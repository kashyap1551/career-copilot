// One record per ad text: the id is the first 16 hex characters of the SHA-256 of the TRIMMED ad text (the string the AI
// is sent). Web Crypto, so it runs in the browser and in Node 20 alike; hence async.
export async function jobIdFor(adText: string): Promise<string> {
  const bytes = new TextEncoder().encode(adText.trim());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}
