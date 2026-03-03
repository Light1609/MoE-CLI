const fs = require('node:fs/promises');
const path = require('node:path');

const { generateWithGemini } = require('./llmGateway');
const { patchSchema, validatePatchSchema } = require('./templates');

async function verifyPatchOps(patch) {
  return patch;
}

async function applyPatch(patch) {
  return patch;
}

async function appendRunEvent(runId, event) {
  const runDir = path.join('.moa', 'runs', runId);
  const eventsFile = path.join(runDir, 'events.jsonl');
  await fs.mkdir(runDir, { recursive: true });
  const record = {
    ts: new Date().toISOString(),
    ...event,
  };
  await fs.appendFile(eventsFile, `${JSON.stringify(record)}\n`, 'utf8');
}

async function cmdRun({ runId, prompt, model, thinking_level = 'medium' }) {
  if (!runId) {
    throw new Error('runId is required.');
  }

  const { output: patch } = await generateWithGemini({
    prompt,
    model,
    thinking_level,
    responseSchema: patchSchema,
  });

  const schemaValidation = validatePatchSchema(patch);
  if (!schemaValidation.ok) {
    await appendRunEvent(runId, {
      type: 'patch_schema_validation_failed',
      schema_ok: false,
      reason: schemaValidation.reason,
    });

    const error = new Error(`Patch schema validation failed: ${schemaValidation.reason}`);
    error.schema_ok = false;
    throw error;
  }

  await verifyPatchOps(patch);
  await applyPatch(patch);

  await appendRunEvent(runId, {
    type: 'patch_applied',
    schema_ok: true,
  });

  return patch;
}

module.exports = {
  cmdRun,
  verifyPatchOps,
  applyPatch,
};
