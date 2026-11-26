import { describe, expect, it } from "vitest";
import { callEstimate, flaggedCalls, OVER_TOKENS, readAllPairs, type AdOutcome, type CvOutcome, type PairInput } from "@/lib/engine/evalEveryCvRun";

// EC-8c part 3.2 (docs/PLAN-EVERY-CV.md, EC-8): the estimate of a CV read counts the answer at 100 tokens a CV line, never less than 3,000 (the baseline
// measured up to about 98 output tokens a line, and the pair-08 CV of 96 lines failed). The 7,800 cap stays. Hand-worked, invented sizes:
//   21 lines of 1,400 characters in all: input ceil((1,496 + 1,000 + 1,400) / 4) = ceil(974.0) = 974; answer max(3,000, 2,100) = 3,000; 3,974.
//   31 lines, no text: input ceil(2,496 / 4) = 624; answer max(3,000, 3,100) = 3,100; 3,724.
//   96 lines of 100 characters (9,600): input ceil((1,496 + 1,000 + 9,600) / 4) = 3,024; answer 9,600; 12,624, cut to the cap 7,800: over 7,000.

const CV = (lines: number, textChars: number) => callEstimate("cv", { instructionsLength: 1496, textChars, lines });

describe("EC-8c 3.2 the CV-read estimate (EE)", () => {
  it("EE1: 21 lines: the answer is 3,000 (the minimum, since 21 x 100 = 2,100), so the estimate is 974 + 3,000 = 3,974, and it is not flagged", () => {
    expect(CV(21, 1400)).toBe(3974);
    expect(CV(21, 1400)).toBeLessThanOrEqual(OVER_TOKENS);
  });

  it("EE2: 30 lines still gives the 3,000 minimum; 31 lines gives 3,100 (the 100 a line takes over): 624 + 3,100 = 3,724", () => {
    expect(CV(30, 0)).toBe(Math.ceil(2496 / 4) + 3000); // 3,624
    expect(CV(31, 0)).toBe(3724);
  });

  it("EE3: 96 lines of 100 characters: 3,024 + 9,600 = 12,624, cut to the cap of 7,800, so it is over 7,000 (flagged)", () => {
    expect(OVER_TOKENS).toBe(7000);
    expect(CV(96, 9600)).toBe(7800);
    expect(CV(96, 9600)).toBeGreaterThan(OVER_TOKENS);
  });

  it("EE4: without a line count the estimate is what it was (6,374 for 11,000 characters), and an ad's estimate is unchanged (3,962)", () => {
    expect(callEstimate("cv", { instructionsLength: 1496, textChars: 11_000 })).toBe(6374);
    expect(callEstimate("ad", { instructionsLength: 3347, textChars: 1000 })).toBe(3962);
  });

  it("EE5: flaggedCalls lists the CV reads estimated over 7,000 before any call: only the 96-line CV of three pairs, with its estimate", () => {
    const lines = (n: number, chars: number) => Array.from({ length: n }, () => "a".repeat(chars));
    const pairs: PairInput[] = [
      { id: "pair-a", cvLines: lines(21, 66), adText: "x".repeat(1000) },
      { id: "pair-b", cvLines: lines(96, 100), adText: "x".repeat(1000) },
      { id: "pair-c", cvLines: lines(40, 50), adText: "x".repeat(1000) },
    ];
    expect(flaggedCalls(pairs, 1496, 3347)).toEqual([{ pair: "pair-b", kind: "cv", estimate: 7800 }]);
  });

  it("EE6: the runner waits for what the 96-line read needs: 6,000 of 8,000 tokens left and a 7,800 estimate: 1,800 missing at 8,000 a minute = 13,500 ms + 500 = 14,000 ms (the old estimate, 6,024, would have waited only the 3,000 ms gap)", async () => {
    const limits = { "x-ratelimit-remaining-tokens": "6000", "x-ratelimit-limit-tokens": "8000" };
    const cv = { skills: [], removed: [], duplicates: 0, unlisted: [], usage: { inputTokens: 1, outputTokens: 1 }, limits } as unknown as CvOutcome;
    const ad = { job: {}, removed: [], moved: [], unlisted: [], notCounted: [], usage: { inputTokens: 1, outputTokens: 1 }, limits } as unknown as AdOutcome;
    const sleeps: number[] = [];
    const lines = (n: number, chars: number) => Array.from({ length: n }, () => "a".repeat(chars));
    const pairs: PairInput[] = [
      { id: "pair-a", cvLines: lines(21, 66), adText: "x".repeat(1000) },
      { id: "pair-b", cvLines: lines(96, 100), adText: "x".repeat(1000) },
    ];
    await readAllPairs(pairs, {
      readCv: async () => cv, readAd: async () => ad, sleep: async (ms) => void sleeps.push(ms), minGapMs: 3000,
      cvInstructionsLength: 1496, adInstructionsLength: 3347, onRead: () => {},
    });
    // calls: a-cv (first: no wait), a-ad (3,000), b-cv (14,000), b-ad (3,000)
    expect(sleeps).toEqual([3000, 14000, 3000]);
  });
});
