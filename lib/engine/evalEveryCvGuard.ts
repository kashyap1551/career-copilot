import { mismatchGuard, type GuardEnv } from "./evalCvGuard";
import type { KeyCheck } from "./evalEveryCvKey";

// The conditions for a REAL baseline run (docs/PLAN-EVERY-CV.md section 10, EC-0). Pure code. Each function answers null (allowed) or one
// plain sentence that names the condition that failed. They are checked in this order, and the first failure is the one reported:
//   1. the guard variables are set (the CV reader: EXPECT_REQUEST_HASH, EXPECT_INSTRUCTIONS_LEN; the ad reader: EXPECT_AD_REQUEST_HASH,
//      EXPECT_AD_INSTRUCTIONS_LEN), the same guard as the other evals, once for each reader the run uses;
//   2. EVERY_CV_GO=yes is set;
//   3. all ten keys are complete without problems;
//   4. git shows no uncommitted change under fixtures/every-cv;
//   5. the example pair is not in the run list.
// The hashes themselves are compared (condition 1 again) once the readers are loaded and before any call: hashRefusal.

const NEEDED = ["EXPECT_REQUEST_HASH", "EXPECT_INSTRUCTIONS_LEN", "EXPECT_AD_REQUEST_HASH", "EXPECT_AD_INSTRUCTIONS_LEN"] as const;

export function firstRefusal(facts: {
  env: GuardEnv;
  tenKeys: { id: string; check: KeyCheck }[];
  gitDirty: () => boolean; // asked only when the earlier conditions hold
  runList: string[];
}): string | null {
  const missing = NEEDED.filter((n) => !facts.env[n]?.trim());
  if (missing.length > 0) {
    return `Refused: ${missing.join(", ")} must be set before a real run (get the values with: npm run every-cv:baseline -- --fingerprint). No AI call was made.`;
  }
  if (facts.env.EVERY_CV_GO?.trim() !== "yes") {
    return "Refused: EVERY_CV_GO=yes is not set. A real run starts only with the owner's go in its own prompt. No AI call was made.";
  }
  const notDone = facts.tenKeys.filter((k) => k.check.state !== "complete" || k.check.problems.length > 0);
  if (facts.tenKeys.length !== 10 || notDone.length > 0) {
    const first = facts.tenKeys.length !== 10 ? `there are ${facts.tenKeys.length} pair folders, not ten` : `${notDone[0].id} is ${notDone[0].check.state === "complete" ? "complete but has a problem" : notDone[0].check.state}`;
    return `Refused: not all ten keys are complete without problems. First one: ${first}. Run: npm run every-cv:keys. No AI call was made.`;
  }
  if (facts.gitDirty()) {
    return "Refused: there are uncommitted changes under fixtures/every-cv. Commit the keys first, so the run is tied to them. No AI call was made.";
  }
  if (facts.runList.includes("example")) {
    return "Refused: the example pair is in the run list. It is a format demonstration and is never sent to an AI. No AI call was made.";
  }
  return null;
}

// After the readers are loaded: the request each one would send must be the one the owner expects. null = the same.
export function hashRefusal(
  env: GuardEnv,
  cv: { hash10: string; instructionsLength: number },
  ad: { hash10: string; instructionsLength: number },
): string | null {
  const cvProblem = mismatchGuard(env, cv.hash10, cv.instructionsLength);
  if (cvProblem) return `CV reader: ${cvProblem}`;
  const adProblem = mismatchGuard({ EXPECT_REQUEST_HASH: env.EXPECT_AD_REQUEST_HASH, EXPECT_INSTRUCTIONS_LEN: env.EXPECT_AD_INSTRUCTIONS_LEN }, ad.hash10, ad.instructionsLength);
  if (adProblem) return `ad reader: ${adProblem}`;
  return null;
}
