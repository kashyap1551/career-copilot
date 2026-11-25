import { describe, expect, it } from "vitest";
import { profileReport } from "@/app/fitReport";
import { roadmapBox } from "@/app/roadmap";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm } from "@/lib/cv/profile";
import { engineView, originalOf } from "@/lib/cv/engineView";
import { gapList } from "@/lib/engine/gaps";
import { match } from "@/lib/engine/match";
import { INTAKE, job, KEPT_INTAKE, KEPT_WOUND, KOMBUCHA, LINES, nameOf, P, person, req, SQL, UNLISTED, WOUND, EXCEL } from "./support/evidenceFixtures";

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

  it("SN6: two INDEPENDENT consumers agree on a same-name requirement: the report shows it as met; the gap list does not list it as a gap; the 'What to learn' box does not offer it and does not count it as not judged", () => {
    // The person has SQL (line 2) and a kept 'Wound care' (line 3) on the profile itself (built.unlistedKept, as EC-2 will put it there).
    const built = { ...person(), unlistedKept: [KEPT_WOUND] } as ReturnType<typeof person>;
    const j = job([SQL, EXCEL, WOUND, INTAKE]); // musts: SQL, Excel (missing), Wound care (same-name), Patient intake (unlisted, unanswered)

    // Consumer 1, the report (profileReport): Wound care is met, with its CV line and its OWN name.
    const report = profileReport(j, built, skills, UNLISTED);
    const row = report.rows.find((x) => x.quote === WOUND.quote)!;
    expect([row.status, row.detail]).toEqual(["met", `Wound care: CV line 3: "${LINES[2]}"`]);
    expect(report.counts).toEqual({ mustsMet: 2, mustsTotal: 3, nicesMet: 0, nicesTotal: 0 }); // SQL and Wound care of SQL, Excel, Wound care
    expect(report.couldNotJudge).toEqual({ musts: 1, nices: 0 }); // only Patient intake is still set aside

    // Consumer 2, the gap list, built from engineView on its own: Excel is the only gap; Wound care (met) is not one.
    const v = engineView(j, built);
    expect(gapList(v.engineProfile, [v.engineJob], nameOf).rows.map((r) => r.skillId)).toEqual(["excel"]);

    // Consumer 3, the 'What to learn' box, from the same profile: four saved ads like this one. It offers Excel, never Wound care, and its
    // 'could not judge' line counts one requirement for each ad (Patient intake), not two.
    const ads = [1, 2, 3, 4].map((i) => ({ id: `ad-${i}`, job: { ...j, id: `ad-${i}`, title: `Ward ${i}` } }));
    const box = roadmapBox(built, ads, skills, 4);
    const text = [...box.partA, ...box.partB].join("\n");
    expect(text).toContain("Excel");
    expect(text).not.toContain("Wound care");
    expect(box.partA).toContain("4 requirements in your saved ads are not in our skill list yet, so we could not judge them. They are not counted.");
  });

  it("SN7: it needs no click (no answers argument) and gives the same result every time", () => {
    const a = engineView(job(), person(), { unlistedKept: [KEPT_WOUND] });
    const b = engineView(job(), person(), { unlistedKept: [KEPT_WOUND] });
    expect(a).toEqual(b);
    expect(a.engineJob.requirements.map((r) => r.skillIds)).toContainEqual(["kept:wound-care"]);
  });
});
