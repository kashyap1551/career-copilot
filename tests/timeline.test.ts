import { afterEach, describe, expect, it, vi } from "vitest";
import { roadmapBoxSafe } from "@/app/roadmap";
import { engineView } from "@/lib/cv/engineView";
import { listedAlternatives } from "@/lib/engine/roadmapJobs";
import { rankMissingSkills, unlockTimeline } from "@/lib/engine/unlock";
import { builtFromSaved, savedFromBuilt } from "@/lib/saved/profile";
import { ROADMAP_FAILED_LINE } from "@/lib/saved/messages";
import * as messages from "@/lib/saved/messages";
import { ad, ad1, ad2, ad3, ad4, must, person, skills } from "./support/roadmapFixtures";
import { page, viaPage } from "./support/viaPage";

// Step 7.3, tests first (docs/PLAN-7.3.md sections 6 and 7: T1 to T9, T12, T13, T16 to T19). The "timeline" field of the "What to learn" box
// does not exist yet, so these are red. EVERY expected text below is copied from the hand tables of section 6 of the plan (H1 to H7),
// none from running the code.
//
// Form: every test that calls the box builds its ads the way the page does (support/viaPage.ts: job id "pasted-ad", distinct saved ids,
// through roadmapAds). Exceptions, named in their tests: T12 also calls the engine directly; T18 forces a throw with a broken record.

afterEach(() => vi.unstubAllGlobals());

const HEADER = "Timeline from skills in progress:";
const FRAMING = "These counts assume you learn each skill by its expected date.";
const NONE = "Timeline from skills in progress: none.";

const s = (id: string, title: string, company: string) => ad(id, title, company, [must("sql")]); // Berlin, hybrid, must SQL only
const S = () => [s("s1", "Report Clerk", "Alder Works Ltd"), s("s2", "Data Assistant", "Birch Yard Ltd"), s("s3", "Sales Analyst", "Cedar Mill Ltd"), s("s4", "Finance Clerk", "Elm Court Ltd")];
const FOUR = () => [ad1(), ad2(), ad3(), ad4()];
const prog = (name: string, date: string) => ({ name, date });

// H1: SQL and Excel had, Tableau in progress 2027-03-01 (the default person), the four ads, threshold 4.
const H1_LINES = [HEADER, FRAMING, "By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd)."];
// H2: SQL had; Tableau and Python 2027-03-01, Excel 2027-09-01; ad 2 in Exampleville (blocked); threshold 4.
const h2Person = () => person({ keptIds: ["sql"], inProgress: [prog("Tableau", "2027-03-01"), prog("Python", "2027-03-01"), prog("Excel", "2027-09-01")] });
const h2Ads = () => [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()];
const H2_LINES = [
  HEADER,
  FRAMING,
  "By 2027-03-01 (Python, Tableau): 2 more Strong matches (Reporting Analyst, Northlake Foods Ltd; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)).",
  "By 2027-09-01 (Excel): 3 more Strong matches (Reporting Analyst, Northlake Foods Ltd; Data Clerk, Example Wharf Ltd; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)).",
];
// H3: every counted ad Strong; Tableau 2026-01-15 (a past date), Docker and Python 2027-02-01; threshold 4.
const h3Person = () => person({ keptIds: ["sql"], inProgress: [prog("Tableau", "2026-01-15"), prog("Docker", "2027-02-01"), prog("Python", "2027-02-01")] });
const H3_LINES = [
  HEADER,
  FRAMING,
  "By 2026-01-15 (Tableau): 0 more Strong matches. Tableau doesn't unlock a job yet.",
  "By 2027-02-01 (Docker, Python): 0 more Strong matches. These skills don't unlock a job yet.",
];

