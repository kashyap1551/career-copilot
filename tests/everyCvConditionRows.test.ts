import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { checkEveryCvKey, everyCvKeyLevel } from "@/lib/engine/evalEveryCvKey";
import { compareBaseline, summarizeBaseline, type AdReading } from "@/lib/engine/evalEveryCvCompare";
import { baselineJson, baselineMarkdown } from "@/lib/engine/evalEveryCvReport";
import { toViewAnswers } from "@/lib/cv/checkBridge";
import { checkMarkdown } from "@/lib/engine/evalEveryCvCheckReport";
import { numbersOf, planFor, scorePair } from "@/lib/engine/evalEveryCvCheckScore";
import { CALL, pairInput, X, type Spec } from "./support/checkEvalWorld";
import type { CvBuildResult, CvSkill } from "@/lib/engine/fromCv";
import type { Job, Requirement } from "@/lib/engine/types";

// EC-8c part 3.1, AM20 (docs/PLAN-EVERY-CV.md): a CONDITION ROW is a key row whose sentence the ad reading put into constraints (minYears, languages or
// otherConditions) and not into a requirement. The person types those (years, language levels); the CV text never decides them. They get their own table
// (never hidden) and are left out of the counts, the recall ceiling and the key level. Invented data, hand-worked, no AI.
//
// The CV, as the page numbers it:  1 Alex Example / 2 [email removed] | [phone removed] / 3 Analyst 2021-2024: wrote SQL queries and Excel reports for the
// sales team. / 4 Wrote small scripts to clean the weekly data. / 5 Skills: Welding
// The key (R1 to R7), and what the invented ad reading did with each sentence:
//   R1 must  SQL                            met   l3   read as a requirement (listed, on the profile)           -> today met (line 3): agree
//   R2 must  A welding certificate          met   l5   read as a requirement (unlisted)                         -> could not judge
//   R3 must  At least two years ...         met   l3   put into constraints.minYears (extraction quote = it)    -> CONDITION ROW
//   R4 must  Fluent English and German ...  met   l3   put into constraints.languages (extraction quote = it)   -> CONDITION ROW
//   R5 must  Registered analyst with ...    partly l3  unsure; contains the otherConditions quote "Registered analyst" -> CONDITION ROW (and unsure)
//   R6 must  You can present to clients     none       set aside by the reader as a trait (notCounted)          -> Dropped, NOT a condition row
//   R7 nice  Reporting to managers          none       read as a requirement (listed, not on the profile)       -> missing: agree

const CV_LINES = [
  "Alex Example",
  "[email removed] | [phone removed]",
  "Analyst 2021-2024: wrote SQL queries and Excel reports for the sales team.",
  "Wrote small scripts to clean the weekly data.",
  "Skills: Welding",
];
const P = (name: string, skillId: string, listed: boolean, line: number): CvSkill => ({ name, skillId, listed, line, quote: "q", label: "named" });
const CV: CvBuildResult = { skills: [P("SQL", "sql", true, 3), P("Excel", "excel", true, 3), P("Welding", "new:welding", false, 5)], removed: [], duplicates: 0, unlisted: [{ id: "new:welding", name: "Welding" }] };

