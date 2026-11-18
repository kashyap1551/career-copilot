import { describe, expect, it } from "vitest";
import { cvFixtures } from "@/fixtures/synthetic-cvs";
import { skills } from "@/fixtures/skills";
import { engineView } from "@/lib/cv/engineView";
import { buildProfile, type ConfirmState } from "@/lib/cv/profile";
import { numberLines } from "@/lib/cv/numberLines";
import { removeContactDetails } from "@/lib/cv/redact";
import { chooseBulletPairs, MAX_PAIRS, type BulletPair } from "@/lib/engine/bulletPairs";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Requirement } from "@/lib/engine/types";
import { ad } from "./support/roadmapFixtures";
import { inputsViaPage, pastedId, savedIdsFor } from "./support/viaPage";

// Step 8.3, stage 2, tests first (docs/PLAN-8.3.md v2, section 10: the pair choice, hand cases P1 to P7, P2b, P4b; tests T10, T11 and T29).
// EVERY expected pair below is a hand result of the plan BEFORE lib/engine/bulletPairs.ts existed. The engine confirmation of stage 2a showed that the
// real engine meets the same requirements (the page's way: ads through roadmapAds, the engine's own profile and job). Invented text only.

const cv1 = cvFixtures.find((c) => c.id === "cv-1-thin");
const CV1 = numberLines(removeContactDetails((cv1 as { text: string }).text));
const L4 = "Answered the phone and kept the stock sheet up to date in Excel";
const L5 = "Helped customers at the counter";

const prop = (name: string, skillId: string, line: number, quote: string): CvSkill => ({ name, skillId, listed: true, line, quote, label: "named" });
const confirm = (o: Partial<ConfirmState>): ConfirmState => ({ keptIds: [], added: [], inProgress: [], languages: [], cities: "Berlin", workModes: [], years: "", availableFrom: "", ...o });
const req = (importance: "must" | "nice", id: string, quote: string): Requirement => ({ skillIds: [id], importance, quote });

// The page's way: the ad reaches the engine through roadmapAds (job id "pasted-ad", a distinct saved id), then the engine's own profile and job.
function pairsFor(
  lines: string[],
  props: CvSkill[],
  conf: ConfirmState,
  reqs: Requirement[],
  max?: number,
  jobIdOf?: (i: number) => string,
): BulletPair[] {
  const built = buildProfile(lines, props, conf, skills);
  const inputs = inputsViaPage(built, [ad("j1", "Invented Ad", "Invented Co", reqs)], savedIdsFor(1), jobIdOf);
  expect(inputs.kind, "the ad must be counted").toBe("ready");
  if (inputs.kind !== "ready") return [];
  return chooseBulletPairs(inputs.engineProfile, inputs.engineJobs[0], max);
}

const EXCEL4 = prop("Excel", "excel", 4, "kept the stock sheet up to date in Excel");
const CUST5 = prop("Customer service", "customer-service", 5, "Helped customers at the counter");
const SHEETS4 = prop("Spreadsheets", "spreadsheets", 4, "kept the stock sheet up to date");
const EXCEL7 = prop("Excel", "excel", 7, "Learning Excel formulas");

