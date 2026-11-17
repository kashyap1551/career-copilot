import { describe, expect, it } from "vitest";
import { profileReport } from "@/app/fitReport";
import { couldNotJudgeCounts, couldNotJudgeNote } from "@/app/reportText";
import { readSkillList, skillsOnlyReport } from "@/app/skillsOnly";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, KINDS, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job } from "@/lib/engine/types";

// docs/PLAN-FIT-LEVEL.md section 3 (with the reviewer's amendments): the regression set (the 11 rows of
// docs/FIT-LEVEL-FACTS.md) and the 26 new cases. EVERY expected string below was written from the plan's wording before
// any code existed; none was taken from the code's output.
//
// Material (invented): CV lines 1 "Alex Example, Reporting Analyst, Exampleville", 2 "Wrote SQL queries to reconcile order
// data", 3 "Built monthly dashboards in Tableau", 4 "Kept the weekly sales sheet in Excel". Ad "Reporting Analyst,
// Northlake Foods Ltd": musts SQL and Tableau, nice Excel, unless a case says otherwise.

const LINES = [
  "Alex Example, Reporting Analyst, Exampleville",
  "Wrote SQL queries to reconcile order data",
  "Built monthly dashboards in Tableau",
  "Kept the weekly sales sheet in Excel",
];
const P: CvSkill[] = [
  { name: "SQL", skillId: "sql", listed: true, line: 2, quote: "Wrote SQL queries", label: "named" },
  { name: "Tableau", skillId: "tableau", listed: true, line: 3, quote: "dashboards in Tableau", label: "named" },
  { name: "Excel", skillId: "excel", listed: true, line: 4, quote: "sales sheet in Excel", label: "named" },
];
type Req = { skillIds: string[]; importance: "must" | "nice"; quote: string };
const SQL: Req = { skillIds: ["sql"], importance: "must", quote: "You write SQL queries." };
const TAB: Req = { skillIds: ["tableau"], importance: "must", quote: "You build dashboards in Tableau." };
const XLS: Req = { skillIds: ["excel"], importance: "nice", quote: "Excel skills are a plus." };
const KOM: Req = { skillIds: ["new:kombucha-brewing"], importance: "must", quote: "You brew kombucha." };
const WELD: Req = { skillIds: ["new:welding"], importance: "must", quote: "You can weld." };
const KOM_NICE: Req = { skillIds: ["new:kombucha-brewing"], importance: "nice", quote: "Kombucha is a plus." };
const UNLISTED = [
  { id: "new:kombucha-brewing", name: "Kombucha brewing" },
  { id: "new:welding", name: "Welding" },
  { id: "new:looker", name: "Looker" },
];
type Over = { reqs?: Req[]; location?: string | null; remote?: "onsite" | "hybrid" | "remote" | null; minYears?: number | null; startDate?: string | null; languages?: { code: string; level: "B2" | "C1" | null }[] };
const job = (o: Over = {}): Job =>
  ({
    id: "invented-ad", title: "Reporting Analyst", company: "Northlake Foods Ltd", source: null,
    constraints: { languages: o.languages ?? [], location: o.location ?? null, remote: o.remote ?? null, minYears: o.minYears ?? null, startDate: o.startDate ?? null, otherConditions: [] },
    requirements: o.reqs ?? [SQL, TAB, XLS],
  }) as Job;
const ALL = ["sql", "tableau", "excel"];
const confirm = (keptIds: string[], over: Partial<ConfirmState> = {}): ConfirmState => ({ ...initialConfirm(P), keptIds, ...over });
const rep = (j: Job, keptIds: string[] = ALL, over: Partial<ConfirmState> = {}) =>
  profileReport(j, buildProfile(LINES, P, confirm(keptIds, over), skills), skills, UNLISTED);
const listRep = (text: string, j: Job) => {
  const { cvLines, lines } = readSkillList(text, skills);
  return skillsOnlyReport(j, cvLines, lines, skills, UNLISTED);
};
const TAIL = "Location, language, work mode, years and start date are not judged here.";
const LEAD_LOC = "Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon.";
const SQL_ROW = 'SQL: CV line 2: "Wrote SQL queries to reconcile order data"';
const TAB_ROW = 'Tableau: CV line 3: "Built monthly dashboards in Tableau"';
const XLS_ROW = 'Excel: CV line 4: "Kept the weekly sales sheet in Excel"';
const KOM_ROW = "Kombucha brewing: not in our skill list yet, so we could not judge it.";
const rows = (r: { rows: { importance: string; status: string; detail: string }[] }) => r.rows.map((x) => `${x.importance} | ${x.status} | ${x.detail}`);

