import { describe, expect, it } from "vitest";
import { roadmapAds, roadmapBox } from "@/app/roadmap";
import type { OpenedAd } from "@/app/savedAdRows";
import type { BuiltProfile } from "@/lib/cv/profile";
import { buildJob } from "@/lib/engine/fromAd";
import type { Job } from "@/lib/engine/types";
import type { ExtractedAd } from "@/lib/schemas/job";
import type { SavedReading } from "@/lib/saved/types";
import { ad, ad1, ad2, ad3, ad4, must, person, skills } from "./support/roadmapFixtures";

// Step P0 (a defect of 7.1): every opened saved ad carries the job id "pasted-ad" (lib/ai/readJob.ts:65, lib/saved/openJob.ts:29), and the
// engine keys on job id (classifyJobs, rankMissingSkills, the labels of the box). The 7.1 tests used distinct ids, so none could see it.
// These tests give the box ads the way the page does: every job id "pasted-ad", the saved-ad ids apart, through roadmapAds and
// roadmapBox. Expected texts come from hand counts, from SECTION_4 of tests/roadmap.test.ts (copied: that constant is not exported) and
// from docs/MANUAL-CHECK-7.1.md step 10; none comes from running the code. Invented people and ads only. No AI call.

const reading = (job: Job) => ({ job, removed: [], moved: [], unlisted: [], notCounted: [] }) as unknown as SavedReading;
const openedAd = (savedId: string, job: Job): OpenedAd => ({
  id: savedId,
  savedAt: "2026-11-17T10:00:00Z",
  titleLine: savedId,
  date: "2026-11-17",
  opened: { kind: "as-stored", reading: reading(job) },
});

// The ads as the page hands them to the box: `jobIdOf(i)` is each job's id, `savedIds[i]` the saved record's id.
function viaPage(built: BuiltProfile | null, jobs: Job[], savedIds: string[], jobIdOf: (i: number) => string, fromJobs?: number) {
  const opened = jobs.map((j, i) => openedAd(savedIds[i], { ...j, id: jobIdOf(i) }));
  return roadmapBox(built, roadmapAds(opened), skills, fromJobs);
}
const shared = () => "pasted-ad";

// Section 4 of docs/PLAN-7.1.md (the four-ad example as a roadmap, threshold 4); the same text as SECTION_4 in tests/roadmap.test.ts.
const SECTION_4 = [
  "Already Strong: 1 job (Data Clerk, Example Wharf Ltd)", // hand count: only ad 3 (its must Excel is met)
  "Skills to build, in order:",
  "1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.",
  "2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.",
  "Blocked jobs: none",
];
const FOUR_JOBS = () => [ad1(), ad2(), ad3(), ad4()];
const FOUR_SAVED = ["saved-1", "saved-2", "saved-3", "saved-4"];

describe("P0a: the four-ad example with every job id 'pasted-ad' and four distinct saved ids", () => {
  it("partB is the text of section 4, and the one Already Strong ad is the Data Clerk ad (saved-3)", () => {
    const b = viaPage(person(), FOUR_JOBS(), FOUR_SAVED, shared, 4);
    expect(b.partB).toEqual(SECTION_4);
    expect(b.alreadyStrongIds).toEqual(["saved-3"]); // hand count: ad 3 only
    expect(b.counted).toBe(4);
  });
});

// Four ads that all ask SQL only (met by the person), with four different labels: all Already Strong.
const strongAd = (id: string, title: string, company: string) => ad(id, title, company, [must("sql")]);
const ALL_STRONG = () => [
  strongAd("x1", "Report Clerk", "Alder Works Ltd"),
  strongAd("x2", "Data Assistant", "Birch Yard Ltd"),
  strongAd("x3", "Sales Analyst", "Cedar Mill Ltd"),
  strongAd("x4", "Finance Clerk", "Elm Court Ltd"),
];
// Two ads with IDENTICAL content (same title, company and requirement), saved under two ids.
const IDENTICAL_PAIR = () => [strongAd("p1", "Data Clerk", "Example Wharf Ltd"), strongAd("p2", "Data Clerk", "Example Wharf Ltd")];
// Two identical ads that are NOT Strong (each needs Python), and a third ad that needs Tableau. Hand count: Python unlocks 2 jobs (the pair),
// Tableau (in progress) unlocks 1; so the totals are 2 and then 3. If the pair shared one id, the second total would be 2.
const IDENTICAL_REACHABLE = () => [ad2(), { ...ad2(), id: "q2" }, ad1()];
const BLOCKED_SET = () => [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()];

