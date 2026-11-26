import { mismatchGuard, type GuardEnv } from "./evalCvGuard";
import type { KeyCheck } from "./evalEveryCvKey";

// The conditions for a REAL run of the check eval (docs/PLAN-EVERY-CV.md, the check eval, `npm run eval-check`). Pure code. Each function answers null
// (allowed) or one plain sentence naming the condition that failed. Asked in this order, the first failure is the one reported:
//   1. the guard variables EXPECT_CHECK_REQUEST_HASH and EXPECT_CHECK_INSTRUCTIONS_LEN are set;
//   2. EVERY_CV_GO=yes is set;
//   3. all ten keys are complete without problems;
//   4. git shows no uncommitted change under fixtures/every-cv;
//   5. the baseline run matches today's fingerprint (asked only now: it may need the readers loaded; it answers its own sentence or null);
//   6. the example pair is not in the run list;
//   7. a COUNTED run uses all ten pairs (no --pairs).
// The hashes themselves are compared (checkHashRefusal) once the request is known and before any call.

const NEEDED = ["EXPECT_CHECK_REQUEST_HASH", "EXPECT_CHECK_INSTRUCTIONS_LEN"] as const;

export function firstCheckRefusal(facts: {
  env: GuardEnv;
  tenKeys: { id: string; check: KeyCheck }[];
  gitDirty: () => boolean;
  baseline: () => string | null;
  runList: string[];
  counted: boolean;
  pairsGiven: boolean;
}): string | null {
  const missing = NEEDED.filter((n) => !facts.env[n]?.trim());
  if (missing.length > 0) {
    return `Refused: ${missing.join(", ")} must be set before a real run (get the values with: npm run eval-check -- --fingerprint). No AI call was made.`;
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
  const baseline = facts.baseline();
  if (baseline !== null) return baseline;
  if (facts.runList.includes("example")) {
    return "Refused: the example pair is in the run list. It is a format demonstration and is never sent to an AI. No AI call was made.";
  }
  if (facts.counted && facts.pairsGiven) {
    return "Refused: a counted run needs all ten pairs; --pairs is for a calibration run (add --calibration). No AI call was made.";
  }
  return null;
}

// Once the request the check would send is known: is it the one the owner expects? null = the same.
export function checkHashRefusal(env: GuardEnv, actualHash10: string, actualLength: number): string | null {
  return mismatchGuard({ EXPECT_REQUEST_HASH: env.EXPECT_CHECK_REQUEST_HASH, EXPECT_INSTRUCTIONS_LEN: env.EXPECT_CHECK_INSTRUCTIONS_LEN }, actualHash10, actualLength);
}
