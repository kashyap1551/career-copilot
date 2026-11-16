import { isNotASkill, NEVER_MAP } from "../vocab";
import { nameKeys, slugOf } from "./skillIds";
import type { Skill } from "./types";

// Stage 2 of the name mapping: close spelling (docs/PLAN-5.1.md, "5.2 stage 2 rules and outcome definitions").
// Pure code: no AI, no network. Live since 2026-11-16 (step 5): reached through mapName and readNameId from fromAd
// and fromCv, after the not-a-skill flag.

// The distance counts insert, delete, replace, and a swap of two neighbouring letters, each as 1 (the "optimal string
// alignment" distance). Distances above `cap` are returned as cap + 1: the allowance never exceeds 2, so nothing
// farther can matter, and the search stays fast.
export function osaDistance(a: string, b: string, cap = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const n = a.length;
  const m = b.length;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m] > cap ? cap + 1 : prev[m];
}

// The allowance comes from the SHORTER of the two folded strings: up to 5 letters 0, 6 to 8 letters 1, 9 or more 2.
// (Changed 2026-11-16, before any measure: short names have the most ordinary-word and real-skill neighbours, "shift"
// and Swift, Flash and Flask. A typo in a name of 5 letters or fewer goes to the review list.)
export function allowanceFor(shorterLength: number): number {
  if (shorterLength <= 5) return 0;
  if (shorterLength <= 8) return 1;
  return 2;
}
const MAX_ALLOWANCE = 2;

export function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Is a distance `d` between the name's form `x` and a target's form `t` accepted? ONE function, used by closeMatch and
// by vocabPairs (the neighbour audit goes through mapName), so they cannot disagree. A distance of 1 is accepted
// anywhere, when the allowance is at least 1. A distance of 2 (only possible when the shorter string has 9 letters or
// more) is accepted only when the two strings share a common prefix of at least (shorter length - 3) letters: a second
// change only at the very end of a long word (a plural, -en, -ing, -ant), never at the start or in the middle.
// (Changed 2026-11-16, before any measure, from the neighbour audit: conference, confidence and influence reached
// Confluence; engineering reached BI engineering; negating prefixes such as "inaccessibility" reached Accessibility.)
export function acceptsDistance(x: string, t: string, d: number): boolean {
  const shorter = Math.min(x.length, t.length);
  if (d > allowanceFor(shorter)) return false;
  if (d <= 1) return true;
  return commonPrefixLength(x, t) >= shorter - 3;
}

// The NAME as compared: folded like stage 1 (case, accents, umlauts, ß), level and filler words and a trailing version
// dropped, then spaces, hyphens and dots dropped.
export function spellingForm(name: string): string {
  return nameKeys(name).plain.replace(/ /g, "");
}

// A TARGET as compared: folded and squashed only. Filler words are NOT dropped from a target, so a term such as
// "analytical skills" does not become "analytical" and reach an alias the owner left undecided.
function targetForm(text: string): string {
  return slugOf(text).replace(/-/g, "");
}

export type CloseTarget = { id: string; text: string; form: string };

const targetCache = new WeakMap<Skill[], CloseTarget[]>();

// Every name, German name and alias of every skill. Never an exactOnly skill; undecided aliases are not part of a
// skill's `aliases`, and the not-a-skill phrases are not skills, so neither is ever a target.
export function closeTargets(skills: Skill[]): CloseTarget[] {
  let targets = targetCache.get(skills);
  if (targets) return targets;
  targets = [];
  for (const s of skills) {
    if (s.exactOnly) continue;
    for (const text of [s.name, s.de, ...(s.aliases ?? [])]) {
      if (text === undefined) continue;
      const form = targetForm(text);
      if (form !== "") targets.push({ id: s.id, text, form });
    }
  }
  targetCache.set(skills, targets);
  return targets;
}

// Ordinary words and look-alike tools that are never mapped BY SPELLING (lib/vocab/data.ts, NEVER_MAP), compared after
// the same spelling fold as the name. Stage 1 (exact) is untouched.
const NEVER_FORMS = new Set(NEVER_MAP.map((n) => spellingForm(n.word)));

export type CloseResult =
  | { how: "close"; id: string; distance: number; via: string }
  | { how: "tie"; ids: string[] }
  | { how: "none" };

type PerSkill = { id: string; distance: number; ok: boolean; via: string };

// The smallest distance per skill id; the name maps only if exactly one skill id has the overall smallest distance and
// that distance is within the allowance. Two or more ids at the smallest distance, at least one within the allowance,
// is a tie (no mapping, the review list). The skills are compared with the exact stage already out of the way.
export function closeMatch(name: string, skills: Skill[]): CloseResult {
  // A name on the not-a-skill list never gets spelling help (docs/PLAN-5.1.md, "Changes before any measure", item 6):
  // with spaces dropped, a two-word phrase can sit one letter from a skill ("Personal development" and Persona
  // development). Stage 1 (exact) is untouched; it runs before this and does not call this function.
  if (isNotASkill(name)) return { how: "none" };
  const x = spellingForm(name);
  if (x === "") return { how: "none" };
  if (NEVER_FORMS.has(x)) return { how: "none" };
  const best = new Map<string, PerSkill>();
  for (const t of closeTargets(skills)) {
    const d = osaDistance(x, t.form, MAX_ALLOWANCE);
    if (d > MAX_ALLOWANCE) continue;
    const ok = acceptsDistance(x, t.form, d);
    const cur = best.get(t.id);
    if (!cur || d < cur.distance || (d === cur.distance && ok && !cur.ok)) {
      best.set(t.id, { id: t.id, distance: d, ok, via: t.text });
    }
  }
  if (best.size === 0) return { how: "none" };
  const dmin = Math.min(...[...best.values()].map((b) => b.distance));
  const closest = [...best.values()].filter((b) => b.distance === dmin);
  if (!closest.some((b) => b.ok)) return { how: "none" };
  if (closest.length >= 2) return { how: "tie", ids: closest.map((b) => b.id).sort() };
  const only = closest[0];
  return { how: "close", id: only.id, distance: only.distance, via: only.via };
}
