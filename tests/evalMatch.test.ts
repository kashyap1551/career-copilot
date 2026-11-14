import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import type { KeyRequirement } from "@/lib/engine/answerKey";
import { matchRequirements } from "@/lib/engine/evalMatch";
import type { Requirement } from "@/lib/engine/types";

// Tables (a), (b) and the other pairing rules in docs/PLAN-3.2.md, worked out
// by hand before the matcher existed. K = a key item, E = an extracted item.

const K = (quote: string, importance: "must" | "nice", ...names: string[]): KeyRequirement => ({
  quote,
  importance,
  skills: names,
});
const E = (quote: string, importance: "must" | "nice", ...ids: string[]): Requirement => ({
  quote,
  importance,
  skillIds: ids,
});
const run = (key: KeyRequirement[], ex: Requirement[]) => matchRequirements(key, ex, skills);
const pairs = (r: ReturnType<typeof run>) => r.pairs.map((p) => [p.key, p.extracted]);

const L = "Sehr gute SQL-Kenntnisse; Python or R is a plus.";
const Q = "Experience with A/B testing and product metrics (retention, funnels).";

describe("(a) one AI quote covers several key items", () => {
  const key = [K("Sehr gute SQL-Kenntnisse", "must", "SQL"), K("Python or R is a plus.", "nice", "Python", "R")];

  it("a1 the shared skill id pairs each key item with its own AI item", () => {
    const r = run(key, [E(L, "must", "sql"), E(L, "nice", "python", "new:r")]);
    expect(pairs(r)).toEqual([[0, 0], [1, 1]]);
    expect(r.missedKeys).toEqual([]);
    expect(r.extras).toEqual([]);
  });

  it("a2 different names: the one shared id (new:r) still settles it", () => {
    const r = run(key, [
      E(L, "must", "new:structured-query-language"),
      E(L, "nice", "new:python-3", "new:r"),
    ]);
    expect(pairs(r)).toEqual([[0, 0], [1, 1]]);
  });

  it("a3 the AI skips Python and R: that key item is missed", () => {
    const r = run(key, [E(L, "must", "sql")]);
    expect(pairs(r)).toEqual([[0, 0]]);
    expect(r.missedKeys).toEqual([1]);
    expect(r.extras).toEqual([]);
  });

  it("a4 the AI lists them in the other order: the ids still pair them correctly", () => {
    const r = run(key, [E(L, "nice", "python", "new:r"), E(L, "must", "sql")]);
    expect(pairs(r)).toEqual([[0, 1], [1, 0]]);
  });
});

describe("(b) several key items share one quote", () => {
  const key = [K(Q, "must", "A/B testing"), K(Q, "must", "Product metrics")];

  it("b1 split correctly: paired by shared id", () => {
    const r = run(key, [E(Q, "must", "new:a-b-testing"), E(Q, "must", "new:product-metrics")]);
    expect(pairs(r)).toEqual([[0, 0], [1, 1]]);
  });

  it("b2 merged into one item: one pair, the other key item is missed", () => {
    const r = run(key, [E(Q, "must", "new:a-b-testing", "new:product-metrics")]);
    expect(pairs(r)).toEqual([[0, 0]]);
    expect(r.missedKeys).toEqual([1]);
  });

  it("b3 no shared ids: position decides", () => {
    const r = run(key, [E(Q, "must", "new:ab-tests"), E(Q, "must", "new:product-kpis")]);
    expect(pairs(r)).toEqual([[0, 0], [1, 1]]);
  });

  it("b4 a third item for the same quote is an extra", () => {
    const r = run(key, [
      E(Q, "must", "new:a-b-testing"),
      E(Q, "must", "new:product-metrics"),
      E(Q, "nice", "new:retention"),
    ]);
    expect(pairs(r)).toEqual([[0, 0], [1, 1]]);
    expect(r.extras).toEqual([2]);
  });

  it("b5 the AI lists them in the other order: ids pair them correctly", () => {
    const r = run(key, [E(Q, "must", "new:product-metrics"), E(Q, "must", "new:a-b-testing")]);
    expect(pairs(r)).toEqual([[0, 1], [1, 0]]);
  });
});

