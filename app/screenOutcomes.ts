import type { BuiltProfile } from "@/lib/cv/profile";
import { ROADMAP_FROM_JOBS } from "@/lib/engine/roadmapJobs";
import type { Job, Skill } from "@/lib/engine/types";
import { ANALYTICS_TOP, type AnalyticsOutcome } from "./analytics";
import type { RoadmapBox } from "./roadmap";
import type { ReportOutcome } from "./roadmapReport";

// Step 8.2 stage 1: STUB (docs/PLAN-8.2.md D9 and section 6). The shape is final; the body returns empty outcomes and never throws.

export type ScreenOutcomes = { box: RoadmapBox; report: ReportOutcome; analytics: AnalyticsOutcome };

export function screenOutcomes(
  built: BuiltProfile | null,
  ads: { id: string; job: Job }[],
  skills: Skill[],
  fromJobs: number = ROADMAP_FROM_JOBS,
  top: number = ANALYTICS_TOP,
): ScreenOutcomes {
  void built;
  void ads;
  void skills;
  void fromJobs;
  void top;
  return {
    box: { noProfile: null, partA: [], partB: [], counted: 0, alreadyStrongIds: [], timeline: [] },
    report: { kind: "none" },
    analytics: { kind: "none" },
  };
}
