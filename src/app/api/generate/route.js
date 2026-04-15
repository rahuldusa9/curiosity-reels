import { fallbackCards } from "@/data/fallbackCards";

const MODEL_NAME = "gemini-3-flash-preview";
const COOLDOWN_MS = 60 * 1000;

let cooldownUntil = 0;
let cooldownReason = "";

function logServer(level, event, details = {}) {
  const payload = {

    ts: new Date().toISOString(),
    level,
    event,
    ...details,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

function buildPrompt(categories) {
  return [
    "You write mind-blowing, highly fascinating trivia and facts for a fast-paced discovery app.",
    "Return valid JSON only. No markdown.",
    "Return this exact shape: {\"cards\": [ ... ] }.",
    "Create exactly 8 card objects with keys: id, category, text, subtext.",
    "Rules:",
    "- text: max 170 characters. Must start with a jaw-dropping hook or bizarre fact.",
    "- subtext: max 220 characters. Provide the fascinating explanation, origin, or a cool twist.",
    "- Tone is awe-inspiring, mysterious, and captivating.",
    "- NO self-help, NO life advice, NO psychology lessons. Do not sound like a psychologist or coach.",
    "- Focus purely on: unsolved mysteries, space, obscure history, bizarre biology, paradoxes, and epic engineering.",
    "- Keep claims broadly verifiable.",
    `- Categories must come from: ${categories.join(", ")}`,
  ].join("\n");
}

function buildPlainTextPrompt(categories) {
  return [
    "Create exactly 8 mind-blowing trivia facts for a fast-scroll discovery app.",
    "No JSON. No markdown. One idea per line.",
    "Each line must be 80 to 170 characters, starting with a crazy hook and ending with a cool explanation.",
    "NO self-help or psychology advice. Just pure, unadulterated fascinating facts (history, space, nature, etc.).",
    `Use only these categories in rotation: ${categories.join(", ")}`,
  ].join("\n");
}

function extractCards(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value.cards)) return value.cards;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.reels)) return value.reels;

  return null;
}

function parseJsonMaybeTwice(input) {
  const first = JSON.parse(input);

  if (typeof first === "string") {
    try {
      return JSON.parse(first);
    } catch {
      return first;
    }
  }

  return first;
}

function parseCardsFromPlainText(rawText, categories) {
  if (!rawText) return null;

  const normalized = rawText
    .replace(/\r/g, "\n")
    .replace(/[•*-]\s+/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("{") && !line.startsWith("[") && !line.startsWith("}"))
    .filter((line) => line.length > 18);

  if (!lines.length) return null;

  const cards = lines.slice(0, 8).map((line, idx) => {
    const text = line.replace(/^\d+[.)-]?\s*/, "").trim();
    const category = categories[idx % categories.length] || "general";

    return {
      id: `plain-${Date.now()}-${idx}`,
      category,
      text: text.slice(0, 170),
      subtext: "Generated from model output. Tap refresh for a new set.",
    };
  });

  return cards.length ? cards : null;
}

function parseCardsFromText(rawText) {
  if (!rawText) return null;

  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    const direct = parseJsonMaybeTwice(cleaned);
    return extractCards(direct);
  } catch {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const sliced = cleaned.slice(start, end + 1);
        const parsed = parseJsonMaybeTwice(sliced);
        return extractCards(parsed);
      } catch {
        // Keep trying object extraction below.
      }
    }

    try {
      const objStart = cleaned.indexOf("{");
      const objEnd = cleaned.lastIndexOf("}");
      if (objStart === -1 || objEnd === -1 || objEnd <= objStart) return null;

      const objectSlice = cleaned.slice(objStart, objEnd + 1);
      const objectParsed = parseJsonMaybeTwice(objectSlice);
      return extractCards(objectParsed);
    } catch {
      return null;
    }
  }
}

