import { roadmapAds, roadmapBox, roadmapInputs } from "@/app/roadmap";
import type { OpenedAd } from "@/app/savedAdRows";
import type { BuiltProfile } from "@/lib/cv/profile";
import type { Job } from "@/lib/engine/types";
import type { SavedReading } from "@/lib/saved/types";
import { skills } from "./roadmapFixtures";

// Not a test file. The lesson of P0 (docs/PLAN-7.1.md Amendment 7, docs/PLAN-7.3.md section 0): every test that calls `roadmapBox`
// builds its ads the way the page does. Every opened reading carries the job id "pasted-ad" (lib/ai/readJob.ts:65,
// lib/saved/openJob.ts:29); the saved records have distinct ids; the ads reach the box through `roadmapAds`. Copied from
// tests/roadmapIds.test.ts (that file is not edited), with defaults added.

const reading = (job: Job) => ({ job, removed: [], moved: [], unlisted: [], notCounted: [] }) as unknown as SavedReading;

export const openedAd = (savedId: string, job: Job): OpenedAd => ({
  id: savedId,
  savedAt: "2026-11-17T10:00:00Z",
  titleLine: savedId,
  date: "2026-11-17",
  opened: { kind: "as-stored", reading: reading(job) },
});

export const pastedId = () => "pasted-ad";
export const savedIdsFor = (n: number) => Array.from({ length: n }, (_, i) => `saved-${i + 1}`);

// The ads as the page hands them to the box: `jobIdOf(i)` is each job's id (default "pasted-ad"), `savedIds[i]` the saved record's id.
export function viaPage(
  built: BuiltProfile | null,
  jobs: Job[],
  savedIds: string[] = savedIdsFor(jobs.length),
  jobIdOf: (i: number) => string = pastedId,
  fromJobs?: number,
) {
  const opened = jobs.map((j, i) => openedAd(savedIds[i], { ...j, id: jobIdOf(i) }));
  return roadmapBox(built, roadmapAds(opened), skills, fromJobs);
}

// The same without the saved-ad list: the box's short form for tests that only need the threshold.
export const page = (built: BuiltProfile | null, jobs: Job[], fromJobs?: number) => viaPage(built, jobs, undefined, undefined, fromJobs);

// Step 8.2 (docs/PLAN-8.2.md D10): the same way, ending in the INPUTS (what the page's composition works out once), and the ads alone for the
// composition. Added; nothing above is changed.
export function adsViaPage(jobs: Job[], savedIds: string[] = savedIdsFor(jobs.length), jobIdOf: (i: number) => string = pastedId) {
  return roadmapAds(jobs.map((j, i) => openedAd(savedIds[i], { ...j, id: jobIdOf(i) })));
}
export function inputsViaPage(
  built: BuiltProfile | null,
  jobs: Job[],
  savedIds: string[] = savedIdsFor(jobs.length),
  jobIdOf: (i: number) => string = pastedId,
) {
  return roadmapInputs(built, adsViaPage(jobs, savedIds, jobIdOf), skills);
}
