import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureRequestBody } from "@/lib/ai/requestBody";
import { READING_VERSION } from "@/lib/ai/readingVersion";
import { requestHash } from "@/lib/engine/evalFingerprint";

// The reading cache keys on READING_VERSION (lib/ai/readingVersion.ts). A cached reading is only as good as the request
// that made it, so the pair (READING_VERSION, ad request hash) is pinned: if the request hash changes (prompt, schema,
// settings, model) READING_VERSION must change in the same commit, and this pin is updated with both.

beforeEach(() => vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b"));
afterEach(() => vi.unstubAllEnvs());

describe("the pair (READING_VERSION, ad request hash)", () => {
  it("P1: READING_VERSION 1 goes with request hash 85357f8fac", async () => {
    const pair = `${READING_VERSION}|${requestHash(await captureRequestBody()).slice(0, 10)}`;
    expect(pair, "The ad request hash and READING_VERSION must change together: change READING_VERSION in lib/ai/readingVersion.ts when the request hash changes, then update this pin.").toBe("1|85357f8fac");
  });
});
