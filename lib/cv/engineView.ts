import { splitJudgeable } from "../engine/judgeable";
import type { Job, Profile, Requirement } from "../engine/types";
import type { BuiltProfile } from "./profile";

// Step 7.1a (docs/PLAN-7.1.md sections 5 and 6): what the rules engine is handed for ONE ad and the profile in use.
// Pure code: no AI, no network. It is exactly the construction that `profileReport` (app/fitReport.ts) did inline before
// it calls match(), moved here so the report and the roadmap cannot disagree:
// - the ad keeps only the requirements in our skill list (docs/PLAN-FIT-LEVEL.md (a)); the others come back as `couldNotJudge`;
// - the engine only sees the kinds the person set: the ad's languages and city are blanked when unset;
// - the work mode is always passed on: an unset work mode means "all three accepted", so it can cause no conflict, and the
//   city check still runs when only a city is set.
export type EngineView = {
  engineJob: Job;
  engineProfile: Profile;
  couldNotJudge: Requirement[];
};

export function engineView(job: Job, built: BuiltProfile): EngineView {
  const { profile, set } = built;
  const { judged: judgedJob, couldNotJudge } = splitJudgeable(job);
  const engineJob: Job = {
    ...judgedJob,
    constraints: {
      ...job.constraints,
      languages: set.language ? job.constraints.languages : [],
      location: set.location ? job.constraints.location : null,
    },
  };
  const engineProfile = {
    ...profile,
    constraints: {
      ...profile.constraints,
      workModes: set.workMode ? profile.constraints.workModes : (["onsite", "hybrid", "remote"] as const).slice(),
    },
  };
  return { engineJob, engineProfile, couldNotJudge };
}
