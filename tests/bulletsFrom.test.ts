import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import type { BulletPair } from "@/lib/engine/bulletPairs";
import { bulletsFrom } from "@/lib/engine/bulletsFrom";

// Step 8.3, stage 2, tests first (docs/PLAN-8.3.md v2, sections 4 and 10; test T12). The answer check: each bullet of the AI's answer is checked with
// checkBullet against ITS OWN pair's line (the citation is assigned by code); at most 3 accepted bullets are shown, in pair order; every asked pair that
// has no accepted bullet is dropped (a failed rule, `missing`, or a repeated pair id: `repeated-pair`); a bullet for a pair that was not asked is only
// counted in `ignored`. Every expected value is a hand result. Invented text only; no AI.

const L4 = "Answered the phone and kept the stock sheet up to date in Excel";
const L5 = "Helped customers at the counter";
const TWO: BulletPair[] = [
  { id: 1, requirement: "Excel is required.", skillId: "excel", line: 4, text: L4 },
  { id: 2, requirement: "Customer service is a plus.", skillId: "customer-service", line: 5, text: L5 },
];
const FIVE: BulletPair[] = [
  { id: 1, requirement: "Excel is required.", skillId: "excel", line: 1, text: "Kept the books in Excel" },
  { id: 2, requirement: "SQL is required.", skillId: "sql", line: 2, text: "Wrote SQL queries" },
  { id: 3, requirement: "Python is required.", skillId: "python", line: 3, text: "Wrote Python scripts" },
  { id: 4, requirement: "Tableau is required.", skillId: "tableau", line: 4, text: "Built dashboards in Tableau" },
  { id: 5, requirement: "Spreadsheets are required.", skillId: "spreadsheets", line: 5, text: "Kept spreadsheets tidy" },
];
const run = (answer: { pair: number; text: string }[], pairs: BulletPair[], show?: number) => bulletsFrom({ bullets: answer }, pairs, skills, show);

