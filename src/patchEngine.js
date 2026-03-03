import fs from "node:fs";

function findAnchorLine(content, anchor) {
  const idx = content.indexOf(anchor);
  return idx;
}

function applyInsertAfter(content, anchor, text) {
  const idx = findAnchorLine(content, anchor);
  if (idx === -1) return { ok: false, error: `anchor_not_found:${anchor}` };
  const insertAt = idx + anchor.length;
  const next = content.slice(0, insertAt) + text + content.slice(insertAt);
  return { ok: true, content: next };
}

function applyReplaceBlock(content, start, end, newText) {
  const s = content.indexOf(start);
  const e = content.indexOf(end);
  if (s === -1 || e === -1 || e < s) return { ok: false, error: "replace_block_anchor_not_found" };
  const next = content.slice(0, s) + newText + content.slice(e + end.length);
  return { ok: true, content: next };
}

function applyDeleteBlock(content, start, end) {
  return applyReplaceBlock(content, start, end, "");
}

function applyReplaceRegex(content, pattern, replacement, flags = "g") {
  const re = new RegExp(pattern, flags);
  const next = content.replace(re, replacement);
  if (next === content) return { ok: false, error: "regex_no_match" };
  return { ok: true, content: next };
}

export function verifyPatchOps(patch) {
  const errors = [];
  if (!patch?.ops || !Array.isArray(patch.ops) || patch.ops.length === 0) {
    errors.push("patch.ops must be a non-empty array");
    return { ok: false, errors };
  }

  for (const [i, op] of patch.ops.entries()) {
    if (!op.file) errors.push(`op[${i}] missing file`);
    if (!op.kind) errors.push(`op[${i}] missing kind`);
    if (!op.reason) errors.push(`op[${i}] missing reason`);
    if (!op.expected_effect) errors.push(`op[${i}] missing expected_effect`);
  }

  return { ok: errors.length === 0, errors };
}

export function applyPatch(patch, { dryRun = true } = {}) {
  const validation = verifyPatchOps(patch);
  if (!validation.ok) return { ok: false, errors: validation.errors, touched: [] };

  const writes = [];
  const touched = [];

  for (const op of patch.ops) {
    if (!fs.existsSync(op.file)) {
      return { ok: false, errors: [`file_not_found:${op.file}`], touched };
    }

    const original = fs.readFileSync(op.file, "utf8");
    let result;

    if (op.kind === "insert_after") {
      result = applyInsertAfter(original, op.anchor, op.text ?? "");
    } else if (op.kind === "replace_block") {
      result = applyReplaceBlock(original, op.anchor_start, op.anchor_end, op.new_text ?? "");
    } else if (op.kind === "delete_block") {
      result = applyDeleteBlock(original, op.anchor_start, op.anchor_end);
    } else if (op.kind === "replace_regex") {
      result = applyReplaceRegex(original, op.pattern, op.replacement ?? "", op.flags ?? "g");
    } else {
      return { ok: false, errors: [`unsupported_op:${op.kind}`], touched };
    }

    if (!result.ok) {
      return { ok: false, errors: [result.error], touched };
    }

    writes.push({ file: op.file, content: result.content });
    touched.push(op.file);
  }

  if (!dryRun) {
    for (const w of writes) fs.writeFileSync(w.file, w.content, "utf8");
  }

  return { ok: true, errors: [], touched };
}
