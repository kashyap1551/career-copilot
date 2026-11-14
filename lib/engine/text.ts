// How text from the AI is compared with the ad it came from. Pure code.
// The rules are in docs/PLAN-3.1.md, section 0.

// Lowercase, one space between words, and the look-alike characters real ads
// use (curly quotes, long dashes, non-breaking spaces) turned into plain ones.
export function normalizeText(s: string): string {
  return s
    .normalize("NFKC") // also turns a non-breaking space into a space
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'") // curly single quotes
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"') // curly double quotes
    .replace(/[\u2010-\u2015\u2212]/g, "-") // hyphens, en and em dashes, minus
    .replace(/\s+/g, " ")
    .trim();
}

// Like normalizeText, and with accents removed and ß written as ss, for
// comparing names and words ("Französisch" and "franzosisch" are the same).
export function foldText(s: string): string {
  return normalizeText(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // the accent marks left after NFD
    .replace(/\u00df/g, "ss");
}

// Is this quote really in the ad? An empty quote never is.
export function isInAd(quote: string, adText: string): boolean {
  const q = normalizeText(quote);
  return q !== "" && normalizeText(adText).includes(q);
}
