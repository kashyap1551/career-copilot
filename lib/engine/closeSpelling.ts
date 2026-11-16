import { nameKeys, slugOf } from "./skillIds";
import type { Skill } from "./types";

// Stage 2 of the name mapping: close spelling (docs/PLAN-5.1.md, "5.2 stage 2 rules and outcome definitions").
// Pure code: no AI, no network. It is NOT wired into the live path (fromAd, fromCv, the routes, the pages): only the
// offline tools and the tests use it until the fresh-set measure passes.

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

// The allowance comes from the SHORTER of the two folded strings: up to 4 letters 0, 5 to 8 letters 1, 9 or more 2.
export function allowanceFor(shorterLength: number): number {
  if (shorterLength <= 4) return 0;
  if (shorterLength <= 8) return 1;
  return 2;
}
const MAX_ALLOWANCE = 2;

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

export type CloseResult =
  | { how: "close"; id: string; distance: number; via: string }
  | { how: "tie"; ids: string[] }
  | { how: "none" };

type PerSkill = { id: string; distance: number; ok: boolean; via: string };

// The smallest distance per skill id; the name maps only if exactly one skill id has the overall smallest distance and
// that distance is within the allowance. Two or more ids at the smallest distance, at least one within the allowance,
// is a tie (no mapping, the review list). The skills are compared with the exact stage already out of the way.
export function closeMatch(name: string, skills: Skill[]): CloseResult {
  const x = spellingForm(name);
  if (x === "") return { how: "none" };
  const best = new Map<string, PerSkill>();
  for (const t of closeTargets(skills)) {
    const d = osaDistance(x, t.form, MAX_ALLOWANCE);
    if (d > MAX_ALLOWANCE) continue;
    const ok = d <= allowanceFor(Math.min(x.length, t.form.length));
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
