import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { closeMatchLine, closeMatchLines } from "@/app/reportText";
import { ReadCache, readThroughCache } from "@/lib/ai/readCache";
import { buildJob } from "@/lib/engine/fromAd";
import { fromCv } from "@/lib/engine/fromCv";
import { readNameId } from "@/lib/engine/readName";
import type { Skill } from "@/lib/engine/types";
import type { ExtractedAd } from "@/lib/schemas/job";

// Step 5 of the fresh-set sequence: stage 2 (close spelling) is wired into the live reading (fromAd and fromCv).
// Order, one shared path (mapName): not-a-skill flag, then stage 1 (exact, three tries), then stage 2 (close). A name
// no stage maps stays unlisted (new:<slug>); a tie stays unlisted. Expectations worked out by hand before the code:
//  - "Experimenten" folds to "experimenten" (12 letters); the alias "experiments" folds to "experiments" (11). One
//    replace (s -> e) and one insert (n) make 2; the common start "experiment" is 10 >= 11 - 3, so distance 2 is
//    accepted (a second change only at the very end of a long word). The skill is experimentation, via "experiments".
//  - "Excell" (6 letters) is one letter from "Excel" (5): the shorter string has 5 letters, allowance 0: no match.
//  - "Dillow" is one letter from both "Pillow" and "Billow" (6 letters, allowance 1): a tie.

const empty: ExtractedAd = {
  title: null, company: null, location: null, workMode: null, minYears: null, startDate: null,
  languages: [], otherConditions: [], requirements: [],
};
const req = (quote: string, importance: "must" | "nice", ...names: string[]) => ({ quote, importance, skills: names.map((name) => ({ name })) });
const AD = [
  "Erfahrung mit Experimenten ist wichtig.",
  "You know Experimentation well.",
  "You grow through personal development.",
  "Experience as a data analyst experience.",
  "Experience as a product analyst experience.",
  "You can use Excell every day.",
  "You can handle Dillow.",
].join("\n");
const ad = (requirements: ExtractedAd["requirements"], list: Skill[] = skills) =>
  buildJob({ ...empty, requirements }, AD, list, { id: "t", source: null });

const CV_LINES = [
  "Leitete Experimenten im Team",
  "Led Experimentation work",
  "Personal development courses",
  "Data analyst experience for two years",
  "Product analyst experience for one year",
  "Used Excell daily",
  "Knows Dillow",
];
const cv = (items: { name: string; line: number; quote: string }[], list: Skill[] = skills) => fromCv({ skills: items }, CV_LINES, list);

describe("a: a close spelling is read as the skill, and the original wording is kept", () => {
  it("W1 (ad): 'Experimenten' ends as experimentation, marked close, with the original wording and the term it matched", () => {
    const r = ad([req("Erfahrung mit Experimenten ist wichtig.", "must", "Experimenten")]);
    expect(r.job.requirements).toEqual([
      {
        skillIds: ["experimentation"], importance: "must", quote: "Erfahrung mit Experimenten ist wichtig.",
        closeMatches: [{ name: "Experimenten", skillId: "experimentation", via: "experiments" }],
      },
    ]);
    expect(r.unlisted).toEqual([]);
  });

  it("W2 (ad): a name stage 1 already finds stays stage 1: same id, no close mark at all", () => {
    const r = ad([req("You know Experimentation well.", "must", "Experimentation")]);
    expect(r.job.requirements).toEqual([{ skillIds: ["experimentation"], importance: "must", quote: "You know Experimentation well." }]);
    expect(r.job.requirements[0]).not.toHaveProperty("closeMatches");
  });

  it("W3 (CV): 'Experimenten' is kept as experimentation, listed, with the original wording and the close mark", () => {
    const r = cv([{ name: "Experimenten", line: 1, quote: "Leitete Experimenten" }]);
    expect(r.skills).toEqual([
      { name: "Experimenten", skillId: "experimentation", listed: true, line: 1, quote: "Leitete Experimenten", label: "named", closeMatch: { via: "experiments" } },
    ]);
    expect(r.unlisted).toEqual([]);
  });

  it("W4 (CV): an exact name is stage 1: no close mark", () => {
    const r = cv([{ name: "Experimentation", line: 2, quote: "Led Experimentation" }]);
    expect(r.skills.map((s) => [s.skillId, s.listed])).toEqual([["experimentation", true]]);
    expect(r.skills[0]).not.toHaveProperty("closeMatch");
  });

  it("W5: the shared path: exact, close, and unlisted, in that order of trying", () => {
    expect(readNameId("Experimentation", skills)).toEqual({ id: "experimentation", listed: true });
    expect(readNameId("Experimenten", skills)).toEqual({ id: "experimentation", listed: true, close: { via: "experiments", distance: 2 } });
    expect(readNameId("Zymurgy", skills)).toEqual({ id: "new:zymurgy", listed: false });
    expect(readNameId("???", skills)).toBeNull(); // nothing to make an id from, as before
  });
});

