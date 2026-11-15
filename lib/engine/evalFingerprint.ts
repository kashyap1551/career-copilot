import { createHash } from "node:crypto";

// "Two full runs in a row" only counts when nothing that could change the
// answers changed: the prompt, the model, how the model is asked (the
// settings), the ad texts and the keys. This builds the one string for that
// and hashes it. A changed setting is a different fingerprint.

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export type FingerprintInput = {
  instructions: string;
  model: string;
  settings: unknown;
  ads: { id: string; text: string; key: unknown }[];
};

export function evalFingerprint(input: FingerprintInput): string {
  return sha(
    [
      input.instructions,
      input.model,
      JSON.stringify(input.settings),
      ...input.ads.map((a) => `${a.id}:${sha(a.text)}:${sha(JSON.stringify(a.key))}`),
    ].join("\n"),
  );
}
