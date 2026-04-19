const { connectLambda, getStore } = require("@netlify/blobs");

const STORE_NAME = "sereniai-conversations";

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

function buildKey(sessionId, conversationId) {
  return `${sessionId}/${conversationId}.json`;
}

exports.handler = async function handler(event) {
  const sessionId = event.queryStringParameters?.sessionId;
  const conversationId = event.queryStringParameters?.conversationId;

  if (!sessionId) {
    return json(400, { error: "sessionId is required." });
  }

  try {
    connectLambda(event);
    const store = getStore(STORE_NAME);

    if (event.httpMethod === "GET") {
      if (conversationId) {
        const conversation = await store.get(buildKey(sessionId, conversationId), {
          type: "json",
        });

        if (!conversation) {
          return json(404, { error: "Conversation not found." });
        }

        return json(200, { conversation });
      }

      const { blobs } = await store.list({
        prefix: `${sessionId}/`,
      });

      const conversations = await Promise.all(
        blobs.map(async (blob) =>
          store.get(blob.key, {
            type: "json",
          }),
        ),
      );

      const items = conversations
        .filter(Boolean)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          mood: conversation.mood,
          updatedAt: conversation.updatedAt,
          preview:
            conversation.messages?.find((message) => message.role === "user")?.text?.slice(0, 90) ||
            "No messages yet.",
        }));

      return json(200, { conversations: items });
    }

    if (event.httpMethod === "DELETE") {
      if (!conversationId) {
        return json(400, { error: "conversationId is required." });
      }

      await store.delete(buildKey(sessionId, conversationId));
      return json(200, { ok: true });
    }

    return json(405, { error: "Method not allowed." });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unexpected server error.",
    });
  }
};
