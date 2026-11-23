import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import type { BulletPair } from "@/lib/engine/bulletPairs";
import { bulletsFrom, bulletsFromDetailed } from "@/lib/engine/bulletsFrom";
import { droppedLines, reviewSheet } from "@/lib/engine/evalBulletsReport";
import type { BulletsEvalRow, BulletsEvalRun } from "@/lib/engine/evalBulletsRun";
import { evalBulletsMain, type BulletsMainDeps } from "@/scripts/evalBulletsMain";

// Step 8.3, stage 5b, tests first (docs/PLAN-8.3.md v2, amendment 0.29): the eval's full output and review sheet list EVERY dropped bullet with the AI's own text,
// the reason code and the cited CV line, so the reviewer can tell a rule that is too strict from a bad bullet. Invented material only; fake answers; no AI.
//
// The hand-worked fake answer (five asked pairs, CV lines 4 to 8):
//   pair 1 "Answered the phone and kept the stock sheet up to date in Excel"  -> "Kept the stock sheet up to date in Excel": a stretch of the line: ACCEPTED.
//   pair 2 "Wrote SQL queries to reconcile order data"                        -> "Wrote 300 SQL queries": 300 is not in the line: DROPPED, new-number (R4).
//   pair 3 "Helped customers at the counter"                                  -> "customers at the counter": the limiting word "Helped" is lost: DROPPED, lost-qualifier (R8).
//   pair 4 "Built monthly dashboards in Tableau for the sales team"           -> answered TWICE ("Built monthly dashboards", "Built monthly dashboards in Tableau"): DROPPED, repeated-pair; both texts are listed, in the AI's order.
//   pair 5 "Handled about 40 orders a day at the counter"                     -> no answer: DROPPED, missing; no text.
//   and one bullet for pair 9, which was never asked: ignored, not listed.

const LINES = [
  "Answered the phone and kept the stock sheet up to date in Excel",
  "Wrote SQL queries to reconcile order data",
  "Helped customers at the counter",
  "Built monthly dashboards in Tableau for the sales team",
  "Handled about 40 orders a day at the counter",
];
const FIRST_LINE_NUMBER = 4;
const PAIRS: BulletPair[] = LINES.map((text, i) => ({ id: i + 1, requirement: `Requirement ${i + 1}.`, skillId: "", line: FIRST_LINE_NUMBER + i, text }));
const ANSWER = {
  bullets: [
    { pair: 1, text: "Kept the stock sheet up to date in Excel" },
    { pair: 2, text: "Wrote 300 SQL queries" },
    { pair: 3, text: "customers at the counter" },
    { pair: 4, text: "Built monthly dashboards" },
    { pair: 4, text: "Built monthly dashboards in Tableau" },
    { pair: 9, text: "Never asked for" },
  ],
};
const DETAIL = [
  { pair: 2, reason: "new-number", texts: ["Wrote 300 SQL queries"] },
  { pair: 3, reason: "lost-qualifier", texts: ["customers at the counter"] },
  { pair: 4, reason: "repeated-pair", texts: ["Built monthly dashboards", "Built monthly dashboards in Tableau"] },
  { pair: 5, reason: "missing", texts: [] },
];

