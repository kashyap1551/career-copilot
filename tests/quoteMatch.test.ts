import { describe, expect, it } from "vitest";
import { hasRealWord, quotesMatch } from "@/lib/engine/quoteMatch";

// The short-quote guard (docs/PLAN-3.2.md, "Short-quote guard"), worked out by
// hand before the code. A quote with no real word must not match another quote
// just because it is contained in it. Equal quotes always match.

describe("hasRealWord", () => {
  it.each([
    ["g1", "and"],
    ["g2", "of the"],
    ["g3a", "or"],
    ["g3b", "a"],
    ["g3c", "in"],
    ["g3d", "to"],
    ["g3e", "the"],
    ["g4", "und oder"],
    ["g5", "für mit von"],
    ["g6", "eine"],
    ["g7", "to be"],
    ["g8a", "AI"],
    ["g8b", "IT"],
    ["g8c", "Go"],
    ["g9a", "R"],
    ["g9b", "C++"],
    ["g10", "3+"],
    ["g18a", ""],
    ["g18b", "   "],
  ])("%s: %j has no real word", (_id, quote) => {
    expect(hasRealWord(quote)).toBe(false);
  });

  it.each([
    ["g11a", "Excel"],
    ["g11b", "SQL"],
    ["g12", "lead scoring"],
    ["g13", "track ROI"],
    ["g14", "and the cat"],
    ["g15", "mit Excel"],
    ["g16", "einen"],
    ["g17", "Büro"],
  ])("%s: %j has a real word", (_id, quote) => {
    expect(hasRealWord(quote)).toBe(true);
  });
});

const LONG_LEAD = "including lead scoring, nurturing, and funnel optimization";
const LONG_ROI = "strong ability to build dashboards, track ROI, and analyze campaign performance metrics";

describe("quotesMatch", () => {
  it("q1 equal quotes match whatever their length", () => {
    expect(quotesMatch("AI", "AI")).toBe(true);
  });

  it("q2 equal after normalising", () => {
    expect(quotesMatch("AND", "and")).toBe(true);
  });

  it("q3 and q4 'and' does not match a line that merely contains it, in either direction", () => {
    expect(quotesMatch("and", "SQL and Excel skills")).toBe(false);
    expect(quotesMatch("SQL and Excel skills", "and")).toBe(false);
  });

  it("q5 'of the' does not match", () => {
    expect(quotesMatch("of the", "Head of the team")).toBe(false);
  });

  it("q6 to q8 a short quote with a real word still matches", () => {
    expect(quotesMatch("Excel", "Proficiency in Excel/Google Sheets")).toBe(true);
    expect(quotesMatch("lead scoring", LONG_LEAD)).toBe(true);
    expect(quotesMatch("track ROI", LONG_ROI)).toBe(true);
    expect(quotesMatch(LONG_ROI, "track ROI")).toBe(true);
  });

  it("q9 and q10 not contained, or empty", () => {
    expect(quotesMatch("Kubernetes", "Proficiency in Excel/Google Sheets")).toBe(false);
    expect(quotesMatch("", "anything")).toBe(false);
    expect(quotesMatch("anything", "  ")).toBe(false);
  });
});
