import type { KeyRequirement } from "./answerKey";
import { guardedContains } from "./quoteMatch";
import { skillIdFor } from "./skillIds";
import { normalizeText } from "./text";
import type { Requirement, Skill } from "./types";

// Pairs the AI's requirements with the answer key's, by quote only
// (docs/PLAN-3.2.md, section 4). Pure code.
//
// One-to-one and greedy. A key item and an extracted item are a candidate when
// their normalised quotes are equal, or one contains the other and the shorter
// one has a real word (a quote like "and" never pairs; see quoteMatch.ts). All candidates
// are ranked, and the best is taken first, each item used once. Rank, best
// first:
//   1. equal quotes beat contained quotes
//   2. sharing at least one skill id (a tie-break only, never required, so a
//      different skill name cannot stop a pair)
//   3. the same importance
//   4. the smaller difference in quote length
//   5. the earlier position: key order, then the AI's order

export type MatchedPair = { key: number; extracted: number };

export type RequirementMatch = {
  pairs: MatchedPair[]; // sorted by key position
  missedKeys: number[]; // key items with no partner
  extras: number[]; // AI items with no partner
};

// The ids of a key item's skill names, by the same function the AI's names use.
export function keyIds(item: KeyRequirement, skills: Skill[]): string[] {
  return item.skills.flatMap((name) => {
    const hit = skillIdFor(name, skills);
    return hit ? [hit.id] : [];
  });
}

export function matchRequirements(
  keyItems: KeyRequirement[],
  extracted: Requirement[],
  skills: Skill[],
): RequirementMatch {
  const kq = keyItems.map((k) => normalizeText(k.quote));
  const eq = extracted.map((e) => normalizeText(e.quote));
  const kIds = keyItems.map((k) => keyIds(k, skills));

  const candidates: { key: number; extracted: number; rank: number[] }[] = [];
  keyItems.forEach((item, k) => {
    extracted.forEach((ex, e) => {
      if (kq[k] === "" || eq[e] === "") return;
      const equal = kq[k] === eq[e];
      if (!equal && !guardedContains(kq[k], eq[e])) return;
      const shared = ex.skillIds.some((id) => kIds[k].includes(id));
      candidates.push({
        key: k,
        extracted: e,
        rank: [
          equal ? 0 : 1,
          shared ? 0 : 1,
          item.importance === ex.importance ? 0 : 1,
          Math.abs(kq[k].length - eq[e].length),
          k,
          e,
        ],
      });
    });
  });

  candidates.sort((a, b) => {
    for (let i = 0; i < a.rank.length; i++) {
      if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
    }
    return 0;
  });

  const keyUsed = new Set<number>();
  const extractedUsed = new Set<number>();
  const pairs: MatchedPair[] = [];
  for (const c of candidates) {
    if (keyUsed.has(c.key) || extractedUsed.has(c.extracted)) continue;
    keyUsed.add(c.key);
    extractedUsed.add(c.extracted);
    pairs.push({ key: c.key, extracted: c.extracted });
  }
  pairs.sort((a, b) => a.key - b.key);

  return {
    pairs,
    missedKeys: keyItems.map((_, k) => k).filter((k) => !keyUsed.has(k)),
    extras: extracted.map((_, e) => e).filter((e) => !extractedUsed.has(e)),
  };
}
