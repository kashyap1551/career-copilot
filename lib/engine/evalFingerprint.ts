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

export const FINGERPRINT_FORMAT = 2;

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
};

export function requestHash(request: unknown): string {
  return sha(stableStringify(request));
}

export function evalFingerprint(input: FingerprintInput, format: number = FINGERPRINT_FORMAT): string {
  return sha(
    [
      `fingerprint format ${format}`,
      stableStringify(input.request),
      ...input.ads.map((a) => `${a.id}:${sha(a.text)}:${sha(stableStringify(a.key))}`),
    ].join("\n"),
  );
}

// The line printed in a report.
export function fingerprintLine(request: unknown, instructionsLength: number, fingerprint?: string): string {
  return `FINGERPRINT: format ${FINGERPRINT_FORMAT} | request ${requestHash(request).slice(0, 10)}${fingerprint ? ` | full ${fingerprint.slice(0, 10)}` : ""} | INSTRUCTIONS ${instructionsLength.toLocaleString("en-US")} characters\n`;
}
