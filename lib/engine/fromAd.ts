import type { ExtractedAd } from "../schemas/job";
import { datesInText } from "./dates";
import { languageCodeFor, levelFromWording } from "./languageWording";
import { skillIdFor } from "./skillIds";
import { foldText, isInAd, normalizeText } from "./text";
import type { Job, JobLanguage, Requirement, Skill } from "./types";

// Turns the AI's reading of an ad into the engine's Job, checking every claim
// against the ad's own text. Pure code: no AI, no network. The rules, with a
// hand-worked table, are in docs/PLAN-3.1.md. The AI reads; this decides.

export type RemovedWhat =
  | "title"
  | "company"
  | "location"
  | "workMode"
  | "minYears"
  | "startDate"
  | "language"
  | "languageLevel"
  | "otherCondition"
  | "requirement";

export type RemovalReason =
  | "not-in-ad"
  | "no-skill"
  | "number-not-in-quote"
  | "number-out-of-range"
  | "no-full-date"
  | "date-mismatch"
  | "level-not-in-quote"
  | "several-cities";

export type RemovedItem = { what: RemovedWhat; why: RemovalReason; text: string };

export type BuildResult = {
  job: Job;
  // Things the AI said that did not survive a check.
  removed: RemovedItem[];
  // Quotes added to otherConditions because a value failed its check, or a
  // language was not in the table.
  moved: { from: RemovedWhat; quote: string }[];
  // Skills whose names are not in the skill list, with their provisional ids.
  unlisted: Skill[];
};

const UNTITLED = "Untitled job";
const MIN_YEARS = 0;
const MAX_YEARS = 50;

// "Berlin or Munich", "Stuttgart/Karlsruhe", "Berlin & Potsdam"... A comma
// alone is not a separator ("Berlin, Germany" is one place).
const SEVERAL_CITIES = /\s(?:or|and|und|oder|&)\s|[/;]/i;

const NUMBER_WORDS: Record<number, string[]> = {
  1: ["one", "ein", "eine", "einem", "einen", "eins"],
  2: ["two", "zwei"],
  3: ["three", "drei"],
  4: ["four", "vier"],
  5: ["five", "funf", "fuenf"],
  6: ["six", "sechs"],
  7: ["seven", "sieben"],
  8: ["eight", "acht"],
  9: ["nine", "neun"],
  10: ["ten", "zehn"],
  11: ["eleven", "elf"],
  12: ["twelve", "zwolf", "zwoelf"],
};

// Does this number appear in the quote, as digits or as a word? "2" is not
// found inside "12".
function numberInQuote(n: number, quote: string): boolean {
  const folded = foldText(quote);
  const digits = String(n).replace(/\./g, "\\.");
  if (new RegExp(`(?<![\\d.,])${digits}(?!\\d)`).test(folded)) return true;
  return (NUMBER_WORDS[n] ?? []).some((w) => new RegExp(`\\b${w}\\b`).test(folded));
}

