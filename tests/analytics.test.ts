import { describe, expect, it } from "vitest";
import { ANALYTICS_TOP, analyticsFrom, type Analytics, type AnalyticsLine } from "@/app/analytics";
import { profileReport } from "@/app/fitReport";
import { roadmapBox, roadmapBoxFrom } from "@/app/roadmap";
import { roadmapReport, roadmapReportFrom } from "@/app/roadmapReport";
import { rankedAdRows } from "@/app/savedAdRows";
import { screenOutcomes } from "@/app/screenOutcomes";
import type { BuiltProfile } from "@/lib/cv/profile";
import type { Job } from "@/lib/engine/types";
import * as messages from "@/lib/saved/messages";
import { ad, ad1, ad2, ad3, ad4, must, nice, person, skills } from "./support/roadmapFixtures";
import { reportNumbers } from "./support/reportNumbers";
import { tenJobs } from "./support/tenAds";
import { adsViaPage, inputsViaPage, openedAd, pastedId, savedIdsFor } from "./support/viaPage";

// Step 8.2, stage 1, tests first (docs/PLAN-8.2.md sections 7 and 8: T1 to T14, T16 and T23). EVERY expected line, kind, bar and number list below is a
// literal written from the hand cases of section 7 BEFORE any code existed; none is imported from the code or copied from running it. The code
// was a stub when these were written (analyticsFrom returns null, the messages are empty strings), so the tests fail on an assertion. Every test that
// builds ads builds them the way the page does: job id "pasted-ad", distinct saved ids, through roadmapAds (tests/support/viaPage.ts).
//
// The `kind` of each line is chosen HERE (section 2 names the six kinds but not which line has which): "basis" the basis line; "heading" the
// three block headings; "note" a parenthesis or a note (A7, A9b, A12); "level" a level line (it carries the bar); "skill" an asked-skill row;
// "plain" the not-counted line, the more-skills line and the your-skills none line.

type Row = [string, AnalyticsLine["kind"], { n: number; of: number } | null];
const TITLE = "Your analytics";
const TAIL = " Every number was counted by the app from them; none is a prediction.";
const LEVELS_HEAD = "Fit levels across your saved ads";
const LEVELS_NOTE = "(These are the levels shown on your saved ads, counted against the profile in use.)";
const NO_LEVEL_NOTE = "No level means the app could not judge those ads; the saved ads list says why for each.";
const ALT_NOTE = "A requirement that accepts several skills is counted once for each of them.";

const B = (t: string): Row => [t, "basis", null];
const H = (t: string): Row => [t, "heading", null];
const N = (t: string): Row => [t, "note", null];
const K = (t: string): Row => [t, "skill", null];
const P = (t: string): Row => [t, "plain", null];
const V = (t: string, n: number, of: number): Row => [t, "level", { n, of }];

const rows = (a: Analytics): Row[] => a.lines.map((l) => [l.text, l.kind, l.bar]);

// ---- the hand tables of section 7 -------------------------------------------------------------------------------------------------
const S_SQL = "SQL (on your profile): must-have in 3 ads";
const S_PY = "Python (not on your profile): must-have in 2 ads, nice-to-have in 1 ad";
const S_TAB = "Tableau (you are learning it, expected 2027-03-01): must-have in 1 ad, nice-to-have in 2 ads";
const S_EXC = "Excel (on your profile): must-have in 1 ad, nice-to-have in 1 ad";
const S_PBI = "Power BI (not on your profile): nice-to-have in 1 ad";
const ASK4 = "Skills asked across your 4 saved ads";
const YOURS4 = "Skills of yours that are asked for in your 4 saved ads";
const MORE = (t: string) => P(t);

const R1_HEAD: Row[] = [B("Based on 4 saved ads we could judge and the profile in use." + TAIL), H(LEVELS_HEAD), N(LEVELS_NOTE)];
const R1_ASKED: Row[] = [H(ASK4), K(S_SQL), K(S_PY), K(S_TAB), K(S_EXC), K(S_PBI), H(YOURS4), K(S_SQL), K(S_EXC)];
const R1: Row[] = [
  ...R1_HEAD,
  V("Strong: 1 of your 4 saved ads", 1, 4),
  V("Good: 3 of your 4 saved ads", 3, 4),
  V("Stretch: 0 of your 4 saved ads", 0, 4),
  V("Long shot: 0 of your 4 saved ads", 0, 4),
  ...R1_ASKED,
];
const R1_NUMBERS = [4, 1, 4, 3, 4, 0, 4, 0, 4, 4, 3, 2, 1, 1, 2, 1, 1, 1, 4, 3, 1, 1];

