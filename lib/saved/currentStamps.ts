import { AD_REQUEST_HASH } from "../ai/adRequestHash";
import { READING_VERSION } from "../ai/readingVersion";
import { vocabHashWeb } from "../vocab/webHash";
import type { CurrentStamps } from "./types";

// The stamps of the code that is running now, for the browser (docs/PLAN-6.1.md, section 3): the FULL vocabulary hash
// (Web Crypto, equal to Node's vocabHash()), READING_VERSION and AD_REQUEST_HASH. It NEVER throws: if the hash cannot be
// computed (crypto.subtle is missing on an insecure page or in an old browser) the answer is { ok: false, reason:
// "unavailable" } and the page works without saving. No node: import.
export async function currentStamps(): Promise<{ ok: true; stamps: CurrentStamps } | { ok: false; reason: "unavailable" }> {
  try {
    const vocabularyHash = await vocabHashWeb();
    return { ok: true, stamps: { vocabularyHash, readingVersion: READING_VERSION, adRequestHash: AD_REQUEST_HASH } };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
