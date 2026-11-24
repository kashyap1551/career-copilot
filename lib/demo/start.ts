import { skills } from "@/fixtures/skills";
import { buildJob } from "@/lib/engine/fromAd";
import { fromCv, type CvBuildResult } from "@/lib/engine/fromCv";
import { currentStamps } from "@/lib/saved/currentStamps";
import { listJobs, saveJob, type SavedContext } from "@/lib/saved/saved";
import { MemoryStore } from "@/lib/saved/store";
import type { SavedJob } from "@/lib/saved/types";
import { DEMO_ADS, DEMO_CV_LINES, DEMO_EXTRACTED_CV } from "./data";

// Step 9.1 (docs/PLAN-9.1.md sections 2.1 and 2.3, amendment A5). Builds the whole demo state in memory, with no argument (so
// it can never be handed the person's own store) and no request of any kind:
//   1. the CV goes through `fromCv` and each ad through `buildJob`, the two functions where the AI's output enters plain code
//      (the live routes call them in their reader files, after the AI answered; the demo calls them on the bundled readings);
//   2. each ad is saved with the real `saveJob` into a NEW MemoryStore, with its own fixed time (ad 1 at 10:09:00, ad 10 at
//      10:00:00 on 2026-11-24), so the list, newest first, is ad 1 to ad 10;
//   3. the real `listJobs` gives the list the page shows.
// The store lives in the tab's memory only and dies with it.

export type DemoState = { cv: { lines: string[]; result: CvBuildResult }; ctx: SavedContext; ads: SavedJob[] };

export async function startDemo(): Promise<DemoState> {
  const result = fromCv(DEMO_EXTRACTED_CV, DEMO_CV_LINES, skills);
  const stamps = await currentStamps();
  if (!stamps.ok) throw new Error("demo: the stamps of this code cannot be worked out in this browser");
  const ctx: SavedContext = { store: new MemoryStore(), stamps: stamps.stamps };
  for (const [i, ad] of DEMO_ADS.entries()) {
    const built = buildJob(ad.extraction, ad.text, skills, { id: "pasted-ad", source: null });
    const at = new Date(Date.UTC(2026, 10, 24, 10, 10 - (i + 1), 0));
    const saved = await saveJob(
      { ...ctx, now: () => at },
      {
        adText: ad.text,
        extraction: ad.extraction,
        reading: { job: built.job, removed: built.removed, moved: built.moved, unlisted: built.unlisted, notCounted: built.notCounted },
      },
    );
    if (!saved.ok) throw new Error(`demo: ad ${i + 1} could not be kept in memory (${saved.reason})`);
  }
  const listed = await listJobs(ctx);
  if (!listed.ok) throw new Error(`demo: the list could not be read (${listed.reason})`);
  return { cv: { lines: [...DEMO_CV_LINES], result }, ctx, ads: listed.jobs };
}
