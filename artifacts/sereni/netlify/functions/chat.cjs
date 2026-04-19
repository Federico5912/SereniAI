const { connectLambda, getStore } = require("@netlify/blobs");

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";
const STORE_NAME = "sereniai-conversations";

const crisisPatterns = [
  /suicide/i,
  /kill myself/i,
  /self[-\s]?harm/i,
  /hurt myself/i,
  /end my life/i,
  /hacerme daño/i,
  /quitarme la vida/i,
  /lastimarme/i,
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function getTextFromResponse(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const message = Array.isArray(data.output)
    ? data.output.find((item) => item?.type === "message")
    : null;

  const chunks = Array.isArray(message?.content)
    ? message.content
        .map((item) => {
          if (item?.type === "output_text" && typeof item.text === "string") {
            return item.text;
          }

          if (item?.type === "refusal" && typeof item.refusal === "string") {
            return item.refusal;
          }

          return "";
        })
        .filter(Boolean)
    : [];

  return chunks.join("\n").trim();
}

function createTitle(messages) {
  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage?.text) {
    return "New conversation";
  }

  return firstUserMessage.text.trim().slice(0, 56) || "New conversation";
}

function buildKey(sessionId, conversationId) {
  return `${sessionId}/${conversationId}.json`;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(500, {
      error: "Missing OPENAI_API_KEY environment variable.",
      code: "CONFIG_MISSING",
    });
  }

  try {
    connectLambda(event);

    const payload = JSON.parse(event.body || "{}");
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const mood = typeof payload.mood === "string" ? payload.mood : "anxious";
    const conversationId =
      typeof payload.conversationId === "string" ? payload.conversationId : "";
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";

    if (!conversationId || !sessionId) {
      return json(400, {
        error: "sessionId and conversationId are required.",
      });
    }

    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message?.role === "user" && typeof message.text === "string");

    if (!latestUserMessage?.text?.trim()) {
      return json(400, { error: "A user message is required." });
    }

    let reply = "";
    let source = "openai";

    if (crisisPatterns.some((pattern) => pattern.test(latestUserMessage.text))) {
      reply =
        "I’m really glad you said that out loud. If you may hurt yourself or are in immediate danger, contact emergency services or a local crisis line right now and stay near another person if you can. If you want, send one short message to someone you trust: 'I need support right now and I should not be alone.'";
      source = "safety-fallback";
    } else {
      const conversation = messages
        .filter(
          (message) =>
            (message?.role === "user" || message?.role === "assistant") &&
            typeof message.text === "string" &&
            message.text.trim(),
        )
        .slice(-10)
        .map((message) => ({
          role: message.role,
          content: [{ type: "input_text", text: message.text.trim() }],
        }));

      const instructions = [
        "You are SereniAI, a warm emotional support assistant for non-clinical support.",
        "Use a calm, validating tone. Keep responses practical, grounded, and under 140 words.",
        "Do not claim to be a therapist, diagnose, or give medical advice.",
        "If the user sounds unsafe, encourage immediate human help clearly and directly.",
        `Current emotional check-in mood: ${mood}. Adapt tone and suggestions to that mood.`,
        "Prefer one or two concrete next steps over long lists.",
      ].join(" ");

      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          input: conversation,
          instructions,
          max_output_tokens: 220,
          text: {
            format: {
              type: "text",
            },
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const message =
          data?.error?.message || "OpenAI request failed. Check logs and API configuration.";

        return json(response.status, {
          error: message,
          code: "OPENAI_ERROR",
        });
      }

      reply = getTextFromResponse(data);

      if (!reply) {
        return json(502, {
          error: "The model returned an empty response.",
          code: "EMPTY_RESPONSE",
        });
      }
    }

    const store = getStore(STORE_NAME);
    const fullConversation = [...messages, { role: "assistant", text: reply }];
    const updatedAt = new Date().toISOString();
    const record = {
      id: conversationId,
      sessionId,
      mood,
      title: createTitle(fullConversation),
      updatedAt,
      createdAt: payload.createdAt || updatedAt,
      messages: fullConversation,
    };

    await store.setJSON(buildKey(sessionId, conversationId), record);

    return json(200, {
      reply,
      conversation: {
        id: record.id,
        title: record.title,
        updatedAt: record.updatedAt,
        mood: record.mood,
      },
      meta: {
        source,
        model: source === "openai" ? DEFAULT_MODEL : null,
      },
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unexpected server error.",
      code: "SERVER_ERROR",
    });
  }
};