export function buildJob(
  ex: ExtractedAd,
  adText: string,
  skills: Skill[],
  meta: { id: string; source: string | null },
): BuildResult {
  const removed: RemovedItem[] = [];
  const moved: BuildResult["moved"] = [];

  const drop = (what: RemovedWhat, why: RemovalReason, text: string) =>
    removed.push({ what, why, text });

  // ---- otherConditions: the AI's own items first, then anything moved here.
  const conditions: string[] = [];
  const seen = new Set<string>();
  const addCondition = (quote: string, from?: RemovedWhat) => {
    const key = normalizeText(quote);
    if (seen.has(key)) return;
    seen.add(key);
    conditions.push(quote.trim());
    if (from) moved.push({ from, quote: quote.trim() });
  };
  for (const c of ex.otherConditions) {
    if (!isInAd(c.quote, adText)) drop("otherCondition", "not-in-ad", c.quote);
    else addCondition(c.quote);
  }

  // ---- title, company
  let title = UNTITLED;
  if (ex.title !== null) {
    if (isInAd(ex.title, adText)) title = ex.title.trim();
    else drop("title", "not-in-ad", ex.title);
  }
  let company: string | null = null;
  if (ex.company !== null) {
    if (isInAd(ex.company, adText)) company = ex.company.trim();
    else drop("company", "not-in-ad", ex.company);
  }

  // ---- location
  let location: string | null = null;
  if (ex.location !== null) {
    if (!isInAd(ex.location, adText)) {
      drop("location", "not-in-ad", ex.location);
    } else if (SEVERAL_CITIES.test(ex.location)) {
      drop("location", "several-cities", ex.location);
      addCondition(ex.location, "location");
    } else {
      location = ex.location.trim();
    }
  }

  // ---- work mode
  let remote: Job["constraints"]["remote"] = null;
  if (ex.workMode !== null) {
    if (isInAd(ex.workMode.quote, adText)) remote = ex.workMode.value;
    else drop("workMode", "not-in-ad", ex.workMode.quote);
  }

  // ---- years of experience
  let minYears: number | null = null;
  if (ex.minYears !== null) {
    const { years, quote } = ex.minYears;
    if (!isInAd(quote, adText)) {
      drop("minYears", "not-in-ad", quote);
    } else if (!Number.isFinite(years) || years < MIN_YEARS || years > MAX_YEARS) {
      drop("minYears", "number-out-of-range", quote);
      addCondition(quote, "minYears");
    } else if (!numberInQuote(years, quote)) {
      drop("minYears", "number-not-in-quote", quote);
      addCondition(quote, "minYears");
    } else {
      minYears = years;
    }
  }

  // ---- start date: read out of the quote, and the AI's date must be one of them
  let startDate: string | null = null;
  if (ex.startDate !== null) {
    const { date, quote } = ex.startDate;
    if (!isInAd(quote, adText)) {
      drop("startDate", "not-in-ad", quote);
    } else {
      const inQuote = datesInText(quote);
      if (inQuote.length === 0) {
        drop("startDate", "no-full-date", quote);
        addCondition(quote, "startDate");
      } else if (!inQuote.includes(date)) {
        drop("startDate", "date-mismatch", quote);
        addCondition(quote, "startDate");
      } else {
        startDate = date;
      }
    }
  }

  // ---- languages
  const languages: JobLanguage[] = [];
  for (const l of ex.languages) {
    if (!isInAd(l.quote, adText)) {
      drop("language", "not-in-ad", l.quote);
      continue;
    }
    const code = languageCodeFor(l.language);
    if (code === null) {
      addCondition(l.quote, "language"); // not in the table: never guessed
      continue;
    }
    if (languages.some((x) => x.code === code)) continue; // the first one stays

    const wording = l.levelWording?.trim() ? l.levelWording : null;
    let level: JobLanguage["level"] = null;
    if (wording !== null) {
      if (normalizeText(l.quote).includes(normalizeText(wording))) {
        level = levelFromWording(wording);
      } else {
        drop("languageLevel", "level-not-in-quote", wording);
      }
    }
    languages.push({ code, level });
  }

  // ---- requirements
  const requirements: Requirement[] = [];
  const keys = new Map<string, Requirement>();
  const unlistedById = new Map<string, Skill>();
  for (const item of ex.requirements) {
    if (!isInAd(item.quote, adText)) {
      drop("requirement", "not-in-ad", item.quote);
      continue;
    }
    const ids: string[] = [];
    const pending: Skill[] = [];
    for (const { name } of item.skills) {
      const hit = skillIdFor(name, skills);
      if (hit === null || ids.includes(hit.id)) continue;
      ids.push(hit.id);
      if (!hit.listed) pending.push({ id: hit.id, name: name.trim() });
    }
    if (ids.length === 0) {
      drop("requirement", "no-skill", item.quote);
      continue;
    }

    const key = `${normalizeText(item.quote)}|${[...ids].sort().join(",")}`;
    const existing = keys.get(key);
    if (existing) {
      if (item.importance === "must") existing.importance = "must";
      continue;
    }
    const requirement: Requirement = {
      skillIds: ids,
      importance: item.importance,
      quote: item.quote.trim(),
    };
    keys.set(key, requirement);
    requirements.push(requirement);
    for (const s of pending) if (!unlistedById.has(s.id)) unlistedById.set(s.id, s);
  }

  return {
    job: {
      id: meta.id,
      title,
      company,
      source: meta.source,
      constraints: {
        languages,
        location,
        remote,
        minYears,
        startDate,
        otherConditions: conditions.map((quote) => ({ quote })),
      },
      requirements,
    },
    removed,
    moved,
    unlisted: [...unlistedById.values()],
  };
}
