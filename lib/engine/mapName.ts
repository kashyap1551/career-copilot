import { closeMatch } from "./closeSpelling";
import { lookupExact } from "./skillIds";
import type { Skill } from "./types";

// The name mapper for 5.2: stage 1 (exact, three tries) always runs first and wins; only when it finds nothing does
// stage 2 (close spelling) look. Pure code. NOT wired into the live path until the fresh-set measure passes: nothing
// in fromAd, fromCv, the routes or the pages imports this file (a test checks it).

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
