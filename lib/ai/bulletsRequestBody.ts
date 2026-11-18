import { writeBullets } from "./writeBullets";

// The JSON body that writeBullets really sends to Groq, captured WITHOUT any network call (the same method as lib/ai/cvRequestBody.ts): the real function and
// the real Groq provider run, fetch is replaced for the moment by a fake that records the body and answers with an empty answer, and the key is a dummy.
// The bullets eval fingerprint will hash it. Nothing is pinned yet (docs/PLAN-8.3.md 0.23).

const PROBE_PAIRS = [{ id: 1, requirement: "Fingerprint probe: this text is never sent anywhere.", line: "Fingerprint probe: this text is never sent anywhere." }];

export async function captureBulletsRequestBody(): Promise<Record<string, unknown>> {
  const realFetch = globalThis.fetch;
  const realKey = process.env.GROQ_API_KEY;
  let sent: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        id: "probe", object: "chat.completion", created: 1, model: "probe",
        choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ bullets: [] }) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  process.env.GROQ_API_KEY = "fingerprint-probe-not-a-key";
  if (!process.env.GROQ_MODEL) process.env.GROQ_MODEL = "probe-model";

  try {
    await writeBullets(PROBE_PAIRS);
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = realKey;
  }
  if (sent === null) throw new Error("The request body could not be captured.");
  return sent;
}
