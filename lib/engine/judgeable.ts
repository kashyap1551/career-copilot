import type { Job, Requirement } from "./types";

// Which requirements of an ad can be judged, and when no level is shown (docs/PLAN-FIT-LEVEL.md). Pure code: no AI, no
// network. fit.ts, match.ts and unlock.ts are NOT changed: the report hands match() a job without the requirements it
// cannot judge, so the level is decided only from requirements in our skill list.

// An id made from a name that is not in our skill list (lib/engine/fromAd.ts gives it "new:<slug>").
export const isUnlistedId = (id: string) => id.startsWith("new:");

// A requirement can be judged unless ALL of its skill ids are unlisted: with one listed alternative ("Power BI or
// Looker") it is judged, and missing if the person has neither.
const cannotJudge = (r: Requirement) => r.skillIds.every(isUnlistedId);

// The job without the requirements it cannot judge (everything else untouched, the order kept), and those requirements.
export function splitJudgeable(job: Job): { judged: Job; couldNotJudge: Requirement[] } {
  return {
    judged: { ...job, requirements: job.requirements.filter((r) => !cannotJudge(r)) },
    couldNotJudge: job.requirements.filter(cannotJudge),
  };
}

export type NoLevelReason = "no-requirements" | "no-must-have-judgeable" | "no-skills";

// null = a level is shown. Checked in this order (docs/PLAN-FIT-LEVEL.md, Amendment 4):
//  1. "no-requirements": the AI found no requirement at all in the ad (`requirements` counts the ad's requirements as read,
//     before the unlisted ones are set aside; a level on nothing is not information);
//  2. "no-must-have-judgeable": the ad has must-haves, and every one is unlisted;
//  3. "no-skills": no entry at all on the profile or the typed list.
// 1 and 2 come before 3 because adding skills fixes neither. An ad with only nice-to-haves is none of these (it is Strong).
export function noLevelReason(input: {
  requirements: number;
  judgedMusts: number;
  unjudgedMusts: number;
  skillCount: number;
}): NoLevelReason | null {
  if (input.requirements === 0) return "no-requirements";
  if (input.unjudgedMusts > 0 && input.judgedMusts === 0) return "no-must-have-judgeable";
  if (input.skillCount === 0) return "no-skills";
  return null;
}
