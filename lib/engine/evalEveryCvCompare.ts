import { reportFor } from "../../app/savedAdRows";
import { buildProfile, initialConfirm, type ConfirmState } from "../cv/profile";
import { engineView, originalOf, type ViewExtras } from "../cv/engineView";
import { recallCeiling, type CeilingResult } from "./evalEveryCvCeiling";
import { everyCvKeyLevel, type KeyBlock, type KeyCheck } from "./evalEveryCvKey";
import type { BuildResult } from "./fromAd";
import type { CvBuildResult } from "./fromCv";
import { match } from "./match";
import { guardedContains } from "./quoteMatch";
import { normalizeText } from "./text";
import type { FitLevel, Requirement, Skill } from "./types";

// The baseline of the accuracy test (docs/PLAN-EVERY-CV.md sections 9 and 10, EC-0): what TODAY's product says about one pair, set against
// the owner's key. Pure code: no AI, no network, no files. It is handed the two saved readings (the CV reading and the ad reading, as
// the routes return them) and runs the page's own pipeline on them with the page's own functions, not copies of them:
//   the CV reading's proposals -> initialConfirm (named skills ticked) -> buildProfile -> engineView (splitJudgeable) -> match (fit),
//   and reportFor (the report the page shows) for the label and the level word.
//
// A key sentence and the read requirements are paired by QUOTE, with the rule the ad eval uses (equal normalised quotes, or one inside the
// other with a real word: quoteMatch.guardedContains). The eval's own pairing (evalMatch.matchRequirements) is one-to-one; a key sentence
// that names two skills is read as TWO requirements with the same quote ("A and B"), so here every read requirement goes to the key
// sentence it pairs best with (equal before contained, then the smaller difference in length, then the earlier sentence), and a sentence
// may collect several. How several are combined: if any is missing the sentence is "missing"; otherwise if any could not be judged it is
// "could not judge"; otherwise it is "met".

export type AdReading = Pick<BuildResult, "job" | "removed" | "moved" | "unlisted" | "notCounted">;

export type Today =
  | { kind: "met"; line: number }
  | { kind: "missing" }
  | { kind: "unjudged" }
  | { kind: "not-read" };

export type RequirementClass = "agree" | "false-met" | "false-missing" | "could-not-judge" | "dropped" | "other";
export const CLASSES: RequirementClass[] = ["agree", "false-met", "false-missing", "could-not-judge", "dropped", "other"];

export type CompareRow = {
  id: string; // "R3"
  tag: string; // must or nice
  quote: string;
  verdict: string; // the key's verdict
  unsure: boolean;
  keyLines: number[];
  readQuotes: string[]; // the read requirements paired with this sentence
  today: Today;
  class: RequirementClass;
  droppedWhere: string | null; // for a dropped sentence: where it went
};

export type LevelVsKey = "stronger" | "equal" | "weaker" | "not comparable";
export type Counted = Record<RequirementClass, number>;

export type PairBaseline = {
  pair: string;
  crossLanguage: boolean;
  rows: CompareRow[];
  unsureRows: CompareRow[];
  counted: Counted; // unsure rows are NOT in it
  answered: number; // rows with an answer today (met or missing), unsure rows left out
  countedTotal: number; // rows counted, unsure rows left out
  extras: { quote: string; importance: "must" | "nice"; status: "met" | "missing" | "unjudged" }[];
  today: { label: string; level: FitLevel | null };
  keyLevel: FitLevel | "no-level" | null;
  levelVsKey: LevelVsKey;
  ceiling: CeilingResult;
};

const RANK: Record<FitLevel, number> = { strong: 0, good: 1, stretch: 2, longShot: 3 };

// null = no pairing; 0 = equal quotes; 1 = one inside the other (with a real word).
function quoteRank(keyQuote: string, readQuote: string): number | null {
  const k = normalizeText(keyQuote);
  const r = normalizeText(readQuote);
  if (k === "" || r === "") return null;
  if (k === r) return 0;
  return guardedContains(k, r) ? 1 : null;
}

