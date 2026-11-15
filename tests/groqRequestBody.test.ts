import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGroq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { extractedAdSchema } from "@/lib/schemas/job";
import { GENERATION_SETTINGS } from "@/lib/ai/settings";

// Step 3.3 part 1. Do the settings really reach Groq? The real Groq provider is
// built with a fake fetch (no network, no key, no tokens) and the JSON body it
// would send is captured. readJobAd is the real one; only the model factory is
// swapped for the real provider on a fake fetch.

const bodies: Record<string, unknown>[] = [];
const emptyReading = {
  title: null, company: null, location: null, workMode: null, minYears: null, startDate: null,
  languages: [], otherConditions: [], requirements: [],
};
const fakeFetch = (async (_url: unknown, init?: { body?: unknown }) => {
  bodies.push(JSON.parse(String(init?.body)));
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1,
      model: "openai/gpt-oss-120b",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(emptyReading) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}) as unknown as typeof fetch;

const realProviderModel = () => createGroq({ apiKey: "test-key-not-real", fetch: fakeFetch })("openai/gpt-oss-120b");

vi.mock("@/lib/ai/model", () => ({
  getModel: () => realProviderModel(),
  MissingSettingError: class extends Error {},
}));

import { readJobAd } from "@/lib/ai/readJob";

describe("the request body the Groq provider sends", () => {
  beforeEach(() => {
    bodies.length = 0;
  });

  it("carries temperature 0, the seed and reasoning_effort medium (via readJobAd)", async () => {
    await readJobAd("A job ad text.");
    expect(bodies).toHaveLength(1);
    const b = bodies[0];
    expect(b.temperature).toBe(0);
    // The seed must really be there (a missing one would equal a missing setting).
    expect(Number.isInteger(b.seed)).toBe(true);
    expect(b.seed).toBe(GENERATION_SETTINGS.seed);
    expect(b.reasoning_effort).toBe("medium");
  });

  it("the SDK gives no warnings for these settings", async () => {
    const result = await generateText({
      model: realProviderModel(),
      instructions: "Read the ad.",
      output: Output.object({ schema: extractedAdSchema }),
      ...GENERATION_SETTINGS,
      prompt: "Read this job ad.",
    });
    expect(result.warnings ?? []).toEqual([]);
  });
});