const R2: Row[] = [
  ...R1_HEAD,
  V("Strong: 1 of your 4 saved ads", 1, 4),
  V("Good: 2 of your 4 saved ads", 2, 4),
  V("Stretch: 0 of your 4 saved ads", 0, 4),
  V("Long shot: 1 of your 4 saved ads", 1, 4),
  ...R1_ASKED,
];
const R2_NUMBERS = [4, 1, 4, 2, 4, 0, 4, 1, 4, 4, 3, 2, 1, 1, 2, 1, 1, 1, 4, 3, 1, 1];

const R3_HEAD: Row[] = [B("Based on 10 saved ads we could judge and the profile in use." + TAIL), H(LEVELS_HEAD), N(LEVELS_NOTE)];
const R3: Row[] = [
  ...R3_HEAD,
  V("Strong: 0 of your 10 saved ads", 0, 10),
  V("Good: 10 of your 10 saved ads", 10, 10),
  V("Stretch: 0 of your 10 saved ads", 0, 10),
  V("Long shot: 0 of your 10 saved ads", 0, 10),
  H("Skills asked across your 10 saved ads"),
  K("SQL (you are learning it, expected 2027-06-01): must-have in 10 ads"),
  P("Skills of yours that are asked for in your 10 saved ads: none."),
];
const R3_NUMBERS = [10, 0, 10, 10, 10, 0, 10, 0, 10, 10, 10, 10];

const R3D: Row[] = [
  ...R3_HEAD,
  V("Strong: 10 of your 10 saved ads", 10, 10),
  V("Good: 0 of your 10 saved ads", 0, 10),
  V("Stretch: 0 of your 10 saved ads", 0, 10),
  V("Long shot: 0 of your 10 saved ads", 0, 10),
  H("Skills asked across your 10 saved ads"),
  K("SQL (on your profile): must-have in 10 ads"),
  H("Skills of yours that are asked for in your 10 saved ads"),
  K("SQL (on your profile): must-have in 10 ads"),
];
const R3D_NUMBERS = [10, 10, 10, 0, 10, 0, 10, 0, 10, 10, 10, 10, 10];

const R6: Row[] = [
  B("Based on 3 saved ads we could judge and the profile in use." + TAIL),
  H(LEVELS_HEAD),
  N(LEVELS_NOTE),
  V("Strong: 0 of your 3 saved ads", 0, 3),
  V("Good: 0 of your 3 saved ads", 0, 3),
  V("Stretch: 0 of your 3 saved ads", 0, 3),
  V("Long shot: 0 of your 3 saved ads", 0, 3),
  V("No level: 3 of your 3 saved ads", 3, 3),
  N(NO_LEVEL_NOTE),
  H("Skills asked across your 3 saved ads"),
  K("Python (not on your profile): must-have in 2 ads"),
  K("SQL (not on your profile): must-have in 2 ads"),
  N(ALT_NOTE),
  P("Skills of yours that are asked for in your 3 saved ads: none."),
];
const R6_NUMBERS = [3, 0, 3, 0, 3, 0, 3, 0, 3, 3, 3, 3, 2, 2, 3];

const R9: Row[] = [
  B("Based on 1 saved ad we could judge and the profile in use." + TAIL),
  H(LEVELS_HEAD),
  N(LEVELS_NOTE),
  V("Strong: 0 of your 1 saved ad", 0, 1),
  V("Good: 0 of your 1 saved ad", 0, 1),
  V("Stretch: 0 of your 1 saved ad", 0, 1),
  V("Long shot: 0 of your 1 saved ad", 0, 1),
  V("No level: 1 of your 1 saved ad", 1, 1),
  N(NO_LEVEL_NOTE),
  H("Skills asked across your 1 saved ad"),
  K("Python (not on your profile): must-have in 1 ad, nice-to-have in 1 ad"),
  K("SQL (not on your profile): must-have in 1 ad"),
  N(ALT_NOTE),
  P("Skills of yours that are asked for in your 1 saved ad: none."),
];
const R9_NUMBERS = [1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1];

// ---- the people and ads of section 7 ----------------------------------------------------------------------------------------------
const prog = (name: string, date: string) => ({ name, date });
const FOUR = () => [ad1(), ad2(), ad3(), ad4()];
const BLOCKED = () => [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()];
const r3Person = (date: string) => person({ keptIds: ["tableau", "excel"], inProgress: [prog("SQL", date)] });
const r3dPerson = () => person({ keptIds: ["sql", "tableau", "excel"], inProgress: [] });
const noSkills = () => person({ keptIds: [], inProgress: [] });
const R6_ADS = () => [
  ad("p1", "Alpha Analyst", "Invented Co Two", [must("sql", "python")]), // ONE must-have that accepts SQL or Python
  ad("p2", "Beta Analyst", "Invented Co Three", [must("python")]),
  ad("p3", "Gamma Analyst", "Invented Co Four", [must("sql")]),
];
const R9_ADS = () => [ad("solo", "Solo Analyst", "Invented Co Six", [must("sql", "python"), must("python"), nice("python")])];

