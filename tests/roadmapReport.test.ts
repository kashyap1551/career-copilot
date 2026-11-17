import { describe, expect, it } from "vitest";
import { roadmapAds, roadmapBox } from "@/app/roadmap";
import { reportAsText, roadmapReport, roadmapReportSafe, type RoadmapReport } from "@/app/roadmapReport";
import type { BuiltProfile } from "@/lib/cv/profile";
import { engineView } from "@/lib/cv/engineView";
import { gapList } from "@/lib/engine/gaps";
import { listedAlternatives } from "@/lib/engine/roadmapJobs";
import type { Job } from "@/lib/engine/types";
import { classifyJobs, rankMissingSkills, unlockTimeline } from "@/lib/engine/unlock";
import * as messages from "@/lib/saved/messages";
import { ad, ad1, ad2, ad3, ad4, must, person, skills } from "./support/roadmapFixtures";
import { reportNumbers } from "./support/reportNumbers";
import { N10, tenJobs, TEN_LABELS } from "./support/tenAds";
import { openedAd, pastedId, savedIdsFor } from "./support/viaPage";

// Step 8.1, tests first (docs/PLAN-8.1.md sections 6 and 7). EVERY expected line and number list below is a literal written from the hand
// tables of section 6 BEFORE the code existed; none is imported from the code or copied from running it. The report code is a STUB, so
// the tests that need a report fail on an assertion. Every test that builds ads builds them the way the page does: job id "pasted-ad",
// distinct saved ids, through roadmapAds (tests/support/viaPage.ts). Exceptions are named in their tests (helper-only, ENGINE).

const TITLE = "Your roadmap report";
const TAIL = " Every number was counted by the app from them; none is a prediction.";
const F = "A skill can be asked in more ads than it unlocks: an ad may need more than one skill, may already be unlocked by a skill higher up this list, or may be held back by something other than skills.";
const FRAME = "These counts assume you learn each skill by its expected date.";
const TL = "Timeline from skills in progress:";
const TL_NONE = "Timeline from skills in progress: none.";

type Pair = [string, boolean];
const L = (t: string): Pair => [t, false];
const S = (t: string): Pair => [t, true];

// ---- the hand tables of section 6 ------------------------------------------------------------------------------------------------
const R1: Pair[] = [
  L("Based on 4 saved ads we could judge and the profile in use." + TAIL),
  L("Already Strong: 1 job (Data Clerk, Example Wharf Ltd)"),
  L("Skills to build, in order:"),
  L("1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs."),
  S("Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1."),
  L("2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs."),
  S("Asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2."),
  L(F),
  L("Blocked jobs: none"),
  L(TL),
  L(FRAME),
  L("By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd)."),
];
const R1_NUMBERS = [4, 1, 2, 2, 2, 4, 1, 1, 3, 1, 4, 2, 1];

const R2: Pair[] = [
  L("Based on 4 saved ads we could judge and the profile in use." + TAIL),
  L("Already Strong: 1 job (Data Clerk, Example Wharf Ltd)"),
  L("Skills to build, in order:"),
  L("1. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 1 job."),
  S("Asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2."),
  L("2. Python: unlocks 1 job (Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs."),
  S("Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1."),
  L(F),
  L("Blocked jobs (skills alone can't make these Strong): 1"),
  L("- BI Developer, Harbor Light Stationery: blocked by 1 thing; it can't be closed soon"),
  L("(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin."),
  L(TL),
  L(FRAME),
  L("By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd)."),
];
const R2_NUMBERS = [4, 1, 1, 1, 1, 4, 2, 1, 2, 2, 4, 1, 1, 1, 1];

