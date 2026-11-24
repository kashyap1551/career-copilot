import { describe, expect, it } from "vitest";
import { heldBackLine } from "@/app/roadmap";
import { KIND_WORDS, type Kind } from "@/lib/cv/profile";

// Step 7.1b, tests first (docs/PLAN-7.1.md, Amendment 2): the SENTENCE of G14a to G14j. `heldBackLine(heldBack, hasRows)` is
// a pure function: it gets the data that `gapList(...).heldBack` returns (tests/gaps.test.ts has the data rows) and
// whether the gap list has at least one row, and returns the line or null. The expected texts are copied from the plan.
// Grammar (Amendment 2 (4)): the noun follows M ("ad" for 1, else "ads"); the verb and pronoun follow N ("is ... it" for 1,
// else "are ... them"). With no gap row (5) the words after the brackets are left out.

type HeldBack = { ads: number; of: number; kinds: Kind[] };
const hb = (ads: number, of: number, kinds: Kind[]): HeldBack => ({ ads, of, kinds });

const A = "1 of your 4 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.";

describe("heldBackLine: the sentence of the G14 rows", () => {
  it("G14a: one of 4 held back by location, rows present", () => {
    expect(heldBackLine(hb(1, 4, ["location"]), true)).toBe(A);
  });

  it("G14b: two of 4, location and work mode (the words are KIND_WORDS: 'work mode', not 'workMode')", () => {
    expect(heldBackLine(hb(2, 4, ["location", "workMode"]), true)).toBe(
      "2 of your 4 counted saved ads are held back by something other than skills (location, work mode), so learning the skills above may not open them.",
    );
  });

  it("G14c: no ad held back (the only conflict could be closed): no line", () => {
    expect(heldBackLine(hb(0, 4, []), true)).toBeNull();
  });

  it("G14d: no counted ad has a conflict: no line", () => {
    expect(heldBackLine(hb(0, 4, []), true)).toBeNull();
  });

  it("G14e: the G14a data (M still 4, kinds still location): exactly the G14a line", () => {
    expect(heldBackLine(hb(1, 4, ["location"]), true)).toBe(A);
  });

  it("G14f: the person set no city: the data says nobody is held back: no line", () => {
    expect(heldBackLine(hb(0, 4, []), true)).toBeNull();
  });

  it("G14g: one counted ad, held back: the noun is singular ('ad'), N = 1 so 'is ... it'", () => {
    expect(heldBackLine(hb(1, 1, ["location"]), true)).toBe(
      "1 of your 1 counted saved ad is held back by something other than skills (location), so learning the skills above may not open it.",
    );
  });

  it("G14h: nothing unmet (no gap row), one of 4 held back: the line WITHOUT the words after the brackets", () => {
    expect(heldBackLine(hb(1, 4, ["location"]), false)).toBe(
      "1 of your 4 counted saved ads is held back by something other than skills (location).",
    );
  });

  it("G14i: the data of the unclosable-plus-closable ad (kinds location only, N once): the G14a line", () => {
    expect(heldBackLine(hb(1, 4, ["location"]), true)).toBe(A);
  });

  it("G14j: two of 4, both by location: the kind once, 'are ... them'", () => {
    expect(heldBackLine(hb(2, 4, ["location"]), true)).toBe(
      "2 of your 4 counted saved ads are held back by something other than skills (location), so learning the skills above may not open them.",
    );
  });
});

describe("heldBackLine: grammar and wording beyond the plan's rows (Amendment 2 (4) and (5))", () => {
  it("H1: several held back and no gap row: both the plural verb and no tail", () => {
    expect(heldBackLine(hb(2, 4, ["location", "workMode"]), false)).toBe(
      "2 of your 4 counted saved ads are held back by something other than skills (location, work mode).",
    );
  });

  it("H2: the noun follows M and the verb follows N independently: 1 of 2 and 2 of 2", () => {
    expect(heldBackLine(hb(1, 2, ["years"]), true)).toBe(
      "1 of your 2 counted saved ads is held back by something other than skills (years), so learning the skills above may not open it.",
    );
    expect(heldBackLine(hb(2, 2, ["startDate"]), true)).toBe(
      "2 of your 2 counted saved ads are held back by something other than skills (start date), so learning the skills above may not open them.",
    );
  });

  it("H3: every kind is written with KIND_WORDS, in the order given", () => {
    const all: Kind[] = ["location", "language", "workMode", "years", "startDate"];
    const words = all.map((k) => KIND_WORDS[k]).join(", "); // location, language, work mode, years, start date
    expect(heldBackLine(hb(3, 5, all), true)).toBe(
      `3 of your 5 counted saved ads are held back by something other than skills (${words}), so learning the skills above may not open them.`,
    );
  });

  it("H4: no ad held back: no line, with or without rows", () => {
    expect(heldBackLine(hb(0, 4, []), false)).toBeNull();
    expect(heldBackLine(hb(0, 0, []), true)).toBeNull();
  });
});