// ---- the page's way ---------------------------------------------------------------------------------------------------------------
const analytics = (built: BuiltProfile | null, jobs: Job[], from?: number, top?: number, savedIds?: string[], jobIdOf?: (i: number) => string) =>
  analyticsFrom(inputsViaPage(built, jobs, savedIds, jobIdOf), built, skills, top, from);
function got(a: Analytics | null): Analytics {
  expect(a, "analytics were expected, got null").not.toBeNull();
  return a as Analytics;
}
const NAMES = ["SQL", "Python", "Tableau", "Excel", "Power BI"];
const numbers = (a: Analytics) => reportNumbers([a.title, ...a.lines.map((l) => l.text)], NAMES);
const fromAsked = (a: Analytics): Row[] => rows(a).slice(rows(a).findIndex((r) => r[0].startsWith("Skills asked across")));

describe("the analytics' lines (ads built the way the page does)", () => {
  it("T1: R1, the four-ad example: title, lines, kinds and bars", () => {
    const a = got(analytics(person(), FOUR(), 4));
    expect(a.title).toBe(TITLE);
    expect(rows(a)).toEqual(R1);
  });

  it("T2: R2, one ad blocked by its city: Long shot 1; the asked lists are unchanged", () => {
    expect(rows(got(analytics(person(), BLOCKED(), 4)))).toEqual(R2);
  });

  it("T3a: R3, the ten ads built by the real buildJob, SQL in progress, the real gate", () => {
    expect(rows(got(analytics(r3Person("2027-06-01"), tenJobs())))).toEqual(R3);
  });

  it("T3b: R3d, the same ten ads with SQL, Tableau and Excel all had: Strong 10, SQL 'on your profile' in both lists", () => {
    expect(rows(got(analytics(r3dPerson(), tenJobs())))).toEqual(R3D);
  });

  it("T4: R6, no skills on the profile: No level 3 with its note, tie order Python before SQL, the several-skills note, your skills none", () => {
    expect(rows(got(analytics(noSkills(), R6_ADS(), 3)))).toEqual(R6);
  });

  it("T5: R9, one name twice in one ad: Python counts must 1 and nice 1; SQL must 1", () => {
    expect(rows(got(analytics(noSkills(), R9_ADS(), 1)))).toEqual(R9);
  });

  it("T6: null for no profile, no saved ads, 9 counted ads at the real gate, zero counted ads; NOT null with exactly 10 (the boundary)", () => {
    expect(analytics(null, FOUR(), 4)).toBeNull();
    expect(analytics(person(), [], 4)).toBeNull();
    expect(analytics(r3Person("2027-06-01"), tenJobs().slice(0, 9))).toBeNull(); // 9 of 10
    expect(analytics(person(), [ad("n", "Empty", "Invented Co", [])], 1)).toBeNull(); // hand count: 0 counted
    expect(analytics(r3Person("2027-06-01"), tenJobs())).not.toBeNull(); // exactly 10: the boundary
  });

  it("T7a: R1 with a limit of 1, 2, 3, 4 and 5: the first rows and any tie, then the more-skills line; the your-skills list is cut from its OWN list", () => {
    const a1 = fromAsked(got(analytics(person(), FOUR(), 4, 1)));
    expect(a1).toEqual([
      H(ASK4), K(S_SQL), MORE("4 more skills are asked in your saved ads and are not shown."),
      H(YOURS4), K(S_SQL), MORE("1 more skill is asked in your saved ads and is not shown."),
    ]);
    const a2 = fromAsked(got(analytics(person(), FOUR(), 4, 2)));
    expect(a2).toEqual([
      H(ASK4), K(S_SQL), K(S_PY), MORE("3 more skills are asked in your saved ads and are not shown."),
      H(YOURS4), K(S_SQL), K(S_EXC), // its own list has two rows: both shown, no more-line (Excel is fourth overall)
    ]);
    const a3 = fromAsked(got(analytics(person(), FOUR(), 4, 3)));
    expect(a3).toEqual([
      H(ASK4), K(S_SQL), K(S_PY), K(S_TAB), MORE("2 more skills are asked in your saved ads and are not shown."),
      H(YOURS4), K(S_SQL), K(S_EXC),
    ]);
    const a4 = fromAsked(got(analytics(person(), FOUR(), 4, 4)));
    expect(a4).toEqual([
      H(ASK4), K(S_SQL), K(S_PY), K(S_TAB), K(S_EXC), MORE("1 more skill is asked in your saved ads and is not shown."),
      H(YOURS4), K(S_SQL), K(S_EXC),
    ]);
    expect(fromAsked(got(analytics(person(), FOUR(), 4, 5)))).toEqual(R1_ASKED);
    expect(fromAsked(got(analytics(person(), FOUR(), 4)))).toEqual(R1_ASKED); // the real limit, 10
  });

  it("T7b: R6 with a limit of 1: Python and SQL have the same counts (2,0), so both are shown; no more-line", () => {
    expect(fromAsked(got(analytics(noSkills(), R6_ADS(), 3, 1)))).toEqual([
      H("Skills asked across your 3 saved ads"),
      K("Python (not on your profile): must-have in 2 ads"),
      K("SQL (not on your profile): must-have in 2 ads"),
      N(ALT_NOTE),
      P("Skills of yours that are asked for in your 3 saved ads: none."),
    ]);
  });

  it("T8: the number checker on the hand lists: R1, R2, R3, R3d, R6 and R9 give exactly the hand numbers lists", () => {
    const text = (r: Row[]) => [TITLE, ...r.map((x) => x[0])];
    expect(reportNumbers(text(R1), NAMES)).toEqual(R1_NUMBERS);
    expect(reportNumbers(text(R2), NAMES)).toEqual(R2_NUMBERS);
    expect(reportNumbers(text(R3), NAMES)).toEqual(R3_NUMBERS);
    expect(reportNumbers(text(R3D), NAMES)).toEqual(R3D_NUMBERS);
    expect(reportNumbers(text(R6), NAMES)).toEqual(R6_NUMBERS);
    expect(reportNumbers(text(R9), NAMES)).toEqual(R9_NUMBERS);
    // and the real analytics give the same lists
    expect(numbers(got(analytics(person(), FOUR(), 4)))).toEqual(R1_NUMBERS);
    expect(numbers(got(analytics(person(), BLOCKED(), 4)))).toEqual(R2_NUMBERS);
    expect(numbers(got(analytics(r3Person("2027-06-01"), tenJobs())))).toEqual(R3_NUMBERS);
    expect(numbers(got(analytics(r3dPerson(), tenJobs())))).toEqual(R3D_NUMBERS);
    expect(numbers(got(analytics(noSkills(), R6_ADS(), 3)))).toEqual(R6_NUMBERS);
    expect(numbers(got(analytics(noSkills(), R9_ADS(), 1)))).toEqual(R9_NUMBERS);
  });

  it("T8b: the checker can fail: R1's lines with 'Good: 2' instead of 3, and with 'must-have in 4 ads' instead of 3, give lists different from the hand list", () => {
    const wrong1 = [TITLE, ...R1.map((r) => r[0].replace("Good: 3 of", "Good: 2 of"))];
    expect(reportNumbers(wrong1, NAMES)).not.toEqual(R1_NUMBERS);
    const wrong2 = [TITLE, ...R1.map((r) => r[0].replace("must-have in 3 ads", "must-have in 4 ads"))];
    expect(reportNumbers(wrong2, NAMES)).not.toEqual(R1_NUMBERS);
  });
});

