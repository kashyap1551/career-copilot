import type { BuiltProfile } from "@/lib/cv/profile";
import { ROADMAP_FROM_JOBS } from "@/lib/engine/roadmapJobs";
import type { Job, Skill } from "@/lib/engine/types";
import { ANALYTICS_FAILED_LINE, REPORT_FAILED_LINE } from "@/lib/saved/messages";
import { ANALYTICS_TOP, analyticsFrom, type AnalyticsOutcome } from "./analytics";
import { failedRoadmapBox, roadmapBoxFrom, roadmapInputs, type RoadmapBox, type RoadmapInputs } from "./roadmap";
import { roadmapReportFrom, type ReportOutcome } from "./roadmapReport";

// Step 8.2 (docs/PLAN-8.2.md D9): the page's ONE call. It works `roadmapInputs` out once and returns the box, the report and the analytics.
// The failure behaviour is today's: a throw while working out the inputs gives the box its failure line and the report its failed outcome; a
// throw after the inputs fails only the outcome that threw (each is built in its own try). Never an error page. Pure code: no AI, no network,
// no store, no clock.

export type ScreenOutcomes = { box: RoadmapBox; report: ReportOutcome; analytics: AnalyticsOutcome };

export function screenOutcomes(
  built: BuiltProfile | null,
  ads: { id: string; job: Job }[],
  skills: Skill[],
  fromJobs: number = ROADMAP_FROM_JOBS,
  top: number = ANALYTICS_TOP,
): ScreenOutcomes {
  let inputs: RoadmapInputs;
  try {
    inputs = roadmapInputs(built, ads, skills);
  } catch {
    return { box: failedRoadmapBox(), report: { kind: "failed", line: REPORT_FAILED_LINE }, analytics: { kind: "failed", line: ANALYTICS_FAILED_LINE } };
  }

  let box: RoadmapBox;
  try {
    box = roadmapBoxFrom(inputs, fromJobs);
  } catch {
    box = failedRoadmapBox();
  }

  let report: ReportOutcome;
  try {
    const r = roadmapReportFrom(inputs, fromJobs);
    report = r ? { kind: "ready", report: r } : { kind: "none" };
  } catch {
    report = { kind: "failed", line: REPORT_FAILED_LINE };
  }

  let analytics: AnalyticsOutcome;
  try {
    const a = analyticsFrom(inputs, built, skills, top, fromJobs);
    analytics = a ? { kind: "ready", analytics: a } : { kind: "none" };
  } catch {
    analytics = { kind: "failed", line: ANALYTICS_FAILED_LINE };
  }

  return { box, report, analytics };
}
