import { describe, expect, it } from "vitest";
import { checkBullet, FRAGMENT_FUNCTION_WORDS, FRAGMENT_PRONOUNS, QUALIFIERS, type BulletReason } from "@/lib/engine/bulletCheck";
import { formatBulletsReport, summarizeBullets } from "@/lib/engine/evalBulletsReport";
import type { BulletsEvalRow, BulletsEvalRun } from "@/lib/engine/evalBulletsRun";
import { foldText } from "@/lib/engine/text";
import { skills } from "@/lib/vocab";

// Step 8.3, stage 8b, tests first (docs/PLAN-8.3.md amendment 0.33): R11, reason `fragment`, checked AFTER R10. It only ever REJECTS a bullet that R1 to R10 accept.
// EVERY verdict below was worked out by hand (R1 to R10 in the rules' order, then R11) BEFORE any code; none comes from running the code. Invented lines only; no AI.
//   a) the FIRST whitespace chunk of the bullet, stripped of leading and trailing characters that are not a letter or a digit and folded, is a FUNCTION word;
//   b) the same for the LAST chunk;
//   c) the bullet holds a PRONOUN (the checker's tokens) and its first word is not the first word of its first cited line.
// a and b work on whole chunks, so "A/B" stays "a/b" (not the article "a") and "sign-up" stays whole.

const OK = { ok: true } as const;
const NO = (reason: BulletReason) => ({ ok: false, reason }) as const;
const check = (bullet: string, lines: string[], cited: number[] = [1]) => checkBullet(bullet, cited, { lines, vocabulary: skills });
const fragment = NO("fragment");

describe("F: the seven fragments (each passes R1 to R10 by hand; R11 rejects)", () => {
  it("F1: ends on 'of' (check b)", () => {
    expect(check("Managed a portfolio of", ["Managed a portfolio of 40 business customers and visited the largest ones every quarter"])).toEqual(fragment);
  });
  it("F2: starts on 'on' (check a)", () => {
    expect(check("on quality checks", ["Trained new staff on quality checks"])).toEqual(fragment);
  });
  it("F3: starts on 'against' (check a)", () => {
    expect(check("against ISO 9001", ["Carried out internal audits against ISO 9001 in 6 production areas each year"])).toEqual(fragment);
  });
  it("F4: the pronoun 'them', and the bullet starts mid-line (check c)", () => {
    expect(check("trained 6 of them", ["Wrote a short guide for new starters and trained 6 of them"])).toEqual(fragment);
  });
  it("F5: German: starts on 'für' (folded 'fur') (check a)", () => {
    expect(check("für die Finanzabteilung", ["Schrieb SQL-Abfragen für die Finanzabteilung"])).toEqual(fragment);
  });
  it("F6: German: ends on 'in' (check b)", () => {
    expect(check("Erstellte wöchentliche Berichte in", ["Erstellte wöchentliche Berichte in Excel mit Pivot-Tabellen"])).toEqual(fragment);
  });
  it("F7: the pronoun 'it', and the bullet starts mid-line (check c)", () => {
    expect(check("kept it up to date", ["Planned the weekly delivery rota for 15 drivers and kept it up to date"])).toEqual(fragment);
  });
  it("A2: starts on the article 'a' (check a)", () => {
    expect(check("a pilot for the sales team", ["Ran a pilot for the sales team"])).toEqual(fragment);
  });
});

describe("C and A1: the controls that must still be accepted", () => {
  const L7 = "Planned the weekly delivery rota for 15 drivers and kept it up to date";
  it("C1: a clean prefix of the F7 line", () => {
    expect(check("Planned the weekly delivery rota for 15 drivers", [L7])).toEqual(OK);
  });
  it("C2: the whole F7 line: the pronoun 'it' is there, but the bullet starts at the line's first word (check c does not fire)", () => {
    expect(check(L7, [L7])).toEqual(OK);
  });
  it("C3: the whole line 'Ran A/B tests on sign-up pages'", () => {
    expect(check("Ran A/B tests on sign-up pages", ["Ran A/B tests on sign-up pages"])).toEqual(OK);
  });
  it("C4: German whole line: 'Weiterbildung:' loses its colon, '2024' is a number; neither is a function word", () => {
    expect(check("Weiterbildung: Python-Grundkurs, 2024", ["Weiterbildung: Python-Grundkurs, 2024"])).toEqual(OK);
  });
  it("C5: starts in lower case on a real word; 'with' stands inside, not at an end", () => {
    expect(
      check("agreed the order of work with the team each sprint", ["Kept the backlog in Jira and agreed the order of work with the team each sprint"]),
    ).toEqual(OK);
  });
  it("C6: ends on a number-and-word, 'about' kept", () => {
    expect(check("Made about 30 cold calls a day", ["Made about 30 cold calls a day to find new customers"])).toEqual(OK);
  });
  it("C7: ends on 'prospects'", () => {
    expect(check("Gave product demos to prospects", ["Gave product demos to prospects and answered technical questions"])).toEqual(OK);
  });
  it("A1: 'A/B tests on sign-up pages' starts mid-line; its first chunk 'A/B' folds to 'a/b', which is not the article 'a'; no pronoun (the tokeniser would have read 'a')", () => {
    expect(check("A/B tests on sign-up pages", ["Ran A/B tests on sign-up pages"])).toEqual(OK);
  });
});

