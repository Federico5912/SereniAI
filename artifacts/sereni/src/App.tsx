import { FormEvent, useEffect, useMemo, useState } from "react";

type MoodId = "overwhelmed" | "anxious" | "flat" | "hopeful";
type ApiState = "idle" | "ready" | "sending" | "error" | "needs-key";

type Message = {
  role: "assistant" | "user";
  text: string;
};

type ConversationSummary = {
  id: string;
  title: string;
  mood: MoodId;
  updatedAt: string;
  preview: string;
};

type ConversationRecord = {
  id: string;
  sessionId: string;
  mood: MoodId;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

const STORAGE_KEY = "sereniai.chat.v2";
const MOOD_KEY = "sereniai.mood.v2";
const SESSION_KEY = "sereniai.session.v1";
const CONVERSATION_KEY = "sereniai.conversation.v1";

const starterMessage =
  "I'm here with you. Tell me what feels heaviest right now, and we'll take it one layer at a time.";

const moods: Record<
  MoodId,
  {
    title: string;
    description: string;
    score: number;
    label: string;
    note: string;
    tone: string;
  }
> = {
  overwhelmed: {
    title: "Overwhelmed",
    description: "Too many tabs open in your mind and no quiet place to land.",
    score: 34,
    label: "Grounding first",
    note: "Small steps, less pressure, more air.",
    tone: "Let's make the next 10 minutes feel lighter, not perfect.",
  },
  anxious: {
    title: "Anxious",
    description: "Your thoughts are moving fast and your body is still catching up.",
    score: 46,
    label: "Reset your pace",
    note: "Slow the rhythm before solving the whole day.",
    tone: "Naming what feels urgent can lower the volume of it.",
  },
  flat: {
    title: "Flat",
    description: "Low energy, low spark, and not much space for self-kindness.",
    score: 58,
    label: "Gentle activation",
    note: "Think warmth, movement and one reachable win.",
    tone: "We can look for something soft and doable to restart momentum.",
  },
  hopeful: {
    title: "Hopeful",
    description: "Not perfect, but you can feel a little room to move forward.",
    score: 74,
    label: "Protect the progress",
    note: "Keep the calm going with simple routines and boundaries.",
    tone: "This is a good moment to turn insight into a caring plan.",
  },
};

const quickPrompts = [
  "I feel anxious and I can't switch off.",
  "I'm exhausted and everything feels heavy.",
  "Help me sort out what actually matters today.",
];

const resourceCards = [
  {
    tag: "For today",
    title: "Rapid reset plan",
    text: "A 3-minute sequence to breathe deeper, unclench your jaw, and regain a little control before the next task.",
    bullets: ["90-second exhale cycle", "Phone-down reset", "One kind sentence to yourself"],
  },
  {
    tag: "For this week",
    title: "Emotional check-in ritual",
    text: "A repeatable rhythm for noticing how you feel before things become too heavy.",
    bullets: ["Mood naming", "Energy tracking", "Boundary for one draining habit"],
  },
  {
    tag: "When you need backup",
    title: "Professional support guide",
    text: "Clear prompts to help you ask for therapy, counseling, or a trusted adult without overexplaining.",
    bullets: ["Short message template", "What to mention first", "How to ask for urgent help"],
  },
];

function createId() {
  return crypto.randomUUID();
}

function getFunctionsBase() {
  const customBase = import.meta.env.VITE_FUNCTIONS_BASE_URL;

  if (customBase) {
    return customBase.replace(/\/$/, "");
  }

  if (import.meta.env.DEV) {
    return "http://localhost:8888/.netlify/functions";
  }

  return "/.netlify/functions";
}

function getFunctionUrl(name: "chat" | "conversations") {
  return `${getFunctionsBase()}/${name}`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function App() {
  const [selectedMood, setSelectedMood] = useState<MoodId>("anxious");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: starterMessage },
  ]);
  const [conversationId, setConversationId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([]);
  const [apiState, setApiState] = useState<ApiState>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "AI chat becomes live when the Netlify Function has an OpenAI key.",
  );
  const [modelName, setModelName] = useState<string | null>(null);

  useEffect(() => {
    const savedMood = window.localStorage.getItem(MOOD_KEY) as MoodId | null;
    const savedMessages = window.localStorage.getItem(STORAGE_KEY);
    const savedConversationId = window.localStorage.getItem(CONVERSATION_KEY);
    const savedSessionId = window.localStorage.getItem(SESSION_KEY) || createId();

    if (savedMood && moods[savedMood]) {
      setSelectedMood(savedMood);
    }

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    setSessionId(savedSessionId);
    window.localStorage.setItem(SESSION_KEY, savedSessionId);

    if (savedConversationId) {
      setConversationId(savedConversationId);
    } else {
      const nextConversationId = createId();
      setConversationId(nextConversationId);
      window.localStorage.setItem(CONVERSATION_KEY, nextConversationId);
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    void loadConversations(sessionId);
  }, [sessionId]);

  useEffect(() => {
    window.localStorage.setItem(MOOD_KEY, selectedMood);
  }, [selectedMood]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      window.localStorage.setItem(CONVERSATION_KEY, conversationId);
    }
  }, [conversationId]);

  const mood = moods[selectedMood];

  const indicators = useMemo(
    () => [
      { label: "Clarity", value: mood.score },
      { label: "Energy", value: Math.max(mood.score - 8, 20) },
      { label: "Support readiness", value: Math.min(mood.score + 12, 92) },
    ],
    [mood.score],
  );

  const progress = Math.round((mood.score / 100) * 408);

  async function loadConversations(activeSessionId: string) {
    try {
      const response = await fetch(
        `${getFunctionUrl("conversations")}?sessionId=${encodeURIComponent(activeSessionId)}`,
      );

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { conversations?: ConversationSummary[] };
      setConversationList(data.conversations || []);
      setApiState((current) => (current === "idle" ? "ready" : current));
    } catch {
      setStatusMessage(
        "Conversation history is available after deploy or when running with Netlify dev.",
      );
    }
  }

  async function loadConversation(activeConversationId: string) {
    if (!sessionId) {
      return;
    }

    try {
      const response = await fetch(
        `${getFunctionUrl("conversations")}?sessionId=${encodeURIComponent(
          sessionId,
        )}&conversationId=${encodeURIComponent(activeConversationId)}`,
      );

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { conversation?: ConversationRecord };

      if (!data.conversation) {
        return;
      }

      setConversationId(data.conversation.id);
      setSelectedMood(data.conversation.mood);
      setMessages(data.conversation.messages);
      setStatusMessage("Conversation loaded.");
    } catch {
      setStatusMessage("Could not load that conversation.");
    }
  }

  async function deleteConversation(targetConversationId: string) {
    if (!sessionId) {
      return;
    }

    try {
      await fetch(
        `${getFunctionUrl("conversations")}?sessionId=${encodeURIComponent(
          sessionId,
        )}&conversationId=${encodeURIComponent(targetConversationId)}`,
        { method: "DELETE" },
      );

      const nextList = conversationList.filter((item) => item.id !== targetConversationId);
      setConversationList(nextList);

      if (targetConversationId === conversationId) {
        startNewConversation();
      }
    } catch {
      setStatusMessage("Could not delete that conversation.");
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();

    if (!trimmed || apiState === "sending" || !sessionId || !conversationId) {
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, text: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setApiState("sending");
    setStatusMessage("SereniAI is thinking...");

    try {
      const response = await fetch(getFunctionUrl("chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mood: selectedMood,
          messages: nextMessages,
          sessionId,
          conversationId,
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        error?: string;
        code?: string;
        meta?: {
          model?: string | null;
        };
      };

      if (!response.ok || !data.reply) {
        const isMissingKey = data.code === "CONFIG_MISSING";

        setApiState(isMissingKey ? "needs-key" : "error");
        setStatusMessage(
          isMissingKey
            ? "Missing OPENAI_API_KEY in Netlify. Add it and redeploy to enable chat."
            : data.error || "The AI request failed. Try again in a moment.",
        );
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text: isMissingKey
              ? "The AI backend is almost ready, but the OpenAI key still needs to be configured in Netlify."
              : "I hit a connection problem. Try again in a moment, and if it keeps happening check the serverless logs.",
          },
        ]);
        return;
      }

      setMessages((current) => [...current, { role: "assistant", text: data.reply as string }]);
      setApiState("ready");
      setModelName(data.meta?.model || null);
      setStatusMessage(
        data.meta?.model
          ? `Live AI connected with ${data.meta.model}.`
          : "Live AI connected.",
      );
      await loadConversations(sessionId);
    } catch (error) {
      setApiState("error");
      setStatusMessage(
        "Couldn't reach the chat function. Locally, use Netlify dev or deploy the site to test live AI.",
      );
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            error instanceof Error && error.message
              ? `I couldn't reach the AI service: ${error.message}`
              : "I couldn't reach the AI service.",
        },
      ]);
    }
  }

  function startNewConversation() {
    const nextConversationId = createId();
    setConversationId(nextConversationId);
    setMessages([{ role: "assistant", text: starterMessage }]);
    setInput("");
    setApiState("idle");
    setStatusMessage("New conversation ready.");
    setModelName(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="container site-header__row">
          <a className="brand" href="#top" aria-label="SereniAI">
            <span className="brand__mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17.4 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="brand__name">SereniAI</span>
          </a>

          <nav className="nav">
            <a href="#experience">Experience</a>
            <a href="#assessment">Assessment</a>
            <a href="#chat">Support chat</a>
            <a href="#resources">Resources</a>
          </nav>

          <div className="header-actions">
            <a href="#resources">See resources</a>
            <a className="button button--primary" href="#chat">
              Open live chat
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero__grid">
            <div className="hero__copy fade-up">
              <div className="eyebrow">
                <span>Emotional support experience</span>
              </div>
              <h1>
                A calmer interface for <span>hard days</span>.
              </h1>
              <p>
                SereniAI now ships with live OpenAI chat, persistent conversation
                history on Netlify, a lightweight emotional check-in, and a deploy
                path that stays serverless end to end.
              </p>

              <div className="hero__actions">
                <a className="button button--primary" href="#assessment">
                  Start check-in
                </a>
                <a className="button button--ghost" href="#chat">
                  Talk to SereniAI
                </a>
              </div>

              <div className="hero__stats">
                <div className="stat-pill">
                  <strong>Live AI</strong>
                  <span>OpenAI runs through a serverless function.</span>
                </div>
                <div className="stat-pill">
                  <strong>Saved chats</strong>
                  <span>Conversation history persists with Netlify Blobs.</span>
                </div>
                <div className="stat-pill">
                  <strong>Deploy-ready</strong>
                  <span>Static site, functions and storage fit one platform.</span>
                </div>
              </div>
            </div>

            <aside className="hero__panel fade-up delay-1">
              <div className="panel-block">
                <h3>Today's soft prompt</h3>
                <p>
                  What would make the next hour feel 10% more manageable, even
                  if the whole day stays imperfect?
                </p>
              </div>

              <div className="panel-metrics">
                <div className="metric">
                  <strong>History enabled</strong>
                  <span>Return to previous chats from the same browser session</span>
                </div>
                <div className="metric">
                  <strong>{modelName || "gpt-5-mini"}</strong>
                  <span>Default model for gentle, cost-aware support</span>
                </div>
              </div>

              <div className="panel-block">
                <h3>Current recommendation</h3>
                <p>{mood.note}</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="section" id="experience">
          <div className="container">
            <div className="section-heading fade-up">
              <div>
                <h2>Designed to feel safe, not sterile.</h2>
              </div>
              <p>
                The product now behaves like a real wellness experience instead
                of a disconnected mockup: clear tone, live interaction and
                persisted sessions.
              </p>
            </div>

            <div className="feature-grid">
              <article className="section-card fade-up delay-1">
                <div className="section-card__icon">01</div>
                <h3>Warm arrival</h3>
                <p>
                  Hero, tone, spacing and visual system are aligned with a
                  mental wellness product that needs calm confidence.
                </p>
              </article>

              <article className="section-card fade-up delay-2">
                <div className="section-card__icon">02</div>
                <h3>Real interaction</h3>
                <p>
                  The chat calls OpenAI through Netlify Functions so the API key
                  never lives in the browser.
                </p>
              </article>

              <article className="section-card fade-up delay-3">
                <div className="section-card__icon">03</div>
                <h3>Persistent memory</h3>
                <p>
                  Conversations are stored with Netlify Blobs and can be reopened
                  from the history panel.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section" id="assessment">
          <div className="container">
            <div className="section-heading fade-up">
              <div>
                <h2>Quick emotional check-in</h2>
              </div>
              <p>
                Choose the closest mood. SereniAI updates the support posture
                and a simple readiness score instantly, then uses that signal in
                the live chat.
              </p>
            </div>

            <div className="assessment-grid">
              <div className="section-card fade-up delay-1">
                <h3>How does it feel right now?</h3>
                <div className="mood-grid">
                  {(
                    Object.entries(moods) as Array<
                      [MoodId, (typeof moods)[MoodId]]
                    >
                  ).map(([key, value]) => (
                    <button
                      key={key}
                      className={`mood-card ${
                        selectedMood === key ? "mood-card--active" : ""
                      }`}
                      onClick={() => setSelectedMood(key)}
                      type="button"
                    >
                      <strong>{value.title}</strong>
                      <span>{value.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="section-card assessment-score fade-up delay-2">
                <h3>{mood.label}</h3>
                <div className="score-ring" aria-label={`Score ${mood.score}`}>
                  <svg viewBox="0 0 160 160">
                    <circle
                      cx="80"
                      cy="80"
                      r="65"
                      fill="none"
                      stroke="rgba(62, 88, 84, 0.08)"
                      strokeWidth="12"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="65"
                      fill="none"
                      stroke="url(#scoreGradient)"
                      strokeDasharray={`${progress} 999`}
                      strokeLinecap="round"
                      strokeWidth="12"
                    />
                    <defs>
                      <linearGradient
                        id="scoreGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#f0b48e" />
                        <stop offset="100%" stopColor="#5c7c6b" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="score-ring__center">
                    <div>
                      <strong>{mood.score}</strong>
                      <span>support score</span>
                    </div>
                  </div>
                </div>

                <p>{mood.note}</p>

                <div className="assessment-bars">
                  {indicators.map((indicator) => (
                    <div className="assessment-bar" key={indicator.label}>
                      <span>{indicator.label}</span>
                      <div className="assessment-bar__track">
                        <div
                          className="assessment-bar__fill"
                          style={{ width: `${indicator.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="chat">
          <div className="container">
            <div className="section-heading fade-up">
              <div>
                <h2>Support chat</h2>
              </div>
              <p>
                The chat now supports live AI replies plus session history.
                Locally, use Netlify dev if you want functions and storage.
              </p>
            </div>

            <div className="chat-layout">
              <aside className="chat-history fade-up delay-1">
                <div className="chat-history__header">
                  <h3>History</h3>
                  <button className="button button--ghost button--small" onClick={startNewConversation} type="button">
                    New chat
                  </button>
                </div>
                <div className="chat-history__list">
                  {conversationList.length === 0 ? (
                    <p className="chat-history__empty">
                      Your saved chats will appear here after the first successful reply.
                    </p>
                  ) : (
                    conversationList.map((conversation) => (
                      <div
                        className={`chat-history__item ${
                          conversation.id === conversationId ? "chat-history__item--active" : ""
                        }`}
                        key={conversation.id}
                      >
                        <button
                          className="chat-history__open"
                          onClick={() => void loadConversation(conversation.id)}
                          type="button"
                        >
                          <strong>{conversation.title}</strong>
                          <span>{conversation.preview}</span>
                          <small>{formatUpdatedAt(conversation.updatedAt)}</small>
                        </button>
                        <button
                          aria-label="Delete conversation"
                          className="chat-history__delete"
                          onClick={() => void deleteConversation(conversation.id)}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </aside>

              <div className="chat-card fade-up delay-2">
                <div className="chat-card__header">
                  <div>
                    <h3>SereniAI conversation</h3>
                    <p className="chat-status">
                      <strong>Status:</strong> {statusMessage}
                    </p>
                  </div>
                </div>

                <div className="chat-prompt-list">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      className="chat-chip"
                      onClick={() => void sendMessage(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>

                <div className="chat-messages">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`message message--${message.role}`}
                    >
                      {message.text}
                    </div>
                  ))}
                </div>

                <form className="chat-form" onSubmit={handleSubmit}>
                  <input
                    aria-label="Write a message"
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Example: I feel anxious and can't stop thinking."
                    value={input}
                  />
                  <button className="button button--primary" disabled={apiState === "sending"} type="submit">
                    {apiState === "sending" ? "Sending..." : "Send"}
                  </button>
                </form>
              </div>

              <aside className="support-card fade-up delay-3">
                <span className="support-card__tag">Live guidance state</span>
                <h3>{mood.title}</h3>
                <p>{mood.tone}</p>
                <ul>
                  <li>Lead with validation before suggestions.</li>
                  <li>Keep actions small and non-clinical.</li>
                  <li>Escalate clearly if self-harm risk appears.</li>
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section className="section" id="resources">
          <div className="container">
            <div className="section-heading fade-up">
              <div>
                <h2>Resources with real next steps</h2>
              </div>
              <p>
                Instead of dead-end pages, the product now frames what users can
                do immediately, this week, or when they need human support.
              </p>
            </div>

            <div className="resource-grid">
              {resourceCards.map((card, index) => (
                <article
                  className={`resource-card fade-up delay-${Math.min(index + 1, 3)}`}
                  key={card.title}
                >
                  <span className="resource-card__tag">{card.tag}</span>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                  <ul>
                    {card.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container support-grid">
            <article className="support-card fade-up delay-1">
              <span className="support-card__tag">When calm is possible</span>
              <h3>Use SereniAI as a gentle front door</h3>
              <p>
                The interface is built to reduce friction: soft prompts, warm
                hierarchy, and enough interaction to feel like a real product.
              </p>
              <div className="support-actions" style={{ marginTop: 18 }}>
                <a className="button button--primary" href="#top">
                  Back to top
                </a>
                <a className="button" href="#assessment">
                  Run check-in again
                </a>
              </div>
            </article>

            <article className="support-card support-card--alert fade-up delay-2">
              <span className="support-card__tag">Safety note</span>
              <h3>Not a crisis substitute</h3>
              <p>
                If someone is in immediate danger or at risk of self-harm, the
                product should direct them to emergency services or a local
                crisis line without delay.
              </p>
              <ul>
                <li>Prioritize human contact and urgent help.</li>
                <li>Show crisis information early when needed.</li>
                <li>Keep escalation language direct and visible.</li>
              </ul>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-card fade-up">
            <div>
              <h2>Deploy-ready and easier to evolve.</h2>
              <p>
                This version already ships as a real Netlify app with live AI,
                persistent browser-linked history and a serverless storage layer.
              </p>
            </div>
            <div className="footer-meta">
              Build target: <strong>Netlify static site + functions + blobs</strong>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