describe("the regression set (docs/FIT-LEVEL-FACTS.md, nine cases, 9b and 5b)", () => {
  it("1: all met, nothing set: unchanged", () => {
    const r = rep(job());
    expect(r.fitLabel).toBe("Strong (skills only)");
    expect(r.explanation).toBe(`You meet all 2 must-haves on your profile. ${TAIL}`);
    expect(r.counts).toEqual({ mustsMet: 2, mustsTotal: 2, nicesMet: 1, nicesTotal: 1 });
    expect(r.satisfied).toEqual([]);
  });

  it("2: all met, a hybrid job in a city not on the profile: Long shot, and the explanation now names the reason", () => {
    const r = rep(job({ location: "Exampleville", remote: "hybrid" }), ALL, { cities: "Berlin" });
    expect(r.fitLabel).toBe("Long shot (judged: skills, location)");
    expect(r.explanation).toBe(
      `${LEAD_LOC} You meet all 2 must-haves on your profile. 1 conflict was found in what you set (listed below). Not judged here: language, work mode, years, start date.`,
    );
    expect(r.conflicts).toEqual(["(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin."]);
    expect(r.satisfied).toEqual([]);
  });

  it("3: all met, ad 3 years and profile 2: Stretch, unchanged, no 'fine' line for years", () => {
    const r = rep(job({ minYears: 3 }), ALL, { years: "2" });
    expect(r.fitLabel).toBe("Stretch (judged: skills, years)");
    expect(r.explanation).toBe(
      "You meet all 2 must-haves on your profile. 1 conflict was found in what you set (listed below). Not judged here: location, language, work mode, start date.",
    );
    expect(r.satisfied).toEqual([]);
  });

  it("4: all met, German B2 asked and B1 on the profile: Stretch, unchanged", () => {
    const r = rep(job({ languages: [{ code: "de", level: "B2" }] }), ALL, { languages: [{ code: "de", level: "B1" }] });
    expect(r.fitLabel).toBe("Stretch (judged: skills, language)");
    expect(r.explanation).toBe(
      "You meet all 2 must-haves on your profile. 1 conflict was found in what you set (listed below). Not judged here: location, work mode, years, start date.",
    );
    expect(r.satisfied).toEqual([]);
  });

  it("5: no skills on the profile: no level, and the sentence says to add skills first", () => {
    const r = rep(job(), []);
    expect(r.fitLabel).toBe("No level (no skills on your profile)");
    expect(r.explanation).toBe(`No level yet: there are no skills on your profile. Add skills first. 2 of 2 must-haves are missing: SQL, Tableau. ${TAIL}`);
    expect(r.counts).toEqual({ mustsMet: 0, mustsTotal: 2, nicesMet: 0, nicesTotal: 1 });
    expect(rows(r)).toEqual(["must | missing | SQL: not on your profile", "must | missing | Tableau: not on your profile", "nice | missing | Excel: not on your profile"]);
  });

  it("5b: the same on the typed-list path (an empty list)", () => {
    const r = listRep("", job());
    expect(r.fitLabel).toBe("No level (no skills on your list)");
    expect(r.explanation).toBe(`No level yet: your list has no skills we can match. Add skills first. 2 of 2 must-haves are missing: SQL, Tableau. ${TAIL}`);
    expect(rows(r)).toEqual(["must | missing | SQL: not on your list", "must | missing | Tableau: not on your list", "nice | missing | Excel: not on your list"]);
  });

  it("6: Tableau missing, nothing set: Good, unchanged", () => {
    const r = rep(job(), ["sql", "excel"]);
    expect(r.fitLabel).toBe("Good (skills only)");
    expect(r.explanation).toBe(`One must-have is missing: Tableau. ${TAIL}`);
  });

  it("7: one unlisted must-have: the level moves from Good to Strong, with the caveat in the label, the sentence, the row and the counts", () => {
    const r = rep(job({ reqs: [SQL, TAB, KOM, XLS] }));
    expect(r.fitLabel).toBe("Strong (skills only; 1 must-have not judged)");
    expect(r.explanation).toBe(`You meet all 2 must-haves on your profile, plus 1 must-have we could not judge. ${TAIL}`);
    expect(r.counts).toEqual({ mustsMet: 2, mustsTotal: 2, nicesMet: 1, nicesTotal: 1 });
    expect(r.unlistedRequirements).toBe(1);
    expect(r.couldNotJudge).toEqual({ musts: 1, nices: 0 });
    expect(rows(r)).toEqual([`must | met | ${SQL_ROW}`, `must | met | ${TAB_ROW}`, `must | unlisted | ${KOM_ROW}`, `nice | met | ${XLS_ROW}`]);
  });

  it("8: only the nice-to-have missing: Strong, unchanged", () => {
    const r = rep(job(), ["sql", "tableau"]);
    expect(r.fitLabel).toBe("Strong (skills only)");
    expect(r.counts).toEqual({ mustsMet: 2, mustsTotal: 2, nicesMet: 0, nicesTotal: 1 });
  });

  it("9: a satisfied location: the explanation is as before and ONE new line says it is fine", () => {
    const r = rep(job({ location: "Berlin", remote: "hybrid" }), ALL, { cities: "Berlin" });
    expect(r.fitLabel).toBe("Strong (judged: skills, location)");
    expect(r.explanation).toBe("You meet all 2 must-haves on your profile. No conflict was found in what you set. Not judged here: language, work mode, years, start date.");
    expect(r.satisfied).toEqual(["Location: fine. The job is in Berlin, and Berlin is on your profile."]);
  });

  it("9b: Tableau in progress instead of a have skill: Good, unchanged", () => {
    const r = rep(job(), ["sql"], { inProgress: [{ name: "Tableau", date: "2027-03-01" }] });
    expect(r.fitLabel).toBe("Good (skills only)");
    expect(r.explanation).toBe(`One must-have is missing: Tableau. ${TAIL}`);
    expect(rows(r)).toContain("must | missing | Tableau: in progress, expected 2027-03-01");
  });
});

