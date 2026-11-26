import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { toViewAnswers } from "@/lib/cv/checkBridge";
import { requestHash } from "@/lib/engine/evalFingerprint";
import { compareBaseline } from "@/lib/engine/evalEveryCvCompare";
import { buildProfile } from "@/lib/cv/profile";
import { buildCheckPlan } from "@/lib/cv/checkPlan";
import { captureCheckRequestBody } from "@/lib/ai/checkRequestBody";
import { bar, confirmFor, estimateTokens, numbersOf, pacingWaitMs, planFor, scorePair, type PairCheckInput, type PairResult } from "@/lib/engine/evalEveryCvCheckScore";
import { checkMarkdown } from "@/lib/engine/evalEveryCvCheckReport";
import { PROBE_ENTRIES, PROBE_REQUIREMENTS } from "@/lib/engine/evalEveryCvCheckProbe";
import { CALL, pairInput, prop, req, REPLY_X, REPLY_Y, REPLY_Z, X, Y, Z, type Spec } from "./support/checkEvalWorld";
import { LINES_W, personW, SENT_W } from "./support/checkWorld";
import { job } from "./support/evidenceFixtures";
import { checkEveryCvKey } from "@/lib/engine/evalEveryCvKey";

// EC-5a (docs/PLAN-EVERY-CV.md, the check eval; tests ES, EL, EP, EN, ER, EX, EI, EZ). The file is named checkEval*, not everyCv*: EI1 captures the check's
// request on a FAKE fetch (lib/ai/checkRequestBody.ts), and tests/everyCvBaseline.test.ts D3 keeps every everyCv*.test.ts away from lib/ai. Pure code, invented data, no AI, no network. Every expectation is
// worked out by hand from the three invented pairs X, Y and Z of tests/support/checkEvalWorld.ts, with the product's own fit rules (0 missing musts
// Strong, 1 Good, 2 Stretch, 3 or more Long shot):
//   X  musts M1 met, M2 partly, M3 none (key: 2 missing = Stretch). Check: M1 met on the key's line, M2 partly, M3 none = 2 missing = Stretch: EQUAL.
//      The nice N1 (Excel) is met by the list and is not sent. Sent 3, answered 3, thrown 0. Key-met rows (counted): M1, N1 = 2, found 2.
//   Y  musts M1 met (line 2), M2 none (key: 1 missing = Good). The AI says M1 met on line 4 (the key says line 2: wrong evidence, 1b) and M2 met (the
//      key says none: 1a). Check: 0 missing = Strong: STRONGER. Sent 2, answered 2. Key-met rows: M1 = 1, found 0.
//   Z  musts M1 met (line 1), M2 met (line 2) (key Strong). The AI says M1 met on line 1; the answer for M2 is thrown away. The level stays Strong but
//      one must is not judged: the label is "At best Strong ...": a CEILING. Sent 2, answered 1, thrown 1. Key-met rows 2, found 1. Its call: 7,150 tokens.
// Totals over X, Y, Z: sent 7; number 1 = 2 (1a 1, 1b 1); number 2 = stronger 1, equal 1, ceiling 1, weaker 0; number 3 = 6 of 7; number 4 = 3 of 5;
// number 5 = 0; number 6 = 7,150; number 7 = 1 of 7. The bar fails on numbers 1, 2, 3, 4, 6 and 7 (the owner listed 1, 2, 4, 6; but 6 of 7 is 86% < 90% and 1 of 7 is 14% > 10%); only number 5 holds.

function scored(spec: Spec, reply: unknown, call: PairCheckInput["call"], over: Partial<PairCheckInput> = {}): PairResult {
  const base = pairInput(spec, over);
  const { plan } = planFor(base);
  const bridged = toViewAnswers({ requirements: plan.requirements, entries: plan.entries }, reply);
  if (!bridged.ok) throw new Error("the invented reply is not readable");
  return scorePair({ ...base, call, answered: { key: plan.key, answers: bridged.answers, thrownAway: bridged.thrownAway, sent: plan.requirements.length }, ...over });
}
const rx = () => scored(X, REPLY_X, CALL(2900, 1800));
const ry = () => scored(Y, REPLY_Y, CALL(3000, 2200));
const rz = () => scored(Z, REPLY_Z, CALL(4300, 2850));
const three = () => [rx(), ry(), rz()];

