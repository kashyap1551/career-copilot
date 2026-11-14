import { datesInText } from "./dates";
import { numberInQuote } from "./fromAd";
import { isInAd } from "./text";
import { LANGUAGE_LEVELS, type LanguageLevel, type WorkMode } from "./types";

// The hand-labelled answer key for one ad (docs/PLAN-3.2.md, section 3). Pure
// types and checks. A key is drafted from the ad text alone, before the AI has
// read that ad, and is only scored once the owner has marked it "reviewed".

export type KeyRequirement = {
  quote: string; // the ad's own words
  importance: "must" | "nice";
  skills: string[]; // skill names; several mean "any one of these" (an "or")
};

export type AnswerKey = {
  ad: string; // "ad-01"
  status: "draft" | "reviewed";
  title: string | null;
  company: string | null;
  location: string | null; // the city only
  workMode: { value: WorkMode; quote: string } | null;
  minYears: { years: number; quote: string } | null;
  startDate: { date: string; quote: string } | null; // "YYYY-MM-DD"
  languages: { code: string; level: LanguageLevel | null; quote: string }[];
  otherConditions: { quote: string }[];
  requirements: KeyRequirement[];
  // Real lines the key forgot. The AI returning one is not "invented".
  acceptedExtras: { quote: string }[];
  // For a known injection case: the company the injected line asks for.
  injectedCompany?: string;
  // The labeller's doubts. Never scored.
  notes?: string;
};

// A problem names the place in the key, never the text, so that checking a
// holdout key cannot leak what is in it.
export type KeyProblem = { where: string; problem: string };

export function checkKey(key: AnswerKey, adText: string): KeyProblem[] {
  const found: KeyProblem[] = [];
  const add = (where: string, problem: string) => {
    if (!found.some((p) => p.where === where)) found.push({ where, problem });
  };
  const quoteIn = (where: string, quote: string) => {
    if (!isInAd(quote, adText)) add(where, "quote is not in the ad");
  };

  if (key.status !== "draft" && key.status !== "reviewed") add("status", "must be draft or reviewed");

  for (const field of ["title", "company", "location"] as const) {
    const value = key[field];
    if (value !== null && !isInAd(value, adText)) add(field, "value is not in the ad");
  }

  if (key.workMode) quoteIn("workMode", key.workMode.quote);

  if (key.minYears) {
    const { years, quote } = key.minYears;
    quoteIn("minYears", quote);
    if (!Number.isFinite(years) || years < 0 || years > 50) add("minYears", "years out of range");
    else if (!numberInQuote(years, quote)) add("minYears", "number is not in its quote");
  }

  if (key.startDate) {
    const { date, quote } = key.startDate;
    quoteIn("startDate", quote);
    if (!datesInText(quote).includes(date)) add("startDate", "date is not one of the dates in its quote");
  }

  key.languages.forEach((l, i) => {
    const where = `languages[${i}]`;
    quoteIn(where, l.quote);
    if (!/^[a-z]{2}$/.test(l.code)) add(where, "code must be two lower-case letters");
    if (l.level !== null && !LANGUAGE_LEVELS.includes(l.level)) add(where, "level must be A1 to C2 or null");
  });

  key.otherConditions.forEach((c, i) => quoteIn(`otherConditions[${i}]`, c.quote));

  key.requirements.forEach((r, i) => {
    const where = `requirements[${i}]`;
    quoteIn(where, r.quote);
    if (r.importance !== "must" && r.importance !== "nice") add(where, "importance must be must or nice");
    if (r.skills.length === 0 || r.skills.some((s) => s.trim() === "")) add(where, "needs at least one real skill name");
  });

  key.acceptedExtras.forEach((e, i) => quoteIn(`acceptedExtras[${i}]`, e.quote));

  return found;
}
