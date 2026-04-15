import { fallbackCards } from "@/data/fallbackCards";

function buildPrompt(categories) {
  return [
    "You create addictive-in-a-good-way curiosity reels for a text-only short feed app.",
    "Return valid JSON only. No markdown.",
    "Return this exact shape: {\"cards\": [ ... ] }.",
    "Create exactly 8 card objects with keys: id, category, text, subtext.",
    "Rules:",
    "- text: max 170 characters and must start with a strong hook",
    "- subtext: max 220 characters and must add one practical takeaway",
    "- Keep claims broadly verifiable and avoid made-up statistics",
    "- Tone is punchy, surprising, and useful",
    "- Avoid repeating self-help advice in every card",
    "- Mix facts, mini-stories, breakthroughs, history twists, and useful trends",
    `- Categories must come from: ${categories.join(", ")}`,
  ].join("\n");
}

function buildPlainTextPrompt(categories) {
  return [
    "Create exactly 8 short curiosity lines for a fast-scroll text reels app.",
    "No JSON. No markdown. One idea per line.",
    "Each line must be 80 to 170 characters and include a hook plus one useful insight.",
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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
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
    throw new Error(`Gemini request failed: ${response.status}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();

  return {
    text,
    finishReason: data?.candidates?.[0]?.finishReason || "UNKNOWN",
  };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const categories = Array.isArray(body?.categories) && body.categories.length
    ? body.categories.slice(0, 5)
    : ["news", "science", "mindset"];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({
      cards: fallbackCards,
      source: "fallback-no-key",
      error: "Missing GEMINI_API_KEY in .env.local or Vercel env settings",
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
      const textAttempt = await callGemini({
        apiKey,
        prompt: buildPlainTextPrompt(categories),
        asJson: false,
      });
      cards = parseCardsFromPlainText(textAttempt.text, categories);
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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown generation error";

    return Response.json({
      cards: fallbackCards,
      source: "fallback-error",
      error: message,
    });
  }
}
