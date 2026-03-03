import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ensureDir, readJson, writeJson } from "./io.js";
import { MOA_CACHE_DIR } from "./paths.js";

const EXACT_CACHE_FILE = path.join(MOA_CACHE_DIR, "exact-cache.json");

export function repoFingerprint() {
  const candidates = ["package.json", ".moa/config.json", ".moa/ir.json", ".moa/contracts.json"];
  const hash = crypto.createHash("sha256");
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    hash.update(file);
    hash.update(fs.readFileSync(file, "utf8"));
  }
  return hash.digest("hex").slice(0, 16);
}

export function buildExactKey(input) {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function getExactCache(key) {
  const db = readJson(EXACT_CACHE_FILE, {});
  return db[key] ?? null;
}

export function setExactCache(key, value) {
  ensureDir(MOA_CACHE_DIR);
  const db = readJson(EXACT_CACHE_FILE, {});
  db[key] = { ...value, ts: new Date().toISOString() };
  writeJson(EXACT_CACHE_FILE, db);
}

export function cacheStats() {
  const db = readJson(EXACT_CACHE_FILE, {});
  return {
    entries: Object.keys(db).length,
    file: EXACT_CACHE_FILE
  };
}

export function cacheClear() {
  ensureDir(MOA_CACHE_DIR);
  writeJson(EXACT_CACHE_FILE, {});
  return { cleared: true };
}