const sameQuote = (a: string, b: string) => quoteRank(a, b) !== null;

function whereDropped(quote: string, ad: AdReading): string {
  if (ad.notCounted.some((n) => sameQuote(quote, n.quote))) return "set aside as not a skill (a trait)";
  if (ad.moved.some((m) => sameQuote(quote, m.quote)) || ad.job.constraints.otherConditions.some((c) => sameQuote(quote, c.quote))) {
    return "moved to the conditions you check yourself";
  }
  if (ad.removed.some((x) => sameQuote(quote, x.text))) return "removed by a check";
  return "not found in the reading";
}

function combine(statuses: Today[]): Today {
  if (statuses.length === 0) return { kind: "not-read" };
  if (statuses.some((s) => s.kind === "missing")) return { kind: "missing" };
  if (statuses.some((s) => s.kind === "unjudged")) return { kind: "unjudged" };
  const lines = statuses.flatMap((s) => (s.kind === "met" ? [s.line] : []));
  return { kind: "met", line: Math.min(...lines) };
}

function classify(today: Today, verdict: string): RequirementClass {
  if (today.kind === "not-read") return "dropped";
  if (today.kind === "unjudged") return "could-not-judge";
  if (today.kind === "met") return verdict === "met" ? "agree" : verdict === "partly" || verdict === "none" ? "false-met" : "other";
  return verdict === "met" ? "false-missing" : verdict === "partly" || verdict === "none" ? "agree" : "other";
}

const emptyCounted = (): Counted => ({ agree: 0, "false-met": 0, "false-missing": 0, "could-not-judge": 0, dropped: 0, other: 0 });

