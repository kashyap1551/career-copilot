import { afterEach, describe, expect, it, vi } from "vitest";
import { vocabHash } from "@/lib/engine/vocabHash";
import { currentStamps } from "@/lib/saved/currentStamps";

// 6.1 part 3a, step 3: the stamps of the code that is running now, for the browser. Hand-worked expectation: in Node
// (Web Crypto exists) the answer is ok with the FULL vocabulary hash (equal to Node's vocabHash()), READING_VERSION "3"
// and the ad request hash "85357f8fac". With crypto.subtle missing (an insecure page, an old browser) it does not throw:
// it answers { ok: false, reason: "unavailable" }.

afterEach(() => vi.unstubAllGlobals());

describe("currentStamps", () => {
  it("K1: in Node: ok, with the three stamps", async () => {
    const r = await currentStamps();
    expect(r).toEqual({ ok: true, stamps: { vocabularyHash: vocabHash(), readingVersion: "3", adRequestHash: "85357f8fac" } });
    if (r.ok) expect(r.stamps.vocabularyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("K2: with crypto missing (stubbed away) it answers unavailable and does not throw", async () => {
    vi.stubGlobal("crypto", undefined);
    await expect(currentStamps()).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("K3: with crypto present but without subtle: the same", async () => {
    vi.stubGlobal("crypto", {});
    await expect(currentStamps()).resolves.toEqual({ ok: false, reason: "unavailable" });
  });
});
