export function validateAgainstSchema(payload, schema) {
  const errors = [];

  if (schema?.type === "object" && (payload === null || typeof payload !== "object" || Array.isArray(payload))) {
    errors.push("payload must be object");
    return { ok: false, errors };
  }

  for (const key of schema?.required ?? []) {
    if (!(key in payload)) errors.push(`missing required field: ${key}`);
  }

  const properties = schema?.properties ?? {};
  for (const [key, rule] of Object.entries(properties)) {
    if (!(key in payload)) continue;
    const value = payload[key];

    if (Array.isArray(rule.type)) {
      const matches = rule.type.some((t) => matchType(value, t));
      if (!matches) errors.push(`invalid type for ${key}`);
      continue;
    }

    if (rule.type && !matchType(value, rule.type)) {
      errors.push(`invalid type for ${key}`);
      continue;
    }

    if (rule.type === "array" && rule.items?.type === "string") {
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
        errors.push(`invalid array items for ${key}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function matchType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === type;
}