const Q = {
  sql: "Strong SQL skills.", weld: "A welding certificate.", years: "At least two years of experience as an analyst.",
  lang: "Fluent English and German, written and spoken.", reg: "Registered analyst with a recognised certificate.", pres: "You can present to clients.", rep: "Reporting to managers.",
};
const req = (quote: string, importance: "must" | "nice", ...skillIds: string[]): Requirement => ({ quote, importance, skillIds });
const job = (requirements: Requirement[]): Job => ({
  id: "ad", title: "Invented role", company: null, source: null,
  constraints: { languages: [{ code: "en", level: "C1" }, { code: "de", level: "C1" }], location: null, remote: null, minYears: 2, startDate: null, otherConditions: [{ quote: "Registered analyst" }] },
  requirements,
});
const EXTRACTION = {
  minYears: { years: 2, quote: Q.years },
  languages: [{ language: "English", levelWording: "Fluent", quote: Q.lang }, { language: "German", levelWording: "Fluent", quote: Q.lang }],
  otherConditions: [{ quote: "Registered analyst" }],
};
const AD: AdReading = {
  job: job([req(Q.sql, "must", "sql"), req(Q.weld, "must", "new:welding"), req(Q.rep, "nice", "reporting")]),
  removed: [], moved: [], unlisted: [{ id: "new:welding", name: "Welding" }],
  notCounted: [{ quote: Q.pres, importance: "must" }],
  extraction: EXTRACTION,
};
const ROWS = [
  { tag: "must", quote: Q.sql, v: "met", lines: "3", unsure: "" },
  { tag: "must", quote: Q.weld, v: "met", lines: "5", unsure: "" },
  { tag: "must", quote: Q.years, v: "met", lines: "3", unsure: "" },
  { tag: "must", quote: Q.lang, v: "met", lines: "3", unsure: "" },
  { tag: "must", quote: Q.reg, v: "partly", lines: "3", unsure: "yes" },
  { tag: "must", quote: Q.pres, v: "none", lines: "", unsure: "" },
  { tag: "nice", quote: Q.rep, v: "none", lines: "", unsure: "" },
];
const keyText = ROWS.map((r, i) => `R${i + 1} [${r.tag}] "${r.quote}"\nverdict: ${r.v}\ncv line(s):${r.lines ? " " + r.lines : ""}\nunsure:${r.unsure ? " " + r.unsure : ""}\nwhy:`).join("\n\n") + '\n\nT1 [trait, not counted] "You are a reliable person."';
const adText = `${Object.values(Q).join("\n")}\nYou are a reliable person.`;
const key = () => checkEveryCvKey(keyText, adText, CV_LINES.length);
const run = (ad: AdReading = AD, withKept = false) => compareBaseline({ pair: "pair-x", crossLanguage: false, key: key(), cvLines: CV_LINES, cv: CV, ad, skills, withKept });

