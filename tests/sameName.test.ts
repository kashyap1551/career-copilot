import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm } from "@/lib/cv/profile";
import { engineView, originalOf } from "@/lib/cv/engineView";
import { gapList } from "@/lib/engine/gaps";
import { match } from "@/lib/engine/match";
import { INTAKE, job, KEPT_INTAKE, KEPT_WOUND, KOMBUCHA, LINES, nameOf, P, person, req, SQL, WOUND, EXCEL } from "./support/evidenceFixtures";

// EC-1, the same-name match (docs/PLAN-EVERY-CV.md 4.2 and AM3, tests SN1 to SN7): an unlisted requirement and a KEPT unlisted skill with the very
// same id match by plain code, with no click and no AI. It lives inside engineView. Invented data; hand-worked.

describe("EC-1 same-name match", () => {
  it("SN1: the same id on both sides: met, citing the entry's line; the engine counts 2 of 3 must-haves met (SQL, Wound care; Excel missing)", () => {
    const j = job([SQL, EXCEL, WOUND]);
    const view = engineView(j, person(), { unlistedKept: [KEPT_WOUND] });
    expect(view.couldNotJudge).toEqual([]);
    const r = match(view.engineProfile, view.engineJob);
    expect([r.counts.mustsMet, r.counts.mustsTotal]).toEqual([2, 3]);
    const wound = r.musts.find((m) => originalOf(view).get(m.requirement) === WOUND)!;
    expect([wound.met, wound.metBy?.evidence]).toEqual([true, { line: 3, text: LINES[2] }]);
    expect(wound.requirement.skillIds).toEqual(["kept:wound-care"]);
  });

  it("SN2: a different spelling is NOT matched: 'new:wound-caring' (or 'new:wound-care-nursing') against 'new:wound-care' stays could-not-judge", () => {
    for (const id of ["new:wound-caring", "new:wound-care-nursing", "new:wound", "new:Wound-care"]) {
      const view = engineView(job([SQL, WOUND]), person(), { unlistedKept: [{ ...KEPT_WOUND, skillId: id }] });
      expect(view.couldNotJudge, id).toEqual([WOUND]);
      expect(originalOf(view).size).toBe(0);
    }
  });

  it("SN3: a requirement with two unlisted ids, one of them matching: met", () => {
    const either = req("You can care for wounds or run intake.", "must", "new:something-else", "new:wound-care");
    const view = engineView(job([SQL, either]), person(), { unlistedKept: [KEPT_WOUND] });
    expect(view.couldNotJudge).toEqual([]);
    const r = match(view.engineProfile, view.engineJob);
    expect(r.musts.every((m) => m.met)).toBe(true);
  });

  it("SN4: a requirement with a listed alternative is not touched by the same-name rule (the listed skill decides)", () => {
    const mixed = req("You know Excel or wound care.", "must", "excel", "new:wound-care");
    const view = engineView(job([mixed]), person(), { unlistedKept: [KEPT_WOUND] });
    expect(view.engineJob.requirements).toEqual([mixed]);
    expect(originalOf(view).size).toBe(0);
    expect(match(view.engineProfile, view.engineJob).musts[0].met).toBe(false); // the person has no Excel
  });

  it("SN5: a skill added by hand or in progress never matches (it is not a kept entry: it has no CV line)", () => {
    const b = buildProfile(LINES, P, { ...initialConfirm(P), keptIds: ["sql"], added: ["Wound care"], inProgress: [{ name: "Patient intake", date: "2027-06-01" }] }, skills);
    expect(b.unmatchable.map((u) => u.where)).toEqual(["hand", "progress"]);
    const view = engineView(job([SQL, WOUND, INTAKE]), b, { unlistedKept: [] });
    expect(view.couldNotJudge).toEqual([WOUND, INTAKE]);
  });

  it("SN6: the roadmap and the gap list see it too: engineView finds the kept entries on the profile by itself, the same as when they are passed in", () => {
    const withKept = { ...person(), unlistedKept: [KEPT_WOUND, KEPT_INTAKE] } as ReturnType<typeof person>;
    const j = job([SQL, EXCEL, WOUND, KOMBUCHA]);
    expect(engineView(j, withKept)).toEqual(engineView(j, person(), { unlistedKept: [KEPT_WOUND, KEPT_INTAKE] }));
    // the gap list: Excel is the only gap; the same-name Wound care is met, not a gap
    const v = engineView(j, withKept);
    const g = gapList(v.engineProfile, [v.engineJob], nameOf);
    expect(g.rows.map((r) => r.skillId)).toEqual(["excel"]);
  });

  it("SN7: it needs no click (no answers argument) and gives the same result every time", () => {
    const a = engineView(job(), person(), { unlistedKept: [KEPT_WOUND] });
    const b = engineView(job(), person(), { unlistedKept: [KEPT_WOUND] });
    expect(a).toEqual(b);
    expect(a.engineJob.requirements.map((r) => r.skillIds)).toContainEqual(["kept:wound-care"]);
  });
});
