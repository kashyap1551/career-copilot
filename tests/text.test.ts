import { describe, expect, it } from "vitest";
import { isInAd } from "@/lib/engine/text";

// Table section 0 of docs/PLAN-3.1.md (the normaliser). Expected results were
// worked out by hand before the code existed.

describe("isInAd: matching the AI's text against the ad", () => {
  it("N1 ignores case, extra spaces and line breaks", () => {
    expect(isInAd("Solid SQL skills", "We want solid  SQL\nskills here")).toBe(true);
  });

  it("N2 treats a curly apostrophe like a straight one", () => {
    expect(isInAd("Bachelor's degree", "A Bachelor’s degree in finance")).toBe(true);
    expect(isInAd("Bachelor’s degree", "A Bachelor's degree in finance")).toBe(true);
  });

  it("N3 treats long dashes like a hyphen", () => {
    expect(isInAd("5 - 7 years", "Wanted: 5 – 7 years of experience")).toBe(true);
    expect(isInAd("5 - 7 years", "Wanted: 5 — 7 years of experience")).toBe(true);
  });

  it("N4 treats a non-breaking space like a space", () => {
    expect(isInAd("Power BI", "Experience with Power BI dashboards")).toBe(true);
  });

  it("N5 never matches an empty or blank quote", () => {
    expect(isInAd("", "any text at all")).toBe(false);
    expect(isInAd("   \n ", "any text at all")).toBe(false);
  });

  it("N6 does not match words that differ", () => {
    expect(isInAd("Strong SQL skills", "Strong SQL for querying large data sets.")).toBe(false);
  });

  it("matches double quotes the same way", () => {
    expect(isInAd('the "best" team', "join the “best” team")).toBe(true);
  });
});
