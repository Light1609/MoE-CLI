export function buildResponse({ ok, command, runId = null, data = {}, errors = [] }) {
  return { ok, command, runId, data, errors };
}

export function printResponse(payload) {
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
}