describe("EC-5a the seven numbers on X, Y and Z (ES)", () => {
  it("ES0: each pair alone, as worked out above", () => {
    const x = rx();
    expect([x.sent, x.accepted, x.thrown, x.levelVsKey, x.keyLevel, x.checkLevel]).toEqual([3, 3, 0, "equal", "stretch", "stretch"]);
    const y = ry();
    expect([y.sent, y.accepted, y.levelVsKey, y.keyLevel, y.checkLevel]).toEqual([2, 2, "stronger", "good", "strong"]);
    const z = rz();
    expect([z.sent, z.accepted, z.thrown, z.levelVsKey, z.keyLevel, z.checkLevel]).toEqual([2, 1, 1, "ceiling", "strong", "strong"]);
    expect(z.label.startsWith("At best Strong")).toBe(true);
  });

  it("ES1: false met = 2 (1a: M2 of Y, the key says none; 1b: M1 of Y, the key says line 2 and the AI cites line 4)", () => {
    const n = numbersOf(three());
    expect([n.falseMet, n.falseMetA, n.wrongEvidence]).toEqual([2, 1, 1]);
    expect(numbersOf([rx()]).falseMet).toBe(0);
  });

  it("ES2: levels: stronger 1, equal 1, ceiling 1, weaker 0, not comparable 0", () => {
    expect(numbersOf(three()).levels).toEqual({ stronger: 1, equal: 1, weaker: 0, ceiling: 1, "not comparable": 0 });
  });

  it("ES3: answered 6 of 7 requirements sent", () => {
    const n = numbersOf(three());
    expect([n.answered, n.sent]).toEqual([6, 7]);
  });

  it("ES4: the key's met found: 3 of 5 (X 2 of 2, Y 0 of 1, Z 1 of 2)", () => {
    const n = numbersOf(three());
    expect([n.found, n.keyMet]).toEqual([3, 5]);
    const y = ry();
    expect(y.rows.find((r) => r.id === "R1")).toMatchObject({ wrongEvidence: true, found: false });
  });

  it("ES5: the 429 count is 0 here, and 1 when one call saw a 429", () => {
    expect(numbersOf(three()).real429).toBe(0);
    expect(numbersOf([rx(), scored(Y, REPLY_Y, CALL(3000, 2200, { statuses: [429, 429], real429: 1, attempts: 2 })), rz()]).real429).toBe(1);
  });

  it("ES6: the biggest call is 7,150 tokens (Z: 4,300 in and 2,850 out)", () => {
    expect(numbersOf(three()).biggestCall).toBe(7150);
  });

  it("ES7: throw-away is 1 of 7", () => {
    const n = numbersOf(three());
    expect([n.thrown, n.sent]).toEqual([1, 7]);
  });

  it("ES8: an unsure key row is shown apart and changes none of numbers 1, 2 and 4: Y with its M2 row unsure has 1 false met (the 1b only)", () => {
    const y2 = scored({ ...Y, key: [{ v: "met", lines: "2" }, { v: "none", unsure: true }] }, REPLY_Y, CALL(3000, 2200));
    expect(y2.unsureRows.map((r) => r.id)).toEqual(["R2"]);
    const n = numbersOf([rx(), y2, rz()]);
    expect([n.falseMet, n.falseMetA, n.wrongEvidence]).toEqual([1, 0, 1]);
    expect(n.keyMet).toBe(5);
    expect(y2.unsureMusts).toBe(1);
    expect(y2.rows.find((r) => r.id === "R2")).toMatchObject({ unsure: true, falseMetA: false, wrongEvidence: false, found: false }); // the row itself says it is not counted
    // an unsure key row that says MET is left out of "key met" and "found": X with its first row unsure has 4 key-met rows (X 1, Y 1, Z 2), 2 found
    const x2 = scored({ ...X, key: [{ v: "met", lines: "3", unsure: true }, ...X.key.slice(1)] }, REPLY_X, CALL(2900, 1800));
    const m = numbersOf([x2, ry(), rz()]);
    expect([m.keyMet, m.found]).toEqual([4, 2]);
    expect(x2.unsureRows.map((r) => r.id)).toEqual(["R1"]);
  });

  it("ES9: the bar passes only when all seven hold; one failing number fails it; the three pairs fail on numbers 1, 2, 3, 4, 6 and 7 (6 of 7 answered is 86%; 1 of 7 thrown is 14%)", () => {
    const failing = bar(numbersOf(three()));
    expect(failing.pass).toBe(false);
    expect(failing.items.filter((i) => !i.pass).map((i) => i.id)).toEqual(["1", "2", "3", "4", "6", "7"]); // 3: 6 of 7 is below 90%; 7: 1 of 7 is above 10%; only 5 holds
    const good = { falseMet: 0, falseMetA: 0, wrongEvidence: 0, levels: { stronger: 0, equal: 8, weaker: 1, ceiling: 1, "not comparable": 0 }, sent: 100, answered: 90, keyMet: 10, found: 8, real429: 0, biggestCall: 7000, thrown: 10, pairs: 10 };
    expect(bar(good).pass).toBe(true);
    for (const worse of [{ falseMet: 1 }, { levels: { ...good.levels, stronger: 1 } }, { levels: { ...good.levels, equal: 7 } }, { answered: 89 }, { found: 7 }, { real429: 1 }, { biggestCall: 7001 }, { thrown: 11 }]) {
      expect(bar({ ...good, ...worse }).pass, JSON.stringify(worse)).toBe(false);
    }
  });

  it("ES10: a pair the key cannot rank (no must in the key) is 'not comparable' and never counts as equal", () => {
    const only: Spec = { pair: "pair-n", cvLines: ["Alex Example", "Kept pastry molds in order daily"], proposals: [prop("Mold care", "new:mold-care", false, 2, "pastry molds")], reqs: [req("Mold work is a plus.", "nice", "new:mold-work")], key: [{ v: "met", lines: "2" }], unlisted: [] };
    const r = scored(only, { answers: [{ requirement: 1, verdict: "met", entry: 1, quote: "pastry molds" }], thrownAway: 0 }, CALL(1000, 500));
    expect(r.levelVsKey).toBe("not comparable");
    const n = numbersOf([r]);
    expect([n.levels["not comparable"], n.levels.equal]).toEqual([1, 0]);
  });
});