describe("(a) unlisted requirements", () => {
  it("A1: two unlisted must-haves: Strong with the caveat in all four places", () => {
    const r = rep(job({ reqs: [SQL, TAB, KOM, WELD, XLS] }));
    expect(r.fitLabel).toBe("Strong (skills only; 2 must-haves not judged)");
    expect(r.explanation).toBe(`You meet all 2 must-haves on your profile, plus 2 must-haves we could not judge. ${TAIL}`);
    expect(r.counts).toEqual({ mustsMet: 2, mustsTotal: 2, nicesMet: 1, nicesTotal: 1 });
    expect(r.couldNotJudge).toEqual({ musts: 2, nices: 0 });
    expect(couldNotJudgeCounts(2, 0)).toBe("Could not judge: 2 must-haves, 0 nice-to-haves.");
    expect(rows(r).filter((x) => x.includes("| unlisted |"))).toHaveLength(2);
  });

  it("A2: one must-have missing and one unlisted: Good with the caveat", () => {
    const r = rep(job({ reqs: [SQL, TAB, KOM] }), ["sql", "excel"]);
    expect(r.fitLabel).toBe("Good (skills only; 1 must-have not judged)");
    expect(r.explanation).toBe(`One must-have is missing: Tableau, plus 1 must-have we could not judge. ${TAIL}`);
  });

  it("A3: every must-have unlisted: no level, and the nice-to-have that can be judged still shows", () => {
    const r = rep(job({ reqs: [KOM, WELD, XLS] }));
    expect(r.fitLabel).toBe("No level (no must-have we could judge)");
    expect(r.explanation).toBe("No level can be shown: none of the ad's 2 must-haves is in our skill list yet, so none could be judged.");
    expect(r.counts).toEqual({ mustsMet: 0, mustsTotal: 0, nicesMet: 1, nicesTotal: 1 });
    expect(rows(r)).toEqual([
      `must | unlisted | ${KOM_ROW}`,
      "must | unlisted | Welding: not in our skill list yet, so we could not judge it.",
      `nice | met | ${XLS_ROW}`,
    ]);
  });

  it("A3b: one must-have, unlisted: no level, singular wording", () => {
    const r = rep(job({ reqs: [KOM] }));
    expect(r.fitLabel).toBe("No level (no must-have we could judge)");
    expect(r.explanation).toBe("No level can be shown: the ad's only must-have is not in our skill list yet, so it could not be judged.");
  });

  it("A4: only a nice-to-have is unlisted: the level and the label are untouched, and the nice-to-have is not counted", () => {
    const r = rep(job({ reqs: [SQL, TAB, KOM_NICE] }));
    expect(r.fitLabel).toBe("Strong (skills only)");
    expect(r.explanation).toBe(`You meet all 2 must-haves on your profile. ${TAIL}`);
    expect(r.counts).toEqual({ mustsMet: 2, mustsTotal: 2, nicesMet: 0, nicesTotal: 0 });
    expect(r.couldNotJudge).toEqual({ musts: 0, nices: 1 });
    expect(r.unlistedRequirements).toBe(1);
    expect(couldNotJudgeCounts(0, 1)).toBe("Could not judge: 0 must-haves, 1 nice-to-have.");
    expect(couldNotJudgeNote(1)).toBe("1 requirement is not in our skill list yet, so we could not judge it. It is not counted in the level or in the counts below.");
  });

  it("A5: an unlisted must-have next to a conflict that can't be closed: the label carries both, and the sentence names the reason", () => {
    const r = rep(job({ reqs: [SQL, KOM], location: "Exampleville", remote: "hybrid" }), ALL, { cities: "Berlin" });
    expect(r.fitLabel).toBe("Long shot (judged: skills, location; 1 must-have not judged)");
    expect(r.explanation).toBe(
      `${LEAD_LOC} You meet the only must-have on your profile, plus 1 must-have we could not judge. 1 conflict was found in what you set (listed below). Not judged here: language, work mode, years, start date.`,
    );
  });

  it("A6: the typed-list path: the same rule, 'on your list'", () => {
    const r = listRep("SQL", job({ reqs: [SQL, KOM] }));
    expect(r.fitLabel).toBe("Strong (skills only; 1 must-have not judged)");
    expect(r.explanation).toBe(`You meet the only must-have on your list, plus 1 must-have we could not judge. ${TAIL}`);
    expect(r.counts).toEqual({ mustsMet: 1, mustsTotal: 1, nicesMet: 0, nicesTotal: 0 });
    expect(r.couldNotJudge).toEqual({ musts: 1, nices: 0 });
  });

  it("A7: an ad with no must-haves at all is not 'none could be judged': Strong, as today", () => {
    const r = rep(job({ reqs: [XLS] }));
    expect(r.fitLabel).toBe("Strong (skills only)");
    expect(r.explanation).toBe(`The ad lists no must-haves. ${TAIL}`);
    expect(r.counts).toEqual({ mustsMet: 0, mustsTotal: 0, nicesMet: 1, nicesTotal: 1 });
  });

  it("A8: a requirement with one listed and one unlisted alternative is judged, and missing", () => {
    const alt: Req = { skillIds: ["power-bi", "new:looker"], importance: "must", quote: "Power BI or Looker." };
    const r = rep(job({ reqs: [alt] }));
    expect(r.unlistedRequirements).toBe(0);
    expect(rows(r)).toEqual(["must | missing | Power BI or Looker: not on your profile"]);
    expect(r.fitLabel).toBe("Good (skills only)");
  });

  it("W3/W4: the wording of the note and of the counts tail, singular and plural", () => {
    expect(couldNotJudgeNote(0)).toBeNull();
    expect(couldNotJudgeNote(3)).toBe("3 requirements are not in our skill list yet, so we could not judge them. They are not counted in the level or in the counts below.");
    expect(couldNotJudgeCounts(0, 0)).toBeNull();
    expect(couldNotJudgeCounts(1, 0)).toBe("Could not judge: 1 must-have, 0 nice-to-haves.");
    expect(couldNotJudgeCounts(2, 1)).toBe("Could not judge: 2 must-haves, 1 nice-to-have.");
  });
});

