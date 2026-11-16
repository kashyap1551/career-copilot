import { closeMatch } from "./closeSpelling";
import { lookupExact } from "./skillIds";
import type { Skill } from "./types";

// The name mapper for 5.2: stage 1 (exact, three tries) always runs first and wins; only when it finds nothing does
// stage 2 (close spelling) look. Pure code. Live since step 5 of the fresh-set sequence (2026-11-16): `readNameId`
// (lib/engine/readName.ts) calls it for the names the AI reads in fromAd and fromCv, after the not-a-skill flag; the
// measure's outcomeFor calls it too, so the live product and the measure cannot drift apart.

export type MapResult =
  | { how: "exact"; id: string; try: 1 | 2 | 3 }
  | { how: "close"; id: string; distance: number; via: string }
  | { how: "tie"; ids: string[] }
  | { how: "none" };

export function mapName(name: string, skills: Skill[]): MapResult {
  const exact = lookupExact(name, skills);
  if (exact) return { how: "exact", id: exact.id, try: exact.try };
  return closeMatch(name, skills);
}
