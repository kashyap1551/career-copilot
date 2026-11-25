import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { checkEveryCvKey } from "@/lib/engine/evalEveryCvKey";
import { compareBaseline, summarizeBaseline, type AdReading } from "@/lib/engine/evalEveryCvCompare";
import type { CvBuildResult, CvSkill } from "@/lib/engine/fromCv";
import type { Job, Requirement } from "@/lib/engine/types";

// EC-0b part 4 (docs/PLAN-EVERY-CV.md sections 9 and 10): today's product against the owner's key, on small INVENTED readings.
// Nothing here calls an AI. Every expectation is worked out by hand (the comments), never read from the code.
//
// The CV, as the page numbers it (contact line already redacted):
//   1 Alex Example
//   2 [email removed] | [phone removed]
//   3 Analyst 2021-2024: wrote SQL queries and Excel reports for the sales team.
//   4 Wrote small scripts to clean the weekly data.
//   5 Skills: Welding
const CV_LINES = [
  "Alex Example",
  "[email removed] | [phone removed]",
  "Analyst 2021-2024: wrote SQL queries and Excel reports for the sales team.",
  "Wrote small scripts to clean the weekly data.",
  "Skills: Welding",
];
const P = (name: string, skillId: string, listed: boolean, line: number, label: "named" | "inferred"): CvSkill => ({ name, skillId, listed, line, quote: "q", label });
const CV: CvBuildResult = {
  skills: [P("SQL", "sql", true, 3, "named"), P("Excel", "excel", true, 3, "named"), P("Welding", "new:welding", false, 5, "named"), P("Python", "python", true, 4, "inferred")],
  removed: [],
  duplicates: 0,
  unlisted: [{ id: "new:welding", name: "Welding" }],
};

const Q = { sql: "Strong SQL skills.", excel: "Excel for reporting.", weld: "A welding certificate.", py: "Experience with Python scripting.", rep: "Reporting to managers.", pres: "Presenting to clients." };
const req = (quote: string, importance: "must" | "nice", ...skillIds: string[]): Requirement => ({ quote, importance, skillIds });
const job = (requirements: Requirement[]): Job => ({
  id: "ad",
  title: "Invented role",
  company: null,
  source: null,
  constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
  requirements,
});
const AD: AdReading = {
  job: job([
    req(Q.sql, "must", "sql"), // met, line 3
    req(Q.excel, "must", "excel"), // met, line 3
    req(Q.weld, "must", "new:welding"), // unlisted: could not judge
    req(Q.py, "must", "python"), // Python is only an unticked inferred proposal: missing
    req(Q.rep, "nice", "reporting"), // missing
    req("Free coffee for all.", "nice", "new:coffee"), // not in any key block: an extra
  ]),
  removed: [],
  moved: [],
  unlisted: [{ id: "new:welding", name: "Welding" }, { id: "new:coffee", name: "Coffee" }],
  notCounted: [{ quote: Q.pres, importance: "must" }], // the reader set this sentence aside as a trait
};
const AD_TEXT = `${Object.values(Q).join("\n")}\nFree coffee for all.\nYou are a reliable person.`;

type R = { tag: "must" | "nice"; quote: string; v: string; lines?: string; unsure?: string };
const keyText = (rows: R[]) =>
  [
    ...rows.map((r, i) => `R${i + 1} [${r.tag}] "${r.quote}"\nverdict: ${r.v}\ncv line(s):${r.lines ? " " + r.lines : ""}\nunsure:${r.unsure ? " " + r.unsure : ""}\nwhy:`),
    `T1 [trait, not counted] "You are a reliable person."`,
  ].join("\n\n");
const KEY_ROWS: R[] = [
  { tag: "must", quote: Q.sql, v: "met", lines: "3" }, // R1
  { tag: "must", quote: Q.excel, v: "partly", lines: "3" }, // R2
  { tag: "must", quote: Q.weld, v: "met", lines: "5" }, // R3
  { tag: "must", quote: Q.py, v: "met", lines: "4" }, // R4
  { tag: "nice", quote: Q.rep, v: "none" }, // R5
  { tag: "must", quote: Q.pres, v: "none" }, // R6
];
const run = (rows: R[] = KEY_ROWS, ad: AdReading = AD, extra: { pair?: string; crossLanguage?: boolean } = {}) => {
  const key = checkEveryCvKey(keyText(rows), AD_TEXT, CV_LINES.length);
  expect(key.state, key.problems.map((p) => `${p.block}: ${p.sentence}`).join(" | ")).toBe("complete");
  return compareBaseline({ pair: extra.pair ?? "pair-xx", crossLanguage: extra.crossLanguage ?? false, key, cvLines: CV_LINES, cv: CV, ad, skills });
};
const byId = (r: ReturnType<typeof run>) => Object.fromEntries(r.rows.map((x) => [x.id, x]));

