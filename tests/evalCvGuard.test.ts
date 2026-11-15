import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { mismatchGuard, missingGuard } from "@/lib/engine/evalCvGuard";

// The guard of `npm run eval-cv`: a real run must refuse to start without its two
// EXPECT_ variables, and when they do not match what would be sent. No AI call.

describe("the guard", () => {
  it("G1: both variables missing, or empty, or blank: refused, naming them", () => {
    expect(missingGuard({})).toMatch(/EXPECT_REQUEST_HASH and EXPECT_INSTRUCTIONS_LEN/);
    expect(missingGuard({ EXPECT_REQUEST_HASH: "", EXPECT_INSTRUCTIONS_LEN: "  " })).toMatch(/EXPECT_REQUEST_HASH and EXPECT_INSTRUCTIONS_LEN/);
    expect(missingGuard({ EXPECT_REQUEST_HASH: "abc" })).toMatch(/^Refused: EXPECT_INSTRUCTIONS_LEN must be set/);
    expect(missingGuard({ EXPECT_INSTRUCTIONS_LEN: "100" })).toMatch(/^Refused: EXPECT_REQUEST_HASH must be set/);
  });

  it("G2: both set: not refused at this step", () => {
    expect(missingGuard({ EXPECT_REQUEST_HASH: "abc", EXPECT_INSTRUCTIONS_LEN: "100" })).toBeNull();
  });

  it("G3: a hash or length that does not match is refused, with both numbers", () => {
    const ok = { EXPECT_REQUEST_HASH: "0123456789", EXPECT_INSTRUCTIONS_LEN: "1,234" };
    expect(mismatchGuard(ok, "0123456789", 1234)).toBeNull();
    expect(mismatchGuard(ok, "ffffffffff", 1234)).toMatch(/request hash is ffffffffff, expected 0123456789/);
    expect(mismatchGuard(ok, "0123456789", 1235)).toMatch(/1235 characters, expected 1234/);
    expect(mismatchGuard(ok, "x", 1)).toMatch(/;/); // both problems in one message
  });
});

describe("the script itself", () => {
  it("G4: without the two variables it refuses at once, exit 1, no key loaded, no call", () => {
    const env = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } as unknown as unknown as NodeJS.ProcessEnv; // no EXPECT_, no GROQ_
    const r = spawnSync("npx", ["tsx", "scripts/evalCv.ts"], { env, encoding: "utf8", timeout: 60000 });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refused: EXPECT_REQUEST_HASH and EXPECT_INSTRUCTIONS_LEN must be set/);
    expect(r.stdout).toBe("");
  });

  it("G5: with the variables set but wrong, it still refuses before any call", () => {
    const env = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", EXPECT_REQUEST_HASH: "0000000000", EXPECT_INSTRUCTIONS_LEN: "1", GROQ_API_KEY: "dummy-not-a-key", GROQ_MODEL: "dummy" } as unknown as NodeJS.ProcessEnv;
    const r = spawnSync("npx", ["tsx", "scripts/evalCv.ts"], { env, encoding: "utf8", timeout: 60000 });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refused: request hash is/);
    expect(r.stdout).toBe("");
  });
});
