import type { BuiltProfile } from "@/lib/cv/profile";
import { ROADMAP_FROM_JOBS } from "@/lib/engine/roadmapJobs";
import type { Skill } from "@/lib/engine/types";
import type { RoadmapInputs } from "./roadmap";

// Step 8.2 stage 1: STUB (docs/PLAN-8.2.md sections 2 and 6). The shapes are final; the body returns null (nothing to show) and never throws.

export const ANALYTICS_TOP = 10;

export type AnalyticsLine = {
  text: string;
  kind: "basis" | "note" | "heading" | "level" | "skill" | "plain";
  bar: { n: number; of: number } | null;
};
export type Analytics = { title: string; lines: AnalyticsLine[] };
export type AnalyticsOutcome = { kind: "none" } | { kind: "ready"; analytics: Analytics } | { kind: "failed"; line: string };

export function analyticsFrom(
  inputs: RoadmapInputs,
  built: BuiltProfile | null,
  skills: Skill[],
  top: number = ANALYTICS_TOP,
  fromJobs: number = ROADMAP_FROM_JOBS,
): Analytics | null {
  void inputs;
  void built;
  void skills;
  void top;
  void fromJobs;
  return null;
}