describe("(b) the named reason", () => {
  it("B1: a language the profile does not list", () => {
    const r = rep(job({ languages: [{ code: "de", level: "B2" }] }), ALL, { languages: [{ code: "en", level: "C1" }] });
    expect(r.fitLabel).toBe("Long shot (judged: skills, language)");
    expect(r.explanation).toBe(
      "Long shot because of language: The ad asks for German at B2; your profile does not list German. That can't be closed soon. You meet all 2 must-haves on your profile. 1 conflict was found in what you set (listed below). Not judged here: location, work mode, years, start date.",
    );
  });

  it("B2: two conflicts that can't be closed: only the first (the city) is named; both are listed", () => {
    const r = rep(job({ location: "Exampleville", remote: "onsite" }), ALL, { cities: "Berlin", workModes: ["remote"] });
    expect(r.fitLabel).toBe("Long shot (judged: skills, location, work mode)");
    expect(r.explanation).toBe(
      `${LEAD_LOC} You meet all 2 must-haves on your profile. 2 conflicts were found in what you set (listed below). Not judged here: language, years, start date.`,
    );
    expect(r.conflicts).toHaveLength(2);
  });

  it("B3: one conflict that could be closed: no lead sentence (Stretch)", () => {
    const r = rep(job({ languages: [{ code: "de", level: "B2" }] }), ALL, { languages: [{ code: "de", level: "B1" }] });
    expect(r.fitLabel.startsWith("Stretch")).toBe(true);
    expect(r.explanation.startsWith("Long shot because")).toBe(false);
  });

  it("B4: Long shot by three gaps (no conflict that can't be closed): no lead sentence", () => {
    const r = rep(job({ minYears: 3 }), ["excel"], { years: "2" });
    expect(r.fitLabel).toBe("Long shot (judged: skills, years)");
    expect(r.explanation).toBe(
      "2 of 2 must-haves are missing: SQL, Tableau. 1 conflict was found in what you set (listed below). Not judged here: location, language, work mode, start date.",
    );
  });

  it("B5: a conflict that can't be closed and no skills: no level, so nothing to explain, but the conflict is still listed", () => {
    const r = rep(job({ location: "Exampleville", remote: "hybrid" }), [], { cities: "Berlin" });
    expect(r.fitLabel).toBe("No level (no skills on your profile)");
    expect(r.explanation).toBe(
      "No level yet: there are no skills on your profile. Add skills first. 2 of 2 must-haves are missing: SQL, Tableau. 1 conflict was found in what you set (listed below). Not judged here: language, work mode, years, start date.",
    );
    expect(r.explanation).not.toContain("Long shot because");
    expect(r.conflicts).toHaveLength(1);
  });
});

