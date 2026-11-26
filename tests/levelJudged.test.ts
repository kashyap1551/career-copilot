import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { profileReport } from "@/app/fitReport";
import { buildProfile, initialConfirm } from "@/lib/cv/profile";
import type { ViewAnswer } from "@/lib/cv/engineView";
import type { CvSkill } from "@/lib/engine/fromCv";
import { EXCEL, INTAKE, job, LINES, req, SQL, UNLISTED, WOUND } from "./support/evidenceFixtures";

// EC-8b (docs/PLAN-EVERY-CV.md, EC-8; finding D-R2): the level counts what was judged. A profile whose only skills are unlisted ones has no listed skill of
// its own (profile.skills is empty), and used to read "No level (no skills on your profile)" even after the same-name match or the AI judged its musts.
// The product's fit rules (lib/engine/fit.ts): 0 missing musts Strong, 1 Good, 2 Stretch, 3 or more Long shot. Every expectation is worked out by hand:
//   the ad has two unlisted musts WOUND (index 0) and INTAKE (index 1); the person has only the unlisted skill "Ward nursing" ticked (CV line 3): another
//   id, so neither must-have is met by the same-name match and only the AI's answers judge them. LJ4 uses a person with "Wound care" ticked instead: the
//   same id as WOUND, so the same-name match judges it.

const proposal = (name: string, id: string): CvSkill[] => [{ name, skillId: id, listed: false, line: 3, quote: "Dressed and monitored wounds", label: "named" }];
const onlyUnlisted = () => buildProfile(LINES, proposal("Ward nursing", "new:ward-nursing"), { ...initialConfirm(proposal("Ward nursing", "new:ward-nursing")), keptIds: ["new:ward-nursing"] }, skills);
const sameNamed = () => buildProfile(LINES, proposal("Wound care", "new:wound-care"), { ...initialConfirm(proposal("Wound care", "new:wound-care")), keptIds: ["new:wound-care"] }, skills);
const nobody = () => buildProfile(LINES, [], initialConfirm([]), skills);
const LINE_3 = { name: "CV line 3", skillId: "line:3", evidence: { line: 3, text: LINES[2] }, inferred: false };
const answer = (index: number, verdict: "met" | "none"): ViewAnswer =>
  verdict === "met" ? { index, verdict, entry: LINE_3, quote: "Dressed and monitored wounds" } : { index, verdict, entry: null, quote: null };
const report = (j = job([WOUND, INTAKE]), built = onlyUnlisted(), answers?: ViewAnswer[]) => profileReport(j, built, skills, UNLISTED, answers ? { answers } : undefined);

describe("EC-8b the level counts what the check judged (LJ)", () => {
  it("LJ1: only unlisted skills, two must-haves judged by the AI (one met, one missing): 1 missing = Good, not 'No level'", () => {
    const r = report(undefined, undefined, [answer(0, "met"), answer(1, "none")]);
    expect(r.fitLabel).toBe("Good (skills only; 2 must-haves judged by AI)");
    expect(r.counts).toEqual({ mustsMet: 1, mustsTotal: 2, nicesMet: 0, nicesTotal: 0 });
  });

  it("LJ2: both judged missing by the AI: 2 missing = Stretch (nothing was added to the profile, and the level is still shown)", () => {
    const r = report(undefined, undefined, [answer(0, "none"), answer(1, "none")]);
    expect(r.fitLabel).toBe("Stretch (skills only; 2 must-haves judged by AI)");
  });

  it("LJ3: a third must-have stays unjudged: the label says 'At best' and counts it (1 missing = Good, 1 not judged)", () => {
    const j = job([WOUND, INTAKE, req("You can weld.", "must", "new:welding")]);
    const r = report(j, undefined, [answer(0, "met"), answer(1, "none")]);
    expect(r.fitLabel).toBe("At best Good (skills only; 2 must-haves judged by AI; 1 must-have not judged)");
  });

  it("LJ4: the same-name match counts too: the one must-have is met by the person's own unlisted skill of the same name: Strong, not 'No level'", () => {
    const r = report(job([WOUND]), sameNamed());
    expect(r.fitLabel).toBe("Strong (skills only)");
    expect(r.counts).toEqual({ mustsMet: 1, mustsTotal: 1, nicesMet: 0, nicesTotal: 0 });
  });

  it("LJ5: nothing judged: no skills at all and two listed must-haves missing: still 'No level (no skills on your profile)'", () => {
    const r = report(job([SQL, EXCEL]), nobody());
    expect(r.fitLabel).toBe("No level (no skills on your profile)");
  });

  it("LJ6: nothing judged (two unlisted must-haves, neither of the person's name, no answer): the old reason stays ('No level (no must-have we could judge)')", () => {
    const r = report(job([INTAKE, req("You can weld.", "must", "new:welding")]));
    expect(r.fitLabel).toBe("No level (no must-have we could judge)");
  });
});