describe("T9: the analytics outcome alone", () => {
  it("T9: a healthy input gives 'ready'; nothing to show gives 'none'", () => {
    const ok = screenOutcomes(person(), adsViaPage(FOUR()), skills, 4).analytics;
    expect(ok.kind).toBe("ready");
    expect(screenOutcomes(null, adsViaPage(FOUR()), skills, 4).analytics).toEqual({ kind: "none" });
    expect(screenOutcomes(person(), [], skills, 4).analytics).toEqual({ kind: "none" });
  });

  it("T9 (third case): a reading whose constraints.languages is missing makes ONLY the analytics' level step throw: the box and the report are still fine, the analytics are 'failed'", () => {
    // Found by the stage-2 probe (d) of docs/PLAN-8.2.md section 15: roadmapInputs and roadmapBox work on it (the engine view blanks the languages when the person
    // set none), profileReport throws a TypeError (adSays reads languages.length). Hand count: 2 counted ads (both have a must-have); the box shows the
    // roadmap at gate 1 and is NOT the failure line; the report is ready; the analytics are the one failed outcome.
    const damaged = { ...ad1(), constraints: { ...ad1().constraints, languages: undefined } } as never as Job;
    const o = screenOutcomes(person(), adsViaPage([damaged, ad2()]), skills, 1);
    expect(o.box.partA).not.toEqual(["What to learn could not be worked out."]);
    expect(o.box.counted).toBe(2);
    expect(o.report.kind).toBe("ready");
    expect(o.analytics).toEqual({ kind: "failed", line: "The analytics could not be worked out." });
  });
});

