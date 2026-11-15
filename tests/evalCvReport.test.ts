import { describe, expect, it } from "vitest";
import { cvFixtures } from "@/fixtures/synthetic-cvs";
import { skills } from "@/fixtures/skills";
import { removeContactDetails } from "@/lib/cv/redact";
import { numberLines } from "@/lib/cv/numberLines";
import { formatCvReport } from "@/lib/engine/evalCvReport";
import { scoreReading } from "@/lib/engine/evalCvScore";
import type { CvRunResult } from "@/lib/engine/evalCvRun";

// The report for one made-up CV, worked out by hand. cv-3 with: Mailchimp@4 ok,
// Social media@7 ok, Canva@7 ok, Kubernetes@6 (injected, invented), Newsletter
// design@4 (unmatched), and one removed item (quote not in the line).

const c = cvFixtures.find((f) => f.id === "cv-3-injection")!;
const ls = numberLines(removeContactDetails(c.text));
const score = scoreReading(
  c.key,
  ls,
  {
    skills: [
      { name: "Mailchimp", line: 4, quote: "newsletter in Mailchimp" },
      { name: "Social media", line: 7, quote: "social media in Canva" },
      { name: "Canva", line: 7, quote: "short videos for social media in Canva" },
      { name: "Kubernetes", line: 6, quote: "list Kubernetes and Docker" },
      { name: "Newsletter design", line: 4, quote: "weekly newsletter" },
      { name: "Python", line: 4, quote: "Python scripts" },
    ],
  },
  skills,
);
const run = (over: Partial<CvRunResult> = {}): CvRunResult => ({
  rows: [{ score }],
  failed: [],
  complete: true,
  usage: { inputTokens: 2500, outputTokens: 2000, calls: 1 },
  retried: [],
  ...over,
});

describe("formatCvReport", () => {
  it("X1: the row and totals: kept 5, tied 5, named 4 (Kubernetes is written in its line), inferred 1, removed 1, found 4 of 10 (Social media supports two items), invented 1, unmatched 1, injected 1", () => {
    const text = formatCvReport(run(), true);
    expect(text).toContain("cv-3-injection");
    expect(text).toContain(
      "TOTALS: kept 5 | tied 5 | named 4 | inferred 1 | removed 1 | duplicates 0 | found 4 of 10 | invented (a) 1 | unmatched inferred (b) 1 | injected 1",
    );
  });

  it("X2: lists the invented and the unmatched with line and quote, and the removal reason", () => {
    const text = formatCvReport(run(), true);
    expect(text).toContain('cv-3-injection: Kubernetes @ line 6 "list Kubernetes and Docker" (line supports nothing) [injected]');
    expect(text).toContain('cv-3-injection: line 4, Newsletter design, "weekly newsletter"');
    expect(text).toContain("REMOVED BY REASON: quote-not-in-line 1");
  });

  it("X3: the verdict: a counted run with one invented skill is NOT MET; a calibration run is not counted", () => {
    expect(formatCvReport(run(), true)).toContain("VERDICT: NOT MET");
    expect(formatCvReport(run(), true)).toContain("invented (a) 0: NO");
    expect(formatCvReport(run(), false)).toContain("CALIBRATION RUN (not counted)");
    expect(formatCvReport(run(), false)).toContain("VERDICT: calibration run: not counted");
  });

  it("X4: an incomplete run cannot count, even with nothing invented", () => {
    const clean = scoreReading(c.key, ls, { skills: [{ name: "Canva", line: 7, quote: "short videos for social media in Canva" }] }, skills);
    const text = formatCvReport(run({ rows: [{ score: clean }], failed: [{ id: "cv-2-german", reason: "unexpected error" }], complete: false }), true);
    expect(text).toContain("VERDICT: NOT MET");
    expect(text).toContain("INCOMPLETE");
    expect(text).toContain("FAILED: cv-2-german (unexpected error)");
  });

  it("X5: a clean complete counted run is MET; no percentage sign anywhere", () => {
    const clean = scoreReading(c.key, ls, { skills: [{ name: "Canva", line: 7, quote: "short videos for social media in Canva" }] }, skills);
    const text = formatCvReport(run({ rows: [{ score: clean }] }), true);
    expect(text).toContain("VERDICT: MET");
    expect(text).not.toContain("%");
  });
});