describe("b: flagged phrases never map to a skill", () => {
  it("W6 (ad): 'Personal development', 'data analyst experience' and 'product analyst experience' are not counted, never a requirement", () => {
    const r = ad([
      req("You grow through personal development.", "must", "Personal development"),
      req("Experience as a data analyst experience.", "must", "data analyst experience"),
      req("Experience as a product analyst experience.", "nice", "product analyst experience"),
    ]);
    expect(r.job.requirements).toEqual([]);
    expect(r.notCounted).toEqual([
      { quote: "You grow through personal development.", importance: "must" },
      { quote: "Experience as a data analyst experience.", importance: "must" },
      { quote: "Experience as a product analyst experience.", importance: "nice" },
    ]);
    expect(r.unlisted).toEqual([]);
  });

  it("W7 (CV): the same three names are removed as not-a-skill, and no skill is kept", () => {
    const r = cv([
      { name: "Personal development", line: 3, quote: "Personal development courses" },
      { name: "data analyst experience", line: 4, quote: "Data analyst experience" },
      { name: "product analyst experience", line: 5, quote: "Product analyst experience" },
    ]);
    expect(r.skills).toEqual([]);
    expect(r.removed.map((x) => [x.name, x.why])).toEqual([
      ["Personal development", "not-a-skill"],
      ["data analyst experience", "not-a-skill"],
      ["product analyst experience", "not-a-skill"],
    ]);
  });
});

describe("c: a tie and a short name stay unlisted; nothing is guessed", () => {
  const two: Skill[] = [{ id: "a", name: "Pillow" }, { id: "b", name: "Billow" }];

  it("W8 (ad): a tie ends unlisted, not as either id", () => {
    const r = ad([req("You can handle Dillow.", "must", "Dillow")], two);
    expect(r.job.requirements).toEqual([{ skillIds: ["new:dillow"], importance: "must", quote: "You can handle Dillow." }]);
    expect(r.unlisted).toEqual([{ id: "new:dillow", name: "Dillow" }]);
  });

  it("W9 (CV): a tie ends unlisted, not as either id", () => {
    const r = cv([{ name: "Dillow", line: 7, quote: "Knows Dillow" }], two);
    expect(r.skills.map((s) => [s.skillId, s.listed])).toEqual([["new:dillow", false]]);
    expect(r.skills[0]).not.toHaveProperty("closeMatch");
    expect(r.unlisted).toEqual([{ id: "new:dillow", name: "Dillow" }]);
  });

  it("W10: a name of 5 letters or fewer with one typo stays unlisted: 'Excell' is not Excel, in the ad and in the CV", () => {
    const a = ad([req("You can use Excell every day.", "must", "Excell")]);
    expect(a.job.requirements.map((x) => x.skillIds)).toEqual([["new:excell"]]);
    const c = cv([{ name: "Excell", line: 6, quote: "Used Excell" }]);
    expect(c.skills.map((s) => [s.skillId, s.listed])).toEqual([["new:excell", false]]);
  });
});

describe("d: the reading cache returns the close-match fields on a hit exactly as on the miss", () => {
  it("W11: the same text read twice: same requirements, closeMatches included, the reader called once", async () => {
    let calls = 0;
    const read = async () => {
      calls++;
      return ad([req("Erfahrung mit Experimenten ist wichtig.", "must", "Experimenten")]);
    };
    const cache = new ReadCache(20);
    const miss = await readThroughCache("Same ad text", read, { cache });
    const hit = await readThroughCache("Same ad text", read, { cache });
    expect([miss.source, hit.source]).toEqual(["miss", "hit"]);
    expect(calls).toBe(1);
    expect(miss.reading.job.requirements[0].closeMatches).toEqual([{ name: "Experimenten", skillId: "experimentation", via: "experiments" }]);
    expect(hit.reading).toEqual(miss.reading);
    expect(hit.reading.job.requirements[0].closeMatches).toEqual([{ name: "Experimenten", skillId: "experimentation", via: "experiments" }]);
  });
});

describe("the page line", () => {
  it("W12: Read as \"Experimentation\" (close spelling of \"Experimenten\")", () => {
    expect(closeMatchLine("Experimenten", "Experimentation")).toBe('Read as "Experimentation" (close spelling of "Experimenten")');
  });
});

describe("the page lines for the ad", () => {
  it("W13: one line per distinct close match; nothing for an exact match", () => {
    const names = (id: string) => skills.find((k) => k.id === id)?.name ?? id;
    const r = ad([
      req("Erfahrung mit Experimenten ist wichtig.", "must", "Experimenten"),
      req("You know Experimentation well.", "must", "Experimentation"),
    ]);
    expect(closeMatchLines(r.job.requirements, names)).toEqual(['Read as "Experimentation" (close spelling of "Experimenten")']);
    expect(closeMatchLines([{ skillIds: ["sql"] } as never], names)).toEqual([]);
    // the same close match on two requirements is shown once
    const twice = [...r.job.requirements, ...r.job.requirements];
    expect(closeMatchLines(twice, names)).toHaveLength(1);
  });
});
