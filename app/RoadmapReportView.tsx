"use client";

/* eslint-disable @typescript-eslint/no-unused-vars -- STUB: stage 3 replaces this */
import type { ReportOutcome, RoadmapReport } from "./roadmapReport";

// STUB: stage 3 replaces this. Step 8.1 (docs/PLAN-8.1.md sections 1 and 5): the shell (the button, the open or closed state, the one
// clipboard write in a click handler) and the pure open-state component. Both draw nothing yet.

export type CopyStatus = "idle" | "copied" | "failed";

// STUB: stage 3 replaces this.
export function RoadmapReportOpen(_props: { report: RoadmapReport; copyStatus: CopyStatus; onCopy: () => void }) {
  return null;
}

// STUB: stage 3 replaces this.
export default function RoadmapReportView(_props: { outcome: ReportOutcome }) {
  return null;
}
