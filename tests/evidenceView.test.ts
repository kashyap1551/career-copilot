import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { profileReport } from "@/app/fitReport";
import { roadmapBox } from "@/app/roadmap";
import { skills } from "@/fixtures/skills";
import { jobs } from "@/fixtures/jobs";
import { displayNamer, engineView, originalOf } from "@/lib/cv/engineView";
import { buildProfile, initialConfirm, type BuiltProfile, type ConfirmState } from "@/lib/cv/profile";
import { gapList } from "@/lib/engine/gaps";
import { splitJudgeable } from "@/lib/engine/judgeable";
import { match } from "@/lib/engine/match";
import type { Job } from "@/lib/engine/types";
import {
  A_INTAKE_MET, A_INTAKE_NONE, A_INTAKE_PARTLY, A_WOUND_MET, deepFreeze, EXCEL, INTAKE, job, KEPT_INTAKE, KEPT_WOUND, KOMBUCHA, LINES, nameOf, P, person, req, SQL, UNLISTED, WOUND,
} from "./support/evidenceFixtures";

// EC-1, the answers view (docs/PLAN-EVERY-CV.md 4.4, tests EV1 to EV13). engineView takes the verified answers of a click and the kept
// unlisted skills, and rewrites ids BEFORE the engine, which stays untouched. Invented data; every expectation is worked out by hand.
//
// The worked example of 4.4 (SQL and Excel listed, "Wound care" and "Patient intake" not; the person has SQL on line 2, kept entries for the two
// unlisted skills on lines 3 and 4): musts SQL, Excel, Wound care, Patient intake; one nice, Kombucha brewing.

// THE OLD CONSTRUCTION, copied (not imported): what engineView did before EC-1 (see tests/engineView.test.ts).
function oldConstruction(j: Job, b: BuiltProfile) {
  const { profile, set } = b;
  const { judged, couldNotJudge } = splitJudgeable(j);
  return {
    engineJob: { ...judged, constraints: { ...j.constraints, languages: set.language ? j.constraints.languages : [], location: set.location ? j.constraints.location : null } },
    engineProfile: { ...profile, constraints: { ...profile.constraints, workModes: set.workMode ? profile.constraints.workModes : (["onsite", "hybrid", "remote"] as const).slice() } },
    couldNotJudge,
  };
}

