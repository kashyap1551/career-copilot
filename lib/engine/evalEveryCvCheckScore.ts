import { buildCheckPlan, type CheckPlan, type Checked } from "../cv/checkPlan";
import { engineView } from "../cv/engineView";
import { buildProfile, initialConfirm, type BuiltProfile, type ConfirmState } from "../cv/profile";
import { waitForTokens } from "./evalCvRun";
import { compareBaseline, type AdReading, type CompareRow, type RequirementClass } from "./evalEveryCvCompare";
import type { CallSummary } from "./evalEveryCvCheckFetch";
import type { KeyCheck } from "./evalEveryCvKey";
import type { CvBuildResult, CvSkill } from "./fromCv";
import { isUnlistedId } from "./judgeable";
import type { FitLevel, Skill } from "./types";

// The scoring of the check eval (docs/PLAN-EVERY-CV.md, the check eval, `npm run eval-check`). Pure code: no AI, no network, no files. It is handed the
// saved baseline readings of one pair, the owner's key and what the check call gave back, and it runs the page's own functions on them (buildProfile,
// buildCheckPlan, the engine view, the report) through compareBaseline: no second copy of the page's rules.
//
// Words: a "counted" row is a key row that is not marked unsure. "Final" is the status after the check. "1a" a false met: the key says partly or none,
// the final status is met. "1b" wrong evidence: an AI-judged row where the key says met but the CV line the AI cites is not one of the key's lines
// (a CANDIDATE: a key lists only some of the lines that may support a row; the owner and the reviewer read each one). A "ceiling" is a level the report
// labels "At best ...": a must stayed unjudged, so the level may be lower; it is never equal, never stronger and never weaker.

export type ConfirmMode = "named" | "all";

// What the page pre-ticks (named skills), or also the inferred ones.
export function confirmFor(proposals: CvSkill[], mode: ConfirmMode): ConfirmState {
  const base = initialConfirm(proposals);
  return mode === "named" ? base : { ...base, keptIds: [...new Set(proposals.map((p) => p.skillId))] };
}

export type PairCheckInput = {
  pair: string;
  crossLanguage: boolean;
  key: KeyCheck;
  cvLines: string[]; // as the page numbers them
  cv: CvBuildResult;
  ad: AdReading;
  skills: Skill[];
  confirm: ConfirmMode;
  estimate: number | null; // tokens the call was expected to use
  call: CallSummary | null; // null: no call was made
  answered: Checked | null; // the answers a click would show (null: no answers: no call, or the call failed)
  failure: string | null; // why the call gave no answers
};

export function planFor(input: Pick<PairCheckInput, "cvLines" | "cv" | "ad" | "skills" | "confirm">): { built: BuiltProfile; plan: CheckPlan } {
  const built = buildProfile(input.cvLines, input.cv.skills, confirmFor(input.cv.skills, input.confirm), input.skills);
  return { built, plan: buildCheckPlan(input.ad.job, built, input.skills, input.cv.skills) };
}

// ---- size and pacing ------------------------------------------------------------------------------------------------------------------------------

export const BIG_CALL_TOKENS = 7000; // the bar: no call over this
const MAX_ESTIMATE = 7800;

// Tokens a call is expected to use: the instructions, the prompt and about 600 characters of framing at about four characters a token, plus room for
// the answer (which, for this model, includes its own reasoning).
export function estimateTokens(promptChars: number, instructionsLength: number): number {
  return Math.min(MAX_ESTIMATE, Math.ceil((instructionsLength + promptChars + 600) / 4) + 2500);
}

// The wait before a call: the larger of the gap between two calls and the time the minute's allowance needs to refill to what this call is expected to use.
export function pacingWaitMs(limits: Record<string, string> | undefined, estimate: number, minGapMs = 3000, noHeaderWaitMs = 30000): number {
  return Math.max(minGapMs, waitForTokens(limits, estimate, noHeaderWaitMs));
}

// ---- one pair ------------------------------------------------------------------------------------------------------------------------------------

export type RowSource = "list" | "same-name" | "AI" | "not judged" | "not read";
export type RowDetail = {
  id: string;
  tag: string;
  quote: string;
  keyVerdict: string;
  unsure: boolean;
  keyLines: number[];
  source: RowSource;
  final: "met" | "missing" | "could not judge" | "not read";
  finalLine: number | null;
  ai: { verdict: "met" | "partly" | "none"; entryName: string | null; line: number | null; quote: string | null } | null;
  class: RequirementClass;
  falseMetA: boolean; // 1a
  wrongEvidence: boolean; // 1b
  found: boolean;
  missingParts: number; // how many read requirements of this key sentence the product counts as missing (a sentence read as two requirements can count twice)
};

