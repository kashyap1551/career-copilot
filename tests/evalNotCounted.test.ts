import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import type { AnswerKey, KeyRequirement } from "@/lib/engine/answerKey";
import { formatNotCountedList, selectNotCountedAds } from "@/lib/engine/evalNotCounted";
import { formatReport } from "@/lib/engine/evalReport";
import type { EvalAd, ScoredAd } from "@/lib/engine/evalRun";
import { recalls, scoreAd, sumScores } from "@/lib/engine/evalScore";
import type { BuildResult, NotCounted } from "@/lib/engine/fromAd";
import type { Job, Requirement } from "@/lib/engine/types";

// The eval scorer learns `notCounted` (docs/DECISIONS.md, 2026-11-16). Every expectation below was worked out by hand
// before the code. The rule: a key requirement matched by a normal requirement is a HIT (as before); matched by no
// requirement but by a notCounted entry (same quote rule as before) is NOT COUNTED (neither hit nor miss); matched by
// both is a HIT; matched by nothing is MISSED. hits + not counted + missed = key requirements.
//   strict recall   = hits / all key requirements
//   adjusted recall = hits / (key requirements - not counted)

const emptyKey: AnswerKey = {
  ad: "ad-x", status: "reviewed", title: null, company: null, location: null, workMode: null, minYears: null,
  startDate: null, languages: [], otherConditions: [], requirements: [], acceptedExtras: [],
};
const keyOf = (p: Partial<AnswerKey>): AnswerKey => ({ ...emptyKey, ...p });
const K = (quote: string, importance: "must" | "nice", ...names: string[]): KeyRequirement => ({ quote, importance, skills: names });
const E = (quote: string, importance: "must" | "nice", ...ids: string[]): Requirement => ({ quote, importance, skillIds: ids });
const N = (quote: string, importance: "must" | "nice"): NotCounted => ({ quote, importance });

function result(requirements: Requirement[], notCounted: NotCounted[]): BuildResult {
  const job: Job = {
    id: "x", title: "Untitled job", company: null, source: null,
    constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
    requirements,
  };
  return { job, removed: [], moved: [], unlisted: [], notCounted };
}

// The made-up key of 6 requirements (quotes share no words, so no quote contains another).
const Q1 = "Strong SQL for reporting";
const Q2 = "Python scripting every day";
const Q3 = "Tableau dashboards are a plus";
const Q4 = "You are a team player";
const Q5 = "Excellent written communication";
const Q6 = "Willingness to travel weekly";
const KEY6 = keyOf({
  requirements: [
    K(Q1, "must", "SQL"), // 0: matched by a normal requirement
    K(Q2, "must", "Python"), // 1: normal
    K(Q3, "nice", "Tableau"), // 2: normal
    K(Q4, "must", "Team player"), // 3: matched ONLY by a notCounted entry
    K(Q5, "must", "Communication"), // 4: matched by BOTH
    K(Q6, "must", "Travel"), // 5: matched by nothing
  ],
});
const REQS6 = [E(Q1, "must", "sql"), E(Q2, "must", "python"), E(Q3, "nice", "tableau"), E(Q5, "must", "communication")];
const NC6 = [N(Q4, "must"), N(Q5, "must")];

