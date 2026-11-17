import { describe, expect, it, vi, afterEach } from "vitest";
import { profileReport } from "@/app/fitReport";
import { roadmapBox } from "@/app/roadmap";
import { engineView } from "@/lib/cv/engineView";
import { renderProfileReport } from "@/lib/engine/report-text";
import { ROADMAP_FROM_JOBS, roadmapBasis } from "@/lib/engine/roadmapJobs";
import type { Job } from "@/lib/engine/types";
import type { BuiltProfile } from "@/lib/cv/profile";
import { ad, ad1, ad2, ad3, ad4, asSaved, FOUR, must, nice, person, skills, UNLISTED } from "./support/roadmapFixtures";

// Step 7.1e, tests first (docs/PLAN-7.1.md sections 1, 4, 5 and 7: U1 to U9, U11, U12 and the text cases of Amendment 3 (3)).
// `roadmapBox` is the pure assembler of the "What to learn" box. SIGNATURE CHOSEN (the plan's section 6 row says "assembles
// Part A and Part B: counts, lines, the notes, the threshold line" and fixes no signature):
//   roadmapBox(built: BuiltProfile | null, ads: { id: string; job: Job }[], skills: Skill[], fromJobs = ROADMAP_FROM_JOBS)
//     : { noProfile: string | null; partA: string[]; partB: string[]; counted: number; alreadyStrongIds: string[] }
// - the lines are plain text without indentation (the view indents); `fromJobs` is the threshold (U3 sets 4: the "test view");
// - `noProfile` is the note when no profile is in use (then partA and partB are empty);
// - `counted` is M, the number of ads the gap list and the roadmap use (roadmapBasis excluded null);
// - `alreadyStrongIds` are the ids of counted ads classed Already Strong ([] while the roadmap is not shown).
// Every expected text is copied from the plan; where the plan gives one form and says "singular and plural", the other form is
// written by the plan's rule (the noun and verb follow the number) and is listed in the report as DERIVED.

afterEach(() => vi.unstubAllGlobals());

const box = (built: BuiltProfile | null, jobs: Job[], fromJobs?: number) => roadmapBox(built, asSaved(jobs), skills, fromJobs);

// ---- the texts of the plan ---------------------------------------------------------------------------------------------
const TITLE4 = "Skills you are missing across your 4 saved ads"; // section 1
const SUBTITLE = "(Counted against the profile in use. Must-haves and nice-to-haves are counted apart.)"; // section 1
const COULD_NOT_1 = "1 requirement in your saved ads is not in our skill list yet, so we could not judge it. It is not counted."; // section 1
const COULD_NOT_2 = "2 requirements in your saved ads are not in our skill list yet, so we could not judge them. They are not counted."; // DERIVED plural
const ALT_NOTE = "A requirement that accepts several skills is counted once for each of them."; // G3
const MEET_ALL_4 = "You meet every requirement we could judge in your 4 saved ads."; // G10
const MEET_ALL_1 = "You meet every requirement we could judge in your 1 saved ad."; // DERIVED singular
const NOT_COUNTED_NOREQ = "1 saved ad is not counted: the AI found no requirements in it."; // section 5
const NOT_COUNTED_NOMUST = "1 saved ad is not counted: the AI found no must-have we could judge in it."; // DERIVED from "... no must-have we could judge ..."
const NOT_COUNTED_2 = "2 saved ads are not counted (no requirements found, or no must-have we could judge)."; // section 5, N = 2
const NO_PROFILE = 'What to learn needs a profile in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.'; // Q12
const THRESHOLD = (have: number) => `The roadmap shows from 10 saved ads we could judge. You have ${have}. Save ${10 - have} more to see it.`; // section 4
const HELD_LOCATION_TAIL = "1 of your 4 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.";
const HELD_LOCATION_NO_TAIL = "1 of your 4 counted saved ads is held back by something other than skills (location).";

