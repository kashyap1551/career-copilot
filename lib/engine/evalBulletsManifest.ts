import { chooseBulletPairs } from "./bulletPairs";
import { profileFromKey, type BulletsEvalItem, type EvalCv } from "./evalBulletsProfile";
import type { Job, Skill } from "./types";

// Step 8.3, stage 5c (docs/PLAN-8.3.md amendment 0.30): the runs of the counted eval, taken from the manifest (fixtures/bullet-eval/manifest.ts) instead of every CV
// against every job. Pure code: no AI, no network. An id the manifest names that does not exist stops it, naming the id only (never CV text).

export type ManifestRunLike = { cv: string; job: string; set: "main" | "edge" };

export function buildManifestItems(manifest: ManifestRunLike[], cvs: EvalCv[], jobs: Job[], vocabulary: Skill[]): BulletsEvalItem[] {
  const profiles = new Map(cvs.map((c) => [c.id, profileFromKey(c.key, c.lines, vocabulary)]));
  return manifest.map((m) => {
    const cv = cvs.find((c) => c.id === m.cv);
    const job = jobs.find((j) => j.id === m.job);
    const profile = profiles.get(m.cv);
    if (!cv || !job || !profile) throw new Error(`The manifest names an unknown id: ${!cv ? m.cv : m.job}`);
    return { cv: cv.id, job: job.id, lang: cv.lang, set: m.set, pairs: chooseBulletPairs(profile, job) };
  });
}