describe("EC-1 engineView with answers", () => {
  it("EV1: with NO answers and NO kept entries the result is deep-equal to today's, over every fixture ad and several settings, and the map is empty", () => {
    const settings: Partial<ConfirmState>[] = [{}, { cities: "Berlin" }, { years: "2", workModes: ["remote"] }, { availableFrom: "2027-06-01", languages: [{ code: "de", level: "B2" }] }];
    let checked = 0;
    for (const j of jobs) {
      for (const over of settings) {
        const b = buildProfile(LINES, P, { ...initialConfirm(P), keptIds: ["sql"], ...over }, skills);
        for (const view of [engineView(j, b), engineView(j, b, {}), engineView(j, b, { answers: [], unlistedKept: [] })]) {
          expect(view).toEqual(oldConstruction(j, b));
          expect(Object.keys(view).sort()).toEqual(["couldNotJudge", "engineJob", "engineProfile"]);
          expect(originalOf(view).size).toBe(0);
          checked++;
        }
      }
    }
    expect(checked).toBe(jobs.length * 12);
  });

  it("EV1b: with kept entries but no hit and no answers the result is the same (the kept skills here match no requirement of the fixture ads)", () => {
    const kept = [{ ...KEPT_WOUND, skillId: "new:zymurgy" }, KEPT_INTAKE];
    for (const j of jobs) {
      const b = person();
      expect(engineView(j, b, { unlistedKept: kept })).toEqual(oldConstruction(j, b));
    }
  });

  it("EV2: a verified MET answer counts as met with the entry's own citation (R1): the requirement is judged, the profile gets one extra 'have' with that evidence", () => {
    const view = engineView(job(), person(), { answers: [A_WOUND_MET] });
    const wound = view.engineJob.requirements.find((r) => r.quote === WOUND.quote)!;
    expect(wound.skillIds).toEqual(["ev:3"]); // requirement number 3 (index 2)
    const extra = view.engineProfile.skills.filter((s) => s.skillId === "ev:3");
    expect(extra).toEqual([{ kind: "have", skillId: "ev:3", evidence: { line: 3, text: LINES[2] } }]);
    const r = match(view.engineProfile, view.engineJob);
    const met = r.musts.find((m) => m.requirement === wound)!;
    expect([met.met, met.metBy?.evidence]).toEqual([true, { line: 3, text: LINES[2] }]);
  });

  it("EV3: PARTLY counts as missing (R2): a judged must-have, no skill added, reason 'not-on-profile'", () => {
    const view = engineView(job(), person(), { answers: [A_INTAKE_PARTLY] });
    const r = match(view.engineProfile, view.engineJob);
    const intake = r.musts.find((m) => originalOf(view).get(m.requirement) === INTAKE)!;
    expect([intake.met, intake.reason]).toEqual([false, "not-on-profile"]);
    expect(view.engineProfile.skills.some((s) => s.skillId === "ev:4")).toBe(false);
  });

  it("EV4: NO EVIDENCE FOUND counts as missing (R3), like partly", () => {
    const view = engineView(job(), person(), { answers: [A_INTAKE_NONE] });
    const r = match(view.engineProfile, view.engineJob);
    expect(r.musts.filter((m) => !m.met).map((m) => originalOf(view).get(m.requirement)?.quote ?? m.requirement.quote)).toEqual([EXCEL.quote, INTAKE.quote]);
  });

  it("EV5: an unanswered requirement is left alone (R4): it stays in couldNotJudge, exactly as today, and is not in the engine's job", () => {
    const view = engineView(job(), person(), { answers: [A_WOUND_MET] });
    expect(view.couldNotJudge).toEqual([INTAKE, KOMBUCHA]);
    expect(view.engineJob.requirements.map((r) => r.quote)).not.toContain(KOMBUCHA.quote);
  });

  it("EV6: the worked example: Good today, Stretch with the two answers, Good if 'Patient intake' is met too (4 musts: 2 met 2 missing = 2 gaps; 3 met 1 missing = 1 gap)", () => {
    const levelOf = (answers: Parameters<typeof engineView>[2]) => {
      const v = engineView(job(), person(), answers);
      const r = match(v.engineProfile, v.engineJob);
      return [r.counts.mustsMet, r.counts.mustsTotal, r.level];
    };
    expect(levelOf(undefined)).toEqual([1, 2, "good"]); // SQL met, Excel missing; two must-haves set aside
    expect(levelOf({ answers: [A_WOUND_MET, A_INTAKE_PARTLY] })).toEqual([2, 4, "stretch"]);
    expect(levelOf({ answers: [A_WOUND_MET, A_INTAKE_MET] })).toEqual([3, 4, "good"]);
  });

  it("EV7: a failed or empty check changes nothing (R4): no answers gives exactly the view without the argument", () => {
    expect(engineView(job(), person(), { answers: [] })).toEqual(engineView(job(), person()));
  });

  it("EV8: a requirement with a listed alternative is never touched by an answer (only 'every id unlisted' is checked by the AI)", () => {
    const j = job([req("You know Excel or wound care.", "must", "excel", "new:wound-care")]);
    const view = engineView(j, person(), { answers: [{ index: 0, verdict: "met", entry: KEPT_WOUND, quote: "Dressed and monitored wounds" }] });
    expect(view.engineJob.requirements[0].skillIds).toEqual(["excel", "new:wound-care"]);
    expect(view.engineProfile.skills.some((s) => s.skillId.startsWith("ev:"))).toBe(false);
  });

  it("EV9: the 'No level' reasons keep their order: every must-have unanswered still reads 'No level (no must-have we could judge)'", () => {
    const j = job([WOUND, INTAKE]);
    const r = profileReport(j, person(), skills, UNLISTED, { answers: [] });
    expect(r.fitLabel).toBe("No level (no must-have we could judge)");
    expect(profileReport(job([]), person(), skills, UNLISTED, { answers: [A_WOUND_MET] }).fitLabel).toBe("No level (no requirements found in this ad)");
  });

  it("EV10: the engine does not import the new code (source guard)", () => {
    for (const f of ["match.ts", "fit.ts", "unlock.ts", "judgeable.ts"]) {
      expect(readFileSync(join(process.cwd(), "lib/engine", f), "utf8"), f).not.toMatch(/evidenceProof|evidenceText|engineView/);
    }
  });

  it("EV11: every 'have' skill the view adds carries the entry's own evidence (a real line number and the line's own text), never null", () => {
    const view = engineView(job(), person(), { answers: [A_WOUND_MET, A_INTAKE_MET], unlistedKept: [] });
    const added = view.engineProfile.skills.filter((s) => s.skillId.startsWith("ev:") || s.skillId.startsWith("kept:"));
    expect(added).toHaveLength(2);
    for (const s of added) {
      expect(s.kind).toBe("have");
      if (s.kind === "have") {
        expect(s.evidence).not.toBeNull();
        expect(view.engineProfile.cvLines[(s.evidence?.line ?? 0) - 1]).toBe(s.evidence?.text);
      }
    }
  });

  it("EV12: no input is changed (frozen job, profile and extras) and the same call twice gives the same view", () => {
    const j = deepFreeze(job());
    const b = deepFreeze(person());
    const extras = deepFreeze({ answers: [A_WOUND_MET, A_INTAKE_PARTLY], unlistedKept: [KEPT_WOUND] });
    expect(engineView(j, b, extras)).toEqual(engineView(j, b, extras));
  });
});