// Hand count of the four-ad example (section 1): rows Python (2, 1), Tableau (1, 2, learning), Power BI (0, 1); 1 requirement not judged.
const ROW_PYTHON = "Python: must-have in 2 ads, nice-to-have in 1 ad";
const ROW_TABLEAU = "Tableau (you are learning it, expected 2027-03-01): must-have in 1 ad, nice-to-have in 2 ads";
const ROW_POWERBI = "Power BI: nice-to-have in 1 ad";

// Section 4, the four-ad example as part of a roadmap (the threshold set to 4):
const SECTION_4 = [
  "Already Strong: 1 job (Data Clerk, Example Wharf Ltd)", // hand count: only ad 3 (its must Excel is met)
  "Skills to build, in order:",
  "1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.",
  "2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.",
  "Blocked jobs: none",
];

describe("Part A: the gap list texts (G1, G3, G6, G7, G8, G9, G10)", () => {
  it("G1: the four-ad example, exactly the screen of section 1", () => {
    expect(box(person(), FOUR()).partA).toEqual([TITLE4, SUBTITLE, ROW_PYTHON, ROW_TABLEAU, ROW_POWERBI, COULD_NOT_1]);
  });

  it("G1b: the counts of the box: 4 ads counted, the roadmap not shown (4 is below 10), no profile note", () => {
    const b = box(person(), FOUR());
    expect(b.counted).toBe(4);
    expect(b.noProfile).toBeNull();
    expect(b.alreadyStrongIds).toEqual([]);
  });

  it("G3: a requirement with alternatives (Power BI or Tableau, unmet) gives one row for each and the sentence under the list", () => {
    // 2 ads: ad X must 'Power BI or Tableau' (profile has neither, nothing in progress), ad Y must SQL (met). Hand count: Power BI must 1,
    // Tableau must 1 (rows by name: Power BI first); the alternatives sentence appears once.
    const jobs = [ad("x", "Analyst", "Invented Co", [must("power-bi", "tableau")]), ad("y", "Clerk", "Invented Co", [must("sql")])];
    expect(box(person({ inProgress: [] }), jobs).partA).toEqual([
      "Skills you are missing across your 2 saved ads",
      SUBTITLE,
      "Power BI: must-have in 1 ad",
      "Tableau: must-have in 1 ad",
      ALT_NOTE,
    ]);
  });

  it("G3b: with no alternative requirement the sentence is not shown (the four-ad example has none)", () => {
    expect(box(person(), FOUR()).partA).not.toContain(ALT_NOTE);
  });

  it("G6: a skill added by hand with no CV line: the row carries '(on your profile without a CV line, so it does not count)'", () => {
    // Python added by hand; 2 ads ask it (one must, one nice). Hand count: must 1, nice 1.
    const jobs = [ad("x", "Analyst", "Invented Co", [must("python")]), ad("y", "Clerk", "Invented Co", [nice("python")])];
    expect(box(person({ added: ["Python"], inProgress: [] }), jobs).partA).toContain(
      "Python (on your profile without a CV line, so it does not count): must-have in 1 ad, nice-to-have in 1 ad",
    );
  });

  it("G7: unlisted-only requirements are in no row and are counted in the line: one (singular) and two (plural)", () => {
    const one = [ad("x", "Analyst", "Invented Co", [must("sql"), must(UNLISTED)]), ad("y", "Clerk", "Invented Co", [must("excel")])];
    // hand count: 1 unlisted requirement, nothing unmet -> the G10 sentence for 2 saved ads, then the could-not-judge line
    expect(box(person(), one).partA).toEqual(["You meet every requirement we could judge in your 2 saved ads.", COULD_NOT_1]);
    const two = [ad("x", "Analyst", "Invented Co", [must("sql"), must(UNLISTED)]), ad("y", "Clerk", "Invented Co", [must("excel"), nice("new:other-thing")])];
    // hand count: 2 unlisted requirements (one in each ad)
    expect(box(person(), two).partA).toEqual(["You meet every requirement we could judge in your 2 saved ads.", COULD_NOT_2]);
  });

  it("G8: an ad with no requirements is named in the not-counted line (singular, no requirements)", () => {
    const b = box(person(), [ad1(), ad("n", "Empty", "Invented Co", [])]);
    // hand count: ad 1 is counted (M = 1): its Tableau must is the only gap; 1 ad is left out
    expect(b.counted).toBe(1);
    expect(b.partA).toContain(NOT_COUNTED_NOREQ);
  });

  it("G8b: an ad with no must-have we could judge is named in the not-counted line (singular, no must-have)", () => {
    const b = box(person(), [ad1(), ad("n", "Odd", "Invented Co", [must(UNLISTED), nice("excel")])]);
    expect(b.counted).toBe(1);
    expect(b.partA).toContain(NOT_COUNTED_NOMUST);
  });

  it("G8c: several ads left out (here one of each reason): the combined sentence, plural", () => {
    const b = box(person(), [ad1(), ad("n", "Empty", "Invented Co", []), ad("m", "Odd", "Invented Co", [must(UNLISTED)])]);
    expect(b.counted).toBe(1);
    expect(b.partA).toContain(NOT_COUNTED_2);
  });

  it("G9: no profile in use: the note, and neither part", () => {
    const b = box(null, FOUR());
    expect(b.noProfile).toBe(NO_PROFILE);
    expect(b.partA).toEqual([]);
    expect(b.partB).toEqual([]);
  });

  it("G10: nothing unmet in 4 ads: the sentence replaces the list (and its title)", () => {
    const jobs = [1, 2, 3, 4].map((i) => ad(`m${i}`, `Role ${i}`, "Invented Co", [must("sql"), nice("excel")]));
    expect(box(person(), jobs).partA).toEqual([MEET_ALL_4]);
  });

  it("G10b: the same sentence for one ad is singular ('in your 1 saved ad')", () => {
    expect(box(person(), [ad("m", "Role", "Invented Co", [must("sql")])]).partA).toEqual([MEET_ALL_1]);
  });
});

