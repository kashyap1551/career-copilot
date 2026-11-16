import { createHash } from "node:crypto";

// "Two full runs in a row" only counts when nothing that could change the
// answers changed: everything the model is sent (the instructions, the JSON
// schema with its descriptions, the model name, the settings), the ad texts and
// the keys. The request is the body readJobAd really sends (lib/ai/requestBody.ts),
// so anything that changes the request changes the fingerprint.
//
// Format 1 (before 2026-11-15, step 3.3) hashed the instructions, the model name
// and the settings only, and missed the schema descriptions. Reports written
// then carry no fingerprint line; format 2 reports say "fingerprint format 2".
//
// Format 3 (2026-11-16, Day 5) adds the vocabulary: the eval scores names by the ids the vocabulary gives them, so
// the same answers from the model score differently when the vocabulary changes. A format 3 report carries a
// "vocab" hash (over the skills, the not-a-skill phrases and the names left unlisted on purpose). Every number
// measured before this (format 1 and 2) was measured on the 17-skill list and is not comparable.

export const FINGERPRINT_FORMAT = 3;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// JSON with the keys in sorted order, so the same content is the same text.
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export type FingerprintInput = {
  request: unknown; // the request body sent to Groq
  ads: { id: string; text: string; key: unknown }[];
  vocabulary: string; // vocabularyHash(...) of the vocabulary in use (format 3 and later)
};

// A hash of the vocabulary data (the skills, the not-a-skill phrases, the names left unlisted on purpose).
export function vocabularyHash(data: unknown): string {
  return sha(stableStringify(data));
}

export function requestHash(request: unknown): string {
  return sha(stableStringify(request));
}

export function evalFingerprint(input: FingerprintInput, format: number = FINGERPRINT_FORMAT): string {
  return sha(
    [
      `fingerprint format ${format}`,
      stableStringify(input.request),
      ...(format >= 3 ? [`vocabulary ${input.vocabulary}`] : []),
      ...input.ads.map((a) => `${a.id}:${sha(a.text)}:${sha(stableStringify(a.key))}`),
    ].join("\n"),
  );
}

// The line printed in a report.
export function fingerprintLine(
  request: unknown,
  instructionsLength: number,
  fingerprint?: string,
  vocabulary?: string,
): string {
  return `FINGERPRINT: format ${FINGERPRINT_FORMAT} | request ${requestHash(request).slice(0, 10)}${fingerprint ? ` | full ${fingerprint.slice(0, 10)}` : ""}${vocabulary ? ` | vocab ${vocabulary.slice(0, 10)}` : ""} | INSTRUCTIONS ${instructionsLength.toLocaleString("en-US")} characters\n`;
}