describe("P0b: the box's whole output does not depend on the job ids (distinct versus all 'pasted-ad')", () => {
  const sets: [string, () => Job[], string[], number][] = [
    ["the four-ad example", FOUR_JOBS, FOUR_SAVED, 4],
    ["four ads that are all Already Strong", ALL_STRONG, ["saved-1", "saved-2", "saved-3", "saved-4"], 4],
    ["the four-ad example with ad 2 blocked by a city out of reach", BLOCKED_SET, FOUR_SAVED, 4],
    ["two ads with identical content under different saved ids", IDENTICAL_PAIR, ["saved-a", "saved-b"], 2],
    ["two identical ads that need Python, and a third that needs Tableau", IDENTICAL_REACHABLE, ["saved-a", "saved-b", "saved-c"], 3],
  ];
  it.each(sets)("%s", (_name, jobs, savedIds, from) => {
    const distinct = viaPage(person(), jobs(), savedIds, (i) => savedIds[i], from);
    const same = viaPage(person(), jobs(), savedIds, shared, from);
    expect(same).toEqual(distinct);
  });

  it("all Already Strong: four entries with four different names, and four saved ids (hand count)", () => {
    const b = viaPage(person(), ALL_STRONG(), ["saved-1", "saved-2", "saved-3", "saved-4"], shared, 4);
    expect(b.partB).toEqual([
      "Already Strong: 4 jobs (Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd)",
      "Skills to build, in order: none. No other saved job can become a Strong match by skills alone.",
      "Blocked jobs: none",
    ]);
    expect(b.alreadyStrongIds).toEqual(["saved-1", "saved-2", "saved-3", "saved-4"]);
  });

  it("a blocked ad: it is blocked, never Already Strong, and the ranking skips it (hand count)", () => {
    // ad 2 (BI Developer) is hybrid in Exampleville, the person's city is Berlin: an unclosable city conflict, so it is blocked.
    // Python now unlocks only ad 4 (1 job); Tableau (in progress) unlocks ad 1 (1 job). Equal on jobs unlocked and on jobs brought closer
    // (0), so the skill already in progress comes first: Tableau, then Python.
    const b = viaPage(person(), BLOCKED_SET(), FOUR_SAVED, shared, 4);
    expect(b.alreadyStrongIds).toEqual(["saved-3"]);
    expect(b.partB.slice(0, 4)).toEqual([
      "Already Strong: 1 job (Data Clerk, Example Wharf Ltd)",
      "Skills to build, in order:",
      "1. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 1 job.",
      "2. Python: unlocks 1 job (Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.",
    ]);
    expect(b.partB[4]).toBe("Blocked jobs (skills alone can't make these Strong): 1");
    expect(b.partB[5]).toContain("BI Developer, Harbor Light Stationery");
  });

  it("two ads with identical content: both Already Strong, 2 jobs, two entries in the list, two saved ids (hand count)", () => {
    for (const jobIdOf of [shared, (i: number) => ["saved-a", "saved-b"][i]]) {
      const b = viaPage(person(), IDENTICAL_PAIR(), ["saved-a", "saved-b"], jobIdOf, 2);
      expect(b.partB[0]).toBe("Already Strong: 2 jobs (Data Clerk, Example Wharf Ltd; Data Clerk, Example Wharf Ltd)");
      expect(b.alreadyStrongIds).toEqual(["saved-a", "saved-b"]);
      expect(b.counted).toBe(2);
    }
  });
});

describe("P0b: identical content that is not Already Strong keeps its own count", () => {
  it("the pair counts as 2 jobs for Python and the total after Tableau is 3 (hand count), whatever the job ids", () => {
    for (const jobIdOf of [shared, (i: number) => ["saved-a", "saved-b", "saved-c"][i]]) {
      const b = viaPage(person(), IDENTICAL_REACHABLE(), ["saved-a", "saved-b", "saved-c"], jobIdOf, 3);
      expect(b.partB).toEqual([
        "Already Strong: none",
        "Skills to build, in order:",
        "1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; BI Developer, Harbor Light Stationery). Total so far: 2 jobs.",
        "2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.",
        "Blocked jobs: none",
      ]);
      expect(b.alreadyStrongIds).toEqual([]);
    }
  });
});

// P0c: the ten ads of docs/MANUAL-CHECK-7.1.md step 10 ("ten short invented ads that each ask for SQL only"), built by the REAL builder
// (buildJob with the id the page's reader gives: "pasted-ad"), saved under ten ids, threshold at its real value (10).
const TEN = [
  ["Report Clerk", "Alder Works Ltd"],
  ["Data Assistant", "Birch Yard Ltd"],
  ["Sales Analyst", "Cedar Mill Ltd"],
  ["Finance Clerk", "Elm Court Ltd"],
  ["Stock Analyst", "Fern Dock Ltd"],
  ["Billing Clerk", "Gorse Lane Ltd"],
  ["Order Analyst", "Heath Row Ltd"],
  ["Ledger Clerk", "Ivy Gate Ltd"],
  ["Survey Assistant", "Juniper Hall Ltd"],
  ["Tally Clerk", "Larch Wharf Ltd"],
] as const;

function builtAd([title, company]: readonly [string, string]): Job {
  const text = `${title}\n${company}. You write SQL queries.`;
  const extraction: ExtractedAd = {
    title, company, location: null, workMode: null, minYears: null, startDate: null,
    languages: [], otherConditions: [],
    requirements: [{ quote: "You write SQL queries.", importance: "must", skills: [{ name: "SQL" }] }],
  };
  return buildJob(extraction, text, skills, { id: "pasted-ad", source: null }).job;
}

describe("P0c: the ten SQL-only ads of MANUAL-CHECK-7.1 step 10, built by the real builder, threshold 10", () => {
  const jobs = TEN.map(builtAd);
  const savedIds = TEN.map((_, i) => `saved-${i + 1}`);

  it("the real builder gives every ad the id 'pasted-ad' (the premise of the defect)", () => {
    expect(jobs.map((j) => j.id)).toEqual(TEN.map(() => "pasted-ad"));
  });

  it("the roadmap is shown (10 of 10) and lists the ten ads by name, each once; the ranking is none; nothing is blocked", () => {
    const opened = jobs.map((j, i) => openedAd(savedIds[i], j));
    const b = roadmapBox(person(), roadmapAds(opened), skills); // the real threshold, ROADMAP_FROM_JOBS = 10
    expect(b.counted).toBe(10);
    expect(b.partB).toEqual([
      `Already Strong: 10 jobs (${TEN.map(([t, c]) => `${t}, ${c}`).join("; ")})`,
      "Skills to build, in order: none. No other saved job can become a Strong match by skills alone.",
      "Blocked jobs: none",
    ]);
    expect(b.alreadyStrongIds).toEqual(savedIds);
  });
});