const ten = (skillLine: string, dateLine: string): Pair[] => [
  L("Based on 10 saved ads we could judge and the profile in use." + TAIL),
  L("Already Strong: none"),
  L("Skills to build, in order:"),
  L(skillLine),
  S("Asked as a must-have in 10 of your 10 saved ads."),
  L(F),
  L("Blocked jobs: none"),
  ...(dateLine === "" ? [L(TL_NONE)] : [L(TL), L(FRAME), L(dateLine)]),
];
const R3 = ten(`1. SQL (in progress, expected 2027-06-01): unlocks 10 jobs (${N10}). Total so far: 10 jobs.`, `By 2027-06-01 (SQL): 10 more Strong matches (${N10}).`);
const R3B = ten(`1. SQL (in progress, expected 2026-01-15): unlocks 10 jobs (${N10}). Total so far: 10 jobs.`, `By 2026-01-15 (SQL): 10 more Strong matches (${N10}).`);
const R3C = ten(`1. SQL: unlocks 10 jobs (${N10}). Total so far: 10 jobs.`, "");
const TEN_NUMBERS = [10, 10, 10, 10, 10, 10];
const R3C_NUMBERS = [10, 10, 10, 10, 10];

const R4: Pair[] = [
  L("Based on 4 saved ads we could judge and the profile in use." + TAIL),
  L("Already Strong: 4 jobs (Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd)"),
  L("Skills to build, in order: none. No other saved job can become a Strong match by skills alone."),
  L("Blocked jobs: none"),
  L(TL_NONE),
];
const R4_NUMBERS = [4, 4];

const R5: Pair[] = [
  L("Based on 1 saved ad we could judge and the profile in use." + TAIL),
  L("Already Strong: none"),
  L("Skills to build, in order:"),
  L("1. Docker: together with Python, unlocks Platform Analyst, Invented Co One."),
  S("Asked as a must-have in 1 of your 1 saved ad."),
  L("2. Python: unlocks 1 job (Platform Analyst, Invented Co One). Total so far: 1 job."),
  S("Asked as a must-have in 1 of your 1 saved ad."),
  L(F),
  L("Blocked jobs: none"),
  L(TL_NONE),
];
const R5_NUMBERS = [1, 1, 1, 1, 1, 1, 1];

const R6: Pair[] = [
  L("Based on 3 saved ads we could judge and the profile in use." + TAIL),
  L("Already Strong: none"),
  L("Skills to build, in order:"),
  L("1. Python: unlocks 2 jobs (Alpha Analyst, Invented Co Two; Beta Analyst, Invented Co Three). Total so far: 2 jobs."),
  S("Asked as a must-have in 2 of your 3 saved ads."),
  L("2. SQL: unlocks 1 job (Gamma Analyst, Invented Co Four). Total so far: 3 jobs."),
  S("Asked as a must-have in 2 of your 3 saved ads."),
  L(F),
  L("Blocked jobs: none"),
  L(TL_NONE),
];
const R6_NUMBERS = [3, 2, 2, 2, 3, 1, 3, 2, 3];

const R7: Pair[] = [
  L("Based on 2 saved ads we could judge and the profile in use." + TAIL),
  L("1 saved ad is not counted: the AI found no requirements in it."),
  L("Already Strong: 1 job (Report Clerk, Alder Works Ltd)"),
  L("Skills to build, in order:"),
  L("1. Python: unlocks 1 job (Data Assistant, Birch Yard Ltd). Total so far: 1 job."),
  S("Asked as a must-have in 1 of your 2 saved ads."),
  L(F),
  L("Blocked jobs: none"),
  L(TL_NONE),
];
const R7_NUMBERS = [2, 1, 1, 1, 1, 1, 2];

const R8: Pair[] = [
  L("Based on 1 saved ad we could judge and the profile in use." + TAIL),
  L("Already Strong: none"),
  L("Skills to build, in order:"),
  L("1. SQL (in progress, expected 2027-06-01): unlocks 1 job (Level 2 Analyst, Example 7 Ltd). Total so far: 1 job."),
  S("Asked as a must-have in 1 of your 1 saved ad."),
  L(F),
  L("Blocked jobs: none"),
  L(TL),
  L(FRAME),
  L("By 2027-06-01 (SQL): 1 more Strong match (Level 2 Analyst, Example 7 Ltd)."),
];
const R8_NUMBERS = [1, 1, 1, 1, 1, 1];

// R1c: the exact copied text of R1 (a sub line indented four spaces, joined with "\n", no trailing newline).
const R1C = R1.map(([t, sub]) => (sub ? `    ${t}` : t));
const R1C_TEXT = [TITLE, ...R1C].join("\n");

