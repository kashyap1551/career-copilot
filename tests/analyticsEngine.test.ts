import { describe, expect, it } from "vitest";
import { engineView } from "@/lib/cv/engineView";
import { askedSkills, tallyLevels } from "@/lib/engine/analytics";
import type { Profile } from "@/lib/engine/types";
import { ad, ad1, ad2, ad3, ad4, must, nice, person, skills } from "./support/roadmapFixtures";

// Step 8.2, stage 1, tests first (docs/PLAN-8.2.md D3 and T15). ENGINE tests: the two pure counting functions of lib/engine/analytics.ts on LITERAL inputs
// (no page, no AI). The expected rows are hand counts from section 7 (R1 and R9) and from the sort rule of the gap list (must-have asks first, then
// nice-to-have asks, then the lower-case name, then the id). The functions were stubs when these were written (zeros and an empty list).

const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;
const built = person();
const profile: Profile = engineView(ad1(), built).engineProfile; // SQL have (CV line 2), Excel have (line 4), Tableau in progress 2027-03-01
const engineJobs = [ad1(), ad2(), ad3(), ad4()].map((j) => engineView(j, built).engineJob); // the unlisted must of ad 4 is set aside

describe("T15: tallyLevels", () => {
  it("T15: counts each level once; null is 'none'; the empty list is all zeros", () => {
    expect(tallyLevels([])).toEqual({ strong: 0, good: 0, stretch: 0, longShot: 0, none: 0 });
    expect(tallyLevels(["strong", "good", "good", "good", null])).toEqual({ strong: 1, good: 3, stretch: 0, longShot: 0, none: 1 });
    expect(tallyLevels(["longShot", "stretch", "longShot", "stretch", "stretch"])).toEqual({ strong: 0, good: 0, stretch: 3, longShot: 2, none: 0 });
    expect(tallyLevels([null, null, null])).toEqual({ strong: 0, good: 0, stretch: 0, longShot: 0, none: 3 });
  });
});

describe("T15: askedSkills", () => {
  it("T15: R1: the five asked skills in the order must, nice, name, with the standing of each", () => {
    expect(askedSkills(profile, engineJobs, nameOf)).toEqual([
      { skillId: "sql", mustAds: 3, niceAds: 0, standing: "have" },
      { skillId: "python", mustAds: 2, niceAds: 1, standing: "none" },
      { skillId: "tableau", mustAds: 1, niceAds: 2, standing: "learning:2027-03-01" },
      { skillId: "excel", mustAds: 1, niceAds: 1, standing: "have" },
      { skillId: "power-bi", mustAds: 0, niceAds: 1, standing: "none" },
    ]);
  });

  it("T15: a skill on the profile with no CV line has the standing 'no-cv-line'", () => {
    const handAdded: Profile = { ...profile, skills: [{ kind: "have", skillId: "excel", evidence: null }] };
    const rows = askedSkills(handAdded, [engineJobs[2]], nameOf); // ad 3: must Excel; nice Python, Power BI
    expect(rows.find((r) => r.skillId === "excel")).toEqual({ skillId: "excel", mustAds: 1, niceAds: 0, standing: "no-cv-line" });
  });

  it("T15: a requirement with alternatives counts for each alternative, met or not; the same name twice in one ad counts once per importance (R9)", () => {
    const none: Profile = { ...profile, skills: [] };
    const solo = ad("solo", "Solo Analyst", "Invented Co Six", [must("sql", "python"), must("python"), nice("python")]);
    expect(askedSkills(none, [solo], nameOf)).toEqual([
      { skillId: "python", mustAds: 1, niceAds: 1, standing: "none" },
      { skillId: "sql", mustAds: 1, niceAds: 0, standing: "none" },
    ]);
    // met alternative: the person has Python; a must that accepts SQL or Python still counts for BOTH skills (the gap list would count neither)
    const hasPython: Profile = { ...profile, skills: [{ kind: "have", skillId: "python", evidence: { line: 5, text: "Wrote Python scripts for monthly checks" } }] };
    expect(askedSkills(hasPython, [ad("alt", "Alt Analyst", "Invented Co Seven", [must("sql", "python")])], nameOf)).toEqual([
      { skillId: "python", mustAds: 1, niceAds: 0, standing: "have" },
      { skillId: "sql", mustAds: 1, niceAds: 0, standing: "none" },
    ]);
  });

  it("T15: equal counts are ordered by the lower-case name (R6: Python before SQL)", () => {
    const none: Profile = { ...profile, skills: [] };
    const r6 = [
      ad("p1", "Alpha Analyst", "Invented Co Two", [must("sql", "python")]),
      ad("p2", "Beta Analyst", "Invented Co Three", [must("python")]),
      ad("p3", "Gamma Analyst", "Invented Co Four", [must("sql")]),
    ];
    expect(askedSkills(none, r6, nameOf)).toEqual([
      { skillId: "python", mustAds: 2, niceAds: 0, standing: "none" },
      { skillId: "sql", mustAds: 2, niceAds: 0, standing: "none" },
    ]);
  });

  it("T15: blocked ads count (an ad in another city still asks for its skills); no ads gives no rows", () => {
    const blocked = [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()].map((j) => engineView(j, built).engineJob);
    expect(askedSkills(profile, blocked, nameOf).map((r) => [r.skillId, r.mustAds, r.niceAds])).toEqual([
      ["sql", 3, 0],
      ["python", 2, 1],
      ["tableau", 1, 2],
      ["excel", 1, 1],
      ["power-bi", 0, 1],
    ]);
    expect(askedSkills(profile, [], nameOf)).toEqual([]);
  });
});
