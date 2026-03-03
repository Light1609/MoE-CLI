import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

function run(...argv) {
  const out = execFileSync("node", ["src/cli.js", ...argv], { encoding: "utf8" });
  return JSON.parse(out);
}

test("init returns structured success", () => {
  const result = run("init");
  assert.equal(result.ok, true);
  assert.equal(result.command, "init");
  assert.ok(Array.isArray(result.errors));
});

test("doctor reports llm status fields", () => {
  run("init");
  const result = run("doctor");
  assert.equal(result.command, "doctor");
  assert.equal(typeof result.data.llm_enabled, "boolean");
  assert.equal(typeof result.data.llm_api_configured, "boolean");
  assert.equal(typeof result.data.gemini_connectivity, "object");
});

test("run emits a runId and ready_for_apply status", () => {
  run("init");
  const result = run("run", "objetivo", "demo");
  assert.equal(result.command, "run");
  assert.equal(typeof result.runId, "string");
  assert.equal(result.data.status, "ready_for_apply");
});

test("apply requires patch id", () => {
  const result = run("apply");
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("missing --patch")));
});

test("run + apply applies deterministic patch in .moa memory", () => {
  const memoryFile = ".moa/memory/objectives.log";
  run("init");
  const before = fs.readFileSync(memoryFile, "utf8");
  try {
    const runResult = run("run", "objetivo", "apply-test");
    const applyResult = run("apply", "--patch", runResult.runId);
    assert.equal(applyResult.command, "apply");
    assert.equal(applyResult.ok, true);
    const after = fs.readFileSync(memoryFile, "utf8");
    assert.notEqual(before, after);
  } finally {
    fs.writeFileSync(memoryFile, before, "utf8");
  }
});

test("cache commands work", () => {
  run("init");
  const stats = run("cache", "stats");
  assert.equal(stats.ok, true);
  const clear = run("cache", "clear");
  assert.equal(clear.ok, true);
});

test("verify returns gate results object", () => {
  run("init");
  const result = run("verify");
  assert.equal(result.command, "verify");
  assert.equal(typeof result.data.gate_results, "object");
});

test("unknown command returns error", () => {
  const result = run("unknown");
  assert.equal(result.ok, false);
  assert.ok(result.errors.length > 0);
});