describe("the held-back line inside the box (G14a, G14e, G14h)", () => {
  it("G14a: ad 2 in Exampleville: the rows are unchanged and the held-back line comes last, with its tail", () => {
    // hand count: rows as in G1 (Python 2/1, Tableau 1/2, Power BI 0/1); one conflict (city) -> N = 1, M = 4.
    const jobs = [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()];
    expect(box(person(), jobs).partA).toEqual([TITLE4, SUBTITLE, ROW_PYTHON, ROW_TABLEAU, ROW_POWERBI, COULD_NOT_1, HELD_LOCATION_TAIL]);
  });

  it("G14e: a fifth ad with no requirements and an unclosable French conflict changes nothing in the held-back line", () => {
    // The person sets German B2. Hand count: M stays 4, kinds stay (location); the fifth ad is named in the not-counted line.
    const jobs = [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4(), ad("a5", "Translator", "Invented Co", [], { languages: [{ code: "fr", level: null }] })];
    const b = box(person({ languages: [{ code: "de", level: "B2" }] }), jobs);
    expect(b.counted).toBe(4);
    expect(b.partA).toContain(HELD_LOCATION_TAIL);
    expect(b.partA).toContain(NOT_COUNTED_NOREQ);
  });

  it("G14h: nothing unmet, one of 4 ads held back by location: the G10 sentence, then the held-back line WITHOUT its tail", () => {
    const jobs = [
      ad("h1", "A", "Invented Co", [must("sql")]),
      ad("h2", "B", "Invented Co", [must("sql"), nice("excel")], { location: "Exampleville" }),
      ad("h3", "C", "Invented Co", [must("excel")]),
      ad("h4", "D", "Invented Co", [must("sql"), must("excel")]),
    ];
    expect(box(person(), jobs).partA).toEqual([MEET_ALL_4, HELD_LOCATION_NO_TAIL]);
  });
});