// ---- the people and ads of section 6 ------------------------------------------------------------------------------------------------
const prog = (name: string, date: string) => ({ name, date });
const FOUR = () => [ad1(), ad2(), ad3(), ad4()];
const BLOCKED = () => [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()];
const s = (id: string, title: string, company: string) => ad(id, title, company, [must("sql")]);
const STRONG4 = () => [s("s1", "Report Clerk", "Alder Works Ltd"), s("s2", "Data Assistant", "Birch Yard Ltd"), s("s3", "Sales Analyst", "Cedar Mill Ltd"), s("s4", "Finance Clerk", "Elm Court Ltd")];
const r3Person = (date: string) => person({ keptIds: ["tableau", "excel"], inProgress: [prog("SQL", date)] });
const R5_ADS = () => [ad("z1", "Platform Analyst", "Invented Co One", [must("python"), must("docker")])];
const R6_ADS = () => [
  ad("p1", "Alpha Analyst", "Invented Co Two", [must("sql", "python")]), // ONE must-have that accepts SQL or Python
  ad("p2", "Beta Analyst", "Invented Co Three", [must("python")]),
  ad("p3", "Gamma Analyst", "Invented Co Four", [must("sql")]),
];
const R7_ADS = () => [s("q1", "Report Clerk", "Alder Works Ltd"), ad("q2", "Data Assistant", "Birch Yard Ltd", [must("python")]), ad("q3", "Empty Ad", "Invented Co Five", [])];
const R8_ADS = () => [ad("l2", "Level 2 Analyst", "Example 7 Ltd", [must("sql")])];

// Labels the checker removes: every job label (and its caveat variant) and every skill name used above.
const LABELS = [
  ...TEN_LABELS,
  "Reporting Analyst, Northlake Foods Ltd", "BI Developer, Harbor Light Stationery", "Data Clerk, Example Wharf Ltd", "Analytics Lead, Imaginary Pages Ltd",
  "Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)", "Platform Analyst, Invented Co One", "Alpha Analyst, Invented Co Two",
  "Beta Analyst, Invented Co Three", "Gamma Analyst, Invented Co Four", "Empty Ad, Invented Co Five", "Level 2 Analyst, Example 7 Ltd",
  "SQL", "Python", "Tableau", "Excel", "Docker", "Power BI",
];
const R8_ONLY = "Level 2 Analyst, Example 7 Ltd";

// ---- the page's way ---------------------------------------------------------------------------------------------------------------
function opened(jobs: Job[], savedIds: string[] = savedIdsFor(jobs.length), jobIdOf: (i: number) => string = pastedId) {
  return roadmapAds(jobs.map((j, i) => openedAd(savedIds[i], { ...j, id: jobIdOf(i) })));
}
const report = (built: BuiltProfile | null, jobs: Job[], from?: number, savedIds?: string[], jobIdOf?: (i: number) => string) =>
  roadmapReport(built, opened(jobs, savedIds, jobIdOf), skills, from);
function got(r: RoadmapReport | null): RoadmapReport {
  expect(r, "a report was expected, got null").not.toBeNull();
  return r as RoadmapReport;
}
const pairs = (r: RoadmapReport): Pair[] => r.lines.map((l) => [l.text, l.sub]);
const texts = (p: Pair[]) => p.map(([t]) => t);