describe("(c) satisfied constraints", () => {
  const FINE_ALL = job({ location: "Berlin", remote: "hybrid", languages: [{ code: "de", level: "B2" }], minYears: 2, startDate: "2026-12-01" });
  const SET_ALL: Partial<ConfirmState> = { cities: "Berlin", workModes: ["hybrid"], languages: [{ code: "de", level: "C1" }], years: "3", availableFrom: "2026-11-15" };

  it("C1: all five kinds set, stated and fine: five lines in this order", () => {
    const r = rep(FINE_ALL, ALL, SET_ALL);
    expect(r.fitLabel).toBe("Strong (judged: skills, location, language, work mode, years, start date)");
    expect(r.explanation).toBe("You meet all 2 must-haves on your profile. No conflict was found in what you set.");
    expect(r.satisfied).toEqual([
      "Location: fine. The job is in Berlin, and Berlin is on your profile.",
      "Language: fine. The ad asks for German at B2; your profile has C1.",
      "Work mode: fine. The job is hybrid, and your profile accepts hybrid.",
      "Years: fine. The ad asks for 2 years; your profile has 3.",
      "Start date: fine. The ad wants a start by 2026-12-01; you are available from 2026-11-15.",
    ]);
  });

  it("C2: the location is fine and the years conflict: only the location line", () => {
    const r = rep(job({ location: "Berlin", remote: "hybrid", minYears: 3 }), ALL, { cities: "Berlin", years: "2" });
    expect(r.satisfied).toEqual(["Location: fine. The job is in Berlin, and Berlin is on your profile."]);
    expect(r.conflicts).toEqual(["(could be closed) The ad asks for 3 years of experience; your profile has 2 (1 year short)."]);
  });

  it("C3: a language the ad gives no level for is not compared: no 'fine' line, and the 'not judged' line stays", () => {
    const r = rep(job({ languages: [{ code: "de", level: null }] }), ALL, { languages: [{ code: "de", level: "C1" }] });
    expect(r.satisfied).toEqual([]);
    expect(r.notJudged).toContain("Language: The ad names German but no level, so your level was not compared.");
  });

  it("C4: two languages, both fine: ONE line, each part in the same form", () => {
    const r = rep(job({ languages: [{ code: "de", level: "B2" }, { code: "en", level: "C1" }] }), ALL, {
      languages: [{ code: "de", level: "C1" }, { code: "en", level: "C1" }],
    });
    expect(r.satisfied).toEqual([
      "Language: fine. The ad asks for German at B2; your profile has C1. The ad asks for English at C1; your profile has C1.",
    ]);
  });

  it("C5: a kind the person set but the ad does not state is not judged: no 'fine' line", () => {
    const r = rep(job({ location: "Berlin", remote: null }), ALL, { cities: "Berlin" });
    expect(r.judged).toEqual([]);
    expect(r.satisfied).toEqual([]);
  });

  it("C6: two languages, one with a conflict: no language line at all", () => {
    const r = rep(job({ languages: [{ code: "de", level: "B2" }, { code: "en", level: "C1" }] }), ALL, {
      languages: [{ code: "de", level: "B1" }, { code: "en", level: "C1" }],
    });
    expect(r.conflicts).toHaveLength(1);
    expect(r.satisfied).toEqual([]);
  });

  it("C7: the typed-list path judges no constraint, so it has no 'fine' lines", () => {
    const r = listRep("SQL\nTableau", job({ location: "Berlin", remote: "hybrid" }));
    expect((r as { satisfied?: string[] }).satisfied).toBeUndefined();
  });

  it("G: over the grid of ads and settings, 'fine' lines are exactly the judged kinds without a conflict, in the fixed order", () => {
    const CAP: Record<string, string> = { location: "Location", language: "Language", workMode: "Work mode", years: "Years", startDate: "Start date" };
    const modes = [null, "onsite", "hybrid", "remote"] as const;
    const settings: Partial<ConfirmState>[] = Array.from({ length: 32 }, (_, bits) => ({
      ...(bits & 1 ? { cities: "Berlin" } : {}),
      ...(bits & 2 ? { languages: [{ code: "de", level: "B2" as const }] } : {}),
      ...(bits & 4 ? { workModes: ["onsite" as const] } : {}),
      ...(bits & 8 ? { years: "1" } : {}),
      ...(bits & 16 ? { availableFrom: "2027-06-01" } : {}),
    }));
    let checked = 0;
    for (const remote of modes)
      for (const location of [null, "Manchester"] as const)
        for (const minYears of [null, 3] as const)
          for (const startDate of [null, "2027-01-15"] as const)
            for (const languages of [[], [{ code: "en", level: "C1" as const }]] as const)
              for (const over of settings) {
                const r = rep(job({ remote, location, minYears, startDate, languages: languages.map((l) => ({ ...l })) }), ALL, over);
                const expected = KINDS.filter((k) => r.judged.includes(k) && !r.conflictKinds.includes(k)).map((k) => CAP[k]);
                expect(r.satisfied.map((l) => l.split(":")[0])).toEqual(expected);
                checked++;
              }
    expect(checked).toBe(2048);
  });
});