describe("Part B: the roadmap and its threshold line (U1 to U3)", () => {
  const usable = (n: number) => Array.from({ length: n }, (_, i) => ad(`u${i + 1}`, `Role ${i + 1}`, "Invented Co", [must("sql")]));

  it("U1: 4 usable ads: the one line 'You have 4. Save 6 more to see it.' and no ranking", () => {
    expect(box(person(), FOUR()).partB).toEqual([THRESHOLD(4)]);
    expect(THRESHOLD(4)).toBe("The roadmap shows from 10 saved ads we could judge. You have 4. Save 6 more to see it.");
  });

  it("U2: 9 usable ads show 'You have 9. Save 1 more to see it.'; 10 show the roadmap", () => {
    expect(box(person(), usable(9)).partB).toEqual(["The roadmap shows from 10 saved ads we could judge. You have 9. Save 1 more to see it."]);
    const ten = box(person(), usable(10));
    // hand count: all 10 ads have only the met must SQL -> 10 Already Strong; nothing to build; nothing blocked
    expect(ten.partB[0].startsWith("Already Strong: 10 jobs (Role 1, Invented Co; Role 2, Invented Co;")).toBe(true);
    expect(ten.partB).toContain("Skills to build, in order: none. No other saved job can become a Strong match by skills alone.");
    expect(ten.partB).toContain("Blocked jobs: none");
    expect(ten.partB).not.toContain(THRESHOLD(10));
  });

  it("U2b: 10 saved ads of which one is not counted: 9 count, so the line says 'You have 9'", () => {
    const b = box(person(), [...usable(9), ad("n", "Empty", "Invented Co", [])]);
    expect(b.counted).toBe(9);
    expect(b.partB).toEqual([THRESHOLD(9)]);
  });

  it("U2c: the threshold is the shared constant 10", () => {
    expect(ROADMAP_FROM_JOBS).toBe(10);
  });

  it("U3: the four-ad example with the threshold set to 4: exactly the text of section 4", () => {
    expect(box(person(), FOUR(), 4).partB).toEqual(SECTION_4);
  });

  it("U4: no `new:` id appears anywhere in the example's box (the whole-job rule would print one)", () => {
    const b = box(person(), FOUR(), 4);
    expect([...b.partA, ...b.partB].join("\n")).not.toContain("new:");
  });
});

describe("Part B: who counts (U5 to U9)", () => {
  it("U5: an ad with no requirements and an ad with no must-have we could judge are never Already Strong, never unlocked; named in the line", () => {
    const strong = ad("s", "Clerk", "Invented Co", [must("sql")]);
    const b = box(person(), [strong, ad("n", "Empty", "Invented Co", []), ad("m", "Odd", "Invented Co", [must(UNLISTED)])], 1);
    expect(b.counted).toBe(1);
    expect(b.alreadyStrongIds).toEqual(["s"]);
    expect(b.partB).toEqual([
      "Already Strong: 1 job (Clerk, Invented Co)",
      "Skills to build, in order: none. No other saved job can become a Strong match by skills alone.",
      "Blocked jobs: none",
    ]);
    expect(b.partA).toContain(NOT_COUNTED_2);
  });

  it("U6: an ad with one unjudged must-have and the rest met is Already Strong, and its name carries '(1 must-have not judged)'", () => {
    const b = box(person(), [ad("k", "Analyst", "Invented Co", [must("sql"), must(UNLISTED)])], 1);
    expect(b.alreadyStrongIds).toEqual(["k"]);
    expect(b.partB[0]).toBe("Already Strong: 1 job (Analyst, Invented Co (1 must-have not judged))");
  });

  it("U6b: two unjudged must-haves: '(2 must-haves not judged)' (plural by the same rule)", () => {
    const b = box(person(), [ad("k", "Analyst", "Invented Co", [must("sql"), must(UNLISTED), must("new:other-thing")])], 1);
    expect(b.partB[0]).toBe("Already Strong: 1 job (Analyst, Invented Co (2 must-haves not judged))");
  });

  it("U7: the level and the roadmap agree: Already Strong exactly when the report's level is strong, before and after gaining the skill", () => {
    // The ad asks for SQL and Python. Person A has SQL only: report level is not strong, the ad is not Already Strong and
    // Python unlocks it. Person B also has Python from CV line 5: the report level is strong and the ad is Already Strong.
    const job = ad("p", "Developer", "Invented Co", [must("sql"), must("python")]);
    const a = person({ inProgress: [] });
    const reportA = profileReport(job, a, skills, []);
    expect(reportA.level).not.toBe("strong");
    const boxA = box(a, [job], 1);
    expect(boxA.alreadyStrongIds).toEqual([]);
    expect(boxA.partB).toContain("1. Python: unlocks 1 job (Developer, Invented Co). Total so far: 1 job.");

    const b = person({ inProgress: [], keptIds: ["sql", "excel", "python"] });
    expect(profileReport(job, b, skills, []).level).toBe("strong");
    expect(box(b, [job], 1).alreadyStrongIds).toEqual(["p"]);
  });

  it("U8: the person set no language and an ad asks German B2: the report does not judge it and the roadmap does not block the ad", () => {
    const job = ad("g", "Clerk", "Invented Co", [must("sql")], { languages: [{ code: "de", level: "B2" }] });
    const report = profileReport(job, person(), skills, []);
    expect(report.conflicts).toEqual([]);
    expect(report.level).toBe("strong");
    const b = box(person(), [job], 1);
    expect(b.alreadyStrongIds).toEqual(["g"]);
    expect(b.partB).toContain("Blocked jobs: none");
  });

  it("U9: a blocked ad (a city out of reach) is listed under Blocked with its conflict sentence and is not in the ranking", () => {
    // Exampleville is not Berlin: one city conflict, unclosable. Hand count: Blocked 1; nothing to build; nothing Strong.
    const job = ad("e", "Dispatcher", "Exampleville Depot Ltd", [must("sql")], { location: "Exampleville" });
    expect(box(person(), [job], 1).partB).toEqual([
      "Already Strong: none",
      "Skills to build, in order: none. No saved job can become a Strong match by skills alone.",
      "Blocked jobs (skills alone can't make these Strong): 1",
      "- Dispatcher, Exampleville Depot Ltd: blocked by 1 thing; it can't be closed soon",
      "(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin.",
    ]);
  });
});