describe("T12: the answer check", () => {
  it("T12 a good answer: both bullets are shown with the line each came from, nothing dropped", () => {
    expect(run([{ pair: 1, text: "Kept the stock sheet up to date in Excel" }, { pair: 2, text: "Helped customers at the counter" }], TWO)).toEqual({
      bullets: [
        { pair: 1, line: 4, text: "Kept the stock sheet up to date in Excel" },
        { pair: 2, line: 5, text: "Helped customers at the counter" },
      ],
      asked: 2,
      dropped: [],
      ignored: 0,
    });
  });

  it("T12 the shown bullets are in pair order even when the answer is in another order", () => {
    const got = run([{ pair: 2, text: "Helped customers at the counter" }, { pair: 1, text: "Kept the stock sheet up to date in Excel" }], TWO);
    expect(got.bullets.map((b) => b.pair)).toEqual([1, 2]);
  });

  it("T12 an unknown pair: its bullet is ignored (not a dropped pair), and the pair that was not answered is `missing`", () => {
    const got = run([{ pair: 1, text: "Kept the stock sheet up to date in Excel" }, { pair: 9, text: "Helped customers at the counter" }], TWO);
    expect(got).toEqual({
      bullets: [{ pair: 1, line: 4, text: "Kept the stock sheet up to date in Excel" }],
      asked: 2,
      dropped: [{ pair: 2, reason: "missing" }],
      ignored: 1,
    });
  });

  it("T12 a repeated pair: every bullet of that pair id is dropped (`repeated-pair`) and the pair counts once", () => {
    const got = run(
      [
        { pair: 1, text: "Kept the stock sheet up to date in Excel" },
        { pair: 2, text: "Helped customers at the counter" },
        { pair: 2, text: "Helped customers at the counter" },
      ],
      TWO,
    );
    expect(got.bullets).toEqual([{ pair: 1, line: 4, text: "Kept the stock sheet up to date in Excel" }]);
    expect(got.dropped).toEqual([{ pair: 2, reason: "repeated-pair" }]);
    expect(got.ignored).toBe(0);
  });

  it("T12 a missing pair: a pair with no bullet is dropped with the reason `missing`", () => {
    const got = run([{ pair: 2, text: "Helped customers at the counter" }], TWO);
    expect(got.dropped).toEqual([{ pair: 1, reason: "missing" }]);
    expect(got.bullets.map((b) => b.pair)).toEqual([2]);
  });

  it("T12 a fact taken from another pair's line: the bullet is checked against its OWN line and dropped", () => {
    // pair 1 is line 4 (the stock sheet in Excel); its bullet uses the words of line 5 (pair 2): "helped" is in no cited line of pair 1
    const got = run([{ pair: 1, text: "Helped customers at the counter" }, { pair: 2, text: "Helped customers at the counter" }], TWO);
    expect(got.bullets).toEqual([{ pair: 2, line: 5, text: "Helped customers at the counter" }]);
    expect(got.dropped).toEqual([{ pair: 1, reason: "new-word" }]);
  });

  it("T12 a skill taken from another pair's line is dropped as `new-skill`", () => {
    // pair 1's own line has Excel; the bullet names SQL, a skill of pair 2 of the five-pair set
    const got = run([{ pair: 1, text: "Kept the books in Excel and SQL" }], [FIVE[0], FIVE[1]]);
    expect(got.dropped).toContainEqual({ pair: 1, reason: "new-skill" });
  });

  it("T12 every bullet failing: nothing is shown and every asked pair is dropped, each with its reason", () => {
    const got = run(
      [
        { pair: 1, text: "Kept the books in Excel since 2021" }, // new-date
        { pair: 2, text: "Wrote 40 SQL queries" }, // new-number
        { pair: 3, text: "Wrote Python scripts as a senior" }, // new-claim
        { pair: 4, text: "Built dashboards in Tableau" + " and Airtable" }, // new-name
        { pair: 5, text: "Kept tidy spreadsheets" }, // reordered
      ],
      FIVE,
    );
    expect(got.bullets).toEqual([]);
    expect(got.asked).toBe(5);
    expect(got.dropped).toEqual([
      { pair: 1, reason: "new-date" },
      { pair: 2, reason: "new-number" },
      { pair: 3, reason: "new-claim" },
      { pair: 4, reason: "new-name" },
      { pair: 5, reason: "reordered" },
    ]);
  });

  it("T12 more than 3 accepted: 3 are shown, in pair order; the others are neither shown nor dropped", () => {
    const answer = FIVE.map((p) => ({ pair: p.id, text: p.text }));
    const got = run(answer, FIVE);
    expect(got.bullets.map((b) => b.pair)).toEqual([1, 2, 3]);
    expect(got.dropped).toEqual([]);
    expect(got.asked).toBe(5);
  });

  it("T12 the show limit is a parameter", () => {
    const answer = FIVE.map((p) => ({ pair: p.id, text: p.text }));
    expect(run(answer, FIVE, 2).bullets.map((b) => b.pair)).toEqual([1, 2]);
  });

  it("T12 the dropped count counts every dropped pair, whatever the reason", () => {
    const got = run(
      [
        { pair: 1, text: "Kept the books in Excel" }, // accepted
        { pair: 2, text: "Wrote 40 SQL queries" }, // new-number
        // pair 3: not answered (missing)
        { pair: 4, text: "Built dashboards in Tableau" }, // answered twice: both dropped
        { pair: 4, text: "Built dashboards in Tableau" },
        { pair: 5, text: "Kept spreadsheets tidy" }, // accepted
        { pair: 9, text: "Wrote SQL queries" }, // not asked: ignored
      ],
      FIVE,
    );
    expect(got.bullets.map((b) => b.pair)).toEqual([1, 5]);
    expect(got.dropped).toEqual([
      { pair: 2, reason: "new-number" },
      { pair: 3, reason: "missing" },
      { pair: 4, reason: "repeated-pair" },
    ]);
    expect(got.dropped.length).toBe(3);
    expect(got.ignored).toBe(1);
    expect(got.asked).toBe(5);
  });

  it("T12 an empty answer drops every pair as missing; no pairs asked gives an empty result", () => {
    expect(run([], TWO).dropped).toEqual([{ pair: 1, reason: "missing" }, { pair: 2, reason: "missing" }]);
    expect(run([], [])).toEqual({ bullets: [], asked: 0, dropped: [], ignored: 0 });
  });
});