// ---- EV13: no internal id on screen ----------------------------------------------------------------------------------------------------------

const strings = (x: unknown, out: string[] = []): string[] => {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) x.forEach((v) => strings(v, out));
  else if (x !== null && typeof x === "object") Object.values(x as object).forEach((v) => strings(v, out));
  return out;
};
const ID = /\b(ev|kept|new):/;

describe("EV13: rewritten and made-up ids never reach a text a person sees", () => {
  // One ad with a same-name match (Wound care, kept), a partly (Patient intake), a none (the second ad below), an unanswered (Kombucha).
  const extras = { answers: [A_INTAKE_PARTLY], unlistedKept: [KEPT_WOUND] };

  it("EV13a: every string of the report (label, explanation, rows, AI rows, not-judged lines, thrown-away line) is free of ev:, kept: and new:", () => {
    const r = profileReport(job(), person(), skills, UNLISTED, { ...extras, thrownAway: 1 });
    const all = strings(r);
    expect(all.length).toBeGreaterThan(10);
    for (const s of all) expect(s, s).not.toMatch(ID);
    // and the words a person should read are there instead
    expect(all.some((s) => s.includes("Patient intake"))).toBe(true);
    expect(all.some((s) => s.includes("Wound care"))).toBe(true);
    const none = profileReport(job(), person(), skills, UNLISTED, { answers: [A_INTAKE_NONE], unlistedKept: [KEPT_WOUND] });
    for (const s of strings(none)) expect(s, s).not.toMatch(ID);
  });

  it("EV13b: the gap list, named through the view's display names, shows the requirement's own skill name, never ev:4", () => {
    const view = engineView(job(), person(), { answers: [A_INTAKE_PARTLY], unlistedKept: [KEPT_WOUND] });
    const namer = displayNamer(view, nameOf);
    const g = gapList(view.engineProfile, [view.engineJob], namer);
    // musts missing: Excel and Patient intake (the id is ev:4 inside the engine); Wound care is met by the same-name match
    expect(g.rows.map((r) => namer(r.skillId))).toEqual(["Excel", "Patient intake"]);
    for (const r of g.rows) expect(namer(r.skillId)).not.toMatch(ID);
  });

  it("EV13c: the 'What to learn' box built from a profile that holds kept entries has no internal id", () => {
    const built = { ...person(), unlistedKept: [KEPT_WOUND] } as BuiltProfile;
    const ads = [1, 2, 3, 4].map((i) => ({ id: `ad-${i}`, job: { ...job(), id: `ad-${i}` } }));
    const box = roadmapBox(built, ads, skills, 4);
    const all = [...box.partA, ...box.partB, box.noProfile ?? ""];
    expect(all.join("\n")).toContain("Excel");
    for (const s of all) expect(s, s).not.toMatch(ID);
  });
});
