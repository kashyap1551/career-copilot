import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INSTRUCTIONS_CHECK } from "@/lib/ai/checkEvidence";
import { captureCheckRequestBody } from "@/lib/ai/checkRequestBody";
import { requestHash } from "@/lib/engine/evalFingerprint";
import type { SentEntry, SentRequirement } from "@/lib/engine/evidenceProof";

// EC-3a (docs/PLAN-EVERY-CV.md section 7; tests CP1 to CP4): the request hash of the evidence check is pinned, call-free (the real checkEvidence runs on a
// fake fetch), the way tests/requestHashPins.test.ts pins the two readers. The pinned request is made with the four example requirements and entries of the
// prompt and GROQ_MODEL openai/gpt-oss-120b. Like the CV pin there is NO hash constant in lib: the literal lives only here. If the prompt, the answer schema or
// a setting changes on purpose, change this literal in the same commit and say so in docs/DECISIONS.md.
const PINNED = "61d7628d46";

const R = (n: number, quote: string): SentRequirement => ({ n, index: n - 1, quote, importance: "must" });
const E = (n: number, name: string, text: string): SentEntry => ({ n, name, skillId: `new:e${n}`, line: n + 1, text, inferred: false });
const REQS = ["Mends sails and rigging", "Has run a ferry rota for five seasons", "Can polish brass or copper fittings", "Speaks Portuguese at work"].map((q, i) => R(i + 1, q));
const ENTRIES = [
  E(1, "Sail repair", "Stitched torn sails and spliced new rope on two sloops"),
  E(2, "Crossing plans", "Drew up the fortnightly crossing plan for the island boat"),
  E(3, "Lantern care", "Polished the brass lantern of the quay beacon each dawn"),
  E(4, "Basque", "Chatted in Basque with visitors at the quay café"),
];

beforeEach(() => vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b"));
afterEach(() => vi.unstubAllEnvs());

describe("EC-3a the check request hash is pinned", () => {
  it("CP1: the captured request hashes to the literal of this file", async () => {
    expect(requestHash(await captureCheckRequestBody(REQS, ENTRIES)).slice(0, 10)).toBe(PINNED);
  });

  it("CP2: it differs from the ad pin 85357f8fac, the CV pin 193e02ee3f, the vocabulary pin e96370fe4c and the bullets pin 5e3da9fa30", () => {
    expect(PINNED).toHaveLength(10);
    for (const other of ["85357f8fac", "193e02ee3f", "e96370fe4c", "5e3da9fa30"]) expect(PINNED).not.toBe(other);
  });

  it("CP3: the same capture with another GROQ_MODEL gives another hash", async () => {
    const a = requestHash(await captureCheckRequestBody(REQS, ENTRIES));
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
    expect(requestHash(await captureCheckRequestBody(REQS, ENTRIES))).not.toBe(a);
  });

  it("CP4: the instruction text is 2,665 characters", () => {
    expect(INSTRUCTIONS_CHECK.length).toBe(2665);
  });
});
