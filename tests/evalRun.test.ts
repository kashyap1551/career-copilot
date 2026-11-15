import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import type { AnswerKey } from "@/lib/engine/answerKey";
import { runEval, twoInARow, type EvalAd } from "@/lib/engine/evalRun";
import type { BuildResult } from "@/lib/engine/fromAd";

// The runner tables (r1 to r7) in docs/PLAN-3.2.md, worked out by hand. The
// reader is a fake, so no AI is called.

const key = (ad: string, status: "draft" | "reviewed" = "reviewed"): AnswerKey => ({
  ad,
  status,
  title: null,
  company: null,
  location: null,
  workMode: null,
  minYears: null,
  startDate: null,
  languages: [],
  otherConditions: [],
  requirements: [{ quote: "SQL needed", importance: "must", skills: ["SQL"] }],
  acceptedExtras: [],
});

const ad = (id: string, status: "draft" | "reviewed" = "reviewed"): EvalAd => ({
  id,
  text: `text of ${id}: SQL needed`,
  key: key(id, status),
  holdout: false,
  known: false,
});

const goodResult: BuildResult = {
  job: {
    id: "x",
    title: "Untitled job",
    company: null,
    source: null,
    constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
    requirements: [{ skillIds: ["sql"], importance: "must", quote: "SQL needed" }],
  },
  removed: [],
  moved: [],
  unlisted: [],
};

const BACKOFFS = [5000, 15000, 45000];
function deps(read: (text: string) => Promise<BuildResult>) {
  const sleeps: number[] = [];
  return {
    sleeps,
    deps: { read, sleep: async (ms: number) => void sleeps.push(ms), delayMs: 3000, backoffsMs: BACKOFFS },
  };
}

describe("runEval", () => {
  it("r1 an ad whose key is a draft is skipped and never read", async () => {
    let reads = 0;
    const d = deps(async () => (reads++, goodResult));
    const run = await runEval([ad("ad-01", "draft"), ad("ad-02")], d.deps, skills);
    expect(reads).toBe(1);
    expect(run.skipped.map((s) => s.id)).toEqual(["ad-01"]);
    expect(run.scored.map((s) => s.ad.id)).toEqual(["ad-02"]);
    expect(run.complete).toBe(false);
  });

  it("r2 two rate limits, then success: waits 5000 then 15000", async () => {
    let calls = 0;
    const d = deps(async () => {
      calls++;
      if (calls <= 2) throw Object.assign(new Error("busy"), { status: 429 });
      return goodResult;
    });
    const run = await runEval([ad("ad-01")], d.deps, skills);
    expect(calls).toBe(3);
    expect(d.sleeps).toEqual([5000, 15000]);
    expect(run.scored).toHaveLength(1);
    expect(run.complete).toBe(true);
  });

  it("r3 a rate limit every time: waits 5000, 15000, 45000, then the ad is failed", async () => {
    const d = deps(async () => {
      throw Object.assign(new Error("busy"), { status: 429 });
    });
    const run = await runEval([ad("ad-01")], d.deps, skills);
    expect(d.sleeps).toEqual([5000, 15000, 45000]);
    expect(run.failed.map((f) => f.id)).toEqual(["ad-01"]);
    expect(run.scored).toEqual([]);
    expect(run.complete).toBe(false);
  });

  it("r4 any other error is not retried", async () => {
    let calls = 0;
    const d = deps(async () => {
      calls++;
      throw Object.assign(new Error("server broke"), { status: 500 });
    });
    const run = await runEval([ad("ad-01")], d.deps, skills);
    expect(calls).toBe(1);
    expect(d.sleeps).toEqual([]);
    expect(run.failed).toHaveLength(1);
  });

  it("r5 three ads: three reads and two delays of 3000, none after the last", async () => {
    let reads = 0;
    const d = deps(async () => (reads++, goodResult));
    const run = await runEval([ad("ad-01"), ad("ad-02"), ad("ad-03")], d.deps, skills);
    expect(reads).toBe(3);
    expect(d.sleeps).toEqual([3000, 3000]);
    expect(run.complete).toBe(true);
  });

  it("a failed ad's reason never contains the ad text", async () => {
    const d = deps(async (text) => {
      throw new Error(`failed on ${text}`);
    });
    const run = await runEval([ad("ad-01")], d.deps, skills);
    expect(run.failed[0].reason).not.toContain("text of ad-01");
  });
});

describe("twoInARow", () => {
  const run = (fingerprint: string, met: boolean, complete = true) => ({ fingerprint, met, complete });

  it("r6 both met, same fingerprint, both complete", () => {
    expect(twoInARow(run("a", true), run("a", true))).toBe(true);
  });

  it("r7 a different fingerprint, a miss, or an incomplete run is not a second in a row", () => {
    expect(twoInARow(run("a", true), run("b", true))).toBe(false);
    expect(twoInARow(run("a", false), run("a", true))).toBe(false);
    expect(twoInARow(run("a", true), run("a", false))).toBe(false);
    expect(twoInARow(run("a", true, false), run("a", true))).toBe(false);
    expect(twoInARow(null, run("a", true))).toBe(false);
  });
});

describe("tokens and rate limits (C6)", () => {
  it("adds up the tokens of every call and keeps the last limits seen", async () => {
    const answers = [
      { ...goodResult, usage: { inputTokens: 100, outputTokens: 50 }, limits: { "x-ratelimit-limit-tokens": "8000" } },
      { ...goodResult, usage: { inputTokens: 200, outputTokens: 70 }, limits: { "x-ratelimit-limit-tokens": "9000" } },
    ];
    let i = 0;
    const d = deps(async () => answers[i++]);
    const run = await runEval([ad("ad-01"), ad("ad-02")], d.deps, skills);
    expect(run.usage).toEqual({ inputTokens: 300, outputTokens: 120, calls: 2 });
    expect(run.limits).toEqual({ "x-ratelimit-limit-tokens": "9000" });
  });

  it("counts a call without usage as a call with no tokens", async () => {
    const d = deps(async () => goodResult);
    const run = await runEval([ad("ad-01")], d.deps, skills);
    expect(run.usage).toEqual({ inputTokens: 0, outputTokens: 0, calls: 1 });
    expect(run.limits).toBeUndefined();
  });
});