// ---- the overlaps (T10 to T12): both sides come from the page's way, never from the analytics' own counting -------------------------
const CASES: { name: string; built: () => BuiltProfile; jobs: () => Job[]; gate: number; strong: number }[] = [
  { name: "R1", built: () => person(), jobs: FOUR, gate: 4, strong: 1 },
  { name: "R2", built: () => person(), jobs: BLOCKED, gate: 4, strong: 1 },
  { name: "R3", built: () => r3Person("2027-06-01"), jobs: tenJobs, gate: 10, strong: 0 },
  { name: "R3d", built: r3dPerson, jobs: tenJobs, gate: 10, strong: 10 },
  { name: "R6", built: noSkills, jobs: R6_ADS, gate: 3, strong: 0 },
  { name: "R9", built: noSkills, jobs: R9_ADS, gate: 1, strong: 0 },
];
const levelCounts = (a: Analytics) => {
  const out: Record<string, number> = {};
  let of = 0;
  for (const l of a.lines.filter((x) => x.kind === "level")) {
    const m = /^(.+): (\d+) of your (\d+) saved ads?$/.exec(l.text);
    expect(m, `a level line was expected: ${l.text}`).not.toBeNull();
    out[(m as RegExpExecArray)[1]] = Number((m as RegExpExecArray)[2]);
    of = Number((m as RegExpExecArray)[3]);
  }
  return { out, of };
};
const askedOf = (t: string) => ({ must: Number(/must-have in (\d+) ad/.exec(t)?.[1] ?? 0), nice: Number(/nice-to-have in (\d+) ad/.exec(t)?.[1] ?? 0) });
const rowName = (t: string) => t.split(" (")[0].split(":")[0];
// the asked list only (between its heading and the next heading)
function askedRows(a: Analytics): Map<string, { must: number; nice: number }> {
  const out = new Map<string, { must: number; nice: number }>();
  const start = a.lines.findIndex((l) => l.kind === "heading" && l.text.startsWith("Skills asked across"));
  for (let i = start + 1; i < a.lines.length && a.lines[i].kind !== "heading"; i++) {
    if (a.lines[i].kind === "skill") out.set(rowName(a.lines[i].text), askedOf(a.lines[i].text));
  }
  return out;
}

describe("T10 (ENGINE): the analytics agree with the BOX", () => {
  for (const c of CASES) {
    it(`T10: ${c.name}: M equals the box's counted; the Strong bucket equals the box's Already Strong count; the buckets add up to M`, () => {
      const built = c.built();
      const a = got(analytics(built, c.jobs(), c.gate));
      const box = roadmapBox(built, adsViaPage(c.jobs()), skills, c.gate);
      const { out, of } = levelCounts(a);
      expect(of).toBe(box.counted);
      expect(out["Strong"]).toBe(box.alreadyStrongIds.length);
      expect(out["Strong"]).toBe(c.strong); // the hand value of section 7
      const sum = Object.values(out).reduce((x, y) => x + y, 0);
      expect(sum).toBe(box.counted);
    });
  }
});

