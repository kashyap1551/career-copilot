import { foldText } from "./text";

// Is the AI's company name the key's company name? Used by the eval scorer
// only (docs/DECISIONS.md, 2026-11-15). An ad often writes "DSV Holding Germany
// GmbH (Group)" where the key says "DSV": that is the same company.
//
// Right when the names are equal after cleaning, or when one starts with the
// other at a whole word and every extra word is a legal form or qualifier.
// Other extra words ("Schwab", "Labs", "Global Transport and Logistics") make
// it wrong, and so does a name that only starts with the same letters.

const QUALIFIERS = new Set(["gmbh", "ag", "se", "inc", "ltd", "llc", "plc", "kg", "holding", "group", "germany"]);

function words(name: string): string[] {
  return foldText(name)
    .replace(/\([^)]*\)/g, " ") // bracketed text
    .split(/[^a-z0-9]+/)
    .filter((w) => w !== "");
}

export function sameCompany(key: string, ai: string): boolean {
  const a = words(key);
  const b = words(ai);
  // Nothing left after cleaning: only identical text counts.
  if (a.length === 0 || b.length === 0) return foldText(key) === foldText(ai);

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (!short.every((w, i) => w === long[i])) return false;
  return long.slice(short.length).every((w) => QUALIFIERS.has(w));
}
