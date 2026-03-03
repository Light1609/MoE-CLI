export const configTemplate = {
  schema_version: "1.0.1",
  models: {
    normalize: { model: "gemini-3.1-flash-lite-preview", thinking_level: "low" },
    implement: { model: "gemini-3-flash-preview", thinking_level: "medium" },
    architecture: { model: "gemini-3.1-pro-preview", thinking_level: "high" }
  },
  budgets: {
    max_iterations: 6,
    max_tokens: 250000,
    stagnation_limit: 2
  },
  semantic_cache_threshold: 0.92,
  llm: {
    provider: "gemini",
    api_key_env: "GEMINI_API_KEY",
    enabled: false
  },
  gates: {
    lint: false,
    typecheck: false,
    tests: true,
    build: false
  },
  tool_allowlist: ["node", "npm", "pnpm", "eslint", "tsc", "vitest", "jest"]
};

export const irTemplate = {
  schema_version: "1.0.1",
  project: {
    stack: "node",
    conventions: ["structured_json_outputs", "patch_first"],
    constraints: ["local_first", "deterministic_gates"]
  },
  modules: [],
  flows: [],
  invariants: [
    "all_mutating_actions_require_schema_validation",
    "tool_runner_uses_allowlist"
  ],
  milestones: [
    {
      id: "M0-bootstrap",
      gates: ["schema_ok", "patch_apply_ok", "verify"],
      acceptance: ["cli_commands_available", "reports_are_json"]
    }
  ]
};

export const contractsTemplate = {
  schema_version: "1.0.1",
  invariants: [
    "responses_must_be_json",
    "contract_changes_require_ccr"
  ],
  response_shape: {
    ok: "boolean",
    command: "string",
    runId: "string|null",
    data: "object",
    errors: "array"
  },
  ccr: {
    required_fields: ["type", "id", "reason", "impact", "tests_to_update", "migration_notes"],
    type: "CCR"
  }
};

export const responseSchema = {
  $id: "moa.response.v1",
  type: "object",
  required: ["ok", "command", "runId", "data", "errors"],
  properties: {
    ok: { type: "boolean" },
    command: { type: "string" },
    runId: { type: ["string", "null"] },
    data: { type: "object" },
    errors: { type: "array", items: { type: "string" } }
  }
};

export const patchSchema = {
  $id: "moa.patch.anchorops.v1",
  type: "object",
  required: ["ops"],
  properties: {
    ops: {
      type: "array",
      items: {
        type: "object",
        required: ["kind", "file", "reason", "expected_effect"],
        properties: {
          kind: { type: "string" },
          file: { type: "string" },
          reason: { type: "string" },
          expected_effect: { type: "string" }
        }
      }
    }
  }
};
