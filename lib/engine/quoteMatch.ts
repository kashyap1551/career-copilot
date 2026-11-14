import { normalizeText } from "./text";

// When is one quote "contained" in another? The eval pairs the AI's items with
// the key's by quote, and accepts extras by quote (docs/PLAN-3.2.md, "Short-
// quote guard"). A quote like "and" is inside almost any line, so containment
// only counts when the shorter quote has a real word. Equal quotes always
// count, whatever their length. Pure code.

const STOP_WORDS = new Set([
  "and", "or", "the", "for", "with", "of", "in", "to", "a", "an", "on", "as", "at", "by",
  "und", "oder", "der", "die", "das", "für", "mit", "von", "im", "zu", "ein", "eine",
]);

const MIN_WORD_LETTERS = 3;

// A real word: a run of letters (accents count as letters), at least 3 long,
// not in the stop list above.
export function hasRealWord(quote: string): boolean {
  const words = normalizeText(quote).match(/\p{L}+/gu) ?? [];
  return words.some((w) => w.length >= MIN_WORD_LETTERS && !STOP_WORDS.has(w));
}

// Both arguments must already be normalised. True when the shorter one is
// inside the longer one and has a real word. (Equal strings are handled by
// the caller: they always match.)
export function guardedContains(a: string, b: string): boolean {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter !== "" && longer.includes(shorter) && hasRealWord(shorter);
}

// Do two quotes match? Equal after normalising, or contained with the guard.
export function quotesMatch(a: string, b: string): boolean {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (x === "" || y === "") return false;
  return x === y || guardedContains(x, y);
}
