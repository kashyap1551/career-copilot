import { describe, expect, it } from "vitest";
import { cvFixtures } from "@/fixtures/synthetic-cvs";
import { skills } from "@/fixtures/skills";
import { removeContactDetails } from "@/lib/cv/redact";
import { numberLines } from "@/lib/cv/numberLines";
import { parseDuration, runCvEval, waitForTokens, type CvReadOutcome } from "@/lib/engine/evalCvRun";

// Pacing and retries of the CV eval, on a fake reader and a fake sleeper: no
// AI call. Waits worked out by hand: Groq refills limit/60 tokens a second.

const items = cvFixtures.map((c) => ({ id: c.id, lines: numberLines(removeContactDetails(c.text)), key: c.key }));
const empty: CvReadOutcome = { skills: [], removed: [], duplicates: 0, unlisted: [] };

function deps(read: (lines: string[]) => Promise<CvReadOutcome>) {
  const sleeps: number[] = [];
  return {
    sleeps,
    d: { read, sleep: async (ms: number) => void sleeps.push(ms), minGapMs: 3000, backoffsMs: [15000, 45000] },
  };
}
const withLimits = (remaining: string, limit = "8000") => ({
  ...empty,
  usage: { inputTokens: 2500, outputTokens: 2000 },
  limits: { "x-ratelimit-remaining-tokens": remaining, "x-ratelimit-limit-tokens": limit },
});

describe("parseDuration", () => {
  it("D1: seconds, milliseconds, minutes, and a mix", () => {
    expect(parseDuration("6.5s")).toBe(6500);
    expect(parseDuration("250ms")).toBe(250);
    expect(parseDuration("2m")).toBe(120000);
    expect(parseDuration("1m30s")).toBe(90000);
    expect(parseDuration("soon")).toBeNull();
    expect(parseDuration(undefined)).toBeNull();
  });
});

describe("waitForTokens", () => {
  const lim = (remaining: string, limit = "8000") => ({ "x-ratelimit-remaining-tokens": remaining, "x-ratelimit-limit-tokens": limit });
  it("W1: enough left: no wait", () => {
    expect(waitForTokens(lim("7000"), 4500)).toBe(0);
    expect(waitForTokens(lim("4500"), 4500)).toBe(0);
  });
  it("W2: 3,500 left of 8,000 a minute, call of 4,500: 1,000 missing at 133.33 a second is 7.5 s, plus 0.5 s", () => {
    expect(waitForTokens(lim("3500"), 4500)).toBe(8000);
  });
  it("W3: 100 left: 4,400 missing is 33 s, plus 0.5 s", () => {
    expect(waitForTokens(lim("100"), 4500)).toBe(33500);
  });
  it("W4: no limit header: use the reset header, plus 0.5 s; no headers at all: the fallback", () => {
    expect(waitForTokens({ "x-ratelimit-remaining-tokens": "100", "x-ratelimit-reset-tokens": "6.5s" }, 4500)).toBe(7000);
    expect(waitForTokens(undefined, 4500)).toBe(30000);
    expect(waitForTokens({}, 4500, 12345)).toBe(12345);
  });
  it("W5: numbers written with commas are read", () => {
    expect(waitForTokens(lim("3,500", "8,000"), 4500)).toBe(8000);
  });
});

describe("runCvEval", () => {
  it("Q1: five CVs, plenty of tokens left: one call each, 3 s between, none before the first", async () => {
    const { d, sleeps } = deps(async () => withLimits("7500"));
    const run = await runCvEval(items, d, skills);
    expect(run.rows.length).toBe(5);
    expect(run.complete).toBe(true);
    expect(sleeps).toEqual([3000, 3000, 3000, 3000]);
    expect(run.usage).toEqual({ inputTokens: 12500, outputTokens: 10000, calls: 5 });
  });

  it("Q2: 3,500 left after a call of 4,500: each of the 4 gaps waits 8 s (the call size is learned)", async () => {
    const { d, sleeps } = deps(async () => withLimits("3500"));
    await runCvEval(items, d, skills);
    expect(sleeps).toEqual([8000, 8000, 8000, 8000]);
  });

  it("Q3: a 429 waits 15 s then 45 s, then the third try works", async () => {
    let n = 0;
    const { d, sleeps } = deps(async () => {
      if (n++ < 2) throw Object.assign(new Error("busy"), { status: 429 });
      return withLimits("7500");
    });
    const run = await runCvEval(items.slice(0, 1), d, skills);
    expect(sleeps).toEqual([15000, 45000]);
    expect(run.rows.length).toBe(1);
  });

  it("Q4: a 429 that never ends fails that CV with a plain reason and the run is incomplete", async () => {
    const { d } = deps(async () => {
      throw Object.assign(new Error("SECRET CV TEXT"), { status: 429 });
    });
    const run = await runCvEval(items.slice(0, 1), d, skills);
    expect(run.failed).toEqual([{ id: "cv-1-thin", reason: "rate limited, even after every retry" }]);
    expect(run.complete).toBe(false);
  });

  it("Q5: a 5xx is retried once after 20 s; the report keeps the code; the retry's tokens count once", async () => {
    let n = 0;
    const { d, sleeps } = deps(async () => {
      if (n++ === 0) throw Object.assign(new Error("The AI service had a problem (status 500). Please try again."), { status: 502 });
      return withLimits("7500");
    });
    const run = await runCvEval(items.slice(0, 1), d, skills);
    expect(sleeps).toEqual([20000]);
    expect(run.retried).toEqual([{ id: "cv-1-thin", code: 500, recovered: true }]);
    expect(run.usage.calls).toBe(1);
  });

  it("Q6: a second 5xx fails the CV, naming the service's own code, never the message; exactly 2 calls", async () => {
    let calls = 0;
    const { d } = deps(async () => {
      // a runaway guard, so a broken retry rule fails this test instead of looping forever
      if (++calls > 10) throw Object.assign(new Error("runaway"), { status: 400 });
      throw Object.assign(new Error("The AI service had a problem (status 503). SECRET"), { status: 502 });
    });
    const run = await runCvEval(items.slice(0, 1), d, skills);
    expect(calls).toBe(2);
    expect(run.failed).toEqual([{ id: "cv-1-thin", reason: "AI service error (status 503)" }]);
    expect(run.retried).toEqual([{ id: "cv-1-thin", code: 503, recovered: false }]);
  });

  it("Q7: 'not in the expected shape' is not retried", async () => {
    let calls = 0;
    const { d, sleeps } = deps(async () => {
      calls++;
      throw Object.assign(new Error("The AI answered, but not in the expected shape. Please try again."), { status: 502 });
    });
    await runCvEval(items.slice(0, 1), d, skills);
    expect(calls).toBe(1);
    expect(sleeps).toEqual([]);
  });

  it("Q8: a failed CV does not stop the others", async () => {
    let n = 0;
    const { d } = deps(async () => {
      if (n++ === 1) throw new Error("x");
      return withLimits("7500");
    });
    const run = await runCvEval(items, d, skills);
    expect(run.rows.length).toBe(4);
    expect(run.failed.map((f) => f.id)).toEqual(["cv-2-german"]);
  });
});
