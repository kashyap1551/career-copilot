import { describe, expect, it } from "vitest";
import { cvFixtures } from "@/fixtures/synthetic-cvs";
import { INSTRUCTIONS_CV } from "@/lib/ai/readCv";

// The 3.3 word check, repeated for the CV prompt (docs/PLAN-4.2.md, decision 8):
// no word of 5 letters or more inside a double-quoted example of the prompt
// (the example block and the quoted examples in the rules) may appear in any
// of the five CVs or their keys. Words outside quotes are the rule's own
// wording ("learning", "studying"), not examples.

const wordsOf = (s: string) =>
  new Set((s.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => w.length >= 5));

export function quotedWords(prompt: string): Set<string> {
  const out = new Set<string>();
  for (const m of prompt.matchAll(/"([^"]+)"/g)) for (const w of wordsOf(m[1])) out.add(w);
  return out;
}

export function testWords(): Set<string> {
  const out = new Set<string>();
  for (const c of cvFixtures) {
    for (const w of wordsOf(c.text)) out.add(w);
    for (const item of c.key.items) for (const n of item.names) for (const w of wordsOf(n)) out.add(w);
  }
  return out;
}

describe("the CV prompt's examples do not use the test CVs' words", () => {
  const quoted = quotedWords(INSTRUCTIONS_CV);
  const test = testWords();

  it("P1: the check is not vacuous: the prompt has many quoted words, the CVs many more", () => {
    // 15 by hand: repaired, bicycle, brakes, bookkeeping, figma, welding, plans, notebook, honey,
    // markets, posted, fortnightly, bulletin, substack, beekeeping
    expect(quoted.size).toBe(15);
    expect(test.size).toBeGreaterThan(80);
  });

  it("P2: no quoted word of 5 letters or more is in any CV or key", () => {
    expect([...quoted].filter((w) => test.has(w))).toEqual([]);
  });

  it("P3: the check does catch an overlap ('Wrote' and 'Excel' are in the CVs)", () => {
    const bad = quotedWords('x "Wrote Excel sheets" y');
    expect([...bad].filter((w) => test.has(w)).sort()).toEqual(["excel", "wrote"]);
  });
});
