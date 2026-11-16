import { vocabularyCanonicalText, type VocabParts } from "./canonical";

// The vocabulary hash for the BROWSER (Web Crypto, async, no node: import; Node 20 has the same API, so the tests run it
// too). It hashes the canonical text of ./canonical.ts and returns 64 hex characters, equal to Node's vocabHash(); the
// first 10 are the short form printed everywhere (e96370fe4c).
export async function vocabHashWeb(parts: Partial<VocabParts> = {}): Promise<string> {
  const bytes = new TextEncoder().encode(vocabularyCanonicalText(parts));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