describe("EC-8c 3.1 condition rows (CR)", () => {
  it("CR1: R3, R4 and R5 are condition rows (in the order of the key), shown apart; R5 is also unsure but is listed there, not among the unsure rows", () => {
    const p = run();
    expect(p.conditionRows.map((r) => r.id)).toEqual(["R3", "R4", "R5"]);
    expect(p.rows.map((r) => r.id)).toEqual(["R1", "R2", "R6", "R7"]);
    expect(p.unsureRows).toEqual([]);
  });

  it("CR2: the trait set aside (R6) stays a Dropped row, and a row read as a requirement is never a condition row", () => {
    const p = run();
    expect(p.rows.find((r) => r.id === "R6")).toMatchObject({ class: "dropped", droppedWhere: "set aside as not a skill (a trait)" });
    expect(p.conditionRows.some((r) => r.id === "R1" || r.id === "R2")).toBe(false);
  });

  it("CR3: the counts leave them out: agree 2 (R1, R7), could not judge 1 (R2), dropped 1 (R6); counted 4, answered 2 (R1 met, R7 missing)", () => {
    const p = run();
    expect(p.counted).toEqual({ agree: 2, "false-met": 0, "false-missing": 0, "could-not-judge": 1, dropped: 1, other: 0 });
    expect([p.answered, p.countedTotal]).toEqual([2, 4]);
    expect(summarizeBaseline([p]).all.total).toBe(4);
  });

  it("CR4: the recall ceiling leaves them out: the key's met rows that count are R1 (line 3) and R2 (line 5): 2 of 2, not 4", () => {
    expect(run().ceiling).toMatchObject({ total: 2, reachable: 2 });
  });

  it("CR5: the key level leaves them out: musts R1 met, R2 met, R6 none = 1 missing = Good (with R3 to R5 it was 2 missing = Stretch, since R5 is partly); the old value stays available", () => {
    const p = run();
    expect(p.keyLevel).toBe("good");
    expect(p.keyLevelWithConditions).toBe("stretch");
    expect(everyCvKeyLevel(key())).toBe("stretch");
    expect(everyCvKeyLevel(key(), new Set(["R3", "R4", "R5"]))).toBe("good");
    expect(everyCvKeyLevel(key(), new Set(["R1", "R2", "R3", "R4", "R5", "R6"]))).toBe("no-level"); // no must left
  });

  it("CR6: a reading saved before the extraction was kept (no `extraction`) can only find the otherConditions quote: R5 is a condition row, R3 and R4 stay Dropped", () => {
    const { extraction: _x, ...old } = AD;
    void _x;
    const p = run(old);
    expect(p.conditionRows.map((r) => r.id)).toEqual(["R5"]);
    expect(p.rows.filter((r) => r.class === "dropped").map((r) => r.id)).toEqual(["R3", "R4", "R6"]);
  });

  it("CR7: the same split with the same-name match on (withKept): nothing changes for the condition rows", () => {
    expect(run(AD, true).conditionRows.map((r) => r.id)).toEqual(["R3", "R4", "R5"]);
  });

  it("CR8: baseline.md lists them in their own table with the key level with and without them, never hidden; baseline.json holds them too", () => {
    const p = run();
    const input = { info: { runId: "r", fingerprint: "f".repeat(64), keyCommit: "k", vocabulary: "v".repeat(64), dry: false }, pairs: [p], calls: [], stopped: null, failed: [] };
    const md = baselineMarkdown(input);
    expect(md).toContain("## Condition rows (typed by the person, never decided from the CV text; not counted)");
    expect(md).toMatch(/\| pair-x \| R3 \| must \| met \| .*At least two years/);
    expect(md).toMatch(/\| pair-x \| R5 \| must \| partly \|/);
    expect(md).toContain("pair-x: key level without these rows Good, with them Stretch.");
    expect(JSON.stringify(baselineJson(input))).toContain('"conditionRows"');
  });

  // The check eval. World CW: the CV of pair X (5 lines), the ad has two requirements (R1 must "equipment in order", unlisted; R2 nice Excel, listed) and
  // a years condition (minYears 5, extraction quote = the key's R3 sentence). The key: R1 met l3, R2 met l5, R3 must PARTLY l2 (a condition row).
  // The check sends R1 and the AI says met on CV line 3 ("Kept pastry molds in order daily"): R1 agree, R2 met by the list: both key-met rows are found.
  //   Without AM20 R3 would be a Dropped row: key met rows 2 (R3 is partly), found 2, and the key level Good (R3 partly = 1 missing must) against a check
  //   level Strong = "stronger". With AM20: key level Strong (R1 met), check level Strong: equal. Numbers 1 and 4 are not hurt.
  it("CR9: in the check eval the condition row is in no number: key met 2, found 2, false met 0, the key level is Strong (Good with the row) and the level is 'equal'; checkMarkdown lists it", () => {
    const CW: Spec = {
      ...X,
      pair: "pair-cw",
      reqs: [{ quote: "You keep equipment in order.", importance: "must", skillIds: ["new:equipment-order"] }, { quote: "Excel is a plus.", importance: "nice", skillIds: ["excel"] }],
      key: [{ v: "met", lines: "3" }, { v: "met", lines: "5" }],
    };
    const R3 = "You have run a shift for five years.";
    const keyText = `R1 [must] "You keep equipment in order."\nverdict: met\ncv line(s): 3\nunsure:\nwhy:\n\nR2 [nice] "Excel is a plus."\nverdict: met\ncv line(s): 5\nunsure:\nwhy:\n\nR3 [must] "${R3}"\nverdict: partly\ncv line(s): 2\nunsure:\nwhy:`;
    const key = checkEveryCvKey(keyText, `You keep equipment in order.\nExcel is a plus.\n${R3}`, CW.cvLines.length);
    const base = pairInput(CW, {
      key,
      ad: {
        job: { ...pairInput(CW).ad.job, constraints: { languages: [], location: null, remote: null, minYears: 5, startDate: null, otherConditions: [] } },
        removed: [], moved: [], unlisted: CW.unlisted, notCounted: [],
        extraction: { minYears: { years: 5, quote: R3 }, languages: [], otherConditions: [] },
      },
    });
    const { plan } = planFor(base);
    const bridged = toViewAnswers({ requirements: plan.requirements, entries: plan.entries }, { answers: [{ requirement: 1, verdict: "met", entry: 3, quote: "pastry molds in order" }], thrownAway: 0 });
    if (!bridged.ok) throw new Error("the invented reply is not readable");
    const r = scorePair({ ...base, call: CALL(2000, 1000), answered: { key: plan.key, answers: bridged.answers, thrownAway: 0, sent: plan.requirements.length } });
    expect(r.conditionRows.map((c) => c.id)).toEqual(["R3"]);
    expect(r.rows.map((x) => x.id)).toEqual(["R1", "R2"]);
    const n = numbersOf([r]);
    expect([n.keyMet, n.found, n.falseMet]).toEqual([2, 2, 0]);
    expect([r.keyLevel, r.keyLevelWithConditions, r.checkLevel, r.levelVsKey]).toEqual(["strong", "good", "strong", "equal"]);
    const md = checkMarkdown({ info: { runId: "r", counted: false, dry: false, fingerprint: "f".repeat(64), requestHash: "h", instructionsLength: 2665, model: "m", readingVersion: "3", vocabulary: "v".repeat(64), baselineRun: "b", keyCommit: "k", head: "h" } as never, results: [r], stopped: null, failed: [] });
    expect(md).toContain("## Condition rows (typed by the person, never decided from the CV text; not counted)");
    expect(md).toContain("pair-cw: key level without these rows Strong, with them Good.");
  });
});