describe("EC-0b part 4: today's product against the key", () => {
  it("C1: the class of every key requirement (hand-worked)", () => {
    const r = byId(run());
    // R1 today met (line 3), key met: agree.   R2 today met, key partly: FALSE MET.   R3 unlisted: could not judge.
    // R4 python not ticked, today missing, key met: FALSE MISSING.   R5 today missing, key none: agree.   R6 set aside as a trait by the reader: dropped.
    expect([r.R1.class, r.R2.class, r.R3.class, r.R4.class, r.R5.class, r.R6.class]).toEqual(["agree", "false-met", "could-not-judge", "false-missing", "agree", "dropped"]);
    expect(r.R1.today).toEqual({ kind: "met", line: 3 });
    expect(r.R4.today).toEqual({ kind: "missing" });
    expect(r.R3.today).toEqual({ kind: "unjudged" });
    expect(r.R6.today.kind).toBe("not-read");
  });

  it("C2: the totals: 2 agree, 1 false met, 1 false missing, 1 could not judge, 1 dropped; 4 of 6 have an answer today", () => {
    const x = run();
    expect(x.counted).toEqual({ agree: 2, "false-met": 1, "false-missing": 1, "could-not-judge": 1, dropped: 1, other: 0 });
    expect([x.answered, x.countedTotal]).toEqual([4, 6]);
  });

  it("C3: where a dropped sentence went: the reader set it aside as a trait (notCounted)", () => {
    expect(byId(run()).R6.droppedWhere).toBe("set aside as not a skill (a trait)");
  });

  it("C4: a read requirement that is in no key block is an extra, listed with its status", () => {
    expect(run().extras).toEqual([{ quote: "Free coffee for all.", importance: "nice", status: "unjudged" }]);
  });

  it("C5: all agree: a key that says what today's page says", () => {
    const rows: R[] = [
      { tag: "must", quote: Q.sql, v: "met", lines: "3" },
      { tag: "must", quote: Q.excel, v: "met", lines: "3" },
      { tag: "must", quote: Q.py, v: "none" },
      { tag: "nice", quote: Q.rep, v: "partly", lines: "4" },
    ];
    const x = run(rows);
    expect(x.counted).toEqual({ agree: 4, "false-met": 0, "false-missing": 0, "could-not-judge": 0, dropped: 0, other: 0 });
  });

  it("C6: the level today against the key's level (Strong, Good, Stretch, Long shot): stronger, equal, weaker", () => {
    // Today: musts judged are SQL met, Excel met, Python missing; the unlisted welding must is not judged: 1 missing = Good
    // ('Good (skills only; 1 must-have not judged)').
    const base = run();
    expect(base.today).toEqual({ label: "Good (skills only; 1 must-have not judged)", level: "good" });
    // KEY_ROWS: musts R1 met, R2 partly, R3 met, R4 met, R6 none: 2 missing = Stretch. Today Good is stronger than Stretch.
    expect([base.keyLevel, base.levelVsKey]).toEqual(["stretch", "stronger"]);
    // A key with one missing must (R2 partly only) is Good: equal.
    const equal = run([
      { tag: "must", quote: Q.sql, v: "met", lines: "3" }, { tag: "must", quote: Q.excel, v: "partly", lines: "3" },
      { tag: "must", quote: Q.weld, v: "met", lines: "5" }, { tag: "must", quote: Q.py, v: "met", lines: "4" },
    ]);
    expect([equal.keyLevel, equal.levelVsKey]).toEqual(["good", "equal"]);
    // A key with every must met is Strong: today's Good is weaker.
    const weaker = run([
      { tag: "must", quote: Q.sql, v: "met", lines: "3" }, { tag: "must", quote: Q.excel, v: "met", lines: "3" },
      { tag: "must", quote: Q.weld, v: "met", lines: "5" }, { tag: "must", quote: Q.py, v: "met", lines: "4" },
    ]);
    expect([weaker.keyLevel, weaker.levelVsKey]).toEqual(["strong", "weaker"]);
  });

  it("C7: unsure rows are listed apart and NOT counted in any total", () => {
    const rows = KEY_ROWS.map((r, i) => (i === 1 ? { ...r, unsure: "yes" } : r)); // R2 (the false met) is unsure
    const x = run(rows);
    expect(x.unsureRows.map((u) => u.id)).toEqual(["R2"]);
    expect(x.counted).toEqual({ agree: 2, "false-met": 0, "false-missing": 1, "could-not-judge": 1, dropped: 1, other: 0 });
    expect([x.answered, x.countedTotal]).toEqual([3, 5]);
    expect(x.rows.map((r) => r.id)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6"]); // still present as rows, marked unsure
  });

  it("C8: the recall ceiling over the non-unsure 'met' rows: R1 line 3 reachable, R3 line 5 reachable (unlisted entry), R4 line 4 recoverable", () => {
    const c = run().ceiling;
    expect([c.reachable, c.recoverable, c.needsPromptChange, c.total]).toEqual([2, 1, 0, 3]);
    expect(c.ceiling).toBeCloseTo(2 / 3, 10);
    // an unsure 'met' row is left out of the ceiling
    const rows = KEY_ROWS.map((r, i) => (i === 3 ? { ...r, unsure: "yes" } : r));
    expect(run(rows).ceiling.total).toBe(2);
  });

  it("C9: several read requirements from one key sentence: met only if all are met; a missing one makes it missing; met plus could-not-judge is could-not-judge", () => {
    const sentence = "Strong SQL and Excel skills.";
    const mk = (items: Requirement[]): AdReading => ({ ...AD, job: job(items), notCounted: [] });
    const rows: R[] = [{ tag: "must", quote: sentence, v: "met", lines: "3" }];
    const key = checkEveryCvKey(keyText(rows), `${sentence}\nYou are a reliable person.`, 5);
    const go = (ad: AdReading) => compareBaseline({ pair: "p", crossLanguage: false, key, cvLines: CV_LINES, cv: CV, ad, skills }).rows[0].today.kind;
    expect(go(mk([req(sentence, "must", "sql"), req(sentence, "must", "excel")]))).toBe("met"); // both met
    expect(go(mk([req(sentence, "must", "sql"), req(sentence, "must", "python")]))).toBe("missing"); // python not on the profile
    expect(go(mk([req(sentence, "must", "sql"), req(sentence, "must", "new:welding")]))).toBe("unjudged"); // one met, one could not be judged
  });

  it("C10: a read requirement pairs with a key sentence by quote (equal, or one inside the other with a real word); an unrelated one does not", () => {
    const key = checkEveryCvKey(keyText([{ tag: "must", quote: Q.sql, v: "met", lines: "3" }]), AD_TEXT, 5);
    const longer = { ...AD, job: job([req(`We need: ${Q.sql} Several years.`, "must", "sql")]), notCounted: [] };
    expect(compareBaseline({ pair: "p", crossLanguage: false, key, cvLines: CV_LINES, cv: CV, ad: longer, skills }).rows[0].today.kind).toBe("met");
    const unrelated = { ...AD, job: job([req("Something else entirely.", "must", "sql")]), notCounted: [] };
    const x = compareBaseline({ pair: "p", crossLanguage: false, key, cvLines: CV_LINES, cv: CV, ad: unrelated, skills });
    expect(x.rows[0].class).toBe("dropped");
    expect(x.extras).toHaveLength(1);
  });

  it("C11: a key that is not complete is refused (no comparison against a half-written key)", () => {
    const half = checkEveryCvKey(keyText([{ tag: "must", quote: Q.sql, v: "met", lines: "3" }, { tag: "must", quote: Q.excel, v: "" }]), AD_TEXT, 5);
    expect(() => compareBaseline({ pair: "p", crossLanguage: false, key: half, cvLines: CV_LINES, cv: CV, ad: AD, skills })).toThrow(/complete/);
  });
});

describe("EC-0b part 4: totals, and the cross-language pairs on their own", () => {
  it("C12: the totals add up, and the cross-language pairs (06 and 10) have their own totals", () => {
    const a = run(KEY_ROWS, AD, { pair: "pair-05" }); // 2 agree, 1 false met, 1 false missing, 1 could not judge, 1 dropped
    const b = run(KEY_ROWS, AD, { pair: "pair-06", crossLanguage: true });
    const c = run(
      [{ tag: "must", quote: Q.sql, v: "met", lines: "3" }, { tag: "must", quote: Q.excel, v: "met", lines: "3" }],
      AD,
      { pair: "pair-10", crossLanguage: true },
    ); // 2 agree
    const s = summarizeBaseline([a, b, c]);
    expect(s.all.counted).toEqual({ agree: 6, "false-met": 2, "false-missing": 2, "could-not-judge": 2, dropped: 2, other: 0 });
    expect(s.crossLanguage.counted).toEqual({ agree: 4, "false-met": 1, "false-missing": 1, "could-not-judge": 1, dropped: 1, other: 0 });
    expect([s.all.answered, s.all.total]).toEqual([4 + 4 + 2, 6 + 6 + 2]);
    expect(s.crossLanguage.pairs).toEqual(["pair-06", "pair-10"]);
    expect(s.levels).toEqual({ stronger: 2, equal: 0, weaker: 1, "not comparable": 0 }); // a and b: today Good against a key of Stretch is stronger; c: today Good against a key of Strong is weaker
  });

  it("C13: the compare uses the page's own functions (source guard)", () => {
    const src = readFileSync(join(process.cwd(), "lib/engine/evalEveryCvCompare.ts"), "utf8");
    for (const name of ["buildProfile(", "initialConfirm(", "engineView(", "match(", "reportFor(", "guardedContains(", "recallCeiling("]) expect(src, name).toContain(name);
  });
});
