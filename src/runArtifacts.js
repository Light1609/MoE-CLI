import fs from "node:fs";
import path from "node:path";
import { ensureDir, writeJson } from "./io.js";
import { MOA_RUNS_DIR } from "./paths.js";

export function createRun(runId) {
  const runDir = path.join(MOA_RUNS_DIR, runId);
  ensureDir(runDir);
  ensureDir(path.join(runDir, "gates"));
  return runDir;
}

export function appendJsonl(runDir, fileName, record) {
  const file = path.join(runDir, fileName);
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, "utf8");
}

export function writeEvent(runDir, event) {
  appendJsonl(runDir, "events.jsonl", event);
}

export function writeMetrics(runDir, metrics) {
  appendJsonl(runDir, "metrics.jsonl", metrics);
}

export function writePatch(runDir, patch) {
  writeJson(path.join(runDir, "patch.json"), patch);
}

export function writeSummary(runDir, summary) {
  writeJson(path.join(runDir, "summary.json"), summary);
}

export function writeGateReport(runDir, report) {
  writeJson(path.join(runDir, "gates", "verify.json"), report);
}
