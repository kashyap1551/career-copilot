import { describe, expect, it } from "vitest";
import { vocabHash } from "@/lib/engine/vocabHash";
import { VOCAB } from "@/lib/vocab";
import { vocabHashWeb } from "@/lib/vocab/webHash";

// 6.1 part 2, step 4, test S12: the browser gets its own vocabulary hash (Web Crypto, async, no node: imports). ONE pure
// function builds the canonical text of the vocabulary; the Node hash and the web hash only hash that text, so they cannot
// drift apart. The Node result must stay e96370fe4c (its first 10 characters; the full value is 64 hex characters).
// Hand-worked: the web hash of the real vocabulary equals the Node hash and starts e96370fe4c; for each altered copy
// (one alias added; one skill name changed) the web hash is NOT e96370fe4c and EQUALS the Node hash of the same copy.

const PIN = "e96370fe4c";
const alias = VOCAB.map((e, i) => (i === 0 ? { ...e, aliases: [...e.aliases, "an alias added for this test"] } : e));
const renamed = VOCAB.map((e, i) => (i === 1 ? { ...e, name: e.name + " (renamed for this test)" } : e));

describe("S12: the web vocabulary hash equals the Node one", () => {
  it("S12a: for the real vocabulary: equal to Node vocabHash(), 64 hex characters, starting with the pinned e96370fe4c", async () => {
    const web = await vocabHashWeb();
    expect(web).toBe(vocabHash());
    expect(web).toMatch(/^[0-9a-f]{64}$/);
    expect(web.slice(0, 10)).toBe(PIN);
    expect(vocabHash().slice(0, 10)).toBe(PIN);
  });

  it("S12b: for an altered copy (one alias added): different from the pin, equal to the Node hash of the same copy", async () => {
    const web = await vocabHashWeb({ VOCAB: alias });
    expect(web.slice(0, 10)).not.toBe(PIN);
    expect(web).toBe(vocabHash({ VOCAB: alias }));
  });

  it("S12c: for an altered copy (one skill name changed): different from the pin and from the other copy, equal to the Node hash", async () => {
    const web = await vocabHashWeb({ VOCAB: renamed });
    expect(web.slice(0, 10)).not.toBe(PIN);
    expect(web).not.toBe(await vocabHashWeb({ VOCAB: alias }));
    expect(web).toBe(vocabHash({ VOCAB: renamed }));
  });
});
