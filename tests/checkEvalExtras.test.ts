import { describe, expect, it } from "vitest";
import { toViewAnswers } from "@/lib/cv/checkBridge";
import { checkEveryCvKey } from "@/lib/engine/evalEveryCvKey";
import { checkMarkdown } from "@/lib/engine/evalEveryCvCheckReport";
import { planFor, scorePair, type PairResult } from "@/lib/engine/evalEveryCvCheckScore";
import { CALL, pairInput, REPLY_X, req, X, type Spec } from "./support/checkEvalWorld";

// EC-8d (docs/PLAN-EVERY-CV.md, EC-8): two additions to the check eval report. 2a: a table "Extra rows" with every requirement the product judged (AI, list
// or same-name) that has no row in the key, never hidden, not counted. 2b: under each pair whose check level is not equal to its key level, one line that
// names the product's missing must-haves and the key's, by requirement id. Invented data, hand-worked, no AI.
//
// World EX (the CV of pair X, 5 lines: 3 "Kept pastry molds in order daily", 2 "Opened the workshop each morning", 4 "Swept the floor", 5 "Wrote Excel sheets
// for the shop"; the person has Mold care (unlisted, line 3) and Excel (listed, line 5)). The ad, in its own order (the number is the ad's place, from 1):
//   Q1 must  You keep equipment in order.   (unlisted)  key R1 met l3
//   Q2 nice  Excel is a plus.               (listed)    NO key row: judged by the list, met (line 5)
//   Q3 must  You lead a small team.         (unlisted)  key R2 met l2: one key sentence, read as TWO requirements (Q3 and Q4, the same words)
//   Q4 must  You lead a small team.         (unlisted)
//   Q5 must  You can sweep floors.          (unlisted)  NO key row: sent to the check
// The check sends the four open musts as R1 (Q1), R2 (Q3), R3 (Q4), R4 (Q5); the entries are the 5 CV lines. The AI says: R1 met on line 3, R2 partly on line 2,
// R3 none, R4 partly on line 4. So the product has: Q1 met, Q3 missing, Q4 missing (partly and none both count as missing), Q5 missing: 3 missing musts =
// Long shot. The key has R1 met, R2 met: 0 missing = Strong. The level is "weaker".

const EX: Spec = {
  ...X,
  pair: "pair-ex",
  reqs: [
    req("You keep equipment in order.", "must", "new:equipment-order"),
    req("Excel is a plus.", "nice", "excel"),
    req("You lead a small team.", "must", "new:team-lead"),
    req("You lead a small team.", "must", "new:team-leadership"),
    req("You can sweep floors.", "must", "new:sweeping"),
  ],
  key: [{ v: "none" }, { v: "none" }, { v: "none" }, { v: "none" }, { v: "none" }], // only to let pairInput build; the real key is passed in
};
const KEY_TEXT = 'R1 [must] "You keep equipment in order."\nverdict: met\ncv line(s): 3\nunsure:\nwhy:\n\nR2 [must] "You lead a small team."\nverdict: met\ncv line(s): 2\nunsure:\nwhy:';
const REPLY_EX = {
  answers: [
    { requirement: 1, verdict: "met", entry: 3, quote: "pastry molds in order" },
    { requirement: 2, verdict: "partly", entry: 2, quote: "Opened the workshop" },
    { requirement: 3, verdict: "none", entry: null, quote: null },
    { requirement: 4, verdict: "partly", entry: 4, quote: "Swept the floor" },
  ],
  thrownAway: 0,
};
function scoredEx(): PairResult {
  const key = checkEveryCvKey(KEY_TEXT, "You keep equipment in order.\nYou lead a small team.", EX.cvLines.length);
  const base = pairInput(EX, { key });
  const { plan } = planFor(base);
  const bridged = toViewAnswers({ requirements: plan.requirements, entries: plan.entries }, REPLY_EX);
  if (!bridged.ok) throw new Error("the invented reply is not readable");
  return scorePair({ ...base, call: CALL(2000, 1000), answered: { key: plan.key, answers: bridged.answers, thrownAway: 0, sent: plan.requirements.length } });
}
function scoredX(): PairResult {
  const base = pairInput(X);
  const { plan } = planFor(base);
  const bridged = toViewAnswers({ requirements: plan.requirements, entries: plan.entries }, REPLY_X);
  if (!bridged.ok) throw new Error("the invented reply is not readable");
  return scorePair({ ...base, call: CALL(2000, 1000), answered: { key: plan.key, answers: bridged.answers, thrownAway: 0, sent: plan.requirements.length } });
}
const info = { runId: "r", counted: false, dry: false, fingerprint: "f".repeat(64), requestHash: "h", instructionsLength: 2665, model: "m", readingVersion: "3", vocabulary: "v".repeat(64), baselineRun: "b", keyCommit: "k", head: "h" } as never;

