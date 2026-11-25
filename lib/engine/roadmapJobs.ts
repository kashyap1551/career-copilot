import { engineView } from "../cv/engineView";
import type { BuiltProfile } from "../cv/profile";
import { isUnlistedId, noLevelReason, splitJudgeable } from "./judgeable";
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

// `built` (EC-2, docs/PLAN-EVERY-CV.md 4.4): the profile in use, when there is one. With it, "judged" and "not judged" are what `engineView` says,
// so a requirement met by the SAME-NAME match (a kept unlisted skill of the person with the very same id) counts as judged here exactly as it
// does in the report. Without it, or with a profile that keeps no unlisted skill, the result is what it always was (`splitJudgeable`).
export function roadmapBasis(job: Job, built: BuiltProfile | null = null): RoadmapBasis {
  let judged: Job;
  let couldNotJudge;
  if (built === null) {
    ({ judged, couldNotJudge } = splitJudgeable(job));
  } else {
    const view = engineView(job, built);
    // `judged` keeps the ad's own constraints (no blanking): only the requirements come from the view.
    judged = { ...job, requirements: view.engineJob.requirements };
    couldNotJudge = view.couldNotJudge;
  }
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

// Amendment 6 (2): in the box, a requirement with one listed and one unlisted alternative ("Power BI or Looker") keeps only its
// listed skill ids, so no raw `new:` id reaches a gap row or the ranking. A requirement whose ids are ALL unlisted is left
// unchanged (never an empty list; `splitJudgeable` has already set those aside). The input is not changed.
export function listedAlternatives(job: Job): Job {
  return {
    ...job,
    requirements: job.requirements.map((r) => {
      const listed = r.skillIds.filter((id) => !isUnlistedId(id));
      return listed.length === 0 || listed.length === r.skillIds.length ? r : { ...r, skillIds: listed };
    }),
  };
}
