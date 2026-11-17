/* eslint-disable @typescript-eslint/no-unused-vars -- STUB: stage 3 replaces this */
import type { BuiltProfile } from "@/lib/cv/profile";
import type { Job, Skill } from "@/lib/engine/types";

// STUB: stage 3 replaces this. Step 8.1 (docs/PLAN-8.1.md): the roadmap report, built by pure code (no AI, no network, no store).
// The names and shapes are the plan's (sections 1 and 5); the bodies do nothing, so the red tests fail on assertions.

export type ReportLine = { text: string; sub: boolean };
export type RoadmapReport = { title: string; lines: ReportLine[] };
export type ReportOutcome = { kind: "none" } | { kind: "ready"; report: RoadmapReport } | { kind: "failed"; line: string };

// STUB: stage 3 replaces this.
export function roadmapReport(
  _built: BuiltProfile | null,
  _ads: { id: string; job: Job }[],
  _skills: Skill[],
  _fromJobs?: number,
): RoadmapReport | null {
  return null;
}

// STUB: stage 3 replaces this.
export function roadmapReportSafe(
  _built: BuiltProfile | null,
  _ads: { id: string; job: Job }[],
  _skills: Skill[],
  _fromJobs?: number,
): ReportOutcome {
  return { kind: "none" };
}

// STUB: stage 3 replaces this.
export function reportAsText(_report: RoadmapReport): string {
  return "";
}