describe("(d) empty skills", () => {
  it("D1: no skills and an ad with no must-haves: no level", () => {
    const r = rep(job({ reqs: [XLS] }), []);
    expect(r.fitLabel).toBe("No level (no skills on your profile)");
    expect(r.explanation).toBe(`No level yet: there are no skills on your profile. Add skills first. The ad lists no must-haves. ${TAIL}`);
  });

  it("D2: a profile whose only skill is one in progress has an entry, so a level is printed", () => {
    const r = rep(job(), [], { inProgress: [{ name: "SQL", date: "2027-03-01" }] });
    expect(r.fitLabel).toBe("Stretch (skills only)");
    expect(r.explanation).toBe(`2 of 2 must-haves are missing: SQL, Tableau. ${TAIL}`);
    expect(rows(r)).toContain("must | missing | SQL: in progress, expected 2027-03-01");
  });

  it("D3: a profile whose only skill was added by hand with no CV line has an entry, so a level is printed", () => {
    const r = rep(job(), [], { added: ["SQL"] });
    expect(r.fitLabel).toBe("Stretch (skills only)");
    expect(rows(r)).toContain("must | missing | SQL: added by hand with no CV line, so it does not count. Add a line about it to your CV text and read again.");
  });

  it("D4: no skills AND every must-have unlisted: the 'could not judge' reason wins", () => {
    const r = rep(job({ reqs: [KOM, WELD] }), []);
    expect(r.fitLabel).toBe("No level (no must-have we could judge)");
  });

  it("D5: a typed list whose lines are all unlisted: no skills we can match", () => {
    const r = listRep("Welding\nFermenting", job());
    expect(r.fitLabel).toBe("No level (no skills on your list)");
    expect(r.explanation).toBe(`No level yet: your list has no skills we can match. Add skills first. 2 of 2 must-haves are missing: SQL, Tableau. ${TAIL}`);
  });
});