describe("T10: the pair choice on the hand cases P1 to P7", () => {
  it("T10: cv-1-thin is numbered as the plan says (lines 4 and 5)", () => {
    expect(CV1[3]).toBe(L4);
    expect(CV1[4]).toBe(L5);
    expect(CV1[6]).toBe("Learning Excel formulas in an evening course");
  });

  it("T10 P1: must Excel, must Python, nice Customer service; Excel line 4 and Customer service line 5 are kept: two pairs, Python (unmet) none", () => {
    const got = pairsFor(CV1, [EXCEL4, CUST5], confirm({ keptIds: ["excel", "customer-service"] }), [
      req("must", "excel", "Excel is required."),
      req("must", "python", "Python is required."),
      req("nice", "customer-service", "Customer service is a plus."),
    ]);
    expect(got).toEqual([
      { id: 1, requirement: "Excel is required.", skillId: "excel", line: 4, text: L4 },
      { id: 2, requirement: "Customer service is a plus.", skillId: "customer-service", line: 5, text: L5 },
    ]);
  });

  it("T10 P2: must Excel, nice Spreadsheets, profile Excel only: one pair (Spreadsheets is its own skill, unmet)", () => {
    const got = pairsFor(CV1, [EXCEL4], confirm({ keptIds: ["excel"] }), [req("must", "excel", "Excel is required."), req("nice", "spreadsheets", "Spreadsheets are a plus.")]);
    expect(got).toEqual([{ id: 1, requirement: "Excel is required.", skillId: "excel", line: 4, text: L4 }]);
  });

  it("T10 P3: Excel is evidenced by line 7 (\"Learning Excel formulas ...\"): no pair, the line holds the marker \"learning\"", () => {
    expect(pairsFor(CV1, [EXCEL7], confirm({ keptIds: ["excel"] }), [req("must", "excel", "Excel is required.")])).toEqual([]);
  });

  it("T10 P5, P6, P7: no kept skills, a hand-added skill with no CV line, a skill in progress: no pair", () => {
    const r = [req("must", "excel", "Excel is required.")];
    expect(pairsFor(CV1, [], confirm({}), r)).toEqual([]); // P5
    expect(pairsFor(CV1, [], confirm({ added: ["Excel"] }), r)).toEqual([]); // P6
    expect(pairsFor(CV1, [], confirm({ inProgress: [{ name: "Excel", date: "2027-03-01" }] }), r)).toEqual([]); // P7
  });

  it("T10: every learning marker of D3 keeps a line out; \"learned\" is not a marker", () => {
    const r = [req("must", "excel", "Excel is required.")];
    const markers = ["learning", "studying", "planning", "currently", "lerne", "lernen", "lernend", "studiere", "geplant"];
    for (const w of markers) {
      const lines = [`Worked ${w} Excel formulas`];
      expect(pairsFor(lines, [prop("Excel", "excel", 1, "Excel")], confirm({ keptIds: ["excel"] }), r), `marker ${w}`).toEqual([]);
      const upper = [`${w.toUpperCase()} Excel formulas daily`];
      expect(pairsFor(upper, [prop("Excel", "excel", 1, "Excel")], confirm({ keptIds: ["excel"] }), r), `marker ${w} in capitals`).toEqual([]);
    }
    const control = ["Learned Excel formulas in a course"];
    expect(pairsFor(control, [prop("Excel", "excel", 1, "Excel")], confirm({ keptIds: ["excel"] }), r)).toEqual([
      { id: 1, requirement: "Excel is required.", skillId: "excel", line: 1, text: "Learned Excel formulas in a course" },
    ]);
  });
});

// P4: a made-up seven-line CV, one skill per line; the ad lists a nice-to-have first, then six musts.
const L7 = [
  "Kept the books in Excel",
  "Wrote SQL queries",
  "Wrote Python scripts",
  "Built dashboards in Tableau",
  "Kept spreadsheets tidy",
  "Planned in Google Sheets",
  "Helped customers at the counter",
];
const P7 = [
  prop("Excel", "excel", 1, "Excel"),
  prop("SQL", "sql", 2, "SQL"),
  prop("Python", "python", 3, "Python"),
  prop("Tableau", "tableau", 4, "Tableau"),
  prop("Spreadsheets", "spreadsheets", 5, "spreadsheets"),
  prop("Google Sheets", "google-sheets", 6, "Google Sheets"),
  prop("Customer service", "customer-service", 7, "Helped customers"),
];
const KEPT7 = confirm({ keptIds: P7.map((p) => p.skillId) });