describe("T11 (ENGINE): the asked numbers agree with the REPORT and with the box's gap list", () => {
  const LITERAL: Record<string, Record<string, { must: number; nice: number }>> = {
    R1: { Python: { must: 2, nice: 1 }, Tableau: { must: 1, nice: 2 } },
    R2: { Python: { must: 2, nice: 1 }, Tableau: { must: 1, nice: 2 } },
    R3: { SQL: { must: 10, nice: 0 } },
    R6: { Python: { must: 2, nice: 0 }, SQL: { must: 2, nice: 0 } },
  };
  for (const c of CASES.filter((x) => x.name in LITERAL)) {
    it(`T11: ${c.name}: every ranked skill's 'Asked as ...' numbers and every gap row equal the asked row's numbers (and the hand values)`, () => {
      const built = c.built();
      const a = got(analytics(built, c.jobs(), c.gate));
      const asked = askedRows(a);
      for (const [name, want] of Object.entries(LITERAL[c.name])) expect(asked.get(name), `${name} row`).toEqual(want);
      // the report's sub lines, by skill name
      const report = roadmapReport(built, adsViaPage(c.jobs()), skills, c.gate);
      expect(report, "a report was expected").not.toBeNull();
      const lines = (report as { lines: { text: string; sub: boolean }[] }).lines;
      let checked = 0;
      lines.forEach((l, i) => {
        if (!l.sub) return;
        const name = /^\d+\. (.+?)(?: \(|:)/.exec(lines[i - 1].text)?.[1] ?? "";
        const must = Number(/must-have in (\d+) of/.exec(l.text)?.[1] ?? 0);
        const nice = Number(/nice-to-have in (\d+)/.exec(l.text)?.[1] ?? 0);
        expect(asked.get(name), `report line for ${name}`).toEqual({ must, nice });
        checked++;
      });
      expect(checked, "the report had at least one asked line").toBeGreaterThan(0);
      // the box's gap list rows
      const box = roadmapBox(built, adsViaPage(c.jobs()), skills, c.gate);
      let gaps = 0;
      for (const t of box.partA.filter((x) => /: (must-have|nice-to-have) in \d+ ad/.test(x))) {
        expect(asked.get(rowName(t)), `gap row ${t}`).toEqual(askedOf(t));
        gaps++;
      }
      expect(gaps, "the gap list had at least one row").toBeGreaterThan(0);
    });
  }
});

describe("T12 (ENGINE): the level counts equal the saved-ads list's own levels", () => {
  for (const c of CASES.filter((x) => ["R1", "R2", "R3", "R6"].includes(x.name))) {
    it(`T12: ${c.name}: the tally equals the counts of rankedAdRows ranks for the same ads`, () => {
      const built = c.built();
      const jobs = c.jobs();
      const ids = savedIdsFor(jobs.length);
      const list = rankedAdRows(jobs.map((j, i) => openedAd(ids[i], { ...j, id: pastedId() })), built, skills).rows;
      const byRank = (r: number) => list.filter((x) => x.rank === r).length;
      const { out } = levelCounts(got(analytics(built, jobs, c.gate)));
      expect(out["Strong"]).toBe(byRank(0));
      expect(out["Good"]).toBe(byRank(1));
      expect(out["Stretch"]).toBe(byRank(2));
      expect(out["Long shot"]).toBe(byRank(3));
      expect(out["No level"] ?? 0).toBe(byRank(4));
    });
  }
});

describe("T13: P0 for the analytics", () => {
  it("T13: R1 built with every job id 'pasted-ad' and with distinct job ids gives the same lines, equal to T1's", () => {
    const saved = ["saved-a", "saved-b", "saved-c", "saved-d"];
    expect(rows(got(analytics(person(), FOUR(), 4, undefined, saved, pastedId)))).toEqual(R1);
    expect(rows(got(analytics(person(), FOUR(), 4, undefined, saved, (i) => saved[i])))).toEqual(R1);
  });
});

describe("T14 (a property, ENGINE): the analytics' numbers equal an independent naive count", () => {
  // Not hand-worked: the expectation is built here from a plain loop over each counted job's requirements and from profileReport levels.
  const people: [string, () => BuiltProfile][] = [
    ["default", () => person()],
    ["no skills", noSkills],
    ["all four skills", () => person({ keptIds: ["sql", "tableau", "excel", "python"], inProgress: [] })],
    ["Excel, SQL and Python in progress", () => person({ keptIds: ["excel"], inProgress: [prog("SQL", "2027-06-01"), prog("Python", "2027-09-01")] })],
  ];
  const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;
  const levelName = { strong: "Strong", good: "Good", stretch: "Stretch", longShot: "Long shot" } as const;
  for (const [pn, mk] of people) {
    for (const [an, mkJobs] of [["R1 ads", FOUR], ["R2 ads", BLOCKED]] as const) {
      it(`T14: ${pn} x ${an}`, () => {
        const built = mk();
        const jobs = mkJobs();
        const a = got(analytics(built, jobs, 4));
        // naive levels
        const levels: Record<string, number> = { Strong: 0, Good: 0, Stretch: 0, "Long shot": 0, "No level": 0 };
        for (const job of jobs) {
          const lv = profileReport(job, built, skills, []).level;
          levels[lv === null ? "No level" : levelName[lv]]++;
        }
        const { out } = levelCounts(a);
        for (const k of Object.keys(levels)) expect(out[k] ?? 0, `level ${k}`).toBe(levels[k]);
        // naive asked counts
        const want = new Map<string, { must: number; nice: number }>();
        for (const job of jobs) {
          const must = new Set<string>();
          const nice = new Set<string>();
          for (const r of job.requirements) {
            for (const id of r.skillIds.filter((x) => !x.startsWith("new:"))) (r.importance === "must" ? must : nice).add(id);
          }
          for (const id of must) want.set(nameOf(id), { must: (want.get(nameOf(id))?.must ?? 0) + 1, nice: want.get(nameOf(id))?.nice ?? 0 });
          for (const id of nice) want.set(nameOf(id), { must: want.get(nameOf(id))?.must ?? 0, nice: (want.get(nameOf(id))?.nice ?? 0) + 1 });
        }
        expect(Object.fromEntries(askedRows(a))).toEqual(Object.fromEntries(want));
        // every asked row is at least the gap row of the same skill
        const box = roadmapBox(built, adsViaPage(jobs), skills, 4);
        for (const t of box.partA.filter((x) => /: (must-have|nice-to-have) in \d+ ad/.test(x))) {
          const gap = askedOf(t);
          const got2 = askedRows(a).get(rowName(t));
          expect(got2, `asked row for ${rowName(t)}`).toBeDefined();
          expect((got2 as { must: number }).must).toBeGreaterThanOrEqual(gap.must);
          expect((got2 as { nice: number }).nice).toBeGreaterThanOrEqual(gap.nice);
        }
      });
    }
  }
});

describe("T16: the constants and functions are exactly the texts of section 2", () => {
  it("T16: A1 to A3, A6 to A10 (with A9b), A13 to A16, both grammars, and the two new notes", () => {
    expect(messages.ANALYTICS_BUTTON_OPEN).toBe("Show my analytics");
    expect(messages.ANALYTICS_BUTTON_CLOSE).toBe("Hide the analytics");
    expect(messages.ANALYTICS_TITLE).toBe("Your analytics");
    expect(messages.LEVELS_TITLE).toBe("Fit levels across your saved ads");
    expect(messages.LEVELS_NOTE).toBe("(These are the levels shown on your saved ads, counted against the profile in use.)");
    expect(messages.levelCountLine("Strong", 1, 4)).toBe("Strong: 1 of your 4 saved ads");
    expect(messages.levelCountLine("Good", 1, 1)).toBe("Good: 1 of your 1 saved ad");
    expect(messages.levelCountLine("Long shot", 0, 10)).toBe("Long shot: 0 of your 10 saved ads");
    expect(messages.NO_LEVEL_NAME).toBe("No level");
    expect(messages.NO_LEVEL_NOTE).toBe("No level means the app could not judge those ads; the saved ads list says why for each.");
    expect(messages.askedTitle(4)).toBe("Skills asked across your 4 saved ads");
    expect(messages.askedTitle(1)).toBe("Skills asked across your 1 saved ad");
    expect(messages.ON_PROFILE_NOTE).toBe(" (on your profile)");
    expect(messages.NOT_ON_PROFILE_NOTE).toBe(" (not on your profile)");
    expect(messages.moreSkillsLine(3)).toBe("3 more skills are asked in your saved ads and are not shown.");
    expect(messages.moreSkillsLine(1)).toBe("1 more skill is asked in your saved ads and is not shown.");
    expect(messages.yoursTitle(4)).toBe("Skills of yours that are asked for in your 4 saved ads");
    expect(messages.yoursTitle(1)).toBe("Skills of yours that are asked for in your 1 saved ad");
    expect(messages.yoursNoneLine(3)).toBe("Skills of yours that are asked for in your 3 saved ads: none.");
    expect(messages.yoursNoneLine(1)).toBe("Skills of yours that are asked for in your 1 saved ad: none.");
    expect(messages.ANALYTICS_FAILED_LINE).toBe("The analytics could not be worked out.");
  });
});

describe("T23: the From functions equal the old wrappers (the commit-1 refactor)", () => {
  const WRAP: { name: string; built: () => BuiltProfile; jobs: () => Job[]; gate: number }[] = [
    { name: "R1", built: () => person(), jobs: FOUR, gate: 4 },
    { name: "R2", built: () => person(), jobs: BLOCKED, gate: 4 },
    { name: "R3", built: () => r3Person("2027-06-01"), jobs: tenJobs, gate: 10 },
    { name: "R6", built: noSkills, jobs: R6_ADS, gate: 3 },
  ];
  for (const c of WRAP) {
    it(`T23: ${c.name}: roadmapBoxFrom and roadmapReportFrom equal roadmapBox and roadmapReport at the same gate`, () => {
      const built = c.built();
      const inputs = inputsViaPage(built, c.jobs());
      expect(roadmapBoxFrom(inputs, c.gate)).toEqual(roadmapBox(built, adsViaPage(c.jobs()), skills, c.gate));
      expect(roadmapReportFrom(inputs, c.gate)).toEqual(roadmapReport(built, adsViaPage(c.jobs()), skills, c.gate));
      expect(roadmapBoxFrom(inputs, c.gate).counted).toBeGreaterThan(0); // not an empty box compared with an empty box
    });
  }
});

// ---- Stage 1b (docs/PLAN-8.2.md v3.1, section 7: R10, R11, R12; section 8: T28 to T31). Written from the hand cases BEFORE any code; the lists of numbers of
// R10 and R11 equal the reviewer's own cross-check lists. The order of the lines is the rule of section 2: asked rows, the more-skills line, then the
// several-skills note; the not-counted line right after the basis line.

const R10_ADS = () => [...R6_ADS(), ad("p4", "Delta Analyst", "Invented Co Eight", [must("tableau"), nice("excel")])];
const R10: Row[] = [
  B("Based on 4 saved ads we could judge and the profile in use." + TAIL),
  H(LEVELS_HEAD),
  N(LEVELS_NOTE),
  V("Strong: 0 of your 4 saved ads", 0, 4),
  V("Good: 0 of your 4 saved ads", 0, 4),
  V("Stretch: 0 of your 4 saved ads", 0, 4),
  V("Long shot: 0 of your 4 saved ads", 0, 4),
  V("No level: 4 of your 4 saved ads", 4, 4),
  N(NO_LEVEL_NOTE),
  H("Skills asked across your 4 saved ads"),
  K("Python (not on your profile): must-have in 2 ads"),
  K("SQL (not on your profile): must-have in 2 ads"),
  P("2 more skills are asked in your saved ads and are not shown."),
  N(ALT_NOTE),
  P("Skills of yours that are asked for in your 4 saved ads: none."),
];
const R10_NUMBERS = [4, 0, 4, 0, 4, 0, 4, 0, 4, 4, 4, 4, 2, 2, 2, 4];

const R11_ADS = () => [
  ad("q1", "Report Clerk", "Alder Works Ltd", [must("sql")]),
  ad("q2", "Data Assistant", "Birch Yard Ltd", [must("python")]),
  ad("q3", "Empty Ad", "Invented Co Five", []), // no requirements: not counted
];
const R11: Row[] = [
  B("Based on 2 saved ads we could judge and the profile in use." + TAIL),
  P("1 saved ad is not counted: the AI found no requirements in it."),
  H(LEVELS_HEAD),
  N(LEVELS_NOTE),
  V("Strong: 1 of your 2 saved ads", 1, 2),
  V("Good: 1 of your 2 saved ads", 1, 2),
  V("Stretch: 0 of your 2 saved ads", 0, 2),
  V("Long shot: 0 of your 2 saved ads", 0, 2),
  H("Skills asked across your 2 saved ads"),
  K("Python (not on your profile): must-have in 1 ad"),
  K("SQL (on your profile): must-have in 1 ad"),
  H("Skills of yours that are asked for in your 2 saved ads"),
  K("SQL (on your profile): must-have in 1 ad"),
];
const R11_NUMBERS = [2, 1, 1, 2, 1, 2, 0, 2, 0, 2, 2, 1, 1, 2, 1];

const handAddedExcel = () => person({ keptIds: [], added: ["Excel"], inProgress: [] }); // Excel as `have` with NO CV line
const R12_ADS = () => [ad("h1", "Clerk One", "Invented Co Nine", [must("excel")])];
const R12: Row[] = [
  B("Based on 1 saved ad we could judge and the profile in use." + TAIL),
  H(LEVELS_HEAD),
  N(LEVELS_NOTE),
  V("Strong: 0 of your 1 saved ad", 0, 1),
  V("Good: 1 of your 1 saved ad", 1, 1),
  V("Stretch: 0 of your 1 saved ad", 0, 1),
  V("Long shot: 0 of your 1 saved ad", 0, 1),
  H("Skills asked across your 1 saved ad"),
  K("Excel (on your profile without a CV line, so it does not count): must-have in 1 ad"),
  P("Skills of yours that are asked for in your 1 saved ad: none."),
];
const R12_NUMBERS = [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1];

describe("T28 to T31: the stage-1b cases", () => {
  it("T28: R11, a saved ad that is not counted: the not-counted line right after the basis line, levels over the 2 counted ads, Python before SQL, SQL in the your-skills list", () => {
    expect(reportNumbers([TITLE, ...R11.map((r) => r[0])], NAMES), "the hand text and the hand numbers list agree").toEqual(R11_NUMBERS);
    const a = got(analytics(person(), R11_ADS(), 2));
    expect(rows(a)).toEqual(R11);
    expect(numbers(a)).toEqual(R11_NUMBERS);
  });

  it("T29: R10 with a limit of 2: the more-skills line, THEN the several-skills note, then the your-skills none line; No level 4 with its note", () => {
    expect(reportNumbers([TITLE, ...R10.map((r) => r[0])], NAMES), "the hand text and the hand numbers list agree").toEqual(R10_NUMBERS);
    const a = got(analytics(noSkills(), R10_ADS(), 4, 2));
    expect(rows(a)).toEqual(R10);
    expect(numbers(a)).toEqual(R10_NUMBERS);
  });

  it("T30: ANALYTICS_TOP is 10 (green on the stub by nature: the constant is already written there)", () => {
    expect(ANALYTICS_TOP).toBe(10);
  });

  it("T31: R12, a skill added by hand: the asked row carries the no-CV-line note, the your-skills list is the none line, the level is Good", () => {
    expect(reportNumbers([TITLE, ...R12.map((r) => r[0])], NAMES), "the hand text and the hand numbers list agree").toEqual(R12_NUMBERS);
    const a = got(analytics(handAddedExcel(), R12_ADS(), 1));
    expect(rows(a)).toEqual(R12);
    expect(numbers(a)).toEqual(R12_NUMBERS);
  });
});
