import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function exists(filePath) {
  return fs.existsSync(filePath);
}

export function readJson(filePath, fallback = null) {
  if (!exists(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