// EC-8d (2a): a requirement the product judged (AI, list or same-name) that has no row in the key. `id` is "Q<n>", n the place in the ad reading, from 1.
export type ExtraRow = {
  id: string;
  tag: string;
  quote: string;
  source: "AI" | "list" | "same-name";
  aiVerdict: "met" | "partly" | "none" | null;
  aiQuote: string | null;
  final: "met" | "missing";
};

export type LevelVsKeyOrCeiling = "stronger" | "equal" | "weaker" | "ceiling" | "not comparable";

export type PairResult = {
  pair: string;
  crossLanguage: boolean;
  sent: number; // requirements sent (0 when no call was made)
  accepted: number; // accepted answers, a "none" too
  thrown: number;
  notChecked: number; // open requirements that did not fit in one check
  noCall: "no-requirements" | "no-entries" | null;
  failure: string | null;
  call: CallSummary | null;
  estimate: number | null;
  entriesAvailable: number;
  entriesSent: number;
  entriesDropped: number;
  rows: RowDetail[]; // every key requirement row, unsure ones too (marked)
  unsureRows: RowDetail[];
  conditionRows: CompareRow[]; // EC-8c (AM20): listed apart, in no number
  extraRows: ExtraRow[]; // EC-8d: judged, no key row; listed apart, in no number
  unsureMusts: number;
  keyLevel: FitLevel | "no-level" | null; // without the condition rows
  keyLevelWithConditions: FitLevel | "no-level" | null;
  checkLevel: FitLevel | null;
  label: string;
  labelBefore: string; // the label before any answer (the same-name match only)
  levelVsKey: LevelVsKeyOrCeiling;
};

export function scorePair(input: PairCheckInput): PairResult {
  const { built, plan } = planFor(input);
  if (input.answered !== null && input.answered.key !== plan.key) throw new Error("The answers do not belong to this plan.");
  const extras = input.answered === null ? undefined : { answers: input.answered.answers, thrownAway: input.answered.thrownAway };
  const base = { pair: input.pair, crossLanguage: input.crossLanguage, key: input.key, cvLines: input.cvLines, cv: input.cv, ad: input.ad, skills: input.skills, withKept: true, confirm: confirmFor(input.cv.skills, input.confirm) };
  const before = compareBaseline(base);
  const after = compareBaseline({ ...base, extras });

  // where each read requirement was judged (the page's own engine view says which were matched by the same name)
  const sameName = new Set((engineView(input.ad.job, built).sameName ?? []).map((s) => s.original));
  const answerAt = new Map((input.answered?.answers ?? []).map((a) => [a.index, a]));
  const reqs = input.ad.job.requirements.map((r, index) => ({ r, index }));

  const rows: RowDetail[] = after.rows.map((row) => {
    const members = reqs.filter((m) => row.readQuotes.includes(m.r.quote));
    const aiMembers = members.filter((m) => answerAt.has(m.index));
    const ai = aiMembers.length > 0 ? answerAt.get(aiMembers[0].index)! : null;
    const source: RowSource =
      aiMembers.length > 0 ? "AI" : members.some((m) => sameName.has(m.r)) ? "same-name" : members.some((m) => !m.r.skillIds.every(isUnlistedId)) ? "list" : members.length > 0 ? "not judged" : "not read";
    const wrongEvidence =
      !row.unsure && row.verdict === "met" &&
      aiMembers.some((m) => {
        const a = answerAt.get(m.index)!;
        return a.verdict === "met" && a.entry !== null && !row.keyLines.includes(a.entry.evidence.line);
      });
    const final = row.today.kind === "met" ? "met" : row.today.kind === "missing" ? "missing" : row.today.kind === "unjudged" ? "could not judge" : "not read";
    return {
      id: row.id,
      tag: row.tag,
      quote: row.quote,
      keyVerdict: row.verdict,
      unsure: row.unsure,
      keyLines: row.keyLines,
      source,
      final,
      finalLine: row.today.kind === "met" ? row.today.line : null,
      ai: ai === null ? null : { verdict: ai.verdict, entryName: ai.entry?.name ?? null, line: ai.entry?.evidence.line ?? null, quote: ai.quote },
      class: row.class,
      falseMetA: !row.unsure && row.class === "false-met",
      wrongEvidence,
      found: !row.unsure && row.verdict === "met" && row.today.kind === "met" && !wrongEvidence,
      missingParts: row.missingParts,
    };
  });

  // The requirements no key sentence pairs with (compareBaseline's `extras`), the judged ones: each is matched to its place in the ad reading.
  const used = new Set<number>();
  const extraRows: ExtraRow[] = [];
  for (const e of after.extras) {
    if (e.status === "unjudged") continue;
    const m = reqs.find((q) => !used.has(q.index) && q.r.quote === e.quote && q.r.importance === e.importance);
    if (!m) continue;
    used.add(m.index);
    const a = answerAt.get(m.index) ?? null;
    const source: ExtraRow["source"] = a !== null ? "AI" : sameName.has(m.r) ? "same-name" : "list";
    extraRows.push({ id: `Q${m.index + 1}`, tag: m.r.importance, quote: m.r.quote, source, aiVerdict: a?.verdict ?? null, aiQuote: a?.quote ?? null, final: e.status });
  }

  const checkLevel = after.today.level;
  const levelVsKey: LevelVsKeyOrCeiling = after.today.label.startsWith("At best ") ? "ceiling" : after.levelVsKey;
  const sent = input.call === null ? 0 : plan.requirements.length;
  return {
    pair: input.pair,
    crossLanguage: input.crossLanguage,
    sent,
    accepted: input.answered?.answers.length ?? 0,
    thrown: input.answered?.thrownAway ?? 0,
    notChecked: plan.notChecked,
    noCall: input.call !== null ? null : plan.requirements.length === 0 ? "no-requirements" : plan.entries.length === 0 ? "no-entries" : null,
    failure: input.failure,
    call: input.call,
    estimate: input.estimate,
    entriesAvailable: plan.entriesAvailable,
    entriesSent: plan.entries.length,
    entriesDropped: plan.entriesAvailable - plan.entries.length,
    rows,
    unsureRows: rows.filter((r) => r.unsure),
    conditionRows: after.conditionRows,
    extraRows,
    unsureMusts: after.unsureRows.filter((r) => r.tag === "must").length,
    keyLevel: after.keyLevel,
    keyLevelWithConditions: after.keyLevelWithConditions,
    checkLevel,
    label: after.today.label,
    labelBefore: before.today.label,
    levelVsKey,
  };
}

