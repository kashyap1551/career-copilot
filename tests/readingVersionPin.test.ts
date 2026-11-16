import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureRequestBody } from "@/lib/ai/requestBody";
import { AD_REQUEST_HASH } from "@/lib/ai/adRequestHash";
import { readingKey } from "@/lib/ai/readCache";
import { READING_VERSION } from "@/lib/ai/readingVersion";
import { requestHash } from "@/lib/engine/evalFingerprint";

// The reading cache keys on READING_VERSION (lib/ai/readingVersion.ts). A cached reading is only as good as the request
// that made it, so the pair (READING_VERSION, ad request hash) is pinned: if the request hash changes (prompt, schema,
// settings, model) READING_VERSION must change in the same commit, and this pin is updated with both.

beforeEach(() => vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b"));
afterEach(() => vi.unstubAllEnvs());

describe("the pair (READING_VERSION, ad request hash)", () => {
  it("P1: READING_VERSION 3 goes with request hash 85357f8fac (3 = the answer carries `extraction`, step 6.1)", async () => {
    const pair = `${READING_VERSION}|${requestHash(await captureRequestBody()).slice(0, 10)}`;
    expect(pair, "The ad request hash and READING_VERSION must change together: change READING_VERSION in lib/ai/readingVersion.ts when the request hash changes, then update this pin.").toBe("3|85357f8fac");
  });

  it("P2: AD_REQUEST_HASH equals the hash computed in Node from the real instructions", async () => {
    const computed = requestHash(await captureRequestBody()).slice(0, 10);
    expect(AD_REQUEST_HASH, "the ad instructions changed: update AD_REQUEST_HASH AND bump READING_VERSION").toBe(computed);
    expect(AD_REQUEST_HASH).toBe("85357f8fac");
  });

  it("P3: the same ad under version 2 and under version 3 is two different cache keys", () => {
    expect(readingKey("The same ad.", { version: "2" })).not.toBe(readingKey("The same ad.", { version: "3" }));
    expect(readingKey("The same ad.", { version: "3" })).toBe(readingKey("The same ad.", { version: READING_VERSION }));
  });
});
