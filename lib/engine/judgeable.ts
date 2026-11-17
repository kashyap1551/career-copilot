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

export type NoLevelReason = "no-must-have-judgeable" | "no-skills";

// null = a level is shown. "No must-have could be judged" (the ad has must-haves, and every one is unlisted) comes first:
// adding skills would not fix it. "No skills" means no entry at all on the profile or the typed list. An ad with no
// must-haves at all is not "none could be judged".
export function noLevelReason(input: { judgedMusts: number; unjudgedMusts: number; skillCount: number }): NoLevelReason | null {
  if (input.unjudgedMusts > 0 && input.judgedMusts === 0) return "no-must-have-judgeable";
  if (input.skillCount === 0) return "no-skills";
  return null;
}
