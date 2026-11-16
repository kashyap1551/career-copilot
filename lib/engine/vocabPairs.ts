import { allowanceFor, closeTargets, osaDistance } from "./closeSpelling";
import { mapName } from "./mapName";
import type { Skill } from "./types";

// The vocabulary pair check (npm run vocab-pairs): every pair of DIFFERENT skills that have two strings (name, German
// name, alias) within the allowed distance of each other. Vocabulary only, no ad names. Pure code.
//
// "check": a typo of one string can land on the other skill (for example one string is a one-letter variant of the
// other, so typing it means the other skill). "tie-protected": no typo lands on the other skill, but a typo is equally
// close to both, so the mapper ties and sends it to the review list.

export type PairInfo = {
  a: string; // the lower skill id
  b: string;
  aText: string; // the closest strings, as written in the vocabulary
  bText: string;
  distance: number;
  label: "tie-protected" | "check";
};

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

// Every string one edit away from `s` (delete, swap of neighbours, replace, insert).
function typosOf(s: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i <= s.length; i++) {
    if (i < s.length) {
      out.add(s.slice(0, i) + s.slice(i + 1));
      if (i < s.length - 1) out.add(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2));
      for (const c of ALPHABET) out.add(s.slice(0, i) + c + s.slice(i + 1));
    }
    for (const c of ALPHABET) out.add(s.slice(0, i) + c + s.slice(i));
  }
  out.delete(s);
  out.delete("");
  return [...out];
}

export function vocabPairs(skills: Skill[]): PairInfo[] {
  const targets = closeTargets(skills);
  const byId = new Map<string, typeof targets>();
  for (const t of targets) byId.set(t.id, [...(byId.get(t.id) ?? []), t]);
  const ids = [...byId.keys()].sort();
  const pairs: PairInfo[] = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      let best: { d: number; s: (typeof targets)[number]; t: (typeof targets)[number] } | null = null;
      for (const s of byId.get(ids[i])!) {
        for (const t of byId.get(ids[j])!) {
          const d = osaDistance(s.form, t.form, 2);
          if (d > allowanceFor(Math.min(s.form.length, t.form.length))) continue;
          if (!best || d < best.d) best = { d, s, t };
        }
      }
      if (!best) continue;

      // Would a typo of one string land on the other skill? Only these two skills are in play.
      const A = skills.find((x) => x.id === ids[i])!;
      const B = skills.find((x) => x.id === ids[j])!;
      const pair = [A, B];
      let lands = false;
      for (const [from, to] of [[best.s.form, ids[j]], [best.t.form, ids[i]]] as const) {
        for (const typo of typosOf(from)) {
          const r = mapName(typo, pair);
          if ((r.how === "exact" || r.how === "close") && r.id === to) {
            lands = true;
            break;
          }
        }
        if (lands) break;
      }
      pairs.push({
        a: ids[i], b: ids[j], aText: best.s.text, bText: best.t.text, distance: best.d,
        label: lands ? "check" : "tie-protected",
      });
    }
  }
  return pairs.sort((x, y) => x.distance - y.distance || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));
}
