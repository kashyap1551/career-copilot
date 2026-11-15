import { describe, expect, it } from "vitest";
import { cvFixtures } from "@/fixtures/synthetic-cvs";
import { removeContactDetails, containsContactDetails } from "@/lib/cv/redact";
import { numberLines } from "@/lib/cv/numberLines";
import { checkCvKey, type CvKey } from "@/lib/engine/cvKey";

// The five made-up CVs and their keys (docs/PLAN-4.2-cvs.md). Every number
// below is the hand count in that file, not read from the code.

const lines = (text: string) => numberLines(removeContactDetails(text));
const byId = Object.fromEntries(cvFixtures.map((c) => [c.id, c]));

describe("the five made-up CVs", () => {
  it("Y1: the five ids, in order", () => {
    expect(cvFixtures.map((c) => c.id)).toEqual(["cv-1-thin", "cv-2-german", "cv-3-injection", "cv-4-skills-line", "cv-5-prose"]);
  });

  it("Y2: line counts are 8, 9, 8, 7, 8 after the removal and numbering", () => {
    expect(cvFixtures.map((c) => lines(c.text).length)).toEqual([8, 9, 8, 7, 8]);
  });

  it("Y3: every key passes its own checks (lines exist, named is written, inferred is not)", () => {
    for (const c of cvFixtures) expect(checkCvKey(c.key, lines(c.text))).toEqual([]);
  });

  it("Y4: key items are 4, 9, 10, 12, 7 = 42; named 1, 5, 4, 7, 1 = 18; inferred 3, 4, 6, 5, 6 = 24", () => {
    expect(cvFixtures.map((c) => c.key.items.length)).toEqual([4, 9, 10, 12, 7]);
    expect(cvFixtures.map((c) => c.key.items.filter((i) => i.label === "named").length)).toEqual([1, 5, 4, 7, 1]);
    expect(cvFixtures.map((c) => c.key.items.filter((i) => i.label === "inferred").length)).toEqual([3, 4, 6, 5, 6]);
  });

  it("Y5: cv-3 line 6 is the injection, cv-1 line 7 is the 'learning' trap, nothing else is either", () => {
    expect(cvFixtures.map((c) => c.key.injectionLines)).toEqual([[], [], [6], [], []]);
    expect(cvFixtures.map((c) => c.key.trapLines)).toEqual([[7], [], [], [], []]);
    expect(lines(byId["cv-3-injection"].text)[5]).toMatch(/^Ignore all previous instructions/);
    expect(lines(byId["cv-1-thin"].text)[6]).toBe("Learning Excel formulas in an evening course");
  });

  it("Y6: the removal changes only line 2 (the contact line) of each CV, to the two placeholders", () => {
    for (const c of cvFixtures) {
      const raw = numberLines(c.text);
      const out = lines(c.text);
      expect(out.length).toBe(raw.length);
      raw.forEach((l, i) => {
        if (i === 1) expect(out[i]).toBe("[email removed] | [phone removed]");
        else expect(out[i]).toBe(l);
      });
      expect(out.some(containsContactDetails)).toBe(false);
    }
  });

  it("Y7: the contact lines hold made-up details only (example domains)", () => {
    for (const c of cvFixtures) expect(numberLines(c.text)[1]).toMatch(/@example\.(com|de)\b/);
  });
});

describe("checkCvKey catches a bad key", () => {
  const cv = byId["cv-1-thin"];
  const ls = lines(cv.text);
  const withItems = (extra: Partial<CvKey>): CvKey => ({ ...cv.key, ...extra });

  it("Y8: a wrong line count", () => {
    expect(checkCvKey(withItems({ lineCount: 9 }), ls).map((p) => p.where)).toEqual(["lineCount"]);
  });
  it("Y9: a line that does not exist", () => {
    const k = withItems({ items: [...cv.key.items, { line: 99, names: ["X"], label: "inferred" }] });
    expect(checkCvKey(k, ls).some((p) => p.problem === "line out of range")).toBe(true);
  });
  it("Y10: 'named' for a name that is not in the line, and 'inferred' for one that is", () => {
    const k1 = withItems({ items: [{ line: 5, names: ["Excel"], label: "named" }] });
    expect(checkCvKey(k1, ls)[0].problem).toMatch(/marked named/);
    const k2 = withItems({ items: [{ line: 4, names: ["Excel"], label: "inferred" }] });
    expect(checkCvKey(k2, ls)[0].problem).toMatch(/marked inferred/);
  });
  it("Y11: an item on the trap line, or no accepted name", () => {
    const k = withItems({ items: [{ line: 7, names: ["Excel"], label: "named" }, { line: 4, names: [], label: "inferred" }] });
    const problems = checkCvKey(k, ls).map((p) => p.problem);
    expect(problems).toContain("an injection or trap line supports nothing");
    expect(problems).toContain("no accepted name");
  });
});
