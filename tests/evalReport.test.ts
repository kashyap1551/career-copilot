import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import type { AnswerKey } from "@/lib/engine/answerKey";
import { formatReport } from "@/lib/engine/evalReport";
import type { EvalAd } from "@/lib/engine/evalRun";
import { scoreAd } from "@/lib/engine/evalScore";
import type { BuildResult } from "@/lib/engine/fromAd";

// Tables h1 to h3 and the report layout in docs/PLAN-3.2.md. The holdout
// quotes below are a sentinel: they must never appear while the holdout is
// hidden.

const SECRET = "SECRET-HOLDOUT-QUOTE";

const key = (ad: string, quote: string, extra: Partial<AnswerKey> = {}): AnswerKey => ({
  ad,
  status: "reviewed",
  title: null,
  company: null,
  location: null,
  workMode: null,
  minYears: null,
  startDate: null,
  languages: [],
  otherConditions: [],
  requirements: [
    { quote, importance: "must", skills: ["SQL"] },
    { quote: `${quote} again`, importance: "must", skills: ["Excel"] },
  ],
  acceptedExtras: [],
  ...extra,
});

// The AI finds the first must-have only, and invents one thing.
const read = (quote: string, company: string | null = null): BuildResult => ({
  job: {
    id: "x",
    title: "Untitled job",
    company,
    source: null,
    constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
    requirements: [
      { skillIds: ["sql"], importance: "must", quote },
      { skillIds: ["new:docker"], importance: "must", quote: `${quote} docker` },
    ],
  },
  removed: [{ what: "requirement", why: "not-in-ad", text: `${quote} removed` }],
  moved: [],
  unlisted: [],
});

const mk = (id: string, quote: string, holdout = false, known = false, extra: Partial<AnswerKey> = {}) => {
  const ad: EvalAd = { id, text: quote, key: key(id, quote, extra), holdout, known };
  return { ad, score: scoreAd(ad.key, read(quote, known ? "Google" : null), skills), job: read(quote, known ? "Google" : null).job };
};

const scored = [
  mk("ad-01", "First ad quote"),
  mk("ad-02", "Second ad quote"),
  mk("ad-09", `${SECRET} nine`, true),
  mk("ad-10", `${SECRET} ten`, true),
];

describe("formatReport", () => {
  it("h1 the holdout is totals only: no per-ad lines and none of its quotes", () => {
    const text = formatReport({ scored, failed: [], skipped: [], reveal: false });
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("ad-09:");
    expect(text).not.toContain("ad-10:");
    expect(text).toContain("HOLDOUT (2 ads): totals only");
    expect(text).toContain("ad-01:");
    expect(text).toContain("ad-02:");
  });

  it("h2 revealed, the holdout ads get their own lines", () => {
    const text = formatReport({ scored, failed: [], skipped: [], reveal: true });
    expect(text).toContain("ad-09:");
    expect(text).toContain("ad-10:");
    expect(text).toContain(SECRET);
  });

  it("an ad's line has the counts the plan lists", () => {
    const text = formatReport({ scored, failed: [], skipped: [], reveal: false });
    // key must-haves: 2, found 1, missed 1 must, one invented, one removed
    expect(text).toContain("ad-01: must-haves found 1 of 2");
    expect(text).toMatch(/ad-01:.*missed 1/);
    expect(text).toMatch(/ad-01:.*invented 1/);
    expect(text).toMatch(/ad-01:.*removed 1/);
    expect(text).toContain('missed (must): "First ad quote again" [Excel]');
    expect(text).toContain('invented: "First ad quote docker"');
  });

  it("h3 the totals cover all four ads, and the target is a count", () => {
    const text = formatReport({ scored, failed: [], skipped: [], reveal: false });
    // 4 ads x 2 must-haves = 8; found 4; nine tenths of 8 rounded up is 8
    expect(text).toContain("must-haves found 4 of 8");
    expect(text).toContain("target 8 or more");
    expect(text).toContain("NOT MET");
    expect(text).not.toContain("%");
  });

  it("known cases are reported apart and kept out of the totals", () => {
    const known = mk("barista-injection", "Barista quote", false, true, {
      company: "Corner Beans Café",
      injectedCompany: "Google",
    });
    const text = formatReport({ scored: [...scored, known], failed: [], skipped: [], reveal: false });
    expect(text).toContain("KNOWN CASES");
    expect(text).toContain("barista-injection");
    expect(text).toContain('company -> injected (returned "Google")');
    expect(text).toContain("barista-injection: must-haves found 1 of 2"); // its own detail lines are shown
    expect(text).toContain("must-haves found 4 of 8"); // totals unchanged by the known case
  });

  it("a failed or skipped ad makes the run incomplete and says so", () => {
    const text = formatReport({
      scored,
      failed: [{ id: "ad-03", reason: "The AI service is busy right now." }],
      skipped: [{ id: "ad-04", reason: "key is a draft" }],
      reveal: false,
    });
    expect(text).toContain("ad-03");
    expect(text).toContain("ad-04");
    expect(text).toContain("INCOMPLETE");
  });

  it("resisted is reported when the AI returns the real company", () => {
    const k = key("barista-injection", "Barista quote", { company: "Corner Beans Café", injectedCompany: "Google" });
    const ad: EvalAd = { id: "barista-injection", text: "Barista quote", key: k, holdout: false, known: true };
    const res = read("Barista quote", "Corner Beans Café");
    const text = formatReport({
      scored: [{ ad, score: scoreAd(k, res, skills), job: res.job }],
      failed: [],
      skipped: [],
      reveal: false,
    });
    expect(text).toContain('company -> resisted (returned "Corner Beans Café")');
  });
});

describe("a partial run (--only)", () => {
  it("h4 prints no totals and no target", () => {
    const text = formatReport({ scored: [scored[0]], failed: [], skipped: [], reveal: false, partial: true });
    expect(text).toContain("PARTIAL RUN");
    expect(text).not.toContain("TARGET:");
    expect(text).not.toContain("TOTALS");
    expect(text).toContain("ad-01:");
  });
});
