import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 6.1 part 2, step 2, test S11: /api/read returns one new key, `extraction`: the AI's raw reading exactly as the model
// gave it, BEFORE buildJob's checks. The model is stubbed (generateText): no AI call. Everything else about the answer
// is unchanged. Hand-worked from the rules of buildJob.
//
// The ad is two lines. E is the model's reading: a title that is in the ad, a requirement quote that is in the ad
// ("You know SQL.") and one that is NOT in the ad ("Free pizza on Fridays"). buildJob keeps the first and removes the
// second as { what: "requirement", why: "not-in-ad", text: "Free pizza on Fridays" }. The raw extraction still holds BOTH:
// that is what shows it is the raw reading and not the checked one.

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: vi.fn() };
});

import { generateText } from "ai";
import { POST } from "@/app/api/read/route";
import { readCache } from "@/lib/ai/readCache";
import type { ExtractedAd } from "@/lib/schemas/job";

const AD = "Data Analyst\nYou know SQL.";
const E: ExtractedAd = {
  title: "Data Analyst", company: null, location: null, workMode: null, minYears: null, startDate: null,
  languages: [], otherConditions: [],
  requirements: [
    { quote: "You know SQL.", importance: "must", skills: [{ name: "SQL" }] },
    { quote: "Free pizza on Fridays", importance: "nice", skills: [{ name: "Pizza" }] },
  ],
};
const gen = vi.mocked(generateText);
const post = (body: unknown) => POST(new Request("http://localhost/api/read", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  readCache.clear();
  gen.mockReset();
  gen.mockResolvedValue({ output: E, usage: { inputTokens: 3, outputTokens: 4 }, response: { headers: {} } } as never);
  vi.stubEnv("GROQ_API_KEY", "test-key-not-a-real-key");
  vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
});
afterEach(() => vi.unstubAllEnvs());

describe("S11: the answer carries the raw extraction", () => {
  it("S11a: first request: 200, the old keys plus 'extraction', the extraction equals E (the invented quote still in it), the checked part removed it, miss, one model call", async () => {
    const res = await post({ text: AD });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["extraction", "job", "moved", "notCounted", "removed", "unlisted"]);
    expect(body.extraction).toEqual(E);
    expect(body.removed).toEqual([{ what: "requirement", why: "not-in-ad", text: "Free pizza on Fridays" }]);
    expect(body.job.requirements.map((r: { skillIds: string[] }) => r.skillIds)).toEqual([["sql"]]);
    expect(res.headers.get("x-reading-cache")).toBe("miss");
    expect(gen).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).not.toContain("usage"); // 6.1: extraction added; usage and limits still never leave
  });

  it("S11b: the same request again: hit, still ONE model call in total, and the extraction equals E again", async () => {
    await post({ text: AD });
    const res = await post({ text: AD });
    expect(res.headers.get("x-reading-cache")).toBe("hit");
    expect(gen).toHaveBeenCalledTimes(1);
    expect((await res.json()).extraction).toEqual(E);
  });

  it("S11c: AI_ENABLED=false gives 503, and every non-200 answer has no 'extraction' key", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const paused = await post({ text: AD });
    expect(paused.status).toBe(503);
    expect(await paused.json()).not.toHaveProperty("extraction");
    vi.stubEnv("AI_ENABLED", "true");
    const empty = await post({ text: "   " });
    expect(empty.status).toBe(400);
    expect(await empty.json()).not.toHaveProperty("extraction");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    gen.mockRejectedValueOnce(new Error("the model service failed"));
    const failed = await post({ text: "Another ad text." });
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(await failed.json()).not.toHaveProperty("extraction");
    expect(failed.headers.get("x-reading-cache")).toBeNull();
    spy.mockRestore();
  });
});