export function compareBaseline(input: {
  pair: string;
  crossLanguage: boolean;
  key: KeyCheck;
  cvLines: string[]; // the CV as the page numbers it (after the page's redaction)
  cv: CvBuildResult;
  ad: AdReading;
  skills: Skill[];
  // EC-2: false (the default) measures the product as it was BEFORE the kept unlisted skills and the same-name match: the profile is used without
  // `unlistedKept`, so a requirement that is not in our skill list stays "could not judge", exactly as in the first baseline. true measures the
  // product as it is now, with the same-name match.
  withKept?: boolean;
  // EC-5: the answers of a check (lib/cv/checkBridge.ts) and the confirm choice the profile is built with. Without them: what it was (named skills ticked, no answers).
  extras?: ViewExtras & { thrownAway?: number };
  confirm?: ConfirmState;
}): PairBaseline {
  const { key, cv, ad, skills } = input;
  if (key.state !== "complete" || key.problems.length > 0) throw new Error("The key must be complete and without problems before it is compared.");

  // Today's pipeline, with the page's own functions.
  const builtWithKept = buildProfile(input.cvLines, cv.skills, input.confirm ?? initialConfirm(cv.skills), skills); // named skills ticked, inferred ones not (unless the caller chose)
  const built = input.withKept === true ? builtWithKept : { ...builtWithKept, unlistedKept: undefined };
  const report = reportFor(ad, built, skills, cv.unlisted, input.extras); // the report the page shows (label, level word)
  const view = engineView(ad.job, built, input.extras);
  const result = match(view.engineProfile, view.engineJob);

  // A requirement the same-name match rewrote for the engine is found under its rewritten form.
  const rewrittenFor = new Map<Requirement, Requirement>([...originalOf(view)].map(([rewritten, original]) => [original, rewritten]));
  const statusOf = (r: Requirement): Today => {
    const found = [...result.musts, ...result.nices].find((x) => x.requirement === (rewrittenFor.get(r) ?? r));
    if (found) return found.met && found.metBy ? { kind: "met", line: found.metBy.evidence.line } : { kind: "missing" };
    return { kind: "unjudged" }; // splitJudgeable set it aside: every skill of it is unlisted
  };

  const reqBlocks: KeyBlock[] = key.blocks.filter((b) => b.kind === "R");

  // Pair every read requirement with the key sentence it pairs best with.
  const groups: Requirement[][] = reqBlocks.map(() => []);
  const unpaired: Requirement[] = [];
  for (const r of ad.job.requirements) {
    let best: { k: number; rank: number; diff: number } | null = null;
    reqBlocks.forEach((b, k) => {
      const rank = quoteRank(b.quote, r.quote);
      if (rank === null) return;
      const diff = Math.abs(normalizeText(b.quote).length - normalizeText(r.quote).length);
      if (best === null || rank < best.rank || (rank === best.rank && diff < best.diff)) best = { k, rank, diff };
    });
    if (best === null) unpaired.push(r);
    else groups[(best as { k: number }).k].push(r);
  }

  const rows: CompareRow[] = reqBlocks.map((b, k) => {
    const today = combine(groups[k].map(statusOf));
    return {
      id: b.id,
      tag: b.tag,
      quote: b.quote,
      verdict: b.verdict,
      unsure: b.unsure === "yes",
      keyLines: b.lines ?? [],
      readQuotes: groups[k].map((g) => g.quote),
      today,
      class: classify(today, b.verdict),
      droppedWhere: today.kind === "not-read" ? whereDropped(b.quote, ad) : null,
    };
  });

  const counting = rows.filter((r) => !r.unsure);
  const counted = emptyCounted();
  for (const r of counting) counted[r.class]++;
  const answered = counting.filter((r) => r.today.kind === "met" || r.today.kind === "missing").length;

  const ceiling = recallCeiling(
    cv.skills,
    counting.filter((r) => r.verdict === "met").map((r) => ({ id: r.id, lines: r.keyLines })),
  );

  const keyLevel = everyCvKeyLevel(key);
  const todayLevel = report.level;
  let levelVsKey: LevelVsKey = "not comparable";
  if (todayLevel !== null && keyLevel !== null && keyLevel !== "no-level") {
    const d = RANK[todayLevel] - RANK[keyLevel];
    levelVsKey = d < 0 ? "stronger" : d > 0 ? "weaker" : "equal";
  }

  return {
    pair: input.pair,
    crossLanguage: input.crossLanguage,
    rows,
    unsureRows: rows.filter((r) => r.unsure),
    counted,
    answered,
    countedTotal: counting.length,
    extras: unpaired.map((r) => ({ quote: r.quote, importance: r.importance, status: statusOf(r).kind as "met" | "missing" | "unjudged" })),
    today: { label: report.fitLabel, level: todayLevel },
    keyLevel,
    levelVsKey,
    ceiling,
  };
}

// ---- totals ------------------------------------------------------------------------------------------------------------------------------

export type Totals = {
  pairs: string[];
  counted: Counted;
  answered: number;
  total: number;
  ceiling: { reachable: number; recoverable: number; needsPromptChange: number; total: number; ceiling: number | null };
};

function totalsOf(pairs: PairBaseline[]): Totals {
  const counted = emptyCounted();
  let answered = 0;
  let total = 0;
  const c = { reachable: 0, recoverable: 0, needsPromptChange: 0, total: 0 };
  for (const p of pairs) {
    for (const k of CLASSES) counted[k] += p.counted[k];
    answered += p.answered;
    total += p.countedTotal;
    c.reachable += p.ceiling.reachable;
    c.recoverable += p.ceiling.recoverable;
    c.needsPromptChange += p.ceiling.needsPromptChange;
    c.total += p.ceiling.total;
  }
  return { pairs: pairs.map((p) => p.pair), counted, answered, total, ceiling: { ...c, ceiling: c.total === 0 ? null : c.reachable / c.total } };
}

export function summarizeBaseline(pairs: PairBaseline[]): {
  all: Totals;
  crossLanguage: Totals;
  levels: Record<LevelVsKey, number>;
} {
  const levels: Record<LevelVsKey, number> = { stronger: 0, equal: 0, weaker: 0, "not comparable": 0 };
  for (const p of pairs) levels[p.levelVsKey]++;
  return { all: totalsOf(pairs), crossLanguage: totalsOf(pairs.filter((p) => p.crossLanguage)), levels };
}
