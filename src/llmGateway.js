import { validateAgainstSchema } from "./schema.js";

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function buildPrompt({ objective, memoryTarget }) {
  return [
    "You are MoA patch generator.",
    "Return ONLY valid JSON matching the provided response schema.",
    "Generate a minimal AnchorOps patch that updates the memory file.",
    `Objective: ${objective}`,
    `Target file: ${memoryTarget}`,
    "Allowed operation kinds: insert_after, replace_block, delete_block, replace_regex",
    "Use insert_after with anchor: \"\"objectives\": []\" and include reason/expected_effect."
  ].join("\n");
}

function extractText(json) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("\n").trim();
}

function safeParseJson(text) {
  const plain = text
    .replace(/^```json\s*/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(plain);
}

export async function generatePatchViaGemini({
  apiKey,
  model,
  thinkingLevel,
  objective,
  memoryTarget,
  patchSchema,
  retries = 2
}) {
  const url = `${API_URL}/${model}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text: buildPrompt({ objective, memoryTarget }) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      responseSchema: patchSchema
    },
    systemInstruction: {
      parts: [{ text: `thinking_level=${thinkingLevel}` }]
    }
  };

  let lastError = "unknown_gateway_error";

  for (let i = 0; i <= retries; i += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const msg = await res.text();
        lastError = `gemini_http_${res.status}:${msg.slice(0, 300)}`;
      } else {
        const json = await res.json();
        const text = extractText(json);
        const parsed = safeParseJson(text);
        const schemaCheck = validateAgainstSchema(parsed, patchSchema);
        if (!schemaCheck.ok) {
          lastError = `gemini_schema_invalid:${schemaCheck.errors.join(";")}`;
        } else {
          return { ok: true, patch: parsed, error: null };
        }
      }
    } catch (error) {
      lastError = `gemini_fetch_error:${error?.message ?? "unknown"}`;
    }

    if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }

  return { ok: false, patch: null, error: lastError };
}