describe("T36: the dropped bullets, with the AI's own text, for the eval", () => {
  it("T36a: bulletsFromDetailed lists every dropped pair with the AI's own text(s), and agrees with bulletsFrom on everything else", () => {
    const d = bulletsFromDetailed(ANSWER, PAIRS, skills, 5);
    expect(d.droppedDetail).toEqual(DETAIL);
    expect(d.bullets).toEqual([{ pair: 1, line: 4, text: "Kept the stock sheet up to date in Excel" }]);
    expect(d.asked).toBe(5);
    expect(d.ignored).toBe(1);
    expect(d.dropped).toEqual(DETAIL.map((x) => ({ pair: x.pair, reason: x.reason })));
    const { droppedDetail: _detail, ...rest } = d;
    expect(rest).toEqual(bulletsFrom(ANSWER, PAIRS, skills, 5)); // the same verdicts: bulletsFrom itself is not changed and has no text of a dropped bullet
    expect(JSON.stringify(bulletsFrom(ANSWER, PAIRS, skills, 5))).not.toContain("Wrote 300");
  });

  const CV = "cv-2-german";
  const JOB = "northwind-operations-analyst";
  const ROW: BulletsEvalRow = {
    cv: CV, job: JOB, lang: "de",
    pairs: PAIRS.map((p) => ({ id: p.id, requirement: p.requirement, line: p.line, text: p.text })),
    asked: 5,
    accepted: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }],
    dropped: DETAIL.map((x) => ({ pair: x.pair, reason: x.reason as never })),
    droppedDetail: DETAIL.map((x) => ({ pair: x.pair, reason: x.reason as never, texts: x.texts })),
    usage: { inputTokens: 10, outputTokens: 5 },
    seconds: 1,
  };
  const RUN: BulletsEvalRun = { rows: [ROW], noPairs: [], failed: [], complete: true };

  it("T36b: the full-output lines: one line for each dropped bullet: run, pair, reason, the AI's text word for word, the cited line word for word", () => {
    expect(droppedLines(RUN)).toEqual([
      `DROPPED ${CV} x ${JOB} | pair 2 | new-number | AI text: "Wrote 300 SQL queries" | cited line 5: "Wrote SQL queries to reconcile order data"`,
      `DROPPED ${CV} x ${JOB} | pair 3 | lost-qualifier | AI text: "customers at the counter" | cited line 6: "Helped customers at the counter"`,
      `DROPPED ${CV} x ${JOB} | pair 4 | repeated-pair | AI text: "Built monthly dashboards" ; "Built monthly dashboards in Tableau" | cited line 7: "Built monthly dashboards in Tableau for the sales team"`,
      `DROPPED ${CV} x ${JOB} | pair 5 | missing | AI text: (none) | cited line 8: "Handled about 40 orders a day at the counter"`,
    ]);
  });

  it("T36c: the review sheet has a second section with the same four rows, and the accepted section is not changed", () => {
    const sheet = reviewSheet(RUN);
    const [accepted, dropped] = sheet.split("\n## ");
    expect(accepted).toContain(`| ${CV} x ${JOB} | 1 | line 4: "Answered the phone and kept the stock sheet up to date in Excel" | "Kept the stock sheet up to date in Excel" |  |  |`);
    expect(accepted).not.toContain("Wrote 300"); // the accepted section lists accepted bullets only
    expect(dropped.split("\n")[0]).toBe("Dropped bullets: the AI's own text next to the reason code and the cited CV line (read them for a rule that is too strict, and for wrong-line facts by eye)");
    const rows = dropped.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| run") && !l.startsWith("| ---"));
    expect(dropped).toContain("| run | pair | reason | AI's own text | cited CV line | rule too strict? (yes/no) |");
    expect(rows).toEqual([
      `| ${CV} x ${JOB} | 2 | new-number | "Wrote 300 SQL queries" | line 5: "Wrote SQL queries to reconcile order data" |  |`,
      `| ${CV} x ${JOB} | 3 | lost-qualifier | "customers at the counter" | line 6: "Helped customers at the counter" |  |`,
      `| ${CV} x ${JOB} | 4 | repeated-pair | "Built monthly dashboards" ; "Built monthly dashboards in Tableau" | line 7: "Built monthly dashboards in Tableau for the sales team" |  |`,
      `| ${CV} x ${JOB} | 5 | missing | (none) | line 8: "Handled about 40 orders a day at the counter" |  |`,
    ]);
  });

  it("T36d: a row with no captured text (an older writer) adds nothing: no second section, no DROPPED line", () => {
    const bare: BulletsEvalRun = { rows: [{ ...ROW, droppedDetail: undefined }], noPairs: [], failed: [], complete: true };
    expect(droppedLines(bare)).toEqual([]);
    expect(reviewSheet(bare)).not.toContain("Dropped bullets");
  });

  // T36e: the whole script, on a fake writer. The runs and their first pair come from the keys (hand work, tests/evalBulletsGuard.test.ts T35): four runs with a
  // pair; the first pair of each is on this line:
  //   cv-1-thin x northwind: line 4; cv-2-german x northwind: line 5; cv-2-german x brightwater: line 6; cv-4-skills-line x fjordlight: line 3.
  const FIRST_PAIR_LINES = [
    "cv-1-thin x northwind-operations-analyst | line 4: \"Answered the phone and kept the stock sheet up to date in Excel\"",
    "cv-2-german x northwind-operations-analyst | line 5: \"Schrieb SQL-Abfragen für die Finanzabteilung\"",
    "cv-2-german x brightwater-financial-planning-analyst | line 6: \"Built the dashboards in Power BI for the sales team\"",
    "cv-4-skills-line x fjordlight-frontend-developer | line 3: \"Skills: TypeScript, React, Git, Jest, accessibility\"",
  ];
  function harness() {
    const saves: { name: string; text: string }[] = [];
    let out = "";
    const deps: BulletsMainDeps = {
      args: [],
      env: { EXPECT_REQUEST_HASH: "5e3da9fa30", EXPECT_INSTRUCTIONS_LEN: "3011", GROQ_API_KEY: "dummy-not-a-key", GROQ_MODEL: "dummy" },
      loadEnv: () => {},
      fingerprint: async () => ({ hash10: "5e3da9fa30", instructionsLength: 3011, line: "FINGERPRINT: fake\n" }),
      write: async (ps) => ({
        // a fake AI: pair 1 is answered with a text that fails (dropped, new-word); every other pair gets its own line
        bullets: ps.slice(1).map((p) => ({ pair: p.id, text: p.line })),
        asked: ps.length,
        dropped: [{ pair: 1, reason: "new-word" }],
        droppedDetail: [{ pair: 1, reason: "new-word", texts: ["Invented zzz qqq"] }],
        usage: { inputTokens: 100, outputTokens: 20 },
        limits: { "x-ratelimit-remaining-tokens": "8000", "x-ratelimit-limit-tokens": "8000" },
      }),
      sleep: async () => {},
      now: () => 1_700_000_000_000,
      save: (name, text) => {
        saves.push({ name, text });
        return `eval-runs/${name}`;
      },
      out: (t) => void (out += t),
      err: () => {},
    };
    return { deps, saves, getOut: () => out };
  }

  it("T36e: the script saves a DROPPED line and a sheet row for every dropped bullet of the four runs, and prints none of the AI's text", async () => {
    const { deps, saves, getOut } = harness();
    expect(await evalBulletsMain(deps)).toBe(0);
    const full = saves.find((s) => s.name.startsWith("bullets-2"))!.text;
    const sheet = saves.find((s) => s.name.startsWith("bullets-review-"))!.text;
    const dropped = full.split("\n").filter((l) => l.startsWith("DROPPED "));
    expect(dropped).toHaveLength(4);
    FIRST_PAIR_LINES.forEach((frag, i) => {
      const [run, line] = frag.split(" | ");
      expect(dropped[i]).toBe(`DROPPED ${run} | pair 1 | new-word | AI text: "Invented zzz qqq" | cited ${line}`);
    });
    const section = sheet.split("\n## ")[1];
    expect(section.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| run") && !l.startsWith("| ---"))).toHaveLength(4);
    expect(section).toContain(`| cv-4-skills-line x fjordlight-frontend-developer | 1 | new-word | "Invented zzz qqq" | line 3: "Skills: TypeScript, React, Git, Jest, accessibility" |  |`);
    expect(getOut()).not.toContain("Invented zzz qqq"); // the printed report never quotes the AI
    expect(getOut().split("\n").filter((l) => l !== "").length).toBeLessThanOrEqual(15);
  });
});