describe("the roadmap report's lines (ads built the way the page does)", () => {
  it("T1: R1, the four-ad example: title, lines and sub flags", () => {
    const r = got(report(person(), FOUR(), 4));
    expect(r.title).toBe(TITLE);
    expect(pairs(r)).toEqual(R1);
  });

  it("T2: R2, one ad blocked: Tableau then Python, the blocked lines, the footnote", () => {
    expect(pairs(got(report(person(), BLOCKED(), 4)))).toEqual(R2);
  });

  it("T3a: R3, the ten ads built by the real buildJob, SQL in progress, the real threshold", () => {
    expect(pairs(got(report(r3Person("2027-06-01"), tenJobs())))).toEqual(R3);
  });

  it("T3b: R3b, a date before today is shown as stored", () => {
    expect(pairs(got(report(r3Person("2026-01-15"), tenJobs())))).toEqual(R3B);
  });

  it("T3c: R3c, SQL added with NO date: dropped, so the ranking has no 'in progress' and the timeline says none", () => {
    const built = r3Person("");
    expect(built.profile.skills.filter((k) => k.kind === "inProgress")).toEqual([]); // hand count: 0 of 1
    expect(pairs(got(report(built, tenJobs())))).toEqual(R3C);
  });

  it("T4: R4, every counted ad Strong: no ranking, no sub lines, no footnote", () => {
    expect(pairs(got(report(person({ keptIds: ["sql"], inProgress: [] }), STRONG4(), 4)))).toEqual(R4);
  });

  it("T5: R5, a skill that helps only together with another; singular grammar", () => {
    expect(pairs(got(report(person({ keptIds: [], inProgress: [] }), R5_ADS(), 1)))).toEqual(R5);
  });

  it("T6: no report for no profile, no saved ads, 9 counted ads at threshold 10, zero counted ads; a report with exactly 10", () => {
    expect(report(null, FOUR(), 4)).toBeNull();
    expect(roadmapReport(person(), [], skills, 4)).toBeNull();
    expect(report(r3Person("2027-06-01"), tenJobs().slice(0, 9))).toBeNull(); // 9 of 10
    expect(report(person(), [ad("n", "Empty", "Invented Co", [])], 1)).toBeNull(); // hand count: 0 counted
    expect(report(r3Person("2027-06-01"), tenJobs())).not.toBeNull(); // exactly 10: the boundary
  });

  it("T20: R6, a skill asked in 2 ads that unlocks 1 because Python, higher up, already unlocked the other", () => {
    expect(pairs(got(report(person({ keptIds: [], inProgress: [] }), R6_ADS(), 3)))).toEqual(R6);
  });

  it("T21: R7, one saved ad is not counted: the box's line right after the basis line; the denominator is the counted ads", () => {
    expect(pairs(got(report(person({ keptIds: ["sql"], inProgress: [] }), R7_ADS(), 2)))).toEqual(R7);
  });

  it("T22: R1c, reportAsText is the title, then every line, a sub line indented four spaces, joined with a newline, no trailing newline", () => {
    const text = reportAsText(got(report(person(), FOUR(), 4)));
    expect(text).toBe(R1C_TEXT);
    expect(text.endsWith("\n")).toBe(false);
  });

  it("T19: P0 for the report: every job id 'pasted-ad' and distinct job ids give the same lines, equal to T1's", () => {
    const saved = ["saved-a", "saved-b", "saved-c", "saved-d"];
    expect(pairs(got(report(person(), FOUR(), 4, saved, pastedId)))).toEqual(R1);
    expect(pairs(got(report(person(), FOUR(), 4, saved, (i) => saved[i])))).toEqual(R1);
  });
});

