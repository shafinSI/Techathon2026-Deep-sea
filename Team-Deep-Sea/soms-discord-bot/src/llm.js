// llm.js — OPTIONAL drop-in LLM rewrite hook.
//
// The brief "strongly encourages" using an LLM to make bot responses
// humanized and friendly instead of robotic data dumps. formatters.js
// already produces friendly, correctly-formatted, deterministic text from
// real backend data with zero external dependencies — that's what runs by
// default so the bot works out of the box with no API key.
//
// If you set ANTHROPIC_API_KEY (and leave USE_LLM_RESPONSES=true, the
// default), bot.js will additionally ask Claude to rephrase that same
// factual template into a looser, more conversational line. The LLM is
// NEVER given permission to invent numbers — it only rewords a string that
// already contains the real figures pulled from the backend, and if the
// call fails or times out for any reason, the caller must fall back to the
// original template untouched. That fallback lives in bot.js, not here, so
// a bad network call can never turn into a broken or hallucinated reply.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const TIMEOUT_MS = 4000;

export function llmEnabled() {
  return Boolean(ANTHROPIC_API_KEY) && process.env.USE_LLM_RESPONSES !== "false";
}

/**
 * Rewrites an already-correct, data-filled template string into a more
 * conversational one. Never fabricates data: the prompt instructs the
 * model to keep every number/word identical and only change tone/phrasing.
 *
 * @param {string} templateText - output of formatters.js (ground truth)
 * @param {string} context - short label, e.g. "office status", "power usage"
 * @returns {Promise<string|null>} rewritten text, or null on any failure
 *          (caller should fall back to templateText)
 */
export async function humanize(templateText, context) {
  if (!llmEnabled()) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system:
          "You rewrite office-monitoring bot messages to sound warmer and more " +
          "conversational for a Discord chat. Rules: keep every number, room " +
          "name, and device name EXACTLY as given — never change, round, or " +
          "invent a figure. Keep it to 1-3 short sentences. Keep any emoji the " +
          "original used, or drop them, your choice. Reply with ONLY the " +
          "rewritten message, no preamble, no quotes.",
        messages: [
          {
            role: "user",
            content: `Context: ${context}\n\nOriginal message:\n${templateText}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.find((b) => b.type === "text")?.text;
    return text ? text.trim() : null;
  } catch {
    // Network error, timeout, malformed response, etc. — the caller falls
    // back to the deterministic template. Never let this throw upward.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