describe("EC-5a the ceiling (EL)", () => {
  it("EL1: a ceiling is never equal, stronger or weaker; a Long shot with an unjudged must compares normally; a pair with no must judged has no level and is not comparable", () => {
    const z = rz();
    expect(z.levelVsKey).toBe("ceiling");
    // Long shot: four musts, the key says none for all (4 missing = Long shot). The AI says none for three; the fourth answer is thrown away.
    const musts = ["You mend roofs.", "You paint walls.", "You lay tiles.", "You fit windows."];
    const L: Spec = {
      pair: "pair-l", cvLines: ["Alex Example", "Wrote SQL reports"], proposals: [prop("SQL", "sql", true, 2, "Wrote SQL reports")],
      reqs: musts.map((m, i) => req(m, "must", `new:l${i}`)), key: musts.map(() => ({ v: "none" as const })), unlisted: [],
    };
    const noneAll = { answers: [1, 2, 3].map((n) => ({ requirement: n, verdict: "none", entry: null, quote: null })), thrownAway: 1 };
    const l = scored(L, noneAll, CALL(1000, 500));
    expect([l.keyLevel, l.checkLevel, l.levelVsKey]).toEqual(["longShot", "longShot", "equal"]);
    expect(l.label.startsWith("At best")).toBe(false);
    // every must thrown away: the label is "No level", the level is null
    const lost = scored(L, { answers: [], thrownAway: 4 }, CALL(1000, 500));
    expect([lost.checkLevel, lost.levelVsKey]).toEqual([null, "not comparable"]);
  });
});