describe("T7 and T8: the number checker (a helper; its lists are the hand lists of section 6)", () => {
  const cases: [string, Pair[], number[]][] = [
    ["R1", R1, R1_NUMBERS], ["R2", R2, R2_NUMBERS], ["R3", R3, TEN_NUMBERS], ["R3b", R3B, TEN_NUMBERS], ["R3c", R3C, R3C_NUMBERS],
    ["R4", R4, R4_NUMBERS], ["R5", R5, R5_NUMBERS], ["R6", R6, R6_NUMBERS], ["R7", R7, R7_NUMBERS], ["R8", R8, R8_NUMBERS],
  ];
  it.each(cases)("T7: %s: the numbers in the hand lines are the hand numbers list (HELPER ONLY: literal lines)", (_n, lines, numbers) => {
    expect(reportNumbers(texts(lines), LABELS)).toEqual(numbers);
  });

  it("T7b: and the report's own lines give the same list for R1, R2, R3, R6 and R7 (page's way)", () => {
    const r1 = pairs(got(report(person(), FOUR(), 4)));
    expect(reportNumbers(texts(r1), LABELS)).toEqual(R1_NUMBERS);
    expect(reportNumbers(texts(pairs(got(report(person(), BLOCKED(), 4)))), LABELS)).toEqual(R2_NUMBERS);
    expect(reportNumbers(texts(pairs(got(report(r3Person("2027-06-01"), tenJobs())))), LABELS)).toEqual(TEN_NUMBERS);
    expect(reportNumbers(texts(pairs(got(report(person({ keptIds: [], inProgress: [] }), R6_ADS(), 3)))), LABELS)).toEqual(R6_NUMBERS);
    expect(reportNumbers(texts(pairs(got(report(person({ keptIds: ["sql"], inProgress: [] }), R7_ADS(), 2)))), LABELS)).toEqual(R7_NUMBERS);
  });

  it("T7c: R8, a title with digits, through the report (page's way): the lines and the numbers list", () => {
    const r = got(report(person({ keptIds: ["tableau"], inProgress: [prog("SQL", "2027-06-01")] }), R8_ADS(), 1));
    expect(pairs(r)).toEqual(R8);
    expect(reportNumbers(r.lines.map((l) => l.text), LABELS)).toEqual(R8_NUMBERS);
  });

  it("T8a: the checker can fail: R1's lines with 'unlocks 3 jobs' instead of 2 give another list (HELPER ONLY)", () => {
    const wrong = texts(R1).map((t) => t.replace("unlocks 2 jobs", "unlocks 3 jobs"));
    expect(reportNumbers(wrong, LABELS)).not.toEqual(R1_NUMBERS);
    expect(reportNumbers(wrong, LABELS)[2]).toBe(3);
  });

  it("T8b: the checker can fail: with the label of R8 not removed, its digits 2 and 7 are read as numbers (HELPER ONLY)", () => {
    const without = LABELS.filter((l) => l !== R8_ONLY);
    expect(reportNumbers(texts(R8), without)).not.toEqual(R8_NUMBERS);
    expect(reportNumbers(texts(R8), without)).toContain(7);
  });
});

describe("T9: roadmapReportSafe", () => {
  it("T9: a record that makes the report throw gives the one failed line; a healthy input gives 'ready'; nothing to report gives 'none'", () => {
    const broken = { id: "z", job: { ...ad1(), requirements: undefined } as never }; // a damaged reading: roadmapBasis throws
    const healthy = { id: "h", job: ad("h", "Clerk", "Invented Co", [must("sql")]) };
    expect(roadmapReportSafe(person(), [broken, healthy], skills, 1)).toEqual({ kind: "failed", line: "The roadmap report could not be worked out." });
    const ok = roadmapReportSafe(person(), opened(FOUR()), skills, 4);
    expect(ok.kind).toBe("ready");
    expect(roadmapReportSafe(null, opened(FOUR()), skills, 4)).toEqual({ kind: "none" });
  });
});

describe("T11 (a property, ENGINE): the report's numbers equal the numbers of the engine's own calls", () => {
  // Not hand-worked: the expected list is built here from DIRECT calls of the engine on the same saved-id jobs, in the order the report
  // writes them: the basis M; Already Strong (when above 0); per ranked skill its newly-unlocked count and total (when it unlocks) and the
  // asked numbers; the blocked count and, per blocked job, its number of conflicts; the timeline counts.
  const people: [string, () => BuiltProfile][] = [
    ["default person", () => person()],
    ["SQL had; Tableau and Python in progress on one date", () => person({ keptIds: ["sql"], inProgress: [prog("Tableau", "2027-03-01"), prog("Python", "2027-03-01")] })],
    ["no skills", () => person({ keptIds: [], inProgress: [] })],
    ["SQL and Excel had, nothing in progress", () => person({ keptIds: ["sql", "excel"], inProgress: [] })],
  ];
  const adSets: [string, () => Job[]][] = [["the four-ad example", FOUR], ["ad 2 blocked", BLOCKED]];
  const nameOf = (id: string) => skills.find((k) => k.id === id)?.name ?? id;

  function engineNumbers(built: BuiltProfile, jobs: Job[]): number[] {
    const views = jobs.map((j) => engineView(j, built));
    const ej = views.map((v, i) => ({ ...listedAlternatives(v.engineJob), id: `saved-${i + 1}` }));
    const prof = views[0].engineProfile;
    const groups = classifyJobs(prof, ej);
    const out: number[] = [ej.length];
    if (groups.alreadyStrong.length > 0) out.push(groups.alreadyStrong.length);
    const gaps = gapList(prof, ej, nameOf).rows;
    for (const e of rankMissingSkills(prof, ej)) {
      if (e.newlyUnlocked.length > 0) out.push(e.newlyUnlocked.length, e.totalUnlocked);
      const row = gaps.find((g) => g.skillId === e.skillId);
      if (row && row.mustAds > 0) {
        out.push(row.mustAds, ej.length);
        if (row.niceAds > 0) out.push(row.niceAds);
      } else if (row && row.niceAds > 0) out.push(row.niceAds, ej.length);
    }
    if (groups.blocked.length > 0) out.push(groups.blocked.length, ...groups.blocked.map((b) => b.conflicts.length));
    for (const e of unlockTimeline(prof, ej)) out.push(e.moreStrong);
    return out;
  }

  for (const [pn, mk] of people) {
    for (const [an, jobs] of adSets) {
      it(`T11: ${pn}, ${an}`, () => {
        const r = got(report(mk(), jobs(), 4));
        expect(reportNumbers(r.lines.map((l) => l.text), LABELS)).toEqual(engineNumbers(mk(), jobs()));
      });
    }
  }
});