// ---- the seven numbers and the bar -------------------------------------------------------------------------------------------------------------------

export type Numbers = {
  falseMet: number; // 1: 1a + 1b
  falseMetA: number;
  wrongEvidence: number;
  levels: Record<LevelVsKeyOrCeiling, number>; // 2
  sent: number;
  answered: number; // 3
  keyMet: number;
  found: number; // 4
  real429: number; // 5
  biggestCall: number; // 6
  thrown: number; // 7
  pairs: number;
};

export function numbersOf(results: PairResult[]): Numbers {
  const n: Numbers = {
    falseMet: 0, falseMetA: 0, wrongEvidence: 0,
    levels: { stronger: 0, equal: 0, weaker: 0, ceiling: 0, "not comparable": 0 },
    sent: 0, answered: 0, keyMet: 0, found: 0, real429: 0, biggestCall: 0, thrown: 0, pairs: results.length,
  };
  for (const r of results) {
    for (const row of r.rows) {
      if (row.unsure) continue;
      if (row.falseMetA) n.falseMetA++;
      if (row.wrongEvidence) n.wrongEvidence++;
      if (row.keyVerdict === "met") {
        n.keyMet++;
        if (row.found) n.found++;
      }
    }
    n.levels[r.levelVsKey]++;
    n.sent += r.sent;
    n.answered += r.accepted;
    n.thrown += r.thrown;
    n.real429 += r.call?.real429 ?? 0;
    n.biggestCall = Math.max(n.biggestCall, (r.call?.inputTokens ?? 0) + (r.call?.outputTokens ?? 0));
  }
  n.falseMet = n.falseMetA + n.wrongEvidence;
  return n;
}

export type BarItem = { id: string; pass: boolean };
export function bar(n: Numbers): { items: BarItem[]; pass: boolean } {
  const items: BarItem[] = [
    { id: "1", pass: n.falseMet === 0 },
    { id: "2", pass: n.levels.stronger === 0 && n.levels.equal * 10 >= 8 * n.pairs },
    { id: "3", pass: n.sent > 0 && n.answered * 10 >= 9 * n.sent },
    { id: "4", pass: n.keyMet > 0 && n.found * 5 >= 4 * n.keyMet },
    { id: "5", pass: n.real429 === 0 },
    { id: "6", pass: n.biggestCall <= BIG_CALL_TOKENS },
    { id: "7", pass: n.sent > 0 && n.thrown * 10 <= n.sent },
  ];
  return { items, pass: items.every((i) => i.pass) };
}
