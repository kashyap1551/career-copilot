import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureCvRequestBody } from "@/lib/ai/cvRequestBody";
import { captureRequestBody } from "@/lib/ai/requestBody";
import { requestHash } from "@/lib/engine/evalFingerprint";

// The request hashes of the two readers are pinned (call-free: the real readers run on a fake fetch). Day 5 changed
// the vocabulary, not the prompts or schemas, so they must still read what they read before: the ad request
// 85357f8fac and the CV request 193e02ee3f (with the model openai/gpt-oss-120b). If a prompt, a schema description
// or a setting changes on purpose, change the pin in the same commit and say so in docs/DECISIONS.md.

beforeEach(() => vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b"));
afterEach(() => vi.unstubAllEnvs());

describe("the request hashes", () => {
  it("P1: the ad request hash is 85357f8fac", async () => {
    expect(requestHash(await captureRequestBody()).slice(0, 10)).toBe("85357f8fac");
  });

  it("P2: the CV request hash is 193e02ee3f", async () => {
    expect(requestHash(await captureCvRequestBody()).slice(0, 10)).toBe("193e02ee3f");
  });
});
