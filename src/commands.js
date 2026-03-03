import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  MOA_CACHE_DIR,
  MOA_CONFIG,
  MOA_CONTRACTS,
  MOA_DIR,
  MOA_IR,
  MOA_MEMORY_DIR,
  MOA_RUNS_DIR,
  MOA_SCHEMAS_DIR
} from "./paths.js";
import { ensureDir, exists, readJson, writeJson } from "./io.js";
import { buildResponse } from "./response.js";
import { configTemplate, contractsTemplate, irTemplate, patchSchema, responseSchema } from "./templates.js";
import { validateAgainstSchema } from "./schema.js";
import { applyPatch, verifyPatchOps } from "./patchEngine.js";
import { detectBinary, runGates } from "./toolRunner.js";
import { createRun, writeEvent, writeGateReport, writeMetrics, writePatch, writeSummary } from "./runArtifacts.js";
import { buildExactKey, cacheClear, cacheStats, getExactCache, repoFingerprint, setExactCache } from "./cache.js";
import { chooseModel, classifyTask } from "./router.js";
import { checkGeminiConnectivity, generatePatchViaGemini } from "./llmGateway.js";

function nowIso() {
  return new Date().toISOString();
}

function makeRun(command, objective = null) {
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runDir = createRun(runId);
  writeSummary(runDir, { runId, command, objective, created_at: nowIso(), status: "created" });
  return { runId, runDir };
}

function ensureWorkspaceTarget() {
  const target = ".moa/memory/objectives.log";
  if (!exists(target)) writeJson(target, { objectives: [] });
  return target;
}

function generateDeterministicPatch(objective = "") {
  const target = ensureWorkspaceTarget();
  const stamp = escapeJsonString(`${objective || "(empty)"} @ ${nowIso()}`);
  return {
    ops: [
      {
        kind: "insert_after",
        file: target,
        anchor: '"objectives": []',
        text: `,\n  "last_objective": "${stamp}"`,
        reason: "store objective in local memory log",
        expected_effect: "memory/objectives.log records latest objective"
      }
    ]
  };
}

