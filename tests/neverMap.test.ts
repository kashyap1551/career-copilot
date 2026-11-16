import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vocabularyHash } from "@/lib/engine/evalFingerprint";
import { mapName } from "@/lib/engine/mapName";
import { neighbourPairs } from "@/lib/engine/neighbours";
import type { Skill } from "@/lib/engine/types";
import { vocabHash } from "@/lib/engine/vocabHash";
import { isNotASkill, LEFT_UNLISTED, NEVER_MAP, NOT_A_SKILL, skills, VOCAB } from "@/lib/vocab";

// The never-map list (docs/PLAN-5.1.md, "Changes before any measure", item 5): ordinary words and look-alike tools
// that must never be mapped BY SPELLING. Stage 1 (exact) is unaffected. Expectations worked out by hand.

describe("the list itself", () => {
  it("L1: six words, each with a one-line reason", () => {
    expect(NEVER_MAP.map((n) => n.word)).toEqual(["confluent", "commerce", "market", "markets", "personal", "typoscript"]);
    for (const n of NEVER_MAP) {
      expect(n.why.trim()).not.toBe("");
      expect(n.why).not.toContain("\n");
    }
  });
});

describe("never mapped by spelling (real vocabulary)", () => {
  const words = ["confluent", "commerce", "market", "markets", "personal", "typoscript"];

  it("L2: each of the six words gives how none", () => {
    for (const w of words) expect(mapName(w, skills)).toEqual({ how: "none" });
  });

  it("L3: in other case, and with spaces around", () => {
    for (const w of ["Markets", " MARKET ", "CONFLUENT", "Commerce ", "  TypoScript", "Personal", "MARKETS", "\tmarket\t"]) {
      expect(mapName(w, skills)).toEqual({ how: "none" });
    }
  });

  it("L4: the real skills they look like still map exactly", () => {
    expect(mapName("Confluence", skills)).toEqual({ how: "exact", id: "confluence", try: 1 });
    expect(mapName("TypeScript", skills)).toEqual({ how: "exact", id: "typescript", try: 1 });
    expect(mapName("E-commerce", skills)).toEqual({ how: "exact", id: "e-commerce", try: 1 });
    expect(mapName("Marketo", skills)).toEqual({ how: "exact", id: "marketo", try: 1 });
    expect(mapName("Persona development", skills)).toEqual({ how: "exact", id: "persona-development", try: 1 });
  });

  it("L5: a typo of TypeScript that is not the listed word still maps close", () => {
    expect(mapName("Typscript", skills)).toEqual({ how: "close", id: "typescript", distance: 1, via: "TypeScript" });
  });

  it("L6: other neighbours of the same skills are still repaired: 'Confluance' (a typo of Confluence) and 'Marketto'", () => {
    expect(mapName("Confluance", skills)).toEqual({ how: "close", id: "confluence", distance: 1, via: "Confluence" });
    expect(mapName("Marketto", skills)).toEqual({ how: "close", id: "marketo", distance: 1, via: "Marketo" });
  });
});

describe("stage 1 is unaffected (made-up list)", () => {
  const l: Skill[] = [{ id: "m", name: "Mkt", aliases: ["market"] }];

  it("L7: a listed word that is also an exact alias still maps exactly", () => {
    expect(mapName("market", l)).toEqual({ how: "exact", id: "m", try: 1 });
    expect(mapName("Market", l)).toEqual({ how: "exact", id: "m", try: 1 });
  });

  it("L8: but its plural, one letter away, is NOT repaired (the list blocks spelling); an unlisted neighbour is", () => {
    expect(mapName("Markets", l)).toEqual({ how: "none" });
    expect(mapName("Marketz", l)).toEqual({ how: "close", id: "m", distance: 1, via: "market" });
  });
});

describe("the audit after the change (hand-worked on a small word list)", () => {
  it("L9: confluent, commerce, market, personal and typoscript are no longer neighbours; persona, dashboard, statistic still are", () => {
    const words = ["confluent", "commerce", "market", "personal", "typoscript", "persona", "dashboard", "statistic"];
    const pairs = neighbourPairs(skills, words, isNotASkill).map((p) => [p.id, p.word, p.distance]);
    expect(pairs).toEqual([
      ["applied-statistics", "statistic", 1],
      ["dashboards", "dashboard", 1],
      ["persona-development", "persona", 1],
    ]);
  });
});

describe("the vocabulary hash is computed in ONE place and includes the list", () => {
  it("H1: vocabHash() is the hash of the skills, the not-a-skill phrases, the left-unlisted names AND the never-map list", () => {
    expect(vocabHash()).toBe(vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED, NEVER_MAP }));
    expect(vocabHash()).not.toBe(vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED })); // the old hash, without the list
  });

  it("H2: it changes when a never-map word changes or one is removed", () => {
    const changed = NEVER_MAP.map((n, i) => (i === 0 ? { ...n, word: "confluents" } : n));
    expect(vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED, NEVER_MAP: changed })).not.toBe(vocabHash());
    expect(vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED, NEVER_MAP: NEVER_MAP.slice(1) })).not.toBe(vocabHash());
  });

  it("H3: every script that prints or uses a vocabulary hash calls vocabHash() and never hashes by hand", () => {
    for (const f of ["eval.ts", "evalCv.ts", "vocabCheck.ts", "vocabPairs.ts", "mapMeasure.ts", "neighbours.ts"]) {
      const text = fs.readFileSync(path.join(process.cwd(), "scripts", f), "utf8");
      expect(`${f}: ${text.includes("vocabHash()")}`).toBe(`${f}: true`);
      expect(`${f}: ${text.includes("vocabularyHash(")}`).toBe(`${f}: false`);
    }
  });
});