describe("(e) Amendment 4: an ad with no requirements at all shows no level", () => {
  const W10 = "No level can be shown: no requirements were found in this ad, so check that the whole ad was pasted.";
  const NO_REQ = "No level (no requirements found in this ad)";
  const EMPTY = job({ reqs: [] });

  it("Z1: profile path, skills present: no level, the sentence, nothing counted, no rows", () => {
    const r = rep(EMPTY);
    expect(r.fitLabel).toBe(NO_REQ);
    expect(r.explanation).toBe(W10);
    expect(r.counts).toEqual({ mustsMet: 0, mustsTotal: 0, nicesMet: 0, nicesTotal: 0 });
    expect(r.rows).toEqual([]);
  });

  it("Z2: profile path, no skills either: the same (no requirements wins; no 'add skills first')", () => {
    const r = rep(EMPTY, []);
    expect(r.fitLabel).toBe(NO_REQ);
    expect(r.explanation).toBe(W10);
    expect(r.explanation).not.toContain("Add skills first");
  });

  it("Z3: profile path, a conflict that can't be closed: still listed, and no 'Long shot because of' lead", () => {
    const r = rep(job({ reqs: [], location: "Exampleville", remote: "hybrid" }), ALL, { cities: "Berlin" });
    expect(r.fitLabel).toBe(NO_REQ);
    expect(r.explanation).toBe(W10);
    expect(r.explanation).not.toContain("Long shot because");
    expect(r.conflicts).toEqual(["(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin."]);
  });

  it("Z3b: profile path, a satisfied city: the 'fine' line is still printed", () => {
    const r = rep(job({ reqs: [], location: "Berlin", remote: "hybrid" }), ALL, { cities: "Berlin" });
    expect(r.fitLabel).toBe(NO_REQ);
    expect(r.satisfied).toEqual(["Location: fine. The job is in Berlin, and Berlin is on your profile."]);
  });

  it("Z4: list path, the list has a skill: no level, the same sentence, no rows", () => {
    const r = listRep("SQL", EMPTY);
    expect(r.fitLabel).toBe(NO_REQ);
    expect(r.explanation).toBe(W10);
    expect(r.rows).toEqual([]);
  });

  it("Z5: list path, an empty list: the same (no requirements wins over 'no skills on your list')", () => {
    const r = listRep("", EMPTY);
    expect(r.fitLabel).toBe(NO_REQ);
    expect(r.explanation).toBe(W10);
  });

  it("Z6: list path, only a nice-to-have: unchanged, Strong", () => {
    const r = listRep("SQL", job({ reqs: [XLS] }));
    expect(r.fitLabel).toBe("Strong (skills only)");
    expect(r.explanation).toBe(`The ad lists no must-haves. ${TAIL}`);
  });

  it("Z7: only an unlisted nice-to-have, skills present: a requirement WAS read, so a level is shown (both paths)", () => {
    const only = job({ reqs: [KOM_NICE] });
    for (const r of [rep(only), listRep("SQL", only)]) {
      expect(r.fitLabel).toBe("Strong (skills only)");
      expect(r.explanation).toBe(`The ad lists no must-haves. ${TAIL}`);
      expect(r.counts).toEqual({ mustsMet: 0, mustsTotal: 0, nicesMet: 0, nicesTotal: 0 });
      expect(r.unlistedRequirements).toBe(1);
      expect(r.couldNotJudge).toEqual({ musts: 0, nices: 1 });
      expect(rows(r)).toEqual(["nice | unlisted | Kombucha brewing: not in our skill list yet, so we could not judge it."]);
    }
  });

  it("Z8: only an unlisted nice-to-have and no skills: 'no skills' applies", () => {
    const r = rep(job({ reqs: [KOM_NICE] }), []);
    expect(r.fitLabel).toBe("No level (no skills on your profile)");
    expect(r.explanation).toBe(`No level yet: there are no skills on your profile. Add skills first. The ad lists no must-haves. ${TAIL}`);
  });
});
