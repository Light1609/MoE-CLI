import path from "node:path";

export const MOA_DIR = ".moa";
export const MOA_CONFIG = path.join(MOA_DIR, "config.json");
export const MOA_IR = path.join(MOA_DIR, "ir.json");
export const MOA_CONTRACTS = path.join(MOA_DIR, "contracts.json");
export const MOA_SCHEMAS_DIR = path.join(MOA_DIR, "schemas");
export const MOA_MEMORY_DIR = path.join(MOA_DIR, "memory");
export const MOA_CACHE_DIR = path.join(MOA_DIR, "cache");
export const MOA_RUNS_DIR = path.join(MOA_DIR, "runs");
