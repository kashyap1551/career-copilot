import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BULLETS_REQUEST_HASH } from "@/lib/ai/bulletsRequestHash";
import { captureBulletsRequestBody } from "@/lib/ai/bulletsRequestBody";
import { requestHash } from "@/lib/engine/evalFingerprint";

// Step 8.3 (docs/PLAN-8.3.md 0.23 and 0.24; test T23): the request hash of the bullets writer is pinned, call-free (the real writer runs on a fake fetch), the
// way tests/requestHashPins.test.ts pins the two readers. The value is the first 10 characters of the hash of the request body captured from the prompt v2
// text (3,011 characters) with the model openai/gpt-oss-120b. If the prompt, the answer schema (its descriptions included) or a setting changes on purpose,
// change this literal AND lib/ai/bulletsRequestHash.ts in the same commit, and say so in the plan.
const PINNED = "5e3da9fa30";

beforeEach(() => vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b"));
afterEach(() => vi.unstubAllEnvs());

describe("T23: the bullets request hash is pinned", () => {
  it("T23: the captured request hashes to the literal of this file and to BULLETS_REQUEST_HASH", async () => {
    const hash = requestHash(await captureBulletsRequestBody()).slice(0, 10);
    expect(hash).toBe(PINNED);
    expect(hash).toBe(BULLETS_REQUEST_HASH);
  });

  it("T23b: it differs from the ad pin 85357f8fac, the CV pin 193e02ee3f and the vocabulary pin e96370fe4c", () => {
    expect(PINNED).toHaveLength(10);
    for (const other of ["85357f8fac", "193e02ee3f", "e96370fe4c"]) expect(PINNED).not.toBe(other);
    expect(BULLETS_REQUEST_HASH).not.toBe("85357f8fac");
    expect(BULLETS_REQUEST_HASH).not.toBe("193e02ee3f");
    expect(BULLETS_REQUEST_HASH).not.toBe("e96370fe4c");
  });
});