describe("T11: order, one pair per line, the limit of 5", () => {
  it("T11 P4: seven skills met, the nice-to-have first in the ad: pairs 1 to 5 are the first five musts in ad order", () => {
    const got = pairsFor(L7, P7, KEPT7, [
      req("nice", "customer-service", "Customer service is a plus."),
      req("must", "excel", "Excel is required."),
      req("must", "sql", "SQL is required."),
      req("must", "python", "Python is required."),
      req("must", "tableau", "Tableau is required."),
      req("must", "spreadsheets", "Spreadsheets are required."),
      req("must", "google-sheets", "Google Sheets is required."),
    ]);
    expect(got).toEqual([
      { id: 1, requirement: "Excel is required.", skillId: "excel", line: 1, text: L7[0] },
      { id: 2, requirement: "SQL is required.", skillId: "sql", line: 2, text: L7[1] },
      { id: 3, requirement: "Python is required.", skillId: "python", line: 3, text: L7[2] },
      { id: 4, requirement: "Tableau is required.", skillId: "tableau", line: 4, text: L7[3] },
      { id: 5, requirement: "Spreadsheets are required.", skillId: "spreadsheets", line: 5, text: L7[4] },
    ]);
    expect(MAX_PAIRS).toBe(5);
  });

  it("T11 P4b: musts first, then the nice-to-have, whatever the ad's order", () => {
    const got = pairsFor(L7, P7, KEPT7, [req("nice", "customer-service", "Customer service is a plus."), req("must", "excel", "Excel is required."), req("must", "sql", "SQL is required.")]);
    expect(got).toEqual([
      { id: 1, requirement: "Excel is required.", skillId: "excel", line: 1, text: L7[0] },
      { id: 2, requirement: "SQL is required.", skillId: "sql", line: 2, text: L7[1] },
      { id: 3, requirement: "Customer service is a plus.", skillId: "customer-service", line: 7, text: L7[6] },
    ]);
  });

  it("T11 P2b: two requirements met by ONE line give one pair, for the first met requirement (musts first)", () => {
    const got = pairsFor(CV1, [EXCEL4, SHEETS4], confirm({ keptIds: ["excel", "spreadsheets"] }), [
      req("nice", "spreadsheets", "Spreadsheets are a plus."),
      req("must", "excel", "Excel is required."),
    ]);
    expect(got).toEqual([{ id: 1, requirement: "Excel is required.", skillId: "excel", line: 4, text: L4 }]);
  });

  it("T11: the limit is a parameter (2 gives the first two pairs); with no unmet limit all met requirements on distinct lines are kept up to 5", () => {
    const r = [req("must", "excel", "Excel is required."), req("must", "sql", "SQL is required."), req("must", "python", "Python is required.")];
    expect(pairsFor(L7, P7, KEPT7, r, 2).map((p) => p.skillId)).toEqual(["excel", "sql"]);
    expect(pairsFor(L7, P7, KEPT7, r).map((p) => p.skillId)).toEqual(["excel", "sql", "python"]);
  });

  it("T11: an ad with no requirement at all gives no pair (the roadmap does not count such an ad, so the engine's view is built directly), and a requirement with two accepted skills uses the one the profile has", () => {
    const view = engineView(ad("j0", "Empty Ad", "Invented Co", []), buildProfile(L7, P7, KEPT7, skills));
    expect(chooseBulletPairs(view.engineProfile, view.engineJob)).toEqual([]);
    const either: Requirement = { skillIds: ["power-bi", "tableau"], importance: "must", quote: "Power BI or Tableau." };
    expect(pairsFor(L7, P7, KEPT7, [either])).toEqual([{ id: 1, requirement: "Power BI or Tableau.", skillId: "tableau", line: 4, text: L7[3] }]);
  });
});

describe("T29: P0 for 8.3: the same ads give the same pairs whatever the job ids", () => {
  it("T29: all job ids 'pasted-ad' or distinct job ids: equal pairs, equal to the hand pairs", () => {
    const props = [EXCEL4, CUST5, SHEETS4];
    const conf = confirm({ keptIds: ["excel", "customer-service", "spreadsheets"] });
    const reqs = [req("must", "excel", "Excel is required."), req("nice", "customer-service", "Customer service is a plus.")];
    const want: BulletPair[] = [
      { id: 1, requirement: "Excel is required.", skillId: "excel", line: 4, text: L4 },
      { id: 2, requirement: "Customer service is a plus.", skillId: "customer-service", line: 5, text: L5 },
    ];
    expect(pairsFor(CV1, props, conf, reqs, undefined, pastedId)).toEqual(want);
    expect(pairsFor(CV1, props, conf, reqs, undefined, (i) => `job-${i}`)).toEqual(want);
  });
});
