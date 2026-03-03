const patchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['ops'],
  properties: {
    ops: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['op', 'path'],
        properties: {
          op: { type: 'string', enum: ['add', 'remove', 'replace', 'move', 'copy', 'test'] },
          path: { type: 'string', minLength: 1 },
          from: { type: 'string', minLength: 1 },
          value: {},
        },
      },
    },
  },
};

function validatePatchSchema(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { ok: false, reason: 'Patch must be an object.' };
  }

  if (!Array.isArray(patch.ops) || patch.ops.length === 0) {
    return { ok: false, reason: 'Patch must include a non-empty ops array.' };
  }

  for (let i = 0; i < patch.ops.length; i += 1) {
    const op = patch.ops[i];
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      return { ok: false, reason: `ops[${i}] must be an object.` };
    }

    if (typeof op.op !== 'string' || !['add', 'remove', 'replace', 'move', 'copy', 'test'].includes(op.op)) {
      return { ok: false, reason: `ops[${i}].op is invalid.` };
    }

    if (typeof op.path !== 'string' || op.path.length === 0) {
      return { ok: false, reason: `ops[${i}].path must be a non-empty string.` };
    }

    if ((op.op === 'move' || op.op === 'copy') && (typeof op.from !== 'string' || op.from.length === 0)) {
      return { ok: false, reason: `ops[${i}].from must be provided for ${op.op}.` };
    }

    if ((op.op === 'add' || op.op === 'replace' || op.op === 'test') && !Object.prototype.hasOwnProperty.call(op, 'value')) {
      return { ok: false, reason: `ops[${i}].value must be provided for ${op.op}.` };
    }
  }

  return { ok: true };
}

module.exports = {
  patchSchema,
  validatePatchSchema,
};
