const MODEL_NAME = "openai/gpt-oss-120b";
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

  const line = JSON.stringify(payload, null, 2);
  if (level === "error") {
    console.error(`[ERROR] ${event}`, line);
    return;
  }
  if (level === "warn") {
    console.warn(`[WARN] ${event}`, line);
    return;
  }
  console.log(`[INFO] ${event}`, line);
}

function buildPrompt(categories) {
  return [
    "You are an expert educator and masterful storyteller building an addictive but highly educational discovery app.",
    "Return valid JSON ONLY. No markdown, no preamble.",
    "Output format: {\"cards\": [ ... ] }.",
    "Generate exactly 5 cards with keys: id, category, text, subtext.",
    "CONTENT RULES:",
    "1. THE HOOK (text): Max 150 characters. A fascinating question, paradox, or counterintuitive fact to grab attention.",
    "2. THE DEEP DIVE (subtext): Max 600 characters. Provide a rich, detailed, and highly educational explanation. Teach the user a profound concept in physics, history, biology, or technology. Make them genuinely smarter,dont repeat the content as you dont have memory so give new content such that old one doesnt repeat",
    "3. THEME: Fascinating scientific phenomena, pivotal historical moments, deep astrophysics, intricate biology, and brilliant engineering.",
    "4. TONE: Engaging, informative, inspiring, and profound.",
    "5. VALUE: Every card must teach a concrete, verifiable concept. The goal is for the user to leave the app significantly more knowledgeable than when they opened it. strictly keep the content out-of-box such that no other content generating app can match and use simple words",
    `6. Map each card to one of these categories: ${categories.join(", ")}`
  ].join("\n");
}

function buildPlainTextPrompt(categories) {
  return [
    "Generate 5 highly educational, fascinating micro-lessons for a discovery app.",
    "No JSON. One lesson per paragraph.",
    "Format: [Intriguing Hook] - [Detailed 600-character explanation teaching a profound concept]",
    "Focus on deep science, pivotal history, and brilliant engineering. Make the user genuinely smarter.",
    `Categories to use: ${categories.join(", ")}`
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

async function callGroq({ apiKey, prompt, asJson }) {
  const promptPreview = prompt.slice(0, 220);
  const response = await fetch(
    `https://api.groq.com/openai/v1/chat/completions`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [{ role: "user", content: prompt }],
        temperature: asJson ? 0.4 : 0.7,
        max_completion_tokens: asJson ? 4000 : 2000,
        ...(asJson ? { response_format: { type: "json_object" } } : {}),
      }),
    },
  );

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    logServer("error", "groq_http_error", {
      status: response.status,
      responsePreview: bodyText.slice(0, 600),
    });
    const error = new Error(`Groq request failed: ${response.status}. Reason: ${bodyText.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    logServer("error", "groq_invalid_json_response", {
      model: MODEL_NAME,
      asJson,
      promptPreview,
      message: error instanceof Error ? error.message : "JSON parse failure",
    });
    throw new Error("Groq returned non-JSON response");
  }

  const text = data?.choices?.[0]?.message?.content || "";
  const finishReason = data?.choices?.[0]?.finish_reason || "UNKNOWN";

  if (!text) {
    logServer("warn", "groq_empty_text", {
      model: MODEL_NAME,
      asJson,
      finishReason,
    });
  }

  return {
    text,
    finishReason,
  };
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

    logServer("warn", "groq_cooldown_active", {
      requestId,
      retryAfterSeconds,
      cooldownReason,
    });

    return Response.json({
      cards: [
        {
          id: `quota-error-${Date.now()}`,
          category: "API Cooling Down",
          text: "Groq API has been paused to prevent rate limit hits.",
          subtext: `Please wait ${retryAfterSeconds} seconds for the cooldown to reset.`,
        }
      ],
      source: "error-quota-cooldown",
      requestId,
      retryAfterSeconds,
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logServer("error", "missing_api_key", { requestId });
    // Explicitly tell the user the API key is missing instead of pretending it's working
    return Response.json({
      cards: [
        {
          id: `missing-key-${Date.now()}`,
          category: "System Error",
          text: "AI Generation is paused because the Groq API Key is missing on Vercel.",
          subtext: "Please go to your Vercel Project Settings -> Environment Variables, add GROQ_API_KEY, and Redeploy.",
        }
      ],
      source: "error-missing-key",
      requestId,
    });
  }

  try {
    const jsonAttempt = await callGroq({
      apiKey,
      prompt: `${buildPrompt(categories)}\n\nRandomness strictly required. Random seed: ${Math.random()}\nOutput JSON object now.`,
      asJson: true,
    });

    let cards = parseCardsFromText(jsonAttempt.text);

    if (!cards || jsonAttempt.finishReason === "length") {
      logServer("warn", "groq_json_attempt_incomplete", {
        requestId,
        finishReason: jsonAttempt.finishReason,
        textPreview: jsonAttempt.text.slice(0, 300),
      });

      const textAttempt = await callGroq({
        apiKey,
        prompt: buildPlainTextPrompt(categories),
        asJson: false,
      });
      cards = parseCardsFromPlainText(textAttempt.text, categories);

      if (!cards || !cards.length) {
        logServer("error", "groq_text_attempt_parse_failed", {
          requestId,
          finishReason: textAttempt.finishReason,
          textPreview: textAttempt.text.slice(0, 500),
        });
      }
    }

    if (!cards || !cards.length) {
      throw new Error("Groq response could not be parsed into cards");
    }

    return Response.json({
      cards: cards.slice(0, 8).map((card, idx) => ({
        // Force a strictly unique ID so React completely rebuilds the UI on new cards
        id: `generated-${Date.now()}-${idx}-${Math.random()}`,
        category: String(card.category || categories[0] || "general"),
        text: String(card.text || "New perspective unlocked."),
        subtext: String(card.subtext || "Use this reel as a short reflective pause."),
      })),
      source: "groq",
      requestId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown generation error";

    const status =
      error && typeof error === "object" && "status" in error
        ? Number(error.status)
        : undefined;

    if (status === 429 || message.includes("429") || message.includes("Rate limit")) {
      cooldownUntil = Date.now() + COOLDOWN_MS;
      cooldownReason = message;

      logServer("warn", "groq_cooldown_started", {
        requestId,
        cooldownMs: COOLDOWN_MS,
        cooldownUntil,
      });

      return Response.json({
        cards: [
          {
            id: `quota-blocked-${Date.now()}`,
            category: "API Error",
            text: "Your Groq API has exhausted its rate limit (429).",
            subtext: "Wait a moment and refresh.",
          }
        ],
        source: "error-quota",
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
      cards: [
        {
          id: `fatal-error-${Date.now()}`,
          category: "System Error",
          text: "The server encountered a fatal error communicating with Groq.",
          subtext: message || "See server logs for details. No simulated fallback available.",
        }
      ],
      source: "error-fatal",
      requestId,
    });
  }
}
