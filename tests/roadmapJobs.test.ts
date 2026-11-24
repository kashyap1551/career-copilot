import { describe, expect, it } from "vitest";
import { engineView } from "@/lib/cv/engineView";
import { gapList } from "@/lib/engine/gaps";
import { match } from "@/lib/engine/match";
import { listedAlternatives, ROADMAP_FROM_JOBS, roadmapBasis } from "@/lib/engine/roadmapJobs";
import { splitJudgeable } from "@/lib/engine/judgeable";
import { ad, ad1, ad2, ad3, ad4, must, nice, person, skills, UNLISTED } from "./support/roadmapFixtures";

// Step 7.1e, tests first (docs/PLAN-7.1.md sections 5 and 6, Amendment 3). `roadmapBasis(job)` says whether one saved ad
// can be used by the roadmap. SIGNATURE CHOSEN (the plan fixes only its name and what it reports):
//   roadmapBasis(job: Job): { judged: Job; unjudgedMusts: number; excluded: "no-requirements" | "no-must-have-judgeable" | null }
// `judged` is `splitJudgeable(job).judged` (no blanking: that is `engineView`, which needs the profile); `excluded` comes from
// `noLevelReason`, never "no-skills" (that one depends on the profile, and adding skills fixes none of the other two).

const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;

describe("ROADMAP_FROM_JOBS", () => {
  it("is 10 (the command-line report's threshold, lib/engine/report-text.ts, moves here)", () => {
    expect(ROADMAP_FROM_JOBS).toBe(10);
  });
});

describe("roadmapBasis: which saved ads the roadmap and the gap list can use", () => {
  it("B1: an ad with no requirements is excluded: 'no-requirements', 0 unjudged musts", () => {
    // hand count: 0 requirements -> noLevelReason step 1.
    const r = roadmapBasis(ad("x", "Analyst", "Invented Co", []));
    expect(r.excluded).toBe("no-requirements");
    expect(r.unjudgedMusts).toBe(0);
    expect(r.judged.requirements).toEqual([]);
  });

  it("B2: an ad whose only must-have is not in our list is excluded: 'no-must-have-judgeable', 1 unjudged must", () => {
    // hand count: requirements 1, judged musts 0, unjudged musts 1 -> step 2.
    const r = roadmapBasis(ad("x", "Analyst", "Invented Co", [must(UNLISTED)]));
    expect(r.excluded).toBe("no-must-have-judgeable");
    expect(r.unjudgedMusts).toBe(1);
  });

  it("B3: an unlisted must-have and a listed nice-to-have: still excluded (a nice-to-have is not a must-have)", () => {
    // hand count: requirements 2, judged musts 0, unjudged musts 1 -> 'no-must-have-judgeable'; the nice stays in `judged`.
    const r = roadmapBasis(ad("x", "Analyst", "Invented Co", [must(UNLISTED), nice("excel")]));
    expect(r.excluded).toBe("no-must-have-judgeable");
    expect(r.unjudgedMusts).toBe(1);
    expect(r.judged.requirements.map((q) => q.skillIds)).toEqual([["excel"]]);
  });

  it("B4: ad 4 of the example (SQL, Python, one unlisted must) is used, with 1 unjudged must-have and the unlisted one set aside", () => {
    // hand count: musts SQL, Python (judged 2), Kombucha (unjudged 1); nice Tableau -> not excluded.
    const r = roadmapBasis(ad4());
    expect(r.excluded).toBeNull();
    expect(r.unjudgedMusts).toBe(1);
    expect(r.judged.requirements.map((q) => q.skillIds[0])).toEqual(["sql", "python", "tableau"]);
  });

  it("B5: an ad with only nice-to-haves is used (it is Strong, as the level says)", () => {
    expect(roadmapBasis(ad("x", "Analyst", "Invented Co", [nice("excel")])).excluded).toBeNull();
  });

  it("B6: an ad whose only requirement is an unlisted nice-to-have is used too (a requirement was read: DECISIONS 2026-11-17)", () => {
    const r = roadmapBasis(ad("x", "Analyst", "Invented Co", [nice(UNLISTED)]));
    expect(r.excluded).toBeNull();
    expect(r.unjudgedMusts).toBe(0);
  });

  it("B7: the reason is never 'no-skills' (it does not depend on the profile): a grid of 16 ads gives only null or the two ad reasons", () => {
    const sets = [[], [must("sql")], [must(UNLISTED)], [nice("sql")], [nice(UNLISTED)], [must("sql"), must(UNLISTED)], [must(UNLISTED), nice("sql")], [must("sql"), nice(UNLISTED)]];
    let n = 0;
    for (const reqs of sets)
      for (const location of ["Berlin", null]) {
        const r = roadmapBasis(ad("x", "Analyst", "Invented Co", reqs, { location }));
        expect([null, "no-requirements", "no-must-have-judgeable"]).toContain(r.excluded);
        n++;
      }
    expect(n).toBe(16); // hand count: 8 requirement sets x 2 locations
  });

  it("B8: `judged` is exactly splitJudgeable(job).judged (constraints untouched: no blanking, that is engineView)", () => {
    const job = ad4({ languages: [{ code: "de", level: "B2" }] });
    expect(roadmapBasis(job).judged).toEqual(splitJudgeable(job).judged);
    expect(roadmapBasis(job).judged.constraints.languages).toEqual([{ code: "de", level: "B2" }]);
  });

  it("B9: the ad is not changed", () => {
    const job = ad4();
    const copy = structuredClone(job);
    roadmapBasis(job);
    expect(job).toEqual(copy);
  });
});

