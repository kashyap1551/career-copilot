import { readJobAd } from "./readJob";

// The JSON body that readJobAd really sends to Groq, captured WITHOUT any
// network call: the real readJobAd and the real Groq provider run, but fetch is
// replaced for the moment by a fake that records the body and answers with an
// empty reading, and the key is replaced by a dummy (so even a failure of the
// fake could not make a billable call). The body holds everything the model
// sees: the instructions, the JSON schema with its descriptions, the model name
// and the settings. The eval fingerprint hashes it, so anything that changes the
// request changes the fingerprint.

const PROBE_AD = "Fingerprint probe: this text is never sent anywhere.";

const EMPTY_READING = {
  title: null, company: null, location: null, workMode: null, minYears: null, startDate: null,
  languages: [], otherConditions: [], requirements: [],
};

export type CapturedRequest = { body: Record<string, unknown>; authorization: string | null };

export async function captureRequest(): Promise<CapturedRequest> {
  const realFetch = globalThis.fetch;
  const realKey = process.env.GROQ_API_KEY;
  let sent: Record<string, unknown> | null = null;
  let authorization: string | null = null;

  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown; headers?: unknown }) => {
    sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const h = new Headers(init?.headers as HeadersInit | undefined);
    authorization = h.get("authorization");
    return new Response(
      JSON.stringify({
        id: "probe", object: "chat.completion", created: 1, model: "probe",
        choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(EMPTY_READING) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  process.env.GROQ_API_KEY = "fingerprint-probe-not-a-key";

  try {
    await readJobAd(PROBE_AD);
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = realKey;
  }
  if (sent === null) throw new Error("The request body could not be captured.");
  return { body: sent, authorization };
}

export async function captureRequestBody(): Promise<Record<string, unknown>> {
  return (await captureRequest()).body;
}