describe("EC-5a pacing and size (EP, EN)", () => {
  it("EP1: 2,000 tokens left of 8,000 a minute and a call of 6,000: wait ceil((6000 - 2000) / (8000 / 60) * 1000) + 500 = 30,500 ms; with room, the 3 s gap", () => {
    expect(pacingWaitMs({ "x-ratelimit-remaining-tokens": "2000", "x-ratelimit-limit-tokens": "8000" }, 6000)).toBe(30500);
    expect(pacingWaitMs({ "x-ratelimit-remaining-tokens": "7000", "x-ratelimit-limit-tokens": "8000" }, 6000)).toBe(3000);
    expect(pacingWaitMs(undefined, 6000)).toBe(30000); // no header: the fallback wait
  });

  it("EN1: the estimate: a 14,000-character prompt gives ceil((2665 + 14000 + 600) / 4) + 2500 = 6,817 (fine); 16,000 gives 7,317 (over 7,000); never above 7,800", () => {
    expect(estimateTokens(14000, 2665)).toBe(6817);
    expect(estimateTokens(16000, 2665)).toBe(7317);
    expect(estimateTokens(100000, 2665)).toBe(7800);
    expect(estimateTokens(14000, 2665) > 7000).toBe(false);
    expect(estimateTokens(16000, 2665) > 7000).toBe(true);
  });
});

describe("EC-5a the report (ER)", () => {
  const results = () => three();
  const info = { runId: "2026-11-26T00-00-00-000Z", fingerprint: "f".repeat(64), counted: false, confirm: "named" as const, dry: false, head: "abc1234", baselineRun: "base-run", keyCommit: "k1", model: "model-x", requestHash: "61d7628d46", instructionsLength: 2665, readingVersion: "3", vocabulary: "v".repeat(64) };

  it("ER1: the per-requirement table has its columns; the wrong-evidence candidate comes first, then the disagreements, then the rest", () => {
    const md = checkMarkdown({ info, results: results(), stopped: null, failed: [] });
    expect(md).toContain("| Pair | Req | Tag | Key verdict | Key lines | Source | Final | AI verdict | AI entry | AI line | AI quote | Class | Note |");
    const lines = md.split("\n").filter((l) => /^\| pair-[xyz] \| R\d /.test(l));
    expect(lines).toHaveLength(4 + 2 + 2); // X 4 rows, Y 2, Z 2
    expect(lines[0]).toContain("wrong-evidence candidate"); // Y R1 first
    expect(lines[0]).toContain("pair-y | R1");
    // after the candidate (which the key's class calls Agree, only its evidence is in doubt), every disagreement comes before every Agree row
    const rest = lines.slice(1);
    const firstAgree = rest.findIndex((l) => l.includes("| Agree |"));
    const lastNotAgree = rest.map((l) => !l.includes("| Agree |")).lastIndexOf(true);
    expect(firstAgree).toBeGreaterThan(-1);
    expect(lastNotAgree).toBeLessThan(firstAgree);
  });

  it("ER2: the per-pair table has the unsure-must column and the level columns", () => {
    const md = checkMarkdown({ info, results: [scored({ ...Y, key: [{ v: "met", lines: "2" }, { v: "none", unsure: true }] }, REPLY_Y, CALL(3000, 2200))], stopped: null, failed: [] });
    expect(md).toContain("| Pair | Requirements sent | Entries available | Entries sent | Dropped by the cap | Estimated tokens | Tokens in + out | Attempts | Elapsed ms | Key level | Check level | Ceiling | Against key | Unsure musts |");
    expect(md).toMatch(/\| pair-y \| 2 \| 6 \| 6 \| 0 \| 5000 \| 5200 \| 1 \| 4000 \| Good \| Strong \| no \| stronger \| 1 \|/);
  });

  it("ER3: a plan with 124 CV lines shows 124 available, 120 sent and 4 dropped", () => {
    const lines = Array.from({ length: 124 }, (_, i) => `Entry line number ${i + 1}`);
    const spec: Spec = {
      pair: "pair-big", cvLines: lines,
      proposals: lines.map((l, i) => prop(`Skill ${i + 1}`, `new:skill-${i + 1}`, false, i + 1, l)),
      reqs: [req("You do big things.", "must", "new:big")], key: [{ v: "none" }], unlisted: [],
    };
    const r = scored(spec, { answers: [{ requirement: 1, verdict: "none", entry: null, quote: null }], thrownAway: 0 }, CALL(5000, 1000));
    expect([r.entriesAvailable, r.entriesSent, r.entriesDropped]).toEqual([124, 120, 4]);
    expect(checkMarkdown({ info, results: [r], stopped: null, failed: [] })).toMatch(/\| pair-big \| 1 \| 124 \| 120 \| 4 \|/);
  });

  it("ER4: the summary against the bar names all seven numbers with pass or fail, as counts", () => {
    const md = checkMarkdown({ info, results: results(), stopped: null, failed: [] });
    expect(md).toContain("1. False met: 2 (1a 1, 1b 1) FAIL");
    expect(md).toContain("2. Levels: stronger 1, equal 1, weaker 0, ceiling 1, not comparable 0 FAIL");
    expect(md).toContain("3. Answered: 6 of 7 FAIL");
    expect(md).toContain("4. Key met found: 3 of 5 FAIL");
    expect(md).toContain("5. 429 seen: 0 pass");
    expect(md).toContain("6. Biggest call: 7150 tokens FAIL");
    expect(md).toContain("7. Thrown away: 1 of 7 FAIL");
    expect(md).toContain("BAR NOT MET");
  });
});

