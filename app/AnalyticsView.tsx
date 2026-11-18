"use client";

import type { Analytics, AnalyticsOutcome } from "./analytics";

// Step 8.2 stage 1: STUB (docs/PLAN-8.2.md sections 2 and 6). Both components draw nothing and never throw.

export function AnalyticsOpen({ analytics }: { analytics: Analytics }) {
  void analytics;
  return null;
}

export default function AnalyticsView({ outcome }: { outcome: AnalyticsOutcome }) {
  void outcome;
  return null;
}