describe("T13: the report's engine lines are the box's own lines", () => {
  const cases: [string, () => BuiltProfile, () => Job[], number][] = [
    ["R1", () => person(), FOUR, 4],
    ["R2", () => person(), BLOCKED, 4],
    ["R4", () => person({ keptIds: ["sql"], inProgress: [] }), STRONG4, 4],
    ["R5", () => person({ keptIds: [], inProgress: [] }), R5_ADS, 1],
  ];
  it.each(cases)("T13: %s: without the basis line, the sub lines and the footnote, the report equals the box's partB then its timeline", (_n, mkBuilt, mkJobs, from) => {
    const r = got(report(mkBuilt(), mkJobs(), from));
    const engineLines = r.lines.filter((l, i) => i > 0 && !l.sub && l.text !== F).map((l) => l.text);
    const box = roadmapBox(mkBuilt(), opened(mkJobs()), skills, from);
    expect(engineLines).toEqual([...box.partB, ...box.timeline]);
  });
});

describe("T17: the words are exactly the texts of section 1 of the plan", () => {
  const m = messages as unknown as Record<string, unknown>;
  it("T17: constants", () => {
    expect(m.REPORT_BUTTON_OPEN).toBe("Make my roadmap report");
    expect(m.REPORT_BUTTON_CLOSE).toBe("Hide the roadmap report");
    expect(m.REPORT_TITLE).toBe(TITLE);
    expect(m.REPORT_FOOTNOTE).toBe(F);
    expect(m.REPORT_COPY).toBe("Copy report as text");
    expect(m.REPORT_COPIED).toBe("Copied.");
    expect(m.REPORT_COPY_FAILED).toBe("Could not copy. Select the text and copy it by hand.");
    expect(m.REPORT_FAILED_LINE).toBe("The roadmap report could not be worked out.");
  });

  it("T17: the basis line, both grammars", () => {
    expect(messages.reportBasisLine(4)).toBe("Based on 4 saved ads we could judge and the profile in use." + TAIL);
    expect(messages.reportBasisLine(1)).toBe("Based on 1 saved ad we could judge and the profile in use." + TAIL);
  });

  it("T17: the asked line, its three forms, the singular, and null when the skill has no counts (a skill with no gap row)", () => {
    expect(messages.reportAskedLine(2, 1, 4)).toBe("Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.");
    expect(messages.reportAskedLine(2, 0, 4)).toBe("Asked as a must-have in 2 of your 4 saved ads.");
    expect(messages.reportAskedLine(0, 1, 4)).toBe("Asked as a nice-to-have in 1 of your 4 saved ads.");
    expect(messages.reportAskedLine(1, 0, 1)).toBe("Asked as a must-have in 1 of your 1 saved ad.");
    expect(messages.reportAskedLine(1, 2, 1)).toBe("Asked as a must-have in 1 of your 1 saved ad, and as a nice-to-have in 2.");
    expect(messages.reportAskedLine(0, 0, 4)).toBeNull();
  });
});