describe("EC-5a compareBaseline with extras (EX)", () => {
  it("EX1: with the answers of the world W of EC-4a (wound care met on CV line 4): that row is 'agree' when the key says met on line 4", () => {
    const adText = "You can care for wounds.\nYou can run patient intake.";
    const key = checkEveryCvKey(`R1 [must] "You can care for wounds."\nverdict: met\ncv line(s): 4\nunsure:\nwhy:\n\nR2 [must] "You can run patient intake."\nverdict: none\ncv line(s):\nunsure:\nwhy:`, adText, 4);
    const cv = { skills: [{ name: "SQL", skillId: "sql", listed: true, line: 2, quote: "Wrote SQL queries", label: "named" as const }, { name: "Ward nursing", skillId: "new:ward-nursing", listed: false, line: 4, quote: "Dressed and monitored wounds", label: "named" as const }], removed: [], duplicates: 0, unlisted: [] };
    const ad = { job: { ...job(), requirements: [job().requirements[2], job().requirements[3]] }, removed: [], moved: [], unlisted: [], notCounted: [] };
    const built = buildProfile(LINES_W, cv.skills, { ...{ keptIds: ["sql", "new:ward-nursing"], added: [], inProgress: [], languages: [], cities: "", workModes: [], years: "", availableFrom: "" } }, skills);
    const plan = buildCheckPlan(ad.job, built, skills, cv.skills);
    const bridged = toViewAnswers({ requirements: plan.requirements, entries: plan.entries }, { answers: [{ requirement: 1, verdict: "met", entry: 4, quote: "Dressed and monitored wounds" }, { requirement: 2, verdict: "none", entry: null, quote: null }], thrownAway: 0 });
    if (!bridged.ok) throw new Error("reply");
    const input = { pair: "w", crossLanguage: false, key, cvLines: LINES_W, cv, ad, skills, withKept: true };
    const without = compareBaseline(input);
    expect(without.rows[0].class).toBe("could-not-judge");
    const withAnswers = compareBaseline({ ...input, extras: { answers: bridged.answers, thrownAway: 0 } });
    expect(withAnswers.rows[0]).toMatchObject({ id: "R1", class: "agree", today: { kind: "met", line: 4 } });
    expect(withAnswers.rows[1]).toMatchObject({ id: "R2", class: "agree", today: { kind: "missing" } });
  });

  it("EX2: with no extras and no confirm choice the output is what it was (the same call twice, and the same as an explicit empty choice)", () => {
    const base = pairInput(X);
    const a = compareBaseline({ pair: base.pair, crossLanguage: false, key: base.key, cvLines: base.cvLines, cv: base.cv, ad: base.ad, skills });
    const b = compareBaseline({ pair: base.pair, crossLanguage: false, key: base.key, cvLines: base.cvLines, cv: base.cv, ad: base.ad, skills, extras: undefined, confirm: undefined });
    expect(b).toEqual(a);
    expect(a.rows.map((r) => r.today.kind)).toEqual(["unjudged", "unjudged", "unjudged", "met"]); // before any check: M1 to M3 not judged, the nice met by the list
  });

  it("EX2b: the defaults, on a world that tells them apart: a kept skill with the requirement's own id is NOT matched by name unless withKept is true, and an inferred skill is NOT ticked unless the confirm choice says so", () => {
    const S: Spec = {
      pair: "pair-s", cvLines: ["Alex Example", "Kept pastry molds in order daily", "Wrote Excel sheets for the shop"],
      proposals: [prop("Mold care", "new:mold-care", false, 2, "pastry molds"), { ...prop("Excel", "excel", true, 3, "Excel sheets"), label: "inferred" as const }],
      reqs: [req("You do mold care.", "must", "new:mold-care"), req("You know Excel.", "must", "excel")],
      key: [{ v: "met", lines: "2" }, { v: "met", lines: "3" }], unlisted: [],
    };
    const b = pairInput(S);
    const input = { pair: b.pair, crossLanguage: false, key: b.key, cvLines: b.cvLines, cv: b.cv, ad: b.ad, skills };
    expect(compareBaseline(input).rows.map((r) => r.today.kind)).toEqual(["unjudged", "missing"]); // no same-name match, Excel not ticked
    expect(compareBaseline({ ...input, withKept: true }).rows.map((r) => r.today.kind)).toEqual(["met", "missing"]); // same-name match only
    expect(compareBaseline({ ...input, withKept: true, confirm: confirmFor(b.cv.skills, "all") }).rows.map((r) => r.today.kind)).toEqual(["met", "met"]);
  });

  it("EX3: the confirm choice 'all' ticks the inferred skills too; 'named' ticks only the named ones", () => {
    const p = [prop("A", "new:a", false, 2, "x"), { ...prop("B", "new:b", false, 3, "y"), label: "inferred" as const }];
    expect(confirmFor(p, "named").keptIds).toEqual(["new:a"]);
    expect(confirmFor(p, "all").keptIds).toEqual(["new:a", "new:b"]);
  });
});

describe("EC-5a the probe and the ignore line (EI, EZ)", () => {
  it("EI1: the probe copy hashes to the PINNED literal read from the pin test, so the script prints the same hash", async () => {
    const pin = /const PINNED = "([0-9a-f]{10})"/.exec(readFileSync(join(process.cwd(), "tests/checkRequestHashPin.test.ts"), "utf8"));
    expect(pin).not.toBeNull();
    process.env.GROQ_MODEL = "openai/gpt-oss-120b";
    expect(requestHash(await captureCheckRequestBody(PROBE_REQUIREMENTS, PROBE_ENTRIES)).slice(0, 10)).toBe(pin![1]);
  });

  it("EZ1: eval-runs/every-cv-check/ is ignored by git", () => {
    expect(() => execFileSync("git", ["check-ignore", "-q", "eval-runs/every-cv-check/2026-11-26T10-00-00-000Z/check.md"], { cwd: process.cwd() })).not.toThrow();
    expect(() => execFileSync("git", ["check-ignore", "-q", "eval-runs/every-cv-check/state.json"], { cwd: process.cwd() })).not.toThrow();
  });
});

void SENT_W;
void personW;
