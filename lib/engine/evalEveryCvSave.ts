// Saved readings of the baseline run (docs/PLAN-EVERY-CV.md section 5, "The baseline is reused"): the checked result of one CV read or one
// ad read, with the fingerprint of the run, the commit of the key files and the tokens of the call. Pure text in, text out: this file reads
// and writes no file. A saved reading is only used again when its fingerprint is today's: the readings depend on the prompts, the schemas,
// the model, the settings and the vocabulary, and a reading made under other ones would give a number that means something else.

export type ReadingMeta = {
  pair: string;
  kind: "cv" | "ad";
  fingerprint: string;
  keyCommit: string;
  tokens: { input: number; output: number };
};
export type SavedReading<T> = ReadingMeta & { reading: T };

export function savedReadingText<T>(meta: ReadingMeta, reading: T): string {
  return JSON.stringify({ ...meta, reading }, null, 2) + "\n";
}

export function loadSavedReading<T>(text: string, todaysFingerprint: string): { ok: true; saved: SavedReading<T> } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: "This is not a saved reading (it is not readable)." };
  }
  const o = raw as Partial<SavedReading<T>> | null;
  if (
    typeof o !== "object" || o === null ||
    typeof o.fingerprint !== "string" || typeof o.pair !== "string" || typeof o.keyCommit !== "string" ||
    (o.kind !== "cv" && o.kind !== "ad") || typeof o.tokens !== "object" || o.tokens === null || o.reading === undefined
  ) {
    return { ok: false, reason: "This is not a saved reading (a field is missing)." };
  }
  if (o.fingerprint !== todaysFingerprint) {
    return { ok: false, reason: "This reading was made with a different prompt, schema, model, settings, vocabulary or material than today's, so it is not used." };
  }
  return { ok: true, saved: o as SavedReading<T> };
}
