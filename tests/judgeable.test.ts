import { describe, expect, it } from "vitest";
import { isUnlistedId, noLevelReason, splitJudgeable } from "@/lib/engine/judgeable";
import type { Job, Requirement } from "@/lib/engine/types";

// docs/PLAN-FIT-LEVEL.md, section 1 ("judgeable.ts") and the D1 to D5 / A3 / A8 cases. Hand-worked: a requirement is
// judgeable unless ALL of its skill ids are unlisted ("new:..."); the "no level" reason is decided from three counts.

const req = (skillIds: string[], importance: "must" | "nice", quote: string): Requirement => ({ skillIds, importance, quote });
const job = (requirements: Requirement[]): Job => ({
  id: "j",
  title: "T",
  company: null,
  source: null,
  constraints: { languages: [], location: "Berlin", remote: "hybrid", minYears: 2, startDate: null, otherConditions: [{ quote: "Right to work." }] },
  requirements,
});

describe("isUnlistedId", () => {
  it("J0: only the provisional ids made from unlisted names", () => {
    expect(isUnlistedId("new:welding")).toBe(true);
    expect(isUnlistedId("sql")).toBe(false);
    expect(isUnlistedId("renew:x")).toBe(false);
  });
});

describe("splitJudgeable", () => {
  const sql = req(["sql"], "must", "SQL.");
  const kom = req(["new:kombucha"], "must", "Kombucha.");
  const weld = req(["new:welding"], "nice", "Welding.");
  const alt = req(["power-bi", "new:looker"], "must", "Power BI or Looker.");
  const mixedTwoNew = req(["new:a", "new:b"], "must", "A or B.");

  it("J1: a requirement is unjudged only when ALL its ids are unlisted; the order of both lists is the ad's order", () => {
    const j = job([sql, kom, weld, alt, mixedTwoNew]);
    const r = splitJudgeable(j);
    expect(r.judged.requirements).toEqual([sql, alt]);
    expect(r.couldNotJudge).toEqual([kom, weld, mixedTwoNew]);
  });

  it("J2: everything else about the job is unchanged, and the input is not modified", () => {
    const j = job([sql, kom]);
    const before = JSON.stringify(j);
    const r = splitJudgeable(j);
    expect(r.judged.constraints).toEqual(j.constraints);
    expect([r.judged.id, r.judged.title, r.judged.company]).toEqual(["j", "T", null]);
    expect(JSON.stringify(j)).toBe(before);
  });

  it("J3: nothing unlisted: the same requirements, nothing set aside", () => {
    const r = splitJudgeable(job([sql, alt]));
    expect(r.judged.requirements).toEqual([sql, alt]);
    expect(r.couldNotJudge).toEqual([]);
  });

  it("J4: nothing but unlisted: no judged requirement at all", () => {
    const r = splitJudgeable(job([kom, weld]));
    expect(r.judged.requirements).toEqual([]);
    expect(r.couldNotJudge).toEqual([kom, weld]);
  });
});

describe("noLevelReason(judgedMusts, unjudgedMusts, skillCount)", () => {
  const cases: [number, number, number, ReturnType<typeof noLevelReason>][] = [
    [2, 1, 3, null], // case 7: a level, with the caveat
    [0, 1, 3, "no-must-have-judgeable"], // A3b
    [0, 2, 3, "no-must-have-judgeable"], // A3
    [0, 2, 0, "no-must-have-judgeable"], // D4: this reason wins over "no skills"
    [2, 0, 0, "no-skills"], // case 5
    [0, 0, 0, "no-skills"], // D1: an ad with no must-haves and a profile with no skills
    [0, 0, 2, null], // A7: an ad with no must-haves is not "none could be judged"
    [1, 0, 1, null],
  ];
  for (const [judged, unjudged, skills, expected] of cases) {
    it(`J5: judged ${judged}, unjudged ${unjudged}, skills ${skills} gives ${expected}`, () => {
      expect(noLevelReason({ judgedMusts: judged, unjudgedMusts: unjudged, skillCount: skills })).toBe(expected);
    });
  }
});