describe("the hand-worked key of 6", () => {
  const s = scoreAd(KEY6, result(REQS6, NC6), skills).requirements;

  it("N1: hits 4, not counted 1, missed 1, total 6", () => {
    // hits: Q1, Q2, Q3 and Q5 (Q5 is matched by both, so it is a hit). not counted: Q4. missed: Q6.
    expect(s.hits).toBe(4);
    expect(s.notCounted).toBe(1);
    expect(s.missedMust + s.missedNice).toBe(1);
    expect(s.hits + s.notCounted + s.missedMust + s.missedNice).toBe(s.mustTotal + s.niceTotal);
    expect(s.mustTotal + s.niceTotal).toBe(6);
  });

  it("N2: the old fields are the old numbers: found 3 (the nice one is not 'found'), missed must 1 (Q6 only, Q4 is not a miss)", () => {
    // must in the key: Q1, Q2, Q4, Q5, Q6 = 5; nice: Q3 = 1. found = must paired with must: Q1, Q2, Q5 = 3.
    expect(s).toMatchObject({ mustTotal: 5, niceTotal: 1, found: 3, missedMust: 1, missedNice: 0, invented: 0, accepted: 0 });
  });

  it("N3: strict recall 4 of 6, adjusted recall 4 of 5", () => {
    expect(recalls({ hits: s.hits, notCounted: s.notCounted, total: s.mustTotal + s.niceTotal })).toEqual({
      strict: { hits: 4, of: 6 },
      adjusted: { hits: 4, of: 5 },
    });
  });

  it("N4: the double match is counted once, and the entry that matched a paired item is not an extra", () => {
    expect(s.details.notCounted).toEqual([{ quote: Q4, importance: "must", skills: ["Team player"] }]);
    expect(s.notCountedExtras).toBe(0);
    expect(s.details.missed).toEqual([{ quote: Q6, importance: "must", skills: ["Travel"] }]);
  });

  it("N5: the sums add up over ads", () => {
    const t = sumScores([scoreAd(KEY6, result(REQS6, NC6), skills), scoreAd(KEY6, result(REQS6, NC6), skills)]);
    expect(t).toMatchObject({ hits: 8, notCounted: 2, missedMust: 2, found: 6, mustTotal: 10, niceTotal: 2 });
  });
});

describe("with zero notCounted entries the old numbers are the old numbers", () => {
  const s = scoreAd(KEY6, result(REQS6, []), skills).requirements;

  it("Z1: the same six: Q4 and Q6 are both missed, none is not counted", () => {
    expect(s).toMatchObject({ mustTotal: 5, niceTotal: 1, found: 3, missedMust: 2, missedNice: 0, invented: 0, accepted: 0, hits: 4, notCounted: 0 });
    expect(s.details.missed.map((m) => m.quote)).toEqual([Q4, Q6]);
    expect(s.details.notCounted).toEqual([]);
  });

  it("Z2: recalls are equal when nothing is not counted: 4 of 6 both ways", () => {
    expect(recalls({ hits: s.hits, notCounted: s.notCounted, total: 6 })).toEqual({ strict: { hits: 4, of: 6 }, adjusted: { hits: 4, of: 6 } });
  });

  it("Z3: an ad scored the old way (a1 of the old tests) keeps its old numbers", () => {
    const L = "Sehr gute SQL-Kenntnisse; Python or R is a plus.";
    const r = scoreAd(
      keyOf({ requirements: [K("Sehr gute SQL-Kenntnisse", "must", "SQL"), K("Python or R is a plus.", "nice", "Python", "R")] }),
      result([E(L, "must", "sql"), E(L, "nice", "python", "r-language")], []),
      skills,
    ).requirements;
    expect(r).toMatchObject({ mustTotal: 1, niceTotal: 1, found: 1, missedMust: 0, missedNice: 0, invented: 0, nameDiffers: 0, hits: 2, notCounted: 0 });
  });
});

