// The fresh-set capture (docs/PLAN-5.1.md): read each fresh ad once with the live reader, keep the raw skill names
// the AI returned (before any mapping or flagging), and make a labels file to fill in. Pure code: the reader is
// passed in, so the tests use a fake one and no AI is called. Counts are printed; a name never is.

// Distinct by case-insensitive trimmed form, the first spelling kept, sorted case-insensitively; blanks are dropped.
export function distinctNames(lists: string[][]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list) {
      const name = raw.trim();
      if (name === "") continue;
      const key = name.toLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, name]) => name);
}

export function labelsTodo(names: string[]): { set: "fresh"; names: Record<string, string> } {
  return { set: "fresh", names: Object.fromEntries(names.map((n) => [n, "TODO"])) };
}

// The first capture is the record: labelling work is never overwritten.
export function refusalFor(existingFiles: string[]): string | null {
  const hit = ["fresh-labels-TODO.json", "fresh-labels.json"].filter((f) => existingFiles.includes(f));
  if (hit.length === 0) return null;
  return `Refused: ${hit.join(" and ")} already exists. The first capture is the record; labelling work is never overwritten. Nothing was read.`;
}

export type FreshDeps = {
  ads: { id: string; text: string }[];
  read: (text: string) => Promise<{ names: string[]; tokens: number }>;
};

export type FreshResult = {
  perAd: { id: string; names: number }[];
  calls: number; // calls that worked
  tokens: number;
  failed: string[];
  distinct: string[] | null; // null when any call failed: then nothing is written
};

// One call per ad, in order, no retry (the live product reads an ad once). A failed call stops the capture, so a
// partial capture can never become "the record".
export async function captureFresh(deps: FreshDeps): Promise<FreshResult> {
  const result: FreshResult = { perAd: [], calls: 0, tokens: 0, failed: [], distinct: [] };
  const lists: string[][] = [];
  for (const ad of deps.ads) {
    try {
      const out = await deps.read(ad.text);
      result.calls++;
      result.tokens += out.tokens;
      result.perAd.push({ id: ad.id, names: out.names.length });
      lists.push(out.names);
    } catch {
      result.failed.push(ad.id);
      result.distinct = null;
      return result; // the reason is never printed: it could carry text from an ad
    }
  }
  result.distinct = distinctNames(lists);
  return result;
}

export function summaryLines(r: FreshResult): string[] {
  const lines = [
    `CAPTURE FRESH (counts only): ads read ${r.perAd.length} | calls made ${r.calls} | tokens ${r.tokens.toLocaleString("en-US")} | distinct names ${r.distinct === null ? "n/a" : r.distinct.length}`,
    `names per ad: ${r.perAd.map((a) => `${a.id} ${a.names}`).join(", ") || "none"}`,
  ];
  if (r.failed.length > 0) lines.push(`FAILED: ${r.failed.join(", ")}: the capture stopped and nothing was written`);
  return lines;
}
