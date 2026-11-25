import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { proveAnswers, type AiAnswer, type SentEntry, type SentRequirement } from "@/lib/engine/evidenceProof";

// EC-1, the proof of docs/PLAN-EVERY-CV.md 4.3 (tests EP1 to EP12). Pure code, no AI. Invented data; every expectation is worked out by hand
// from the four conditions of 4.3, never read from the code:
//   1. the requirement number was sent, and it was answered exactly once (twice or never = unanswered);
//   2. for met and partly: the entry number was sent;
//   3. the quote has a real word;
//   4. the quote is inside THAT entry's line (case and accents ignored).
// A failed 2, 3 or 4 throws the answer away: the requirement then reads "no evidence found" (verdict none). A none answer needs no entry and no quote.

const REQS: SentRequirement[] = [
  { n: 1, index: 2, quote: "You can care for wounds.", importance: "must" },
  { n: 2, index: 3, quote: "You can run patient intake.", importance: "must" },
];
const E = (n: number, name: string, text: string, inferred = false): SentEntry => ({ n, name, skillId: `new:${name.toLowerCase().replace(/ /g, "-")}`, line: n + 2, text, inferred });
const ENTRIES = [
  E(1, "Wound care", "Dressed and monitored wounds on a surgical ward"),
  E(2, "Patient intake", "Gave intake interviews to new patients", true),
];
const A = (requirement: number, verdict: "met" | "partly" | "none", entry: number | null, quote: string | null): AiAnswer => ({ requirement, verdict, entry, quote });
const prove = (answers: AiAnswer[], entries = ENTRIES) => proveAnswers(REQS, entries, answers);

describe("EC-1 the proof (EP1 to EP12)", () => {
  it("EP1: met with a sent entry and a quote inside its line is accepted, with that entry", () => {
    const r = prove([A(1, "met", 1, "Dressed and monitored wounds")]);
    expect(r.accepted).toEqual([{ requirement: 1, verdict: "met", entry: ENTRIES[0], quote: "Dressed and monitored wounds" }]);
    expect([r.thrownAway, r.unanswered, r.ignored]).toEqual([[], [2], 0]); // requirement 2 was not answered
  });

  it("EP2: an entry number that was not sent: the answer is thrown away, the requirement reads 'no evidence found' (none)", () => {
    const r = prove([A(1, "met", 9, "Dressed and monitored wounds"), A(2, "partly", 3, "Gave intake")]);
    expect(r.thrownAway).toEqual([{ requirement: 1, reason: "entry-not-sent" }, { requirement: 2, reason: "entry-not-sent" }]);
    expect(r.accepted).toEqual([]);
    expect(r.decided.map((d) => [d.requirement, d.verdict, d.entry, d.thrown])).toEqual([[1, "none", null, "entry-not-sent"], [2, "none", null, "entry-not-sent"]]);
  });

  it("EP3: a quote that is only on ANOTHER entry's line is not rescued", () => {
    const r = prove([A(1, "met", 1, "Gave intake interviews")]); // the quote is on entry 2's line, the answer names entry 1
    expect(r.thrownAway).toEqual([{ requirement: 1, reason: "quote-not-on-line" }]);
    expect(r.decided[0]).toMatchObject({ requirement: 1, verdict: "none", thrown: "quote-not-on-line" });
  });

  it("EP4: a quote with no real word ('a', 'of the', numbers only) is thrown away", () => {
    const r = prove([A(1, "met", 1, "of the"), A(2, "partly", 2, "a")]);
    expect(r.thrownAway.map((t) => t.reason)).toEqual(["no-real-word", "no-real-word"]);
  });

  it("EP5: none needs no entry and no quote; a leftover entry and quote on a none answer are ignored", () => {
    const r = prove([A(1, "none", 1, "Dressed and monitored wounds"), A(2, "none", null, null)]);
    expect(r.accepted).toEqual([
      { requirement: 1, verdict: "none", entry: null, quote: null },
      { requirement: 2, verdict: "none", entry: null, quote: null },
    ]);
    expect(r.thrownAway).toEqual([]);
  });

  it("EP6: partly with a sent entry and a quote on its line is accepted as partly", () => {
    const r = prove([A(2, "partly", 2, "intake interviews to new patients")]);
    expect(r.accepted).toEqual([{ requirement: 2, verdict: "partly", entry: ENTRIES[1], quote: "intake interviews to new patients" }]);
  });

  it("EP7: an answer for a requirement number that was not sent is ignored (counted), and the requirement that was sent stays unanswered, never 'none'", () => {
    const r = prove([A(7, "met", 1, "Dressed and monitored wounds")]);
    expect(r.ignored).toBe(1);
    expect(r.unanswered).toEqual([1, 2]);
    expect(r.decided).toEqual([]);
  });

  it("EP8: a requirement answered twice is unanswered (both copies ignored); the other one is judged on its own", () => {
    const r = prove([A(1, "met", 1, "Dressed and monitored wounds"), A(1, "none", null, null), A(2, "none", null, null)]);
    expect(r.unanswered).toEqual([1]);
    expect(r.accepted.map((a) => a.requirement)).toEqual([2]);
  });

  it("EP9: a requirement the AI skipped is unanswered, not 'none'", () => {
    const r = prove([A(2, "none", null, null)]);
    expect(r.unanswered).toEqual([1]);
    expect(r.decided.map((d) => d.requirement)).toEqual([2]);
  });

  it("EP10: a quote copied from the AD (the requirement's own sentence) instead of the CV is thrown away", () => {
    const r = prove([A(1, "met", 1, "You can care for wounds")]);
    expect(r.thrownAway).toEqual([{ requirement: 1, reason: "quote-not-on-line" }]);
  });

  it("EP11: capital letters and accents are ignored when the quote is looked for in the line", () => {
    const german = [E(1, "Kuehlkette", "Kühlkette überwacht und Temperaturen dokumentiert"), ENTRIES[1]];
    expect(prove([A(1, "met", 1, "DRESSED and Monitored WOUNDS")]).accepted).toHaveLength(1);
    const g = proveAnswers(REQS, german, [A(1, "met", 1, "kuhlkette uberwacht")]);
    expect(g.accepted).toHaveLength(1);
    expect(g.thrownAway).toEqual([]);
  });

  it("EP12: met or partly with no entry, or with no quote, is thrown away; a quote spanning two lines is thrown away", () => {
    const r = prove([A(1, "met", null, "Dressed and monitored wounds"), A(2, "partly", 2, null)]);
    expect(r.thrownAway).toEqual([{ requirement: 1, reason: "no-entry" }, { requirement: 2, reason: "no-quote" }]);
    const spans = prove([A(1, "met", 1, "wounds on a surgical ward Gave intake interviews")]);
    expect(spans.thrownAway).toEqual([{ requirement: 1, reason: "quote-not-on-line" }]);
  });

  it("EP13: the proof is plain code: no AI, no network, no files, and no input is changed (source guard)", () => {
    const src = readFileSync(join(process.cwd(), "lib/engine/evidenceProof.ts"), "utf8");
    expect(src).not.toMatch(/lib\/ai\/|from "ai"|fetch\(|node:fs|process\.env/);
    expect(src).toMatch(/hasRealWord\(/);
    expect(src).toMatch(/foldText\(/); // case AND accents ignored (isInAd alone ignores case but not accents)
    const frozen = Object.freeze(ENTRIES.map((e) => Object.freeze({ ...e })));
    expect(() => proveAnswers(REQS, frozen as SentEntry[], [A(1, "met", 1, "Dressed and monitored wounds")])).not.toThrow();
  });
});
