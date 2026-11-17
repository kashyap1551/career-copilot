import { noLevelReason, splitJudgeable } from "./judgeable";
import type { Job } from "./types";

// Step 7.1 (docs/PLAN-7.1.md sections 5 and 6, Amendments 3 and 4): which saved ads the gap list and the roadmap can use.
// Pure code: no AI, no network, no store.

// From this many saved ads we could judge the roadmap is shown as a real feature; below it, the printout labels it a test view
// (the command-line report, lib/engine/report-text.ts) and the page shows one threshold line instead.
export const ROADMAP_FROM_JOBS = 10;

export type RoadmapExclusion = "no-requirements" | "no-must-have-judgeable";

export type RoadmapBasis = {
  judged: Job; // `splitJudgeable(job).judged`: only requirements in our skill list; no blanking (that is `engineView`, which needs the profile)
  unjudgedMusts: number; // the must-haves not in our skill list (the caveat "(n must-haves not judged)")
  excluded: RoadmapExclusion | null; // why the ad is left out of the gap list and the roadmap, or null when it counts
};

export function roadmapBasis(job: Job): RoadmapBasis {
  const { judged, couldNotJudge } = splitJudgeable(job);
  const unjudgedMusts = couldNotJudge.filter((r) => r.importance === "must").length;
  const reason = noLevelReason({
    requirements: job.requirements.length,
    judgedMusts: judged.requirements.filter((r) => r.importance === "must").length,
    unjudgedMusts,
    // "no-skills" depends on the profile and adding skills fixes neither of the two ad reasons: pass 1 so it never fires.
    skillCount: 1,
  });
  return { judged, unjudgedMusts, excluded: reason === "no-skills" ? null : reason };
}
