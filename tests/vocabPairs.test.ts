import { describe, expect, it } from "vitest";
import { vocabPairs } from "@/lib/engine/vocabPairs";
import type { Skill } from "@/lib/engine/types";
import { skills } from "@/lib/vocab";

// The vocabulary pair check (npm run vocab-pairs): pairs of DIFFERENT skills with two strings within the allowance of
// each other, each marked "tie-protected" or "check". Hand-worked on made-up lists.

describe("vocabPairs", () => {
  it("P1: 'Tableau' and 'Tableaux' (distance 1, 7 letters): a typo of one IS the other: check", () => {
    const l: Skill[] = [{ id: "a", name: "Tableau" }, { id: "b", name: "Tableaux" }];
    expect(vocabPairs(l)).toEqual([{ a: "a", b: "b", aText: "Tableau", bText: "Tableaux", distance: 1, label: "check" }]);
  });

  it("P2: two 10-letter strings at distance 2: a typo is equally close to both, none lands: tie-protected", () => {
    const l: Skill[] = [{ id: "p", name: "Abcdefghij" }, { id: "q", name: "Abcdefghxy" }];
    expect(vocabPairs(l)).toEqual([{ a: "p", b: "q", aText: "Abcdefghij", bText: "Abcdefghxy", distance: 2, label: "tie-protected" }]);
  });

  it("P3: strings too far apart for their allowance make no pair", () => {
    expect(vocabPairs([{ id: "a", name: "Alpha" }, { id: "b", name: "Omega" }])).toEqual([]);
    // 4 letters: allowance 0, so distance 1 is no pair
    expect(vocabPairs([{ id: "a", name: "Java" }, { id: "b", name: "Jave" }])).toEqual([]);
  });

  it("P3b: the allowance comes from the SHORTER string: 'Rust' (4 letters) and 'Rusty' (5) are distance 1 but allowance 0: no pair; the 5/6 boundary", () => {
    expect(vocabPairs([{ id: "a", name: "Rust" }, { id: "b", name: "Rusty" }])).toEqual([]);
    // 5 and 6 letters: the shorter is 5, allowance 0 (since 2026-11-16): no pair
    expect(vocabPairs([{ id: "a", name: "Trust" }, { id: "b", name: "Trusty" }])).toEqual([]);
    // 6 and 6 letters: allowance 1: a pair
    expect(vocabPairs([{ id: "a", name: "Trusty" }, { id: "b", name: "Trusts" }]).map((p) => p.distance)).toEqual([1]);
  });

  it("P4: exactOnly skills are never part of a pair", () => {
    expect(vocabPairs([{ id: "g", name: "Golang", exactOnly: true }, { id: "h", name: "Golanf" }])).toEqual([]);
  });

  it("P5: two strings of the SAME skill are not a pair", () => {
    expect(vocabPairs([{ id: "s", name: "Pillow", aliases: ["Billow"] }])).toEqual([]);
  });

  it("P6: strings that are the same once spaces and hyphens are dropped (distance 0) are a pair", () => {
    const pairs = vocabPairs([{ id: "a", name: "E commerce" }, { id: "b", name: "Ecommerce" }]);
    expect(pairs.length).toBe(1);
    expect(pairs[0].distance).toBe(0);
  });

  it("P7: the closest string pair of two skills is the one reported, and the list is ordered by distance, then ids", () => {
    const l: Skill[] = [
      { id: "z", name: "Abcdefghij", aliases: ["Zzzzzzzzzz"] },
      { id: "y", name: "Abcdefghxy", aliases: ["Abcdefghix"] },
      { id: "c", name: "Tableau" },
      { id: "d", name: "Tableaux" },
    ];
    const pairs = vocabPairs(l);
    expect(pairs.map((p) => [p.a, p.b, p.distance])).toEqual([["c", "d", 1], ["y", "z", 1]]);
    expect(pairs[1]).toMatchObject({ aText: "Abcdefghix", bText: "Abcdefghij" });
  });

  it("P8: on the real vocabulary every pair has two different skills and no exactOnly skill", () => {
    const pairs = vocabPairs(skills);
    for (const p of pairs) {
      expect(p.a).not.toBe(p.b);
      expect(skills.find((s) => s.id === p.a)?.exactOnly).toBeFalsy();
      expect(skills.find((s) => s.id === p.b)?.exactOnly).toBeFalsy();
      expect(["tie-protected", "check"]).toContain(p.label);
    }
  });
});
