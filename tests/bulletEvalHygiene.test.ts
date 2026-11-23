import { describe, expect, it } from "vitest";
import { bulletEvalJobs, newCvFixtures } from "@/fixtures/bullet-eval";
import { INSTRUCTIONS_BULLETS } from "@/lib/ai/writeBullets";

// Step 8.3, stage 5c (docs/PLAN-8.3.md amendment 0.30, anti-tuning rule): the check of tests/bulletsPromptHygiene.test.ts (T25), repeated for the NEW material. No word
// of 5 letters or more inside a double-quoted example of the bullets prompt may appear in any new CV line, CV key name, job title, company or requirement. Words
// outside double quotes are the rules' own wording, not examples. Invented text only.

const wordsOf = (s: string) => new Set((s.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => w.length >= 5));

function quotedWords(prompt: string): Set<string> {
  const out = new Set<string>();
  for (const m of prompt.matchAll(/"([^"]+)"/g)) for (const w of wordsOf(m[1])) out.add(w);
  return out;
}

function newMaterialWords(): Set<string> {
  const out = new Set<string>();
  const add = (t: string) => wordsOf(t).forEach((w) => out.add(w));
  for (const c of newCvFixtures) {
    add(c.text);
    for (const item of c.key.items) for (const n of item.names) add(n);
  }
  for (const j of bulletEvalJobs) {
    add(j.title);
    add(j.company ?? "");
    for (const r of j.requirements) add(r.quote);
  }
  return out;
}

describe("T40: the bullets prompt's examples do not use the new material's words", () => {
  const quoted = quotedWords(INSTRUCTIONS_BULLETS);
  const material = newMaterialWords();

  it("T40a: the check is not vacuous: the prompt has quoted words, the new material many more", () => {
    expect(quoted.size).toBeGreaterThanOrEqual(8);
    expect(material.size).toBeGreaterThan(150);
  });

  it("T40b: no quoted word of 5 letters or more is in any new CV line, key name, job title, company or requirement", () => {
    expect([...quoted].filter((w) => material.has(w))).toEqual([]);
  });

  it("T40c: the check does catch an overlap (a made-up line with 'honey' and 'harbour' is found)", () => {
    const planted = wordsOf("Sold honey at the harbour");
    expect([...quoted].filter((w) => planted.has(w)).sort()).toEqual(["harbour", "honey"]);
  });

  it("T40d: the prompt's quoted example words are the ones we expect to avoid (the list is stable)", () => {
    expect([...quoted].sort()).toEqual(["autumn", "baskets", "bowls", "buyers", "catalogues", "glaze", "glazed", "harbour", "honey", "knitted", "mailed", "occasionally", "packed", "parcels", "scarves", "sometimes", "sorted", "stall", "winter"]);
  });
});
