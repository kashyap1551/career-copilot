import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { engineView } from "@/lib/cv/engineView";
import { buildProfile, type BuiltProfile, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import { gapList } from "@/lib/engine/gaps";
import { match } from "@/lib/engine/match";
import type { Job, Requirement } from "@/lib/engine/types";

// Step 7.1b, tests first (docs/PLAN-7.1.md section 7, the gap-list cases G1 to G13 and the DATA of G14a to G14j).
// The SENTENCE of G14 is in tests/heldBackLine.test.ts. Every number below was worked out by hand from the plan's
// four-ad example (section 1) BEFORE any code; the hand count sits in the comment next to it. All people, ads and
// companies are invented.
//
// What `gapList` is given: the profile and the ads AFTER `engineView` (the judgeable job with unset kinds blanked,
// and the profile with the work-modes default), exactly what the page will pass. It is asked for the ads that COUNT:
// ads left out of the roadmap (no requirements, no must-have we could judge) are chosen upstream (stage B), so `of`
// below is always the number of ads handed in.

// ---- the invented person -------------------------------------------------------------------------------------------
const LINES = [
  "Robin Sample, Reporting Analyst", // 1
  "Wrote SQL queries to reconcile order data", // 2 (SQL)
  "Built monthly dashboards in Tableau", // 3 (Tableau, only ticked in G4)
  "Skills: Excel", // 4 (Excel)
];
const proposal = (name: string, skillId: string, line: number, quote: string): CvSkill => ({
  name, skillId, listed: true, line, quote, label: "named",
});
const PROPOSALS = [
  proposal("SQL", "sql", 2, "Wrote SQL queries"),
  proposal("Tableau", "tableau", 3, "dashboards in Tableau"),
  proposal("Excel", "excel", 4, "Skills: Excel"),
];
// Section 1: SQL (CV line 2) and Excel (CV line 4) are had; Tableau is in progress, expected 2027-03-01; the person set
// only a city, Berlin (so only the location kind is set; the work modes default to all three).
const person = (over: Partial<ConfirmState> = {}): BuiltProfile =>
  buildProfile(
    LINES,
    PROPOSALS,
    {
      keptIds: ["sql", "excel"],
      added: [],
      inProgress: [{ name: "Tableau", date: "2027-03-01" }],
      languages: [],
      cities: "Berlin",
      workModes: [],
      years: "",
      availableFrom: "",
      ...over,
    },
    skills,
  );

// ---- the invented ads ----------------------------------------------------------------------------------------------
const must = (...skillIds: string[]): Requirement => ({ skillIds, importance: "must", quote: `must ${skillIds.join(" or ")}` });
const nice = (...skillIds: string[]): Requirement => ({ skillIds, importance: "nice", quote: `nice ${skillIds.join(" or ")}` });
type Over = { remote?: Job["constraints"]["remote"]; location?: string | null; minYears?: number | null; languages?: Job["constraints"]["languages"] };
const ad = (id: string, title: string, company: string, requirements: Requirement[], over: Over = {}): Job => ({
  id,
  title,
  company,
  source: null,
  requirements,
  constraints: {
    languages: over.languages ?? [],
    location: over.location === undefined ? "Berlin" : over.location,
    remote: over.remote === undefined ? "hybrid" : over.remote,
    minYears: over.minYears === undefined ? null : over.minYears,
    startDate: null,
    otherConditions: [],
  },
});

// The four-ad example of section 1: every ad in Berlin, hybrid, no conflict.
const UNLISTED = "new:kombucha-brewing";
const ad1 = (o: Over = {}) => ad("a1", "Reporting Analyst", "Northlake Foods Ltd", [must("sql"), must("tableau"), nice("excel")], o);
const ad2 = (o: Over = {}) => ad("a2", "BI Developer", "Harbor Light Stationery", [must("sql"), must("python"), nice("tableau")], o);
const ad3 = (o: Over = {}) => ad("a3", "Data Clerk", "Example Wharf Ltd", [must("excel"), nice("python"), nice("power-bi")], o);
const ad4 = (o: Over = {}) => ad("a4", "Analytics Lead", "Imaginary Pages Ltd", [must("sql"), must("python"), must(UNLISTED), nice("tableau")], o);
const FOUR = () => [ad1(), ad2(), ad3(), ad4()];

// What the page does: engineView for each ad, then the gap list over the judgeable jobs.
function gaps(built: BuiltProfile, jobs: Job[]) {
  const views = jobs.map((j) => engineView(j, built));
  return gapList(views[0].engineProfile, views.map((v) => v.engineJob));
}

// Hand count of section 1 (also the expected rows of G1, G12, G14a, G14b and G14e..j wherever the skills are unchanged):
//  ad 1 unmet: must Tableau (in progress, so not met)          -> Tableau must +1
//  ad 2 unmet: must Python; nice Tableau                       -> Python must +1, Tableau nice +1
//  ad 3 unmet: nice Python; nice Power BI (must Excel is met)  -> Python nice +1, Power BI nice +1
//  ad 4 unmet: must Python; nice Tableau (Kombucha: not judged, in no row) -> Python must +1, Tableau nice +1
const SECTION_1_ROWS = [
  { skillId: "python", mustAds: 2, niceAds: 1, learning: null, noCvLine: false }, // must: ads 2, 4; nice: ad 3
  { skillId: "tableau", mustAds: 1, niceAds: 2, learning: "2027-03-01", noCvLine: false }, // must: ad 1; nice: ads 2, 4
  { skillId: "power-bi", mustAds: 0, niceAds: 1, learning: null, noCvLine: false }, // nice: ad 3
];

describe("the gap list: counts, order and notes (G1 to G13)", () => {
  it("G1: the four-ad example gives the three rows of section 1, in order Python, Tableau, Power BI, and no Kombucha row", () => {
    const g = gaps(person(), FOUR());
    expect(g.rows).toEqual(SECTION_1_ROWS);
    // order: musts first (2, 1, 0), not name only (that would give Power BI, Python, Tableau)
    expect(g.rows.map((r) => r.skillId)).toEqual(["python", "tableau", "power-bi"]);
    expect(g.rows.some((r) => r.skillId === UNLISTED)).toBe(false);
    // hand count: no ad has a conflict (all in Berlin, hybrid): nothing held back; 4 ads were handed in
    expect(g.heldBack).toEqual({ ads: 0, of: 4, kinds: [] });
  });

  it("G1b: the unlisted requirement of ad 4 is what engineView sets aside: 1 requirement could not be judged (hand count 1)", () => {
    const view = engineView(ad4(), person());
    expect(view.couldNotJudge.map((r) => r.skillIds)).toEqual([[UNLISTED]]);
  });

  it("G2: two skills with the same counts are ordered by skill name (Power BI before Python), not by the ad's order", () => {
    // one ad: must Python, must Power BI (Python is written first). Profile: SQL, Excel. Hand count: each must +1.
    const g = gaps(person({ inProgress: [] }), [ad("x", "Analyst", "Invented Co", [must("python"), must("power-bi")])]);
    expect(g.rows.map((r) => [r.skillId, r.mustAds, r.niceAds])).toEqual([
      ["power-bi", 1, 0],
      ["python", 1, 0],
    ]);
  });

  it("G3: a requirement with alternatives (Power BI or Tableau, must, unmet) counts for each alternative, one ad each", () => {
    // Profile has neither (no Tableau in progress). Hand count: Power BI must 1, Tableau must 1; tie -> by name.
    const g = gaps(person({ inProgress: [] }), [ad("x", "Analyst", "Invented Co", [must("power-bi", "tableau")])]);
    expect(g.rows).toEqual([
      { skillId: "power-bi", mustAds: 1, niceAds: 0, learning: null, noCvLine: false },
      { skillId: "tableau", mustAds: 1, niceAds: 0, learning: null, noCvLine: false },
    ]);
  });

  it("G4: the same requirement when the profile has one of the alternatives is met: no gap, no row", () => {
    // Tableau ticked from CV line 3: "Power BI or Tableau" is met. Hand count: 0 rows.
    const g = gaps(person({ keptIds: ["sql", "excel", "tableau"], inProgress: [] }), [
      ad("x", "Analyst", "Invented Co", [must("power-bi", "tableau")]),
    ]);
    expect(g.rows).toEqual([]);
  });

  it("G5: a skill the person is learning carries its expected date in the row", () => {
    // Tableau in progress, 2027-03-01 (section 1). Hand count: the Tableau row has learning "2027-03-01"; the others null.
    const g = gaps(person(), FOUR());
    expect(g.rows.find((r) => r.skillId === "tableau")?.learning).toBe("2027-03-01");
    expect(g.rows.filter((r) => r.learning !== null).length).toBe(1);
  });

  it("G6: a skill added by hand with no CV line is a gap and the row says so (noCvLine true)", () => {
    // Python added by hand: on the profile, no evidence, so match() says reason "no-cv-line" (not met).
    // Hand count: ad must Python -> Python must 1, noCvLine true.
    const g = gaps(person({ added: ["Python"], inProgress: [] }), [ad("x", "Analyst", "Invented Co", [must("python")])]);
    expect(g.rows).toEqual([{ skillId: "python", mustAds: 1, niceAds: 0, learning: null, noCvLine: true }]);
  });

  it("G7: an unlisted-only requirement is in no row (engineView set it aside before the gap list)", () => {
    // ad: must SQL (met), must Kombucha (unlisted). Hand count: 0 rows, 1 requirement could not be judged.
    const job = ad("x", "Analyst", "Invented Co", [must("sql"), must(UNLISTED)]);
    const g = gaps(person(), [job]);
    expect(g.rows).toEqual([]);
    expect(engineView(job, person()).couldNotJudge.length).toBe(1);
  });

  it("G8: an ad with no requirements contributes no row", () => {
    // Hand count: nothing to miss. (Naming it in the 'not counted' line, and leaving it out of M, is decided upstream by
    // roadmapBasis in stage B: this file only checks the rows.)
    const g = gaps(person(), [ad("x", "Analyst", "Invented Co", [])]);
    expect(g.rows).toEqual([]);
  });

  it("G10: nothing unmet in any ad: no rows", () => {
    // Every requirement is SQL or Excel (met). Hand count: 0 rows.
    const g = gaps(person(), [
      ad("a", "A", "Invented Co", [must("sql"), nice("excel")]),
      ad("b", "B", "Invented Co", [must("excel")]),
    ]);
    expect(g.rows).toEqual([]);
  });

  it("G11: a skill asked as a must in one ad and a nice in another is counted in both columns", () => {
    // ad A: must Python; ad B: nice Python. Hand count: Python must 1, nice 1.
    const g = gaps(person(), [
      ad("a", "A", "Invented Co", [must("python")]),
      ad("b", "B", "Invented Co", [nice("python")]),
    ]);
    expect(g.rows).toEqual([{ skillId: "python", mustAds: 1, niceAds: 1, learning: null, noCvLine: false }]);
  });

  it("G12: an ad blocked by a conflict (a city out of reach) still counts: its unmet skills are in the rows", () => {
    // ad 2 in Exampleville (city conflict: match.ts checkPlace, hybrid is not remote and Exampleville is not Berlin).
    // Hand count: the rows are the section-1 rows unchanged (ad 2's Python and nice Tableau still count).
    const jobs = [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()];
    expect(gaps(person(), jobs).rows).toEqual(SECTION_1_ROWS);
  });

  it("G13: an ad is counted once per importance even if two of its requirements name the same skill", () => {
    // one ad with two must requirements (different quotes) that both name Python. Hand count: Python must 1, not 2.
    const g = gaps(person(), [
      ad("x", "Analyst", "Invented Co", [
        { skillIds: ["python"], importance: "must", quote: "Python for reports" },
        { skillIds: ["python"], importance: "must", quote: "Python for automation" },
      ]),
    ]);
    expect(g.rows).toEqual([{ skillId: "python", mustAds: 1, niceAds: 0, learning: null, noCvLine: false }]);
  });
});

// The DATA of G14 (docs/PLAN-7.1.md Amendment 2): `heldBack` = { ads: N, of: M, kinds }.
// N = counted ads with at least one conflict that can't be closed soon (an ad counts once); M = ads handed in;
// kinds = the kinds of the UNCLOSABLE conflicts only, each once, in the order of KINDS, as the person's `Kind` words.
describe("the held-back data (G14a to G14j)", () => {
  it("G14a: ad 2 hybrid in Exampleville, person's city Berlin: rows unchanged, heldBack { 1, of 4, [location] }", () => {
    // Conflict: match.ts checkPlace, branch `!profile.constraints.locations.some(same(city))`: city Exampleville is not on
    // [Berlin]; closable false. No work-mode conflict (the person set no work mode, so all three are accepted).
    const g = gaps(person(), [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()]);
    expect(g.rows).toEqual(SECTION_1_ROWS);
    expect(g.heldBack).toEqual({ ads: 1, of: 4, kinds: ["location"] });
  });

  it("G14b: ad 2 hybrid in Exampleville (location only), ad 3 on-site in Berlin (work mode only): { 2, of 4, [location, work mode] }", () => {
    // Profile: city Berlin, work mode hybrid only. Ad 2: checkPlace city branch -> city conflict (unclosable); hybrid is
    // accepted so no work-mode conflict. Ad 3: city Berlin matches; checkPlace work-mode branch: onsite is not in [hybrid]
    // -> workMode conflict (unclosable). Ads 1 and 4: hybrid in Berlin, no conflict. Hand count: N = 2, M = 4.
    // Why this shape: checkPlace compares the city only when the ad is not remote, so a "remote only" profile cannot give
    // a location-only conflict.
    const g = gaps(person({ workModes: ["hybrid"] }), [ad1(), ad2({ location: "Exampleville" }), ad3({ remote: "onsite" }), ad4()]);
    expect(g.heldBack).toEqual({ ads: 2, of: 4, kinds: ["location", "workMode"] });
  });

  it("G14c: the only conflict is one that could be closed (one year short): no ad is held back", () => {
    // Person sets years 2; ad 2 asks 3 years: checkYears, short = 1 <= YEARS_CLOSABLE_SHORTFALL (1) -> closable true.
    // Hand count: N = 0, M = 4, kinds [].
    const g = gaps(person({ years: "2" }), [ad1(), ad2({ minYears: 3 }), ad3(), ad4()]);
    expect(g.heldBack).toEqual({ ads: 0, of: 4, kinds: [] });
  });

  it("G14d: no counted ad has a conflict (the plain four-ad example)", () => {
    expect(gaps(person(), FOUR()).heldBack).toEqual({ ads: 0, of: 4, kinds: [] });
  });

  it("G14e: the G14a example plus a fifth ad with NO requirements that asks for French: the four counted ads give { 1, of 4, [location] }", () => {
    // The person also sets German B2 (so the language kind is set). The fifth ad asks French (no level): checkLanguages,
    // `!has` branch -> closable false, whatever LANGUAGE_CLOSABLE_LEVELS is. Hand count: if the fifth ad were counted it
    // would add a language conflict (N 2, M 5); it has no requirements, so it is not counted: N = 1, M = 4, kinds
    // [location]. (Leaving it out and naming it in the not-counted line is stage B, roadmapBasis; here the four counted
    // ads are handed in, and the premise is checked on the engine itself.)
    const built = person({ languages: [{ code: "de", level: "B2" }] });
    const fifth = ad("a5", "Translator", "Invented Co", [], { languages: [{ code: "fr", level: null }] });
    const premise = engineView(fifth, built);
    const result = match(premise.engineProfile, premise.engineJob);
    expect(result.conflicts.map((c) => [c.kind, c.closable])).toEqual([["language", false]]);
    const g = gaps(built, [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()]);
    expect(g.rows).toEqual(SECTION_1_ROWS);
    expect(g.heldBack).toEqual({ ads: 1, of: 4, kinds: ["location"] });
  });

  it("G14f: the person set NO city; an ad in Exampleville: no ad is held back (unset kinds are blanked by engineView)", () => {
    // cities "" -> set.location false -> engineView blanks the ad's location -> checkPlace has no city to compare
    // (the ad's location is null: notJudged, not a conflict). Hand count: N = 0, M = 4, kinds [].
    const g = gaps(person({ cities: "" }), [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()]);
    expect(g.heldBack).toEqual({ ads: 0, of: 4, kinds: [] });
  });

  it("G14g: one counted ad, held back by location, with an unmet skill: { 1, of 1, [location] } and a row", () => {
    // Ad: Python must, hybrid in Exampleville; city Berlin: checkPlace city branch -> unclosable. Hand count: N 1, M 1.
    const g = gaps(person(), [ad("x", "Analyst", "Invented Co", [must("python")], { location: "Exampleville" })]);
    expect(g.rows.length).toBe(1);
    expect(g.heldBack).toEqual({ ads: 1, of: 1, kinds: ["location"] });
  });

  it("G14h: nothing unmet in any ad, one of 4 held back by location: no rows, { 1, of 4, [location] }", () => {
    // Every requirement is SQL or Excel (met), so no rows; ad 2 is in Exampleville: checkPlace city branch.
    const jobs = [
      ad("h1", "A", "Invented Co", [must("sql")]),
      ad("h2", "B", "Invented Co", [must("sql"), nice("excel")], { location: "Exampleville" }),
      ad("h3", "C", "Invented Co", [must("excel")]),
      ad("h4", "D", "Invented Co", [must("sql"), must("excel")]),
    ];
    const g = gaps(person(), jobs);
    expect(g.rows).toEqual([]);
    expect(g.heldBack).toEqual({ ads: 1, of: 4, kinds: ["location"] });
  });

  it("G14i: one ad has an unclosable location conflict AND a closable one-year-short conflict: kinds [location] only, N counts it once", () => {
    // Person sets years 2. Ad 2: Exampleville (checkPlace city branch: unclosable) and asks 3 years (checkYears: short 1,
    // closable). Hand count: N = 1 (the ad once), M = 4, kinds [location]; years is NOT listed.
    const g = gaps(person({ years: "2" }), [ad1(), ad2({ location: "Exampleville", minYears: 3 }), ad3(), ad4()]);
    expect(g.heldBack).toEqual({ ads: 1, of: 4, kinds: ["location"] });
  });

  it("G14j: two ads, both held back by location: { 2, of 4, [location] }, the kind once", () => {
    // Ads 2 and 3 in Exampleville: each gets one city conflict (checkPlace city branch). Hand count: N = 2, kinds once.
    const g = gaps(person(), [ad1(), ad2({ location: "Exampleville" }), ad3({ location: "Exampleville" }), ad4()]);
    expect(g.heldBack).toEqual({ ads: 2, of: 4, kinds: ["location"] });
  });

  it("G14k (extra, Amendment 2 (1)): kinds come out in the order of KINDS: location, language, work mode, years, start date", () => {
    // One ad with three unclosable conflicts at once: Exampleville + on-site (profile hybrid only) + French (not listed;
    // the person set German B2). Conflicts are found language, then city, then work mode; the list must still read
    // location, language, work mode. Hand count: N = 1, kinds [location, language, workMode].
    const built = person({ workModes: ["hybrid"], languages: [{ code: "de", level: "B2" }] });
    const job = ad("x", "Analyst", "Invented Co", [must("python")], {
      location: "Exampleville",
      remote: "onsite",
      languages: [{ code: "fr", level: null }],
    });
    expect(gaps(built, [job]).heldBack).toEqual({ ads: 1, of: 1, kinds: ["location", "language", "workMode"] });
  });
});
