import { StoreError } from "./store";

// One record per ad text: the id is the first 16 hex characters of the SHA-256 of the TRIMMED ad text (the string the AI
// is sent). Web Crypto, so it runs in the browser and in Node 20 alike; hence async.
// A missing crypto.subtle (an old or locked-down browser) is reported as StoreError("unavailable"): the one exported
// function in lib/saved that throws, and saveJob (its only caller in the logic layer) catches it.
export async function jobIdFor(adText: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new StoreError("unavailable");
  const bytes = new TextEncoder().encode(adText.trim());
  const digest = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