async function callGemini({ apiKey, prompt, asJson }) {
  const promptPreview = prompt.slice(0, 220);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: asJson ? 0.3 : 0.7,
          maxOutputTokens: asJson ? 2600 : 1400,
          thinkingConfig: {
            thinkingBudget: 0,
          },
          ...(asJson
            ? {
                responseMimeType: "application/json",
                responseSchema: {
                  type: "object",
                  properties: {
                    cards: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          category: { type: "string" },
                          text: { type: "string" },
                          subtext: { type: "string" },
                        },
                        required: ["category", "text", "subtext"],
                      },
                    },
                  },
                  required: ["cards"],
                },
              }
            : {}),
        },
      }),
    },
  );

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    logServer("error", "gemini_http_error", {
      model: MODEL_NAME,
      asJson,
      status: response.status,
      statusText: response.statusText,
      promptPreview,
      responsePreview: bodyText.slice(0, 600),
    });
    const error = new Error(`Gemini request failed: ${response.status}`);
    error.status = response.status;
    error.responsePreview = bodyText.slice(0, 600);
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    logServer("error", "gemini_invalid_json_response", {
      model: MODEL_NAME,
      asJson,
      promptPreview,
      message: error instanceof Error ? error.message : "JSON parse failure",
    });
    throw new Error("Gemini returned non-JSON response");
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();

  if (!text) {
    logServer("warn", "gemini_empty_text", {
      model: MODEL_NAME,
      asJson,
      finishReason: data?.candidates?.[0]?.finishReason || "UNKNOWN",
    });
  }

  return {
    text,
    finishReason: data?.candidates?.[0]?.finishReason || "UNKNOWN",
  };
}

function getSimulatedCards(categories) {
  // Shuffle and pick 8 fallback cards
  const shuffled = [...fallbackCards].sort(() => 0.5 - Math.random()).slice(0, 8);
  return shuffled.map((c, i) => ({
    ...c,
    id: `simulated-${Date.now()}-${i}`,
    category: categories[i % categories.length] || "mindset",
  }));
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 30; // Attempt to increase vercel execution time if needed

export async function POST(request) {
  const requestId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `req-${Date.now()}`;

  const body = await request.json().catch(() => ({}));
  const categories = Array.isArray(body?.categories) && body.categories.length
    ? body.categories.slice(0, 5)
    : ["news", "science", "mindset"];

  if (Date.now() < cooldownUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));

    logServer("warn", "gemini_cooldown_active", {
      requestId,
      retryAfterSeconds,
      cooldownReason,
    });

    return Response.json({
      cards: getSimulatedCards(categories),
      source: "simulated-offline",
      requestId,
      retryAfterSeconds,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // If NO API key, simulate offline immediately
    return Response.json({
      cards: getSimulatedCards(categories),
      source: "simulated-offline",
      requestId,
    });
  }

  try {
    const jsonAttempt = await callGemini({
      apiKey,
      prompt: `${buildPrompt(categories)}\n\nOutput JSON object now.`,
      asJson: true,
    });

    let cards = parseCardsFromText(jsonAttempt.text);

    if (!cards || jsonAttempt.finishReason === "MAX_TOKENS") {
      logServer("warn", "gemini_json_attempt_incomplete", {
        requestId,
        finishReason: jsonAttempt.finishReason,
        textPreview: jsonAttempt.text.slice(0, 300),
      });

      const textAttempt = await callGemini({
        apiKey,
        prompt: buildPlainTextPrompt(categories),
        asJson: false,
      });
      cards = parseCardsFromPlainText(textAttempt.text, categories);

      if (!cards || !cards.length) {
        logServer("error", "gemini_text_attempt_parse_failed", {
          requestId,
          finishReason: textAttempt.finishReason,
          textPreview: textAttempt.text.slice(0, 500),
        });
      }
    }

    if (!cards || !cards.length) {
      throw new Error("Gemini response could not be parsed into cards");
    }

    return Response.json({
      cards: cards.slice(0, 8).map((card, idx) => ({
        id: card.id || `generated-${Date.now()}-${idx}`,
        category: String(card.category || categories[0] || "general"),
        text: String(card.text || "New perspective unlocked."),
        subtext: String(card.subtext || "Use this reel as a short reflective pause."),
      })),
      source: "gemini",
      requestId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown generation error";

    const status =
      error && typeof error === "object" && "status" in error
        ? Number(error.status)
        : undefined;

    if (status === 429 || message.includes("429")) {
      cooldownUntil = Date.now() + COOLDOWN_MS;
      cooldownReason = message;

      logServer("warn", "gemini_cooldown_started", {
        requestId,
        cooldownMs: COOLDOWN_MS,
        cooldownUntil,
      });

      // Instead of returning an error, fallback smoothly to dynamic simulated cards
      return Response.json({
        cards: getSimulatedCards(categories),
        source: "simulated-offline",
        requestId,
      });
    }

    logServer("error", "feed_generation_failed", {
      requestId,
      message,
      categories,
      model: MODEL_NAME,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return Response.json({
      cards: getSimulatedCards(categories),
      source: "simulated-offline",
      requestId,
    });
  }
}