describe("U11: building the box only reads", () => {
  const deepFreeze = <T,>(x: T): T => {
    if (x && typeof x === "object") {
      Object.freeze(x);
      for (const v of Object.values(x as object)) deepFreeze(v);
    }
    return x;
  };

  it("makes no fetch call and changes none of its inputs (frozen inputs would throw)", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("fetch must not be called");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const built = deepFreeze(person());
    const ads = deepFreeze(asSaved(FOUR()));
    const b = roadmapBox(built, ads, skills, 4);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(b.partB).toEqual(SECTION_4);
  });
});

describe("U12: the page's ranking text equals the engine's text, line by line", () => {
  // The command-line report prints the same sentences (lib/engine/report-text.ts) for the same profile and the same
  // judgeable jobs. Cut its roadmap part (from "Already Strong" to before "Timeline"), trim the indentation, drop blank lines.
  function engineLines(built: BuiltProfile, jobs: Job[]): string[] {
    const views = jobs.map((j) => engineView(j, built));
    const text = renderProfileReport(views[0].engineProfile, views.map((v) => v.engineJob), skills);
    const lines = text.split("\n");
    const from = lines.findIndex((l) => l.startsWith("Already Strong:"));
    const to = lines.findIndex((l) => l.startsWith("Timeline from skills in progress"));
    return lines.slice(from, to).map((l) => l.trim()).filter((l) => l !== "");
  }

  it("U12a: the four-ad example", () => {
    expect(box(person(), FOUR(), 4).partB).toEqual(engineLines(person(), FOUR()));
  });

  it("U12b: an example with a blocked ad", () => {
    const jobs = [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()];
    expect(box(person(), jobs, 4).partB).toEqual(engineLines(person(), jobs));
  });
});

describe("the ads that count are the ones roadmapBasis does not exclude", () => {
  it("the box counts exactly the ads for which roadmapBasis(job).excluded is null", () => {
    const jobs = [ad1(), ad("n", "Empty", "Invented Co", []), ad4(), ad("m", "Odd", "Invented Co", [must(UNLISTED)])];
    expect(box(person(), jobs).counted).toBe(jobs.filter((j) => roadmapBasis(j).excluded === null).length); // hand count: 2 (ads 1 and 4)
    expect(box(person(), jobs).counted).toBe(2);
  });
});
