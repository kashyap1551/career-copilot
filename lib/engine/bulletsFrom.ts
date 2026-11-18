import { checkBullet, type BulletReason } from "./bulletCheck";
import type { BulletPair } from "./bulletPairs";
import type { Skill } from "./types";

// Step 8.3 (docs/PLAN-8.3.md v2, sections 4 and 10): what the page may show of the AI's answer. Pure code: no AI, no network, no clock, nothing from app/ or
// lib/ai. Each bullet is checked with `checkBullet` against ITS OWN pair's line (the citation is assigned by code, never by the AI), so a fact taken from
// another pair's line is rejected like any other new word. A failing bullet is dropped, never repaired.

export const MAX_SHOWN = 3;

export type BulletAnswer = { bullets: { pair: number; text: string }[] };
export type DropReason = BulletReason | "missing" | "repeated-pair";
export type BulletsResult = {
  bullets: { pair: number; line: number; text: string }[]; // at most `show`, the accepted ones, in pair order
  asked: number; // the number of pairs
  dropped: { pair: number; reason: DropReason }[]; // every asked pair without an accepted bullet, in pair order
  ignored: number; // bullets for a pair id that was not asked (not a dropped pair)
};

export function bulletsFrom(answer: BulletAnswer, pairs: BulletPair[], vocabulary: Skill[], show: number = MAX_SHOWN): BulletsResult {
  const given = Array.isArray(answer?.bullets) ? answer.bullets : [];
  const asked = new Set(pairs.map((p) => p.id));
  const ignored = given.filter((b) => !asked.has(b?.pair)).length;

  // The lines the check sees: line n of the CV is at index n - 1; lines that are not in a pair are empty (and so can never be cited).
  const longest = pairs.reduce((m, p) => Math.max(m, p.line), 0);
  const lines: string[] = Array.from({ length: longest }, () => "");
  for (const p of pairs) lines[p.line - 1] = p.text;

  const accepted: BulletsResult["bullets"] = [];
  const dropped: BulletsResult["dropped"] = [];
  for (const p of pairs) {
    const mine = given.filter((b) => b?.pair === p.id);
    if (mine.length === 0) {
      dropped.push({ pair: p.id, reason: "missing" });
    } else if (mine.length > 1) {
      dropped.push({ pair: p.id, reason: "repeated-pair" }); // answered more than once: no bullet of that id is trusted
    } else {
      const verdict = checkBullet(mine[0].text, [p.line], { lines, vocabulary });
      if (verdict.ok) accepted.push({ pair: p.id, line: p.line, text: mine[0].text });
      else dropped.push({ pair: p.id, reason: verdict.reason });
    }
  }
  return { bullets: accepted.slice(0, Math.max(0, show)), asked: pairs.length, dropped, ignored };
}
