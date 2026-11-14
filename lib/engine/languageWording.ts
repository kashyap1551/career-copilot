import { foldText } from "./text";
import type { LanguageLevel } from "./types";

// An ad's words for a language level, and a language's name, turned into the
// engine's level and two-letter code. Pure code. The mapping is written down
// once in docs/DECISIONS.md (the language wording line) and the tests follow
// the table in docs/PLAN-3.1.md.

// Keys are compared with accents stripped and ß as ss, as whole words.
// "advanced", "intermediate" and "upper intermediate" are deliberately not
// here: too vague to place on the scale, so they give null.
const KEYS: [string, LanguageLevel][] = [
  ["native speaker", "C2"],
  ["native", "C2"],
  ["mother tongue", "C2"],
  ["muttersprache", "C2"],
  ["business fluent", "C1"],
  ["fluent", "C1"],
  ["conversational", "B1"],
  ["good", "B2"],
  ["basic", "A2"],
  ["grundkenntnisse", "A2"],
  ["basiskenntnisse", "A2"],
];

// German adjectives also match with their endings: gutes, gutem, fließende,
// verhandlungssicheres... The stem must be a whole word with at most one of
// these endings, so "gutachten" and "fließband" stay unmatched (step 3.2a).
const GERMAN_STEMS: [string, LanguageLevel][] = [
  ["muttersprachlich", "C2"],
  ["fliessend", "C1"],
  ["verhandlungssicher", "C1"],
  ["gut", "B2"],
];
const ENDINGS = "(?:e|em|en|er|es)?";

// Longest key first, so "business fluent" is tried before "fluent".
const KEY_PATTERNS = [
  ...KEYS.map(([key, level]) => ({ key, level, pattern: new RegExp(`\\b${key}\\b`) })),
  ...GERMAN_STEMS.map(([key, level]) => ({
    key,
    level,
    pattern: new RegExp(`\\b${key}${ENDINGS}\\b`),
  })),
]
  .sort((a, b) => b.key.length - a.key.length)
  .map(({ pattern, level }) => [pattern, level] as const);

// A stated level (A1 to C2, as a whole word) wins. Otherwise the first key
// found, longest first. Nothing found gives null: "not stated" beats a guess.
export function levelFromWording(wording: string | null | undefined): LanguageLevel | null {
  if (!wording) return null;
  const folded = foldText(wording);
  const stated = folded.match(/\b([abc][12])\b/);
  if (stated) return stated[1].toUpperCase() as LanguageLevel;
  for (const [pattern, level] of KEY_PATTERNS) {
    if (pattern.test(folded)) return level;
  }
  return null;
}

// Language names (English and German) to two-letter codes.
const NAMES: Record<string, string[]> = {
  en: ["english", "englisch"],
  de: ["german", "deutsch"],
  fr: ["french", "franzosisch"],
  es: ["spanish", "spanisch"],
  it: ["italian", "italienisch"],
  pt: ["portuguese", "portugiesisch"],
  nl: ["dutch", "niederlandisch"],
  pl: ["polish", "polnisch"],
  tr: ["turkish", "turkisch"],
  ru: ["russian", "russisch"],
  ar: ["arabic", "arabisch"],
  zh: ["chinese", "chinesisch", "mandarin"],
  ja: ["japanese", "japanisch"],
  ko: ["korean", "koreanisch"],
  ro: ["romanian", "rumanisch"],
  hu: ["hungarian", "ungarisch"],
  uk: ["ukrainian", "ukrainisch"],
  sv: ["swedish", "schwedisch"],
  da: ["danish", "danisch"],
  no: ["norwegian", "norwegisch"],
  fi: ["finnish", "finnisch"],
  cs: ["czech", "tschechisch"],
  el: ["greek", "griechisch"],
  hi: ["hindi"],
  kn: ["kannada"],
};

const CODE_BY_NAME = new Map<string, string>(
  Object.entries(NAMES).flatMap(([code, names]) => names.map((n) => [n, code] as const)),
);

// null when the name is not in the table. Never guessed.
export function languageCodeFor(name: string): string | null {
  return CODE_BY_NAME.get(foldText(name)) ?? null;
}