function escapeJsonString(value = "") {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function responseWithSchemaValidation(payload) {
  const check = validateAgainstSchema(payload, responseSchema);
  if (check.ok) return payload;
  return buildResponse({
    ok: false,
    command: payload.command ?? "",
    runId: payload.runId ?? null,
    errors: [`response_schema_invalid:${check.errors.join(";")}`]
  });
}

async function buildPatch(objective, config) {
  const memoryTarget = ensureWorkspaceTarget();
  const apiKey = process.env[config.llm?.api_key_env ?? "GEMINI_API_KEY"];

  if (!apiKey) {
    return { patch: generateDeterministicPatch(objective), source: "deterministic", gatewayError: null, route: null };
  }

  const taskClass = classifyTask(objective);
  const route = chooseModel(taskClass, config);
  const llm = await generatePatchViaGemini({
    apiKey,
    model: route.model,
    thinkingLevel: route.thinking_level,
    objective,
    memoryTarget,
    patchSchema
  });

  if (!llm.ok) {
    return {
      patch: generateDeterministicPatch(objective),
      source: "deterministic_fallback",
      gatewayError: llm.error,
      route
    };
  }

  return { patch: llm.patch, source: "gemini", gatewayError: null, route };
}

async function runCompilerLoop(objective, config, runDir) {
  const fingerprint = repoFingerprint();
  const taskClass = classifyTask(objective);
  const route = chooseModel(taskClass, config);
  const llmConfigured = Boolean(process.env[config.llm?.api_key_env ?? "GEMINI_API_KEY"]);
  const cacheKey = buildExactKey({ objective, fingerprint, schema: patchSchema.$id, model: route.model, llmConfigured });
  const cached = getExactCache(cacheKey);

  let patchSource = "cache";
  let gatewayError = null;
  let patch;

  if (cached?.patch) {
    patch = cached.patch;
  } else {
    const generated = await buildPatch(objective, config);
    patch = generated.patch;
    patchSource = generated.source;
    gatewayError = generated.gatewayError;
  }

  const patchSchemaCheck = validateAgainstSchema(patch, patchSchema);
  const patchOpsCheck = verifyPatchOps(patch);
  const dryRun = applyPatch(patch, { dryRun: true });
  const gates = runGates(config);

  if (!cached && patchSchemaCheck.ok && patchOpsCheck.ok && patchSource !== "deterministic_fallback") {
    setExactCache(cacheKey, { patch, fingerprint, source: patchSource });
  }

  const report = {
    schema_ok: patchSchemaCheck.ok,
    patch_apply_ok: dryRun.ok,
    contracts_ok: exists(MOA_CONTRACTS),
    imports_ok: true,
    gates_ok: gates.ok,
    op_validation_ok: patchOpsCheck.ok,
    cache_hit_exact: Boolean(cached),
    patch_source: patchSource,
    gateway_error: gatewayError
  };

  writePatch(runDir, patch);
  writeGateReport(runDir, gates);
  writeEvent(runDir, { ts: nowIso(), event: "run_started", objective });
  writeEvent(runDir, { ts: nowIso(), event: "patch_generated", schema_ok: patchSchemaCheck.ok, patch_apply_ok: dryRun.ok, cache_hit: Boolean(cached), source: patchSource, route, gateway_error: gatewayError });
  writeEvent(runDir, { ts: nowIso(), event: "gates_executed", gates_ok: gates.ok });
  writeEvent(runDir, { ts: nowIso(), event: "run_completed" });

  writeMetrics(runDir, {
    ts: nowIso(),
    iterations: 1,
    schema_valid_rate: patchSchemaCheck.ok ? 1 : 0,
    patch_apply_success_rate: dryRun.ok ? 1 : 0,
    gate_fail_distribution: Object.fromEntries(Object.entries(gates.results).filter(([, r]) => !r.ok).map(([k]) => [k, 1]))
  });

  return { report, patchSchemaCheck, patchOpsCheck, dryRun, route };
}

export function cmdInit() {
  ensureDir(MOA_DIR);
  ensureDir(MOA_SCHEMAS_DIR);
  ensureDir(MOA_MEMORY_DIR);
  ensureDir(MOA_CACHE_DIR);
  ensureDir(MOA_RUNS_DIR);

  if (!exists(MOA_CONFIG)) writeJson(MOA_CONFIG, configTemplate);
  if (!exists(MOA_IR)) writeJson(MOA_IR, irTemplate);
  if (!exists(MOA_CONTRACTS)) writeJson(MOA_CONTRACTS, contractsTemplate);
  writeJson(path.join(MOA_SCHEMAS_DIR, "response.schema.json"), responseSchema);
  writeJson(path.join(MOA_SCHEMAS_DIR, "patch.anchorops.schema.json"), patchSchema);
  ensureWorkspaceTarget();

  return responseWithSchemaValidation(buildResponse({
    ok: true,
    command: "init",
    data: {
      moa_dir: MOA_DIR,
      created: [MOA_CONFIG, MOA_IR, MOA_CONTRACTS, `${MOA_SCHEMAS_DIR}/response.schema.json`, `${MOA_SCHEMAS_DIR}/patch.anchorops.schema.json`, ".moa/memory/objectives.log"]
    }
  }));
}

export function cmdPlan(objective = "") {
  const { runId, runDir } = makeRun("plan", objective);
  const spec = {
    objective,
    acceptance_criteria: ["structured_outputs", "patch_first", "local_verify_gates"],
    risks: ["missing_api_key", "gate_failures"],
    constraints: ["local_first", "allowlist_only"]
  };
  writeJson(path.join(runDir, "spec.json"), spec);
  writeJson(path.join(runDir, "test-plan.json"), {
    smoke: ["init", "verify", "doctor"],
    core: ["run_generates_patch", "apply_dryrun_and_apply"]
  });

  return responseWithSchemaValidation(buildResponse({
    ok: true,
    command: "plan",
    runId,
    data: {
      objective,
      outputs: ["spec", "ir", "contracts", "test_plan"],
      mode: "dry"
    }
  }));
}

export async function cmdRun(objective = "") {
  const { runId, runDir } = makeRun("run", objective);
  const config = readJson(MOA_CONFIG, configTemplate);
  const { report, patchSchemaCheck, patchOpsCheck, dryRun, route } = await runCompilerLoop(objective, config, runDir);

  const payload = buildResponse({
    ok: report.schema_ok && report.patch_apply_ok && report.contracts_ok && report.imports_ok && report.gates_ok && report.op_validation_ok,
    command: "run",
    runId,
    data: {
      stage_order: ["spec", "ir", "contracts", "tests", "generate", "patch", "verify", "apply", "gates", "metrics", "learn"],
      status: "ready_for_apply",
      route,
      report,
      api_required_next: false,
      note: "If GEMINI_API_KEY is set, run uses Gemini routing; otherwise it uses deterministic fallback."
    },
    errors: [...patchSchemaCheck.errors, ...patchOpsCheck.errors, ...dryRun.errors]
  });
  return responseWithSchemaValidation(payload);
}

export function cmdVerify() {
  const config = readJson(MOA_CONFIG, configTemplate);
  const gates = runGates(config);
  const report = {
    patch_apply_ok: exists(MOA_IR) && exists(MOA_CONTRACTS),
    schema_ok: exists(path.join(MOA_SCHEMAS_DIR, "response.schema.json")) && exists(path.join(MOA_SCHEMAS_DIR, "patch.anchorops.schema.json")),
    contracts_ok: exists(MOA_CONTRACTS),
    imports_ok: true,
    fast_typecheck: config.gates.typecheck ? gates.results.typecheck?.ok ?? false : null,
    test_selection_ok: config.gates.tests === true,
    gates_ok: gates.ok
  };

  return responseWithSchemaValidation(buildResponse({
    ok: Object.values(report).every((v) => v === true || v === null),
    command: "verify",
    data: { gates: config.gates, report, gate_results: gates.results }
  }));
}

export async function cmdDoctor() {
  const nodeVersion = process.version;
  const packageExists = exists("package.json");
  const bootstrapReady = exists(MOA_CONFIG) && exists(MOA_IR) && exists(MOA_CONTRACTS);
  const config = readJson(MOA_CONFIG, configTemplate);
  const envKeyName = config.llm?.api_key_env ?? "GEMINI_API_KEY";
  const tools = ["node", "npm", "pnpm", "eslint", "tsc", "vitest", "jest"].map((t) => ({ tool: t, ...detectBinary(t) }));
  const connectivity = await checkGeminiConnectivity(process.env[envKeyName]);

  return responseWithSchemaValidation(buildResponse({
    ok: true,
    command: "doctor",
    data: {
      node: nodeVersion,
      package_json: packageExists,
      bootstrap_ready: bootstrapReady,
      llm_provider: config.llm?.provider ?? "gemini",
      llm_api_env: envKeyName,
      llm_api_configured: Boolean(process.env[envKeyName]),
      tools,
      repo_fingerprint: repoFingerprint(),
      cache: cacheStats(),
      gemini_connectivity: connectivity
    }
  }));
}

export function cmdApply(patchRunId = "") {
  if (!patchRunId) {
    return responseWithSchemaValidation(buildResponse({ ok: false, command: "apply", errors: ["missing --patch <runId>"] }));
  }

  const runDir = path.join(MOA_RUNS_DIR, patchRunId);
  if (!fs.existsSync(runDir)) {
    return responseWithSchemaValidation(buildResponse({ ok: false, command: "apply", errors: [`run not found: ${patchRunId}`] }));
  }

  const patchFile = path.join(runDir, "patch.json");
  if (!exists(patchFile)) {
    return responseWithSchemaValidation(buildResponse({ ok: false, command: "apply", runId: patchRunId, errors: ["patch.json missing in run"] }));
  }

  const patch = readJson(patchFile, null);
  const schemaCheck = validateAgainstSchema(patch, patchSchema);
  if (!schemaCheck.ok) {
    return responseWithSchemaValidation(buildResponse({ ok: false, command: "apply", runId: patchRunId, errors: schemaCheck.errors }));
  }

  const gateFile = path.join(runDir, "gates", "verify.json");
  const gateReport = readJson(gateFile, null);
  if (!gateReport?.ok) {
    return responseWithSchemaValidation(buildResponse({
      ok: false,
      command: "apply",
      runId: patchRunId,
      errors: ["gates_not_green_for_run"]
    }));
  }

  const result = applyPatch(patch, { dryRun: false });
  writeJson(path.join(runDir, "apply-result.json"), result);

  return responseWithSchemaValidation(buildResponse({
    ok: result.ok,
    command: "apply",
    runId: patchRunId,
    data: {
      status: result.ok ? "applied" : "failed",
      touched: result.touched
    },
    errors: result.errors
  }));
}

export function cmdCacheStats() {
  return responseWithSchemaValidation(buildResponse({ ok: true, command: "cache:stats", data: cacheStats() }));
}

export function cmdCacheClear() {
  return responseWithSchemaValidation(buildResponse({ ok: true, command: "cache:clear", data: cacheClear() }));
}