describe("edge cases", () => {
  it("E1: an empty key: hits 0, not counted 0, missed 0, and recalls 0 of 0 (no division, no NaN)", () => {
    const s = scoreAd(emptyKey, result([], []), skills).requirements;
    expect(s).toMatchObject({ mustTotal: 0, niceTotal: 0, hits: 0, notCounted: 0, missedMust: 0, missedNice: 0 });
    expect(recalls({ hits: 0, notCounted: 0, total: 0 })).toEqual({ strict: { hits: 0, of: 0 }, adjusted: { hits: 0, of: 0 } });
  });

  it("E2: a notCounted entry with the other importance: still not counted; the difference is its own count, not 'wrong importance'", () => {
    const s = scoreAd(keyOf({ requirements: [K(Q4, "must", "Team player")] }), result([], [N(Q4, "nice")]), skills).requirements;
    expect(s).toMatchObject({ notCounted: 1, hits: 0, missedMust: 0, mustReadAsNice: 0, niceReadAsMust: 0, notCountedWrongImportance: 1 });
    expect(s.details.notCountedWrongImportance).toEqual([{ quote: Q4, key: "must", ai: "nice" }]);
    // the same importance: no difference
    const same = scoreAd(keyOf({ requirements: [K(Q4, "must", "Team player")] }), result([], [N(Q4, "must")]), skills).requirements;
    expect(same.notCountedWrongImportance).toBe(0);
  });

  it("E3: an extra notCounted entry (matches no key requirement) is an extra like any: invented, or accepted if the key accepts it", () => {
    const invented = scoreAd(keyOf({ requirements: [K(Q1, "must", "SQL")] }), result([E(Q1, "must", "sql")], [N("Curious about everything", "must")]), skills).requirements;
    expect(invented).toMatchObject({ hits: 1, notCounted: 0, invented: 1, accepted: 0, notCountedExtras: 1 });
    expect(invented.details.notCountedExtras).toEqual([{ quote: "Curious about everything", importance: "must" }]);
    const accepted = scoreAd(
      keyOf({ requirements: [K(Q1, "must", "SQL")], acceptedExtras: [{ quote: "Curious about everything" }] }),
      result([E(Q1, "must", "sql")], [N("Curious about everything", "must")]),
      skills,
    ).requirements;
    expect(accepted).toMatchObject({ invented: 0, accepted: 1, notCountedExtras: 1 });
  });

  it("E4: the quote rule is the old one: a quote inside the key's quote (with a real word) matches; 'and' alone does not", () => {
    const k = keyOf({ requirements: [K("You are a reliable team player who communicates", "must", "Team player")] });
    const inside = scoreAd(k, result([], [N("reliable team player", "must")]), skills).requirements;
    expect(inside).toMatchObject({ notCounted: 1, missedMust: 0, notCountedExtras: 0 });
    const tiny = scoreAd(k, result([], [N("and", "must")]), skills).requirements;
    expect(tiny).toMatchObject({ notCounted: 0, missedMust: 1, notCountedExtras: 1 });
  });

  it("E5: two key items on one line and one notCounted entry for it (the AI lists a quote once): both are not counted", () => {
    const line = "Team player and self-starter";
    const k = keyOf({ requirements: [K(line, "must", "Team player"), K(line, "must", "Initiative")] });
    const s = scoreAd(k, result([], [N(line, "must")]), skills).requirements;
    expect(s).toMatchObject({ notCounted: 2, missedMust: 0, notCountedExtras: 0 });
  });

  it("E6: a pair is made first: a key item with a normal partner is never moved to not counted", () => {
    const s = scoreAd(keyOf({ requirements: [K(Q5, "must", "Communication")] }), result([E(Q5, "must", "communication")], [N(Q5, "must")]), skills).requirements;
    expect(s).toMatchObject({ hits: 1, notCounted: 0, found: 1 });
    expect(s.details.notCounted).toEqual([]);
  });
});

// ---- the printed lines ---------------------------------------------------------

const adOf = (id: string, key: AnswerKey, p: Partial<EvalAd> = {}): EvalAd => ({ id, text: "t", key: { ...key, ad: id }, holdout: false, known: false, ...p });
const scoredOf = (ad: EvalAd, res: BuildResult): ScoredAd => ({ ad, score: scoreAd(ad.key, res, skills), job: res.job });
const SECRET = "Secret holdout quote about travelling";
const holdKey = keyOf({ requirements: [K(SECRET, "must", "Travel")] });

