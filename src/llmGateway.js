const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return status === 429 || status === 408 || status === 503 || status >= 500;
}

function extractRetryAfterMs(response) {
  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) return null;

  const retryAfterSeconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(retryAfterSeconds)) {
    return retryAfterSeconds * 1000;
  }

  const retryDate = Date.parse(retryAfter);
  if (Number.isFinite(retryDate)) {
    return Math.max(0, retryDate - Date.now());
  }

  return null;
}

function backoffDelayMs(attempt, baseDelayMs) {
  const jitter = Math.floor(Math.random() * 250);
  return (baseDelayMs * (2 ** attempt)) + jitter;
}

function extractTextFromResponse(payload) {
  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Gemini response did not contain content parts.');
  }

  const text = parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini response content was empty.');
  }

  return text;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (!fenced) throw new Error('Model output was not valid JSON.');
    return JSON.parse(fenced[1]);
  }
}

async function generateWithGemini({
  prompt,
  responseSchema,
  model = 'gemini-1.5-pro',
  thinking_level = 'medium',
  maxRetries = 4,
  baseDelayMs = 750,
  apiKey = process.env.GEMINI_API_KEY,
}) {
  if (!responseSchema) {
    throw new Error('responseSchema is required for Gemini gateway calls.');
  }

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required.');
  }

  if (!prompt || typeof prompt !== 'string') {
    throw new Error('prompt is required and must be a string.');
  }

  const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0,
    },
    systemInstruction: {
      role: 'system',
      parts: [{ text: `Return only valid JSON that conforms exactly to the provided responseSchema. thinking_level=${thinking_level}` }],
    },
  };

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const responseText = await response.text();
        const isRetryable = isRetryableStatus(response.status) || /rate.?limit/i.test(responseText);
        if (!isRetryable || attempt === maxRetries) {
          throw new Error(`Gemini error ${response.status}: ${responseText}`);
        }

        const retryAfterMs = extractRetryAfterMs(response);
        const delay = retryAfterMs ?? backoffDelayMs(attempt, baseDelayMs);
        await sleep(delay);
        continue;
      }

      const payload = await response.json();
      const text = extractTextFromResponse(payload);
      const parsed = parseJson(text);
      return {
        output: parsed,
        rawText: text,
        model,
      };
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        break;
      }
      await sleep(backoffDelayMs(attempt, baseDelayMs));
    }
  }

  throw lastError ?? new Error('Gemini gateway failed after retries.');
}

module.exports = {
  generateWithGemini,
};