describe("listedAlternatives: the listed skills of each requirement (Amendment 6 (2))", () => {
  const deepFreeze = <T,>(x: T): T => {
    if (x && typeof x === "object") {
      Object.freeze(x);
      for (const v of Object.values(x as object)) deepFreeze(v);
    }
    return x;
  };

  it("B10: unlisted alternatives are dropped, the rest of each requirement is untouched, the order is kept, the input is not changed", () => {
    // hand count: [Power BI or Looker] -> [Power BI]; [Foo or Excel] -> [Excel]; [SQL] -> [SQL]; importance and quote as they were.
    const job = deepFreeze(ad("x", "Analyst", "Invented Co", [must("power-bi", "new:looker"), nice("new:foo", "excel"), must("sql")]));
    const out = listedAlternatives(job);
    expect(out.requirements.map((r) => r.skillIds)).toEqual([["power-bi"], ["excel"], ["sql"]]);
    expect(out.requirements.map((r) => r.importance)).toEqual(["must", "nice", "must"]);
    expect(out.requirements.map((r) => r.quote)).toEqual(job.requirements.map((r) => r.quote));
    expect(out.constraints).toEqual(job.constraints);
    expect(out.id).toBe("x");
  });

  it("B11: a requirement whose ids are ALL unlisted is left unchanged (never an empty list); an all-listed job comes back equal", () => {
    const allUnlisted = must("new:looker", "new:foo");
    const out = listedAlternatives(ad("x", "Analyst", "Invented Co", [allUnlisted]));
    expect(out.requirements[0].skillIds).toEqual(["new:looker", "new:foo"]);
    const listedOnly = ad("y", "Clerk", "Invented Co", [must("sql"), nice("power-bi", "tableau")]);
    expect(listedAlternatives(listedOnly)).toEqual(listedOnly);
  });
});

describe("G14e: the exclusion of an ad that has no requirements and an unclosable French conflict", () => {
  it("five ads go in, the fifth (no requirements, asks French) is left out upstream, so M stays 4 and the kinds stay (location)", () => {
    // The person also sets German B2. Ad 2 is hybrid in Exampleville (location conflict, unclosable). The fifth ad asks
    // French (checkLanguages `!has` -> closable false): if it were counted, N would be 2, M 5 and kinds (location, language).
    // Hand count: roadmapBasis excludes the fifth (no-requirements); counted = ads 1 to 4, so N = 1, M = 4, kinds (location).
    const built = person({ languages: [{ code: "de", level: "B2" }] });
    const fifth = ad("a5", "Translator", "Invented Co", [], { languages: [{ code: "fr", level: null }] });
    const all = [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4(), fifth];

    const counted = all.filter((j) => roadmapBasis(j).excluded === null);
    const excluded = all.filter((j) => roadmapBasis(j).excluded !== null);
    expect(counted.map((j) => j.id)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(excluded.map((j) => j.id)).toEqual(["a5"]);

    // the premise: the engine does see an unclosable language conflict in the fifth ad
    const v5 = engineView(fifth, built);
    expect(match(v5.engineProfile, v5.engineJob).conflicts.map((c) => [c.kind, c.closable])).toEqual([["language", false]]);

    const views = counted.map((j) => engineView(j, built));
    const g = gapList(views[0].engineProfile, views.map((v) => v.engineJob), nameOf);
    expect(g.heldBack).toEqual({ ads: 1, of: 4, kinds: ["location"] });
  });
});
