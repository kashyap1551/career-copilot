import type { KeyCheck } from "./evalEveryCvKey";
import { normalizeText } from "./text";

// The fake model of `npm run eval-check -- --dry` (docs/PLAN-EVERY-CV.md, the check eval). It answers the check's prompt FROM THE OWNER'S KEY of that pair:
// for each requirement the key sentence it belongs to, the key's verdict, and the entry whose CV line is one of the key's lines (the quote is the first
// words of that line). It is a stand-in that is right by construction, so the dry run shows the real chain and the real report layout; it measures
// nothing. Pure code: no AI, no network. The fake fetch answers like Groq does (a chat completion with usage and rate-limit headers).

type Answer = { requirement: number; verdict: "met" | "partly" | "none"; entry: number | null; quote: string | null };

export function answersFromKey(prompt: string, key: KeyCheck, cvLines: string[]): Answer[] {
  const requirements = [...prompt.matchAll(/^R(\d+) "(.*)"$/gm)].map((m) => ({ n: Number(m[1]), text: m[2] }));
  const entries = [...prompt.matchAll(/^E(\d+) \| .* \| "(.*)"$/gm)].map((m) => ({ n: Number(m[1]), text: m[2] }));
  const blocks = key.blocks.filter((b) => b.kind === "R");
  return requirements.map((r): Answer => {
    const block = blocks.find((b) => normalizeText(b.quote).includes(normalizeText(r.text)) || normalizeText(r.text).includes(normalizeText(b.quote)));
    if (!block || block.verdict === "none" || (block.verdict !== "met" && block.verdict !== "partly")) return { requirement: r.n, verdict: "none", entry: null, quote: null };
    for (const line of block.lines ?? []) {
      const text = cvLines[line - 1];
      const entry = text === undefined ? undefined : entries.find((e) => normalizeText(e.text) === normalizeText(text).replace(/"/g, "'") || normalizeText(text).startsWith(normalizeText(e.text)));
      if (entry) return { requirement: r.n, verdict: block.verdict, entry: entry.n, quote: text.split(/\s+/).slice(0, 3).join(" ") };
    }
    return { requirement: r.n, verdict: "none", entry: null, quote: null };
  });
}

// A fetch that answers every request like Groq would, with `answer(promptText)` as the model's answer. No network.
export function cannedGroqFetch(answer: (prompt: string) => Answer[]): typeof fetch {
  return (async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body)) as { messages?: { role: string; content: unknown }[] };
    const user = [...(body.messages ?? [])].reverse().find((m) => m.role === "user");
    const prompt = typeof user?.content === "string" ? user.content : Array.isArray(user?.content) ? (user.content as { text?: string }[]).map((c) => c.text ?? "").join("") : "";
    const promptTokens = 600 + Math.ceil(prompt.length / 4);
    return new Response(
      JSON.stringify({
        id: "dry", object: "chat.completion", created: 1, model: "dry-model",
        choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ answers: answer(prompt) }) }, finish_reason: "stop" }],
        usage: { prompt_tokens: promptTokens, completion_tokens: 900, total_tokens: promptTokens + 900 },
      }),
      { status: 200, headers: { "content-type": "application/json", "x-ratelimit-remaining-tokens": "6000", "x-ratelimit-limit-tokens": "8000" } },
    );
  }) as typeof fetch;
}