describe("EC-8d the check report: extra rows and the missing musts (EE)", () => {
  it("EE1: the extra rows are the judged requirements with no key row: Q2 (list, met) and Q5 (AI, partly, so missing); Q3 and Q4 belong to key row R2 and are not extras", () => {
    const r = scoredEx();
    expect(r.extraRows).toEqual([
      { id: "Q2", tag: "nice", quote: "Excel is a plus.", source: "list", aiVerdict: null, aiQuote: null, final: "met" },
      { id: "Q5", tag: "must", quote: "You can sweep floors.", source: "AI", aiVerdict: "partly", aiQuote: "Swept the floor", final: "missing" },
    ]);
    expect(r.rows.map((x) => x.id)).toEqual(["R1", "R2"]);
  });

  it("EE2: the extra rows are in no number: the key met rows are R1 and R2 (2), found 1 (R2 is missing because of its two parts), false met 0", () => {
    const r = scoredEx();
    expect([r.rows[0].found, r.rows[1].found]).toEqual([true, false]);
    expect(r.rows[1].final).toBe("missing");
  });

  it("EE3: the pair-level counts: the product has 3 missing musts, and R2 counts 2 of them (two parts)", () => {
    const r = scoredEx();
    expect(r.rows.map((x) => x.missingParts)).toEqual([0, 2]);
    expect([r.keyLevel, r.checkLevel, r.levelVsKey]).toEqual(["strong", "longShot", "weaker"]);
  });

  it("EE4: checkMarkdown has the 'Extra rows' table with both rows, and under pair-ex (weaker) the line with the product's and the key's missing musts", () => {
    const md = checkMarkdown({ info, results: [scoredEx()], stopped: null, failed: [] });
    expect(md).toContain("## Extra rows (judged by the product, no row in the key; not counted, never hidden): 2");
    expect(md).toMatch(/\| pair-ex \| Q2 \| nice \| list \| - \| - \| met \|/);
    expect(md).toMatch(/\| pair-ex \| Q5 \| must \| AI \| partly \| "?Swept the floor"? \| missing \|/);
    expect(md).toContain("pair-ex: product missing musts: R2 (2 parts), Q5; key missing musts: none.");
  });

  it("EE5: a pair whose level equals its key's gets no such line (pair X is equal), and with no extra row the table says none", () => {
    const x = scoredX();
    expect(x.levelVsKey).toBe("equal");
    const md = checkMarkdown({ info, results: [x], stopped: null, failed: [] });
    expect(md).not.toContain("pair-x: product missing musts");
    expect(md).toContain("## Extra rows (judged by the product, no row in the key; not counted, never hidden): 0");
  });

  it("EE6: where the key has missing musts, they are named by key id (a partly counts as missing, an unsure one too)", () => {
    const key = checkEveryCvKey('R1 [must] "You keep equipment in order."\nverdict: partly\ncv line(s): 3\nunsure: yes\nwhy:\n\nR2 [must] "You lead a small team."\nverdict: none\ncv line(s):\nunsure:\nwhy:', "You keep equipment in order.\nYou lead a small team.", EX.cvLines.length);
    const base = pairInput(EX, { key });
    const { plan } = planFor(base);
    const bridged = toViewAnswers({ requirements: plan.requirements, entries: plan.entries }, REPLY_EX);
    if (!bridged.ok) throw new Error("reply");
    const r = scorePair({ ...base, call: CALL(2000, 1000), answered: { key: plan.key, answers: bridged.answers, thrownAway: 0, sent: plan.requirements.length } });
    const md = checkMarkdown({ info, results: [r], stopped: null, failed: [] });
    expect(md).toContain("key missing musts: R1, R2.");
  });
});