describe("other rules of the pairing", () => {
  it("c3 either quote may contain the other", () => {
    expect(pairs(run([K("A/B testing", "must", "A/B testing")], [E(Q, "must", "new:a-b-testing")]))).toEqual([[0, 0]]);
    expect(pairs(run([K(Q, "must", "A/B testing")], [E("A/B testing", "must", "new:a-b-testing")]))).toEqual([[0, 0]]);
  });

  it("c3b case, spacing and curly quotes do not matter", () => {
    const r = run([K("Bachelor's  degree", "must", "Degree")], [E("BACHELOR’S\ndegree", "must", "new:degree")]);
    expect(pairs(r)).toEqual([[0, 0]]);
  });

  it("c4 an empty or blank quote is never a candidate", () => {
    expect(run([K("", "must", "SQL")], [E("anything", "must", "sql")]).pairs).toEqual([]);
    expect(run([K("anything", "must", "SQL")], [E("   ", "must", "sql")]).pairs).toEqual([]);
  });

  it("no shared words, no pair", () => {
    const r = run([K("SQL required", "must", "SQL")], [E("Docker experience", "must", "new:docker")]);
    expect(r.pairs).toEqual([]);
    expect(r.missedKeys).toEqual([0]);
    expect(r.extras).toEqual([0]);
  });

  it("c5 an equal quote beats a contained quote", () => {
    const r = run(
      [K("SQL required", "must", "SQL")],
      [E("SQL required and Python helps", "must", "sql"), E("SQL required", "must", "new:other")],
    );
    expect(pairs(r)).toEqual([[0, 1]]);
    expect(r.extras).toEqual([0]);
  });

  it("c6 the smaller difference in quote length wins when nothing else decides", () => {
    const r = run(
      [K("python", "must", "Python")],
      [
        E("Python or R is a plus. And more text here", "must", "new:q"),
        E("Python or R is a plus.", "must", "new:p"),
      ],
    );
    expect(pairs(r)).toEqual([[0, 1]]);
  });

  it("same importance beats different importance when nothing earlier decides", () => {
    const r = run(
      [K("python", "must", "Python")],
      [E("Python or R is a plus.", "nice", "new:p"), E("Python or R is a plus.", "must", "new:q")],
    );
    expect(pairs(r)).toEqual([[0, 1]]);
  });

  it("c7 each item is used at most once", () => {
    const r = run([K(Q, "must", "A/B testing"), K(Q, "must", "Product metrics")], [E(Q, "must", "new:a-b-testing")]);
    expect(r.pairs).toHaveLength(1);
  });
});

describe("the short-quote guard in the matcher (docs/PLAN-3.2.md)", () => {
  const long = "strong ability to build dashboards, track ROI, and analyze campaign performance metrics";

  it("m1 a quote that is only 'and' does not pair with a line that contains it", () => {
    const r = run([K("SQL and Excel skills", "must", "SQL")], [E("and", "must", "sql")]);
    expect(r.pairs).toEqual([]);
    expect(r.missedKeys).toEqual([0]);
    expect(r.extras).toEqual([0]);
  });

  it("m2 'of the' does not pair", () => {
    expect(run([K("Head of the team", "must", "Leadership")], [E("of the", "must", "new:x")]).pairs).toEqual([]);
  });

  it("m3 to m5 a short quote with a real word still pairs", () => {
    expect(pairs(run([K("including lead scoring, nurturing, and funnel optimization", "must", "Lead scoring")], [E("lead scoring", "must", "new:lead-scoring")]))).toEqual([[0, 0]]);
    expect(pairs(run([K("Proficiency in Excel/Google Sheets", "must", "Excel")], [E("Excel", "must", "excel")]))).toEqual([[0, 0]]);
    expect(pairs(run([K(long, "must", "ROI tracking")], [E("track ROI", "must", "new:roi-tracking")]))).toEqual([[0, 0]]);
  });

  it("m6 equal short quotes pair", () => {
    expect(pairs(run([K("AI", "must", "AI")], [E("AI", "must", "new:ai")]))).toEqual([[0, 0]]);
  });

  it("m7 'and' pairs with none of two key items that contain it", () => {
    const r = run(
      [K("SQL and Excel", "must", "SQL"), K("Python and R", "must", "Python")],
      [E("and", "must", "sql")],
    );
    expect(r.pairs).toEqual([]);
    expect(r.missedKeys).toEqual([0, 1]);
  });
});
