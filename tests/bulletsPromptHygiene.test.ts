import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cvFixtures } from "@/fixtures/synthetic-cvs";
import { jobs } from "@/fixtures/jobs";
import { brightwaterAdText, fjordlightAdText, lindenbergAdText, northwindAdText } from "@/fixtures/synthetic-ad-texts";
import { INSTRUCTIONS_BULLETS } from "@/lib/ai/writeBullets";
import { checkBullet, QUALIFIERS } from "@/lib/engine/bulletCheck";
import { foldText } from "@/lib/engine/text";
import { skills } from "@/lib/vocab";

// Step 8.3, stage 3 (docs/PLAN-8.3.md v2, section 4; test T25): the word check of tests/promptHygiene.test.ts, repeated for the bullets prompt. No word of 5
// letters or more inside a double-quoted example of the prompt may appear in any invented CV, CV key, ad or job, nor in the CV-A lines of the plan's hand
// cases. Words outside double quotes are the rules' own wording ("helped", "learning"), not examples. Invented text only.

const wordsOf = (s: string) => new Set((s.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => w.length >= 5));

function quotedWords(prompt: string): Set<string> {
  const out = new Set<string>();
  for (const m of prompt.matchAll(/"([^"]+)"/g)) for (const w of wordsOf(m[1])) out.add(w);
  return out;
}

function testWords(): Set<string> {
  const out = new Set<string>();
  const add = (t: string) => wordsOf(t).forEach((w) => out.add(w));
  for (const c of cvFixtures) {
    add(c.text);
    for (const item of c.key.items) for (const n of item.names) add(n);
  }
  for (const t of [northwindAdText, brightwaterAdText, fjordlightAdText, lindenbergAdText]) add(t);
  for (const j of jobs) {
    add(j.title);
    add(j.company ?? "");
    for (const r of j.requirements) add(r.quote);
  }
  // the CV-A lines of docs/PLAN-8.3.md section 3.1
  const plan = readFileSync(join(process.cwd(), "docs/PLAN-8.3.md"), "utf8");
  const block = /```\n(1: Sam Placeholder[\s\S]*?)```/.exec(plan);
  if (block) add(block[1]);
  return out;
}

describe("the bullets prompt's examples do not use the test material's words", () => {
  const quoted = quotedWords(INSTRUCTIONS_BULLETS);
  const test = testWords();

  it("T25a: the check is not vacuous: the prompt has quoted words, the test material many more", () => {
    expect(quoted.size).toBeGreaterThanOrEqual(8);
    expect(test.size).toBeGreaterThan(150);
  });

  it("T25b: no quoted word of 5 letters or more is in any CV, key, ad, job or CV-A line", () => {
    expect([...quoted].filter((w) => test.has(w))).toEqual([]);
  });

  it("T25c: the check does catch an overlap ('Wrote' and 'Excel' are in the CVs)", () => {
    const bad = quotedWords('x "Wrote Excel sheets" y');
    expect([...bad].filter((w) => test.has(w)).sort()).toEqual(["excel", "wrote"]);
  });

  it("T25d: the plan's CV-A block was found (the check reads it)", () => {
    const plan = readFileSync(join(process.cwd(), "docs/PLAN-8.3.md"), "utf8");
    expect(/```\n1: Sam Placeholder/.test(plan)).toBe(true);
    expect(test.has("placeholder")).toBe(true);
  });

  it("T25e: the prompt has the example block and the answer shape", () => {
    expect(INSTRUCTIONS_BULLETS).toContain("Example, made up");
    expect(INSTRUCTIONS_BULLETS).toContain("bullets");
    expect(INSTRUCTIONS_BULLETS).toContain("pair");
  });
});

// ---- Step 8.3, prompt v2 (docs/PLAN-8.3.md 0.24): the prompt names every limiting word, and its example answers pass the checker ---------------------------------

describe("T25f: the prompt names every limiting word of rule R8", () => {
  it("T25f: every member of QUALIFIERS (folded) is a word of the folded prompt; the list of missing words is empty", () => {
    const promptWords = new Set(foldText(INSTRUCTIONS_BULLETS).match(/\p{L}+/gu) ?? []);
    const checked = [...QUALIFIERS];
    const missing = checked.filter((w) => !promptWords.has(w));
    console.log(`T25f: ${checked.length} QUALIFIERS words checked, ${missing.length} missing`);
    expect(checked.length).toBeGreaterThan(80);
    expect(missing).toEqual([]);
  });
});

describe("T25g: the example answers of the prompt pass the checker", () => {
  const example = INSTRUCTIONS_BULLETS.slice(INSTRUCTIONS_BULLETS.indexOf("Example, made up"));
  const lines = [...example.matchAll(/^CV line: "([^"]*)"$/gm)].map((m) => m[1]);
  const answerStart = example.search(/^(?:Answer|Reading):/m); // the answer line of the example (v1 said "Reading:", v2 says "Answer:")
  const answers = [...example.slice(Math.max(answerStart, 0)).matchAll(/text "([^"]*)"/g)].map((m) => m[1]);
  const CONTROL_LINE = "Sold honey jars at the harbour stall and sometimes packed the parcels"; // the line of pair 3 of the v2 example

  it("T25g: every answer of the example is accepted by checkBullet against its own line (one pair, line 1)", () => {
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(answers.length).toBe(lines.length);
    lines.forEach((line, i) => {
      expect(checkBullet(answers[i], [1], { lines: [line], vocabulary: skills }), `pair ${i + 1}: ${answers[i]}`).toEqual({ ok: true });
    });
  });

  it("T25g (negative control): pair 3's line with an answer that loses the limiting word 'sometimes' is rejected as lost-qualifier; and when the prompt has a third pair it is this line", () => {
    expect(checkBullet("Sold honey jars at the harbour stall", [1], { lines: [CONTROL_LINE], vocabulary: skills })).toEqual({ ok: false, reason: "lost-qualifier" });
    if (lines.length >= 3) expect(lines[2]).toBe(CONTROL_LINE);
  });
});
