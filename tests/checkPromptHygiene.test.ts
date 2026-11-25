import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jobs } from "@/fixtures/jobs";
import { brightwaterAdText, fjordlightAdText, lindenbergAdText, northwindAdText } from "@/fixtures/synthetic-ad-texts";
import { cvFixtures } from "@/fixtures/synthetic-cvs";
import { INSTRUCTIONS_CHECK } from "@/lib/ai/checkEvidence";
import { proveAnswers, type AiAnswer, type SentEntry, type SentRequirement } from "@/lib/engine/evidenceProof";

// EC-3a (docs/PLAN-EVERY-CV.md section 8; tests CH1 to CH5): the word check of tests/promptHygiene.test.ts, repeated for the check prompt. No word of 5
// letters or more inside a double-quoted example of the prompt may appear in the invented CVs, their key names, the four invented ad texts, the fixture jobs,
// the cv.txt and ad.txt of every pair of fixtures/every-cv (and of the example), or tests/support/*. NOT key.txt (the owner's keys quote the ads). The rules
// of the prompt contain no double quote, so no rule word is an example.

const root = process.cwd();
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
  const base = join(root, "fixtures/every-cv");
  for (const d of readdirSync(base)) for (const f of ["cv.txt", "ad.txt"]) if (existsSync(join(base, d, f))) add(readFileSync(join(base, d, f), "utf8"));
  for (const f of readdirSync(join(root, "tests/support"))) add(readFileSync(join(root, "tests/support", f), "utf8"));
  return out;
}

// The example block of the prompt, read back: the R and E lines and the four answers.
function parseExample() {
  const example = INSTRUCTIONS_CHECK.slice(INSTRUCTIONS_CHECK.indexOf("Example, made up:"));
  const requirements: SentRequirement[] = [...example.matchAll(/^R(\d+) "(.*)"$/gm)].map((m, i) => ({ n: Number(m[1]), index: i, quote: m[2], importance: "must" as const }));
  const entries: SentEntry[] = [...example.matchAll(/^E(\d+) \| ([^|]+) \| "(.*)"$/gm)].map((m) => ({
    n: Number(m[1]), name: m[2].trim(), skillId: `new:e${m[1]}`, line: Number(m[1]) + 1, text: m[3], inferred: false,
  }));
  const answers: AiAnswer[] = [...example.matchAll(/^R\d+: requirement (\d+), verdict (\w+), entry (\w+), quote (null|"[^"]*")/gm)].map((m) => ({
    requirement: Number(m[1]),
    verdict: m[2] as AiAnswer["verdict"],
    entry: m[3] === "null" ? null : Number(m[3]),
    quote: m[4] === "null" ? null : m[4].slice(1, -1),
  }));
  return { requirements, entries, answers };
}

describe("EC-3a the check prompt's examples do not use the test material's words", () => {
  const quoted = quotedWords(INSTRUCTIONS_CHECK);
  const test = testWords();

  it("CH1: the check is not vacuous: exactly 23 quoted words of 5 letters or more (counted by hand from the example), and more than 150 test words", () => {
    // by hand: basque, beacon, brass, chatted, copper, crossing, ferry, fittings, fortnightly, island, lantern, mends, polish, polished, portuguese,
    // rigging, sails, seasons, sloops, speaks, spliced, stitched, visitors
    expect([...quoted].sort()).toEqual(
      ["basque", "beacon", "brass", "chatted", "copper", "crossing", "ferry", "fittings", "fortnightly", "island", "lantern", "mends", "polish", "polished", "portuguese", "rigging", "sails", "seasons", "sloops", "speaks", "spliced", "stitched", "visitors"],
    );
    expect(quoted.size).toBe(23);
    expect(test.size).toBeGreaterThan(150);
  });

  it("CH2: no quoted word is in the test words", () => {
    expect([...quoted].filter((w) => test.has(w))).toEqual([]);
  });

  it("CH3: the check does catch an overlap ('Wrote' and 'Excel' are in the CVs)", () => {
    // The probe is 'Wrote Excel', not the 'Wrote Excel sheets' of tests/promptHygiene.test.ts: the word 'sheets' is also in fixtures/every-cv/pair-04/cv.txt
    // (line 15), which this test reads and which must not be edited, so the expectation (exactly excel and wrote) is kept and the probe is the one that meets it.
    const bad = quotedWords('x "Wrote Excel" y');
    expect([...bad].filter((w) => test.has(w)).sort()).toEqual(["excel", "wrote"]);
  });

  it("CH4: every double quote of the prompt lies after the line 'Example, made up:' (the rules hold none)", () => {
    const at = INSTRUCTIONS_CHECK.indexOf("Example, made up:");
    expect(at).toBeGreaterThan(0);
    expect(INSTRUCTIONS_CHECK.slice(0, at)).not.toContain('"');
    expect(INSTRUCTIONS_CHECK.slice(at)).toContain('"');
  });

  it("CH5: the example's answers pass the proof (4 accepted: met, partly, met, none; 0 thrown away); the entry NAME as a quote, and words that are not on the line, are rejected", () => {
    const { requirements, entries, answers } = parseExample();
    expect([requirements.length, entries.length, answers.length]).toEqual([4, 4, 4]);
    const ok = proveAnswers(requirements, entries, answers);
    expect(ok.accepted.map((a) => [a.requirement, a.verdict])).toEqual([[1, "met"], [2, "partly"], [3, "met"], [4, "none"]]);
    expect(ok.thrownAway).toEqual([]);
    const withQuote = (quote: string) => answers.map((a) => (a.requirement === 1 ? { ...a, quote } : a));
    for (const bad of ["Sail repair", "Stitched torn canvas"]) {
      const r = proveAnswers(requirements, entries, withQuote(bad));
      expect(r.thrownAway, bad).toEqual([{ requirement: 1, reason: "quote-not-on-line" }]);
      expect(r.accepted.map((a) => a.requirement)).toEqual([2, 3, 4]);
    }
  });
});
