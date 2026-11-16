import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGroq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";
import { captureRequest, captureRequestBody } from "@/lib/ai/requestBody";
import { INSTRUCTIONS } from "@/lib/ai/readJob";
import { GENERATION_SETTINGS } from "@/lib/ai/settings";
import { extractedAdSchema } from "@/lib/schemas/job";
import { evalFingerprint, requestHash } from "@/lib/engine/evalFingerprint";

// Step 3.3: the fingerprint must cover everything the model is sent, including the
// descriptions inside the JSON schema. No network is used anywhere in this file.

// A made-up schema (not the real one), sent through the real Groq provider on a fake fetch.
async function bodyFor(description: string): Promise<Record<string, unknown>> {
  let sent: Record<string, unknown> = {};
  const fakeFetch = (async (_url: unknown, init?: { body?: unknown }) => {
    sent = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: "x", object: "chat.completion", created: 1, model: "m",
        choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ town: null }) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  await generateText({
    model: createGroq({ apiKey: "test-key-not-real", fetch: fakeFetch })("made-up-model"),
    instructions: "Made-up instructions.",
    output: Output.object({ schema: z.object({ town: z.string().nullable().describe(description) }) }),
    ...GENERATION_SETTINGS,
    prompt: "probe",
  });
  return sent;
}

const ads = [{ id: "ad-x", text: "text", key: {} }];

describe("the fingerprint and a made-up schema", () => {
  it("changing nothing does not change the fingerprint", async () => {
    const a = await bodyFor("The town only.");
    const b = await bodyFor("The town only.");
    expect(evalFingerprint({ request: a, ads, vocabulary: "v" })).toBe(evalFingerprint({ request: b, ads, vocabulary: "v" }));
  });

  it("changing only one description changes the fingerprint", async () => {
    const a = await bodyFor("The town only.");
    const b = await bodyFor("The town only. The same town twice is one town.");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b)); // the model really sees a difference
    expect(evalFingerprint({ request: a, ads, vocabulary: "v" })).not.toBe(evalFingerprint({ request: b, ads, vocabulary: "v" }));
  });
});

describe("captureRequestBody (the real readJobAd on a fake fetch)", () => {
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
    vi.stubEnv("GROQ_API_KEY", "some-other-value");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("holds the instructions, the real schema descriptions, the model and the settings", async () => {
    const body = await captureRequestBody();
    const raw = JSON.stringify(body);
    expect(body.model).toBe("openai/gpt-oss-120b");
    expect(body.temperature).toBe(0);
    expect(Number.isInteger(body.seed)).toBe(true);
    expect(body.reasoning_effort).toBe("medium");
    expect(raw).toContain(JSON.stringify(INSTRUCTIONS).slice(1, 200)); // the start of the instructions
    const locationDescription = extractedAdSchema.shape.location.description as string;
    expect(locationDescription.length).toBeGreaterThan(20);
    expect(raw).toContain(JSON.stringify(locationDescription).slice(1, -1)); // so a changed description changes the request hash
  });

  it("is the same twice, and restores fetch and the key afterwards", async () => {
    const a = await captureRequestBody();
    expect(globalThis.fetch).toBe(realFetch);
    expect(process.env.GROQ_API_KEY).toBe("some-other-value");
    const b = await captureRequestBody();
    expect(requestHash(a)).toBe(requestHash(b));
  });

  it("never uses the real key: a dummy is what the fake fetch sees", async () => {
    const { body, authorization } = await captureRequest();
    expect(authorization).toBe("Bearer fingerprint-probe-not-a-key");
    expect(String(authorization)).not.toContain("some-other-value");
    expect(JSON.stringify(body)).not.toContain("some-other-value");
  });
});