describe("E: R11 only rejects, and only after R10", () => {
  it("E1: a bullet that fails an earlier rule keeps its earlier reason, though it also looks like a fragment", () => {
    // starts on 'on' (a fragment), but 'yesterday' is a new word: R9 comes first
    expect(check("on quality checks yesterday", ["Trained new staff on quality checks"])).toEqual(NO("new-word"));
    // starts on 'at' (a fragment), but the limiting word 'helped' was lost: R8 comes first
    expect(check("at the counter", ["Helped customers at the counter"])).toEqual(NO("lost-qualifier"));
    // two words, starts on 'of': R2 comes first
    expect(check("of it", ["Planned the weekly delivery rota for 15 drivers and kept it up to date"])).toEqual(NO("bad-length"));
  });

  it("E2: no word of the R11 lists is a limiting word (QUALIFIERS): the two lists share nothing, so R8 and R11 never disagree on a word", () => {
    for (const w of [...FRAGMENT_FUNCTION_WORDS, ...FRAGMENT_PRONOUNS]) expect(QUALIFIERS.has(w), w).toBe(false);
  });

  it("E3: the lists, as the reviewer wrote them, folded: 22 English + 30 German function words (in and an are in both) = 50; 11 + 10 pronouns = 21", () => {
    const en = "a an the and or but of in on at by for from to with into onto within against via per as".split(" ");
    const de = "und oder aber der die das den dem des ein eine einen einem einer für mit von in im am an auf zu zur zum bei gegen nach aus um".split(" ");
    expect(en).toHaveLength(22); // hand count corrected from 25: the reviewer's English list has 22 words
    expect(de).toHaveLength(30);
    const fn = new Set([...en, ...de].map(foldText));
    expect(fn.size).toBe(50);
    expect([...FRAGMENT_FUNCTION_WORDS].sort()).toEqual([...fn].sort());
    const pen = "it its them their theirs themselves he she him his her".split(" ");
    const pde = "es ihn ihm ihnen ihr ihre ihren ihrer sie er".split(" ");
    expect(pen).toHaveLength(11);
    expect(pde).toHaveLength(10);
    const pr = new Set([...pen, ...pde].map(foldText));
    expect(pr.size).toBe(21);
    expect([...FRAGMENT_PRONOUNS].sort()).toEqual([...pr].sort());
  });
});

describe("M3: the eval report names the new reason", () => {
  const row = (dropped: BulletsEvalRow["dropped"]): BulletsEvalRow => ({
    cv: "cv-x", job: "job-x", lang: "en", pairs: [], asked: dropped.length, accepted: [], dropped, usage: { inputTokens: 1, outputTokens: 1 }, seconds: 1,
  });
  it("M3a: by hand: dropped reordered 1, fragment 2, bad-length 1 -> counted by reason", () => {
    const run: BulletsEvalRun = {
      rows: [row([{ pair: 1, reason: "reordered" }, { pair: 2, reason: "fragment" }, { pair: 3, reason: "fragment" }, { pair: 4, reason: "bad-length" }])],
      noPairs: [], failed: [], complete: true,
    };
    expect(summarizeBullets(run).byReason).toEqual({ reordered: 1, fragment: 2, "bad-length": 1 });
  });

  it("M3b: the printed line puts `fragment` after `reordered` and before `bad-length` (the rule order), not at the end", () => {
    const run: BulletsEvalRun = {
      rows: [row([{ pair: 1, reason: "reordered" }, { pair: 2, reason: "fragment" }, { pair: 3, reason: "fragment" }, { pair: 4, reason: "bad-length" }])],
      noPairs: [], failed: [], complete: true,
    };
    expect(formatBulletsReport(run, false)).toContain("M3 DROPPED BY REASON: reordered 1, fragment 2, bad-length 1\n");
  });
});