describe("the timeline of the box (ads built the way the page does)", () => {
  it("T1: H1, the four-ad example: one date, one job", () => {
    expect(page(person(), FOUR(), 4).timeline).toEqual(H1_LINES);
  });

  it("T2: H2, two skills on one date, a later date, cumulative, ad 2 blocked and absent", () => {
    expect(page(h2Person(), h2Ads(), 4).timeline).toEqual(H2_LINES);
  });

  it("T3: H3, every counted ad Strong, a past date, two skills on one date; the timeline is not in partB", () => {
    const b = page(h3Person(), S(), 4);
    expect(b.timeline).toEqual(H3_LINES);
    expect(b.partB).toEqual([
      "Already Strong: 4 jobs (Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd)",
      "Skills to build, in order: none. No other saved job can become a Strong match by skills alone.",
      "Blocked jobs: none",
    ]);
  });

  it("T4: H4, no skill in progress: one line, and no framing sentence anywhere in the box", () => {
    const b = page(person({ inProgress: [] }), FOUR(), 4);
    expect(b.timeline).toEqual([NONE]);
    expect([...b.partA, ...b.partB, ...b.timeline].join("\n")).not.toContain(FRAMING);
  });

  it("T5: H6, a date with 0 first, then an unlock; the dates were entered in reverse order", () => {
    const built = person({ keptIds: ["sql"], inProgress: [prog("Excel", "2027-01-10"), prog("Docker", "2026-12-20")] });
    expect(page(built, [s("s1", "Report Clerk", "Alder Works Ltd"), ad3()], 2).timeline).toEqual([
      HEADER,
      FRAMING,
      "By 2026-12-20 (Docker): 0 more Strong matches. Docker doesn't unlock a job yet.",
      "By 2027-01-10 (Excel): 1 more Strong match (Data Clerk, Example Wharf Ltd).",
    ]);
  });

  it("T6: H7, an ad blocked by a conflict that could be closed (one year short) is never counted", () => {
    const built = person({ keptIds: ["sql"], inProgress: [prog("Excel", "2027-01-10")], years: "2" });
    const needsExcelAndThreeYears = ad("a3", "Data Clerk", "Example Wharf Ltd", [must("excel")], { minYears: 3 });
    expect(page(built, [s("s1", "Report Clerk", "Alder Works Ltd"), needsExcelAndThreeYears], 2).timeline).toEqual([
      HEADER,
      FRAMING,
      "By 2027-01-10 (Excel): 0 more Strong matches. Excel doesn't unlock a job yet.",
    ]);
  });

  it("T7: H5, below the threshold: no timeline; also none without a profile, without saved ads, or with no counted ad", () => {
    expect(page(person(), FOUR(), 5).timeline).toEqual([]); // 4 counted, threshold 5
    expect(page(person(), FOUR(), 5).partB).toEqual(["The roadmap shows from 5 saved ads we could judge. You have 4. Save 1 more to see it."]);
    expect(page(null, FOUR(), 4).timeline).toEqual([]); // no profile in use
    expect(page(person(), [], 4).timeline).toEqual([]); // nothing saved
    expect(page(person(), [ad("n", "Empty", "Invented Co", [])], 1).timeline).toEqual([]); // hand count: 0 counted
  });

  it("T8: the timeline is its own list: no line of partA or partB starts with Timeline or holds the framing sentence", () => {
    for (const b of [page(person(), FOUR(), 4), page(h2Person(), h2Ads(), 4), page(h3Person(), S(), 4)]) {
      for (const line of [...b.partA, ...b.partB]) {
        expect(line.startsWith("Timeline")).toBe(false);
        expect(line).not.toContain(FRAMING);
      }
      expect(b.timeline.length).toBeGreaterThan(0);
    }
  });

  it("T9: an ad that is not counted (no requirements) changes nothing in the timeline", () => {
    const b = page(person(), [...FOUR(), ad("n", "Empty", "Invented Co", [])], 4);
    expect(b.counted).toBe(4);
    expect(b.timeline).toEqual(H1_LINES);
  });
});

describe("T12: the timeline and the ranking agree", () => {
  // H2 by hand: every ranking line lists the jobs one skill unlocks (Python: Analytics Lead; Tableau: Reporting Analyst; Excel: Data
  // Clerk); the last timeline entry lists the same three. The first part calls the engine directly (the ids a1, a3, a4 of the fixtures).
  it("T12a: the engine's own functions: the last entry's jobs are exactly the jobs the ranking unlocks", () => {
    const built = h2Person();
    const views = h2Ads().map((j) => engineView(j, built));
    const jobs = views.map((v) => listedAlternatives(v.engineJob));
    const unlocked = rankMissingSkills(views[0].engineProfile, jobs).flatMap((r) => r.newlyUnlocked).sort();
    const entries = unlockTimeline(views[0].engineProfile, jobs);
    expect(unlocked).toEqual(["a1", "a3", "a4"]);
    expect(entries[entries.length - 1].jobs.slice().sort()).toEqual(["a1", "a3", "a4"]);
  });

  it("T12b: in the box (page-built ads), the names in the last timeline line are the names the ranking lines unlock, each once", () => {
    const b = page(h2Person(), h2Ads(), 4);
    const names = ["Reporting Analyst, Northlake Foods Ltd", "Data Clerk, Example Wharf Ltd", "Analytics Lead, Imaginary Pages Ltd"];
    const last = b.timeline[b.timeline.length - 1];
    const ranking = b.partB.filter((l) => /^\d+\. /.test(l)).join("\n");
    for (const n of names) {
      expect(last.split(n).length - 1, `${n} in the last timeline line`).toBe(1);
      expect(ranking.split(n).length - 1, `${n} in the ranking`).toBe(1);
    }
  });
});