describe("the report line (scorer v2)", () => {
  const base = {
    failed: [], skipped: [], reveal: false,
    scored: [scoredOf(adOf("ad-01", KEY6), result(REQS6, NC6)), scoredOf(adOf("ad-09", holdKey, { holdout: true }), result([], [N(SECRET, "must")]))],
  };

  it("R1: a per-ad line shows hits, not counted and missed, and both recalls, as counts", () => {
    const text = formatReport(base);
    expect(text).toContain("ad-01: must-haves found 3 of 5"); // the old start of the line is unchanged
    expect(text).toContain("key requirements 6: hits 4, not counted 1, missed 1 | recall strict 4 of 6, adjusted 4 of 5");
  });

  it("R2: the totals line has the same segment; the holdout is in it as numbers only (one key requirement, not counted)", () => {
    const text = formatReport(base);
    // totals: ad-01 (6 key, hits 4, nc 1, missed 1) + ad-09 (1 key, hits 0, nc 1, missed 0) = 7, hits 4, nc 2, missed 1
    expect(text).toContain("TOTALS (2 ads, known cases left out):");
    expect(text).toContain("key requirements 7: hits 4, not counted 2, missed 1 | recall strict 4 of 7, adjusted 4 of 5");
    expect(text).toContain("HOLDOUT (1 ads): totals only");
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("ad-09:");
  });

  it("R3: the key items that are not counted are listed under their ad (tuning ads only); never a percentage", () => {
    const text = formatReport(base);
    expect(text).toContain(`  not counted (must): "${Q4}" [Team player]`);
    expect(text).not.toContain("%");
  });

  it("R4: the report says it is scorer v2, so the old lines are not compared by eye", () => {
    expect(formatReport(base)).toContain("Scorer v2");
    expect(formatReport(base)).toContain("not comparable");
  });

  it("R5: a report with nothing not counted still prints the segment (not counted 0, adjusted equals strict)", () => {
    const text = formatReport({ failed: [], skipped: [], reveal: false, scored: [scoredOf(adOf("ad-01", KEY6), result(REQS6, []))] });
    expect(text).toContain("key requirements 6: hits 4, not counted 0, missed 2 | recall strict 4 of 6, adjusted 4 of 6");
  });
});

describe("the listing command (tuning ads only)", () => {
  const ads = [
    adOf("ad-01", KEY6), adOf("ad-08", KEY6), adOf("ad-09", holdKey, { holdout: true }), adOf("ad-10", holdKey, { holdout: true }),
    adOf("barista-injection", KEY6, { known: true }),
  ];

  it("C1: the selection keeps ad-01 to ad-08 and drops the holdout and the known cases, before any AI call", () => {
    expect(selectNotCountedAds(ads).map((a) => a.id)).toEqual(["ad-01", "ad-08"]);
  });

  it("C2: the list names each not-counted key requirement with its importance and skills, and counts per ad", () => {
    const text = formatNotCountedList([scoredOf(adOf("ad-01", KEY6), result(REQS6, NC6))]);
    expect(text).toContain("ad-01: not counted 1 of 6 key requirements");
    expect(text).toContain(`  (must) "${Q4}" [Team player]`);
    expect(text).toContain("TOTAL: not counted 1 of 6 key requirements in 1 ads");
    expect(text).not.toContain("%");
  });

  it("C3: the formatter refuses a holdout ad itself (a second line of defence)", () => {
    expect(() => formatNotCountedList([scoredOf(adOf("ad-09", holdKey, { holdout: true }), result([], [N(SECRET, "must")]))])).toThrow();
  });

  it("C4: the script uses the selection and the formatter, and never prints the holdout's lines on this path", () => {
    const text = fs.readFileSync(path.join(process.cwd(), "scripts/eval.ts"), "utf8");
    expect(text).toContain("selectNotCountedAds(");
    expect(text).toContain("formatNotCountedList(");
    expect(text).toContain("--not-counted");
  });
});
