// The guard of `npm run eval-cv` (docs/PLAN-4.2.md, section d). A real run makes
// Groq calls that cost free-tier tokens, so it only starts when the person who
// starts it has said which request and which prompt size they expect
// (EXPECT_REQUEST_HASH, EXPECT_INSTRUCTIONS_LEN), and both match what is about
// to be sent. Pure code.

export type GuardEnv = Record<string, string | undefined>; // process.env, reading EXPECT_REQUEST_HASH and EXPECT_INSTRUCTIONS_LEN

// Step 1, before anything is loaded: are both variables set?
export function missingGuard(env: GuardEnv, script: string = "eval-cv"): string | null {
  const missing = [
    env.EXPECT_REQUEST_HASH?.trim() ? null : "EXPECT_REQUEST_HASH",
    env.EXPECT_INSTRUCTIONS_LEN?.trim() ? null : "EXPECT_INSTRUCTIONS_LEN",
  ].filter((x): x is string => x !== null);
  if (missing.length === 0) return null;
  return `Refused: ${missing.join(" and ")} must be set before a real run (get the values with: npm run ${script} -- --fingerprint). No AI call was made.`;
}

// Step 2, once the request is known: do they match what would be sent?
export function mismatchGuard(env: GuardEnv, actualHash10: string, actualLength: number): string | null {
  const wantHash = (env.EXPECT_REQUEST_HASH ?? "").trim();
  const wantLen = (env.EXPECT_INSTRUCTIONS_LEN ?? "").trim().replace(/,/g, "");
  const problems: string[] = [];
  if (wantHash !== actualHash10) problems.push(`request hash is ${actualHash10}, expected ${wantHash}`);
  if (wantLen !== String(actualLength)) problems.push(`INSTRUCTIONS is ${actualLength} characters, expected ${wantLen}`);
  if (problems.length === 0) return null;
  return `Refused: ${problems.join("; ")}. No AI call was made.`;
}
