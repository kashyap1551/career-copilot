import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildJob } from "@/lib/engine/fromAd";
import type { ExtractedAd } from "@/lib/schemas/job";

// C1 (docs/PLAN-3.3.md, section 9): a work-mode quote that is only hashtags is
// rejected, because a tag such as "#LI-onsite" is a label, not the ad's own
// words about the job (docs/DECISIONS.md, 2026-11-14). The table was worked out
// by hand before the code.

const empty: ExtractedAd = {
  title: null, company: null, location: null, workMode: null, minYears: null,
  startDate: null, languages: [], otherConditions: [], requirements: [],
};
const read = (value: "onsite" | "hybrid" | "remote", quote: string, ad = quote) =>
  buildJob({ ...empty, workMode: { value, quote } }, ad, skills, { id: "t", source: null });

describe("C1: a work-mode quote that is only tags is rejected", () => {
  it.each([
    ["#LI-onsite", "onsite"],
    ["#LI-remote", "remote"],
    ["#remote", "remote"],
    ["#LI-onsite #LI-VA1", "onsite"],
    ["#", "onsite"],
    ["#LI-onstie", "onsite"], // a typo in the tag changes nothing
  ] as const)("%s is rejected", (quote, value) => {
    const r = read(value, quote, `Some ad.\n\n${quote}\n`);
    expect(r.job.constraints.remote).toBeNull();
    expect(r.removed.map((x) => `${x.what}:${x.why}`)).toEqual(["workMode:tag-not-sentence"]);
  });

  it("a rejected tag is not moved to 'check this yourself'", () => {
    const r = read("onsite", "#LI-onsite");
    expect(r.moved).toEqual([]);
    expect(r.job.constraints.otherConditions).toEqual([]);
  });

  it.each([
    ["Hybrid: three days a week #LI-hybrid", "hybrid"],
    ["We work remotely", "remote"],
    ["remote #LI-remote", "remote"],
    ["Berlin, hybrid", "hybrid"],
    ["On-site in our Leipzig office", "onsite"],
  ] as const)("%s is accepted, because it has real words", (quote, value) => {
    const r = read(value, quote);
    expect(r.job.constraints.remote).toBe(value);
    expect(r.removed).toEqual([]);
  });

  it("a quote that is not in the ad is still 'not in the ad', not 'tag'", () => {
    const r = buildJob({ ...empty, workMode: { value: "remote", quote: "#LI-remote" } }, "No tags here.", skills, { id: "t", source: null });
    expect(r.removed.map((x) => `${x.what}:${x.why}`)).toEqual(["workMode:not-in-ad"]);
  });
});
