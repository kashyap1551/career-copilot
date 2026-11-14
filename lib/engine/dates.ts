import { foldText } from "./text";

// Reads the full calendar dates written in a piece of text. Pure code. Only a
// full day counts (day, month and a four-digit year); "March 2027" and
// "Q1 2027" give nothing. Formats: 2027-03-01, 01.03.2027 (day first),
// 1 March 2027 (also 1st, and 1. März), March 1, 2027 (also March 1st),
// with English and German full month names.

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  januar: 1, februar: 2, marz: 3, maerz: 3, mai: 5, juni: 6, juli: 7,
  oktober: 10, dezember: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const DOTTED = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
const DAY_MONTH_YEAR = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+(?:of\\s+)?(${MONTH_NAMES})\\s*,?\\s*(\\d{4})\\b`,
  "g",
);
const MONTH_DAY_YEAR = new RegExp(
  `\\b(${MONTH_NAMES})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s+(\\d{4})\\b`,
  "g",
);

function isRealDay(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of next month = last day
}

function iso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Every full date in the text, as YYYY-MM-DD, in the order they appear, once each.
export function datesInText(text: string): string[] {
  const folded = foldText(text);
  const found: { at: number; date: string }[] = [];

  const add = (at: number, y: number, m: number, d: number) => {
    if (isRealDay(y, m, d)) found.push({ at, date: iso(y, m, d) });
  };

  for (const m of folded.matchAll(ISO)) add(m.index, +m[1], +m[2], +m[3]);
  for (const m of folded.matchAll(DOTTED)) add(m.index, +m[3], +m[2], +m[1]);
  for (const m of folded.matchAll(DAY_MONTH_YEAR)) add(m.index, +m[3], MONTHS[m[2]], +m[1]);
  for (const m of folded.matchAll(MONTH_DAY_YEAR)) add(m.index, +m[3], MONTHS[m[1]], +m[2]);

  found.sort((a, b) => a.at - b.at);
  return [...new Set(found.map((f) => f.date))];
}
