import { beforeEach, describe, expect, it, vi } from "vitest";

// Step 3.3 part 1a, end to end on a fake provider: the real readJobAd and its real
// error mapping, the real AI SDK error classes, the real runner and the real report.
// generateText is a fake, so no network and no tokens.

const generateText = vi.fn();
vi.mock("ai", async (importActual) => {
  const actual = await importActual<typeof import("ai")>();
  return { ...actual, generateText: (...args: unknown[]) => generateText(...args) };
});
vi.mock("@/lib/ai/model", () => ({
  getModel: () => "fake-model",
  MissingSettingError: class extends Error {},
}));

import { APICallError, RetryError } from "ai";
import { skills } from "@/fixtures/skills";
import { ReadAdError, readJobAd } from "@/lib/ai/readJob";
import type { AnswerKey } from "@/lib/engine/answerKey";
import { formatReport } from "@/lib/engine/evalReport";
import { runEval, type EvalAd } from "@/lib/engine/evalRun";

const key: AnswerKey = {
  ad: "ad-01", status: "reviewed", title: null, company: null, location: null, workMode: null, minYears: null,
  startDate: null, languages: [], otherConditions: [], acceptedExtras: [],
  requirements: [{ quote: "SQL needed", importance: "must", skills: ["SQL"] }],
};
const ad: EvalAd = { id: "ad-01", text: "text of ad-01: SQL needed", key, holdout: false, known: false };

const reading = {
  title: null, company: null, location: null, workMode: null, minYears: null, startDate: null,
  languages: [], otherConditions: [],
  requirements: [{ quote: "SQL needed", importance: "must", skills: [{ name: "SQL" }] }],
};
const good = { output: reading, usage: { inputTokens: 100, outputTokens: 50 }, response: { headers: {} } };

// What the SDK throws after its own three attempts fail with a retryable error.
const sdkGaveUp = (statusCode: number) =>
  new RetryError({
    message: "Failed after 3 attempts. Last error: boom",
    reason: "maxRetriesExceeded",
    errors: [new APICallError({ message: "boom", url: "https://example.invalid", requestBodyValues: {}, statusCode })],
  });

function run() {
  const sleeps: number[] = [];
  const deps = {
    read: (text: string) => readJobAd(text),
    sleep: async (ms: number) => void sleeps.push(ms),
    delayMs: 3000,
    backoffsMs: [5000, 15000, 45000],
  };
  return { sleeps, go: () => runEval([ad], deps, skills) };
}

describe("a Groq failure that outlasts the SDK's own retries", () => {
  beforeEach(() => {
    generateText.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("the contract the runner relies on: it reaches the runner as a generic 500, with no Groq code", async () => {
    generateText.mockRejectedValue(sdkGaveUp(500));
    const error = await readJobAd("x").catch((e) => e);
    expect(error).toBeInstanceOf(ReadAdError);
    expect((error as ReadAdError).status).toBe(500);
    expect((error as ReadAdError).message).toMatch(/Something went wrong/);
    // a 429 that outlasts the SDK looks the same (this is why the runner cannot tell them apart):
    generateText.mockRejectedValue(sdkGaveUp(429));
    const error429 = await readJobAd("x").catch((e) => e);
    expect((error429 as ReadAdError).status).toBe(500);
  });

  it("500 then success: retried once after 20 s, the result is kept, the report says so", async () => {
    generateText.mockRejectedValueOnce(sdkGaveUp(500)).mockResolvedValueOnce(good);
    const r = run();
    const result = await r.go();
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(r.sleeps).toEqual([20000]);
    expect(result.scored).toHaveLength(1);
    expect(result.failed).toEqual([]);
    expect(result.retried).toEqual([{ id: "ad-01", code: 500, recovered: true }]);
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50, calls: 1 }); // only the call that worked
    const text = formatReport({ scored: result.scored, failed: result.failed, skipped: result.skipped, retried: result.retried, reveal: false, partial: true });
    expect(text).toContain("ad-01: retried once after status 500 (the retry worked)");
    expect(text).toContain("Ads scored: 1, failed: 0");
  });

  it("500 twice: one retry, then a failed ad, and the report says both", async () => {
    generateText.mockRejectedValue(sdkGaveUp(500));
    const r = run();
    const result = await r.go();
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(r.sleeps).toEqual([20000]);
    expect(result.scored).toEqual([]);
    expect(result.failed).toEqual([{ id: "ad-01", reason: "AI service error (status 500)" }]);
    expect(result.usage.calls).toBe(0);
    const text = formatReport({ scored: result.scored, failed: result.failed, skipped: result.skipped, retried: result.retried, reveal: false, partial: true });
    expect(text).toContain("ad-01: retried once after status 500 (the retry failed too)");
    expect(text).toContain("FAILED: ad-01 (AI service error (status 500))");
  });

  it("a non-retryable AI service error (400) is not retried", async () => {
    generateText.mockRejectedValue(new APICallError({ message: "bad", url: "https://example.invalid", requestBodyValues: {}, statusCode: 400 }));
    const r = run();
    const result = await r.go();
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(r.sleeps).toEqual([]);
    expect(result.retried).toEqual([]);
    expect(result.failed).toHaveLength(1);
  });
});
