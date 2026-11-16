import { mapName } from "./mapName";
import type { Skill } from "./types";

// The neighbour audit (npm run neighbours, docs/PLAN-5.1.md): which ordinary English words close spelling (stage 2)
// would map to a skill. Pure code: no AI, no network, no file; the script reads the dictionary.

export type Neighbour = { id: string; word: string; via: string; distance: number };

// A dictionary file as a word list: lowercase letters only (no capitalised words, apostrophes, accents or digits),
// each once, sorted.
export function loadWords(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split("\n")) {
    const w = line.trim();
    if (/^[a-z]+$/.test(w)) out.add(w);
  }
  return [...out].sort();
}

// Every word that stage 2 would map to a skill: within the allowance, not an exact hit (stage 1 owns those), not the
// same string as a name or alias once spaces and hyphens are dropped (distance 0), and not a word the live path would
// set aside first as not-a-skill. A tie is not a mapping. Only words of 6 letters or more can map, because the
// allowance is 0 up to 5 letters. Sorted by skill id, then word.
export function neighbourPairs(skills: Skill[], words: string[], isNotASkill: (word: string) => boolean): Neighbour[] {
  const out: Neighbour[] = [];
  for (const word of words) {
    if (word.length < 6) continue;
    if (isNotASkill(word)) continue;
    const r = mapName(word, skills);
    if (r.how === "close" && r.distance > 0) out.push({ id: r.id, word, via: r.via, distance: r.distance });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id) || a.word.localeCompare(b.word));
}