describe("T13: building the timeline only reads", () => {
  const deepFreeze = <T,>(x: T): T => {
    if (x && typeof x === "object") {
      Object.freeze(x);
      for (const v of Object.values(x as object)) deepFreeze(v);
    }
    return x;
  };
  it("T13: no fetch call, and frozen inputs are not changed (a write would throw)", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("fetch must not be called");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const b = page(deepFreeze(person()), deepFreeze(FOUR()), 4);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(b.timeline).toEqual(H1_LINES);
  });
});

describe("T16: ads that all carry the id 'pasted-ad' keep their own entry in the timeline", () => {
  it("T16a: H1's four ads, four distinct saved ids: the timeline of T1", () => {
    expect(viaPage(person(), FOUR(), ["saved-a", "saved-b", "saved-c", "saved-d"], () => "pasted-ad", 4).timeline).toEqual(H1_LINES);
  });

  it("T16b: two ads of identical content (needing Python) and a third (needing Tableau): the pair is named twice, then three jobs", () => {
    // hand count: SQL had; Python in progress 2027-03-01, Tableau 2027-06-01. Ads: BI Developer twice (must SQL and Python), Reporting Analyst.
    // Date 1: gained {python}: both BI Developer ads covered: 2. Date 2: gained {python, tableau}: the pair and Reporting Analyst: 3.
    const built = person({ keptIds: ["sql"], inProgress: [prog("Python", "2027-03-01"), prog("Tableau", "2027-06-01")] });
    const b = viaPage(built, [ad2(), ad2(), ad1()], ["saved-a", "saved-b", "saved-c"], () => "pasted-ad", 3);
    expect(b.timeline).toEqual([
      HEADER,
      FRAMING,
      "By 2027-03-01 (Python): 2 more Strong matches (BI Developer, Harbor Light Stationery; BI Developer, Harbor Light Stationery).",
      "By 2027-06-01 (Tableau): 3 more Strong matches (BI Developer, Harbor Light Stationery; BI Developer, Harbor Light Stationery; Reporting Analyst, Northlake Foods Ltd).",
    ]);
  });
});

describe("T17: an in-progress skill never has a new: id", () => {
  it("T17a: no id in the vocabulary starts with new:", () => {
    expect(skills.filter((k) => k.id.startsWith("new:")).map((k) => k.id)).toEqual([]);
  });

  it("T17b: a name not in our list, with a real date, is not put on the profile as in progress (it is set aside as unmatchable)", () => {
    const built = person({ inProgress: [prog("Kombucha brewing", "2027-01-10")] });
    expect(built.profile.skills.filter((k) => k.kind === "inProgress")).toEqual([]); // hand count: 0 of 1
    expect(built.unmatchable).toEqual([{ name: "Kombucha brewing", where: "progress" }]);
    expect(page(built, FOUR(), 4).timeline).toEqual([NONE]);
  });

  it("T17c: a stored in-progress skill with a new: id is dropped when the saved profile is loaded; the timeline says none", () => {
    const saved = savedFromBuilt(person({ inProgress: [] }), { vocabularyHash: "v", readingVersion: "1" }, new Date("2026-11-17T10:00:00Z"));
    saved.skills.push({ kind: "inProgress", skillId: "new:kombucha-brewing", expectedDate: "2027-01-10" });
    const loaded = builtFromSaved(saved);
    expect(loaded.profile.skills.filter((k) => k.kind === "inProgress")).toEqual([]); // hand count: 0 of 1
    expect(page(loaded, FOUR(), 4).timeline).toEqual([NONE]);
  });
});

describe("T18: roadmapBoxSafe after a throw", () => {
  it("T18: one failed line in Part A, and an empty timeline (the form of S1: a record with no requirements at all)", () => {
    const broken = { id: "z", job: { ...ad1(), requirements: undefined } as never };
    const b = roadmapBoxSafe(person(), [broken], skills);
    expect(b.partA).toEqual([ROADMAP_FAILED_LINE]);
    expect(b.partB).toEqual([]);
    expect(b.timeline).toEqual([]);
  });
});

describe("T19: the words are constants in lib/saved/messages.ts", () => {
  it("T19: TIMELINE_HEADER, TIMELINE_FRAMING and TIMELINE_NONE are exactly the three texts of section 1 of the plan", () => {
    const m = messages as unknown as Record<string, unknown>;
    expect(m.TIMELINE_HEADER).toBe(HEADER);
    expect(m.TIMELINE_FRAMING).toBe(FRAMING);
    expect(m.TIMELINE_NONE).toBe(NONE);
  });
});
