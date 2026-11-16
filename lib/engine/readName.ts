import { mapName } from "./mapName";
import { slugOf } from "./skillIds";
import type { Skill } from "./types";

// The ONE path that decides the id for a name the AI READ (an ad's skill, a CV's skill) in the live product, step 5.2:
//   1. (the caller) the not-a-skill flag: a flagged name never gets here;
//   2. stage 1, exact, three tries;
//   3. stage 2, close spelling (a distance of at most 2 under the rules of lib/engine/closeSpelling.ts).
// It is `mapName`, the same function the measure's outcomeFor uses, so the live product and the measure cannot drift
// apart. A name no stage maps (nothing found, or a tie) stays unlisted: `new:<slug>`, exactly as before. Nothing is
// guessed. Names the person TYPES (a skill list, hand-added skills) still go through `skillIdFor` (exact only).
// Pure code: no AI, no network.

export type ReadName = {
  id: string;
  listed: boolean;
  // Set only when stage 2 mapped the name: the vocabulary term it matched and the distance.
  close?: { via: string; distance: number };
};

// null when the name has nothing to make an id from ("???"), as skillIdFor.
export function readNameId(name: string, skills: Skill[]): ReadName | null {
  const slug = slugOf(name);
  if (slug === "") return null;
  const r = mapName(name, skills);
  if (r.how === "exact") return { id: r.id, listed: true };
  if (r.how === "close") return { id: r.id, listed: true, close: { via: r.via, distance: r.distance } };
  return { id: `new:${slug}`, listed: false };
}
