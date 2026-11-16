import { mapName } from "./mapName";
import { foldText } from "./text";
import type { Skill } from "./types";

// The arithmetic of the 5.2 measure (docs/PLAN-5.1.md, "5.2 stage 2 rules and outcome definitions"). Pure code: no AI,
// no network, no file. The script `npm run map-measure` reads the labels and prints what this returns; names never
// reach the terminal (they go to a gitignored detail file).

export type Outcome =
  | { kind: "mapped"; id: string }
  | { kind: "flagged" }
  | { kind: "notmapped"; how: "tie" | "none" };

// label: a skill id, "none" (should stay unlisted) or "not-a-skill".
export type Item = { name: string; label: string; outcome: Outcome };

// The live order: a name on the not-a-skill list is flagged before anything is mapped (as fromAd does); only then the mapper.
export function outcomeFor(name: string, skills: Skill[], isFlagged: (name: string) => boolean): Outcome {
  if (isFlagged(name)) return { kind: "flagged" };
  const r = mapName(name, skills);
  if (r.how === "exact" || r.how === "close") return { kind: "mapped", id: r.id };
  return { kind: "notmapped", how: r.how === "tie" ? "tie" : "none" };
}

export type SetResult = {
  L: number; // labelled names
  M: number; // names whose label is a skill id
  rightM: number; // of those, mapped to the right id
  right: number;
  wrongMerges: number; // mapped to a skill id that is not the label (including label none or not-a-skill)
  wronglyFlagged: number; // flagged as not-a-skill when the label is a skill id or none
  wrong: number;
  notMappedTie: number; // label is a skill id, the mapper tied
  notMappedNone: number; // label is a skill id, the mapper found nothing
  traitNotFlagged: number; // label not-a-skill, neither flagged nor mapped (in L, in no line)
  mustNotMerge: number;
};

const isSkillLabel = (label: string) => label !== "none" && label !== "not-a-skill";

export function measureSet(
  items: Item[],
  groups: string[][],
  bans: { name: string; notId: string }[],
): SetResult {
  const r: SetResult = {
    L: items.length, M: 0, rightM: 0, right: 0, wrongMerges: 0, wronglyFlagged: 0, wrong: 0,
    notMappedTie: 0, notMappedNone: 0, traitNotFlagged: 0, mustNotMerge: 0,
  };
  for (const { name, label, outcome } of items) {
    const skill = isSkillLabel(label);
    if (skill) r.M++;
    let merge = false;
    if (outcome.kind === "mapped") {
      if (outcome.id === label) {
        r.right++;
        r.rightM++;
      } else {
        r.wrongMerges++;
        if (skill && groups.some((g) => g.includes(label) && g.includes(outcome.id))) merge = true;
      }
      if (bans.some((b) => foldText(name) === foldText(b.name) && outcome.id === b.notId)) merge = true;
    } else if (outcome.kind === "flagged") {
      if (label === "not-a-skill") r.right++;
      else r.wronglyFlagged++;
    } else if (skill) {
      if (outcome.how === "tie") r.notMappedTie++;
      else r.notMappedNone++;
    } else if (label === "none") {
      r.right++;
    } else {
      r.traitNotFlagged++;
    }
    if (merge) r.mustNotMerge++;
  }
  r.wrong = r.wrongMerges + r.wronglyFlagged;
  return r;
}

export type Judged = {
  wrong: { pass: boolean; limit: number; size: number };
  recall: { pass: boolean; measurable: boolean };
  mustNotMerge: { pass: boolean };
  allPass: boolean;
};

// Wrong line: wrong <= floor(5 x size / 100), where size = |L| minus the names labelled not-a-skill that were neither
// flagged nor mapped (they are not decisions the mapper made, and counting them would loosen the line). Recall line:
// 4 x right_M >= 3 x |M|, and |M| = 0 is "not measurable" and counts as NOT passed. Must-not-merge: 0. The check
// passes only if all three pass.
export function judge(r: SetResult): Judged {
  const size = r.L - r.traitNotFlagged;
  const limit = Math.floor((5 * size) / 100);
  const wrong = { pass: r.wrong <= limit, limit, size };
  const recall = r.M === 0 ? { pass: false, measurable: false } : { pass: 4 * r.rightM >= 3 * r.M, measurable: true };
  const mustNotMerge = { pass: r.mustNotMerge === 0 };
  return { wrong, recall, mustNotMerge, allPass: wrong.pass && recall.pass && mustNotMerge.pass };
}

const word = (pass: boolean) => (pass ? "PASS" : "FAIL");

// Counts and verdicts only: no name, no percentage.
export function formatSetLines(label: string, r: SetResult, j: Judged, judgedSet: boolean): string[] {
  const lines = [
    judgedSet ? `SET ${label} (judged)` : `SET ${label} (not judged: printed next to the fresh set, not pooled; information only)`,
    `  |L| ${r.L} | |M| ${r.M} | right ${r.right} (of M: ${r.rightM}) | wrong ${r.wrong} (wrong merges ${r.wrongMerges}, wrongly flagged ${r.wronglyFlagged}) | not mapped ${r.notMappedTie + r.notMappedNone} (ties ${r.notMappedTie}, none ${r.notMappedNone}) | trait not flagged ${r.traitNotFlagged} | must-not-merge ${r.mustNotMerge}`,
    `  wrong <= floor(5 x ${j.wrong.size} / 100) = ${j.wrong.limit} (|L| ${r.L}, trait not flagged ${r.traitNotFlagged}, size used ${j.wrong.size}): wrong ${r.wrong}: ${word(j.wrong.pass)}`,
    j.recall.measurable
      ? `  recall 4 x ${r.rightM} >= 3 x ${r.M}: ${word(j.recall.pass)}`
      : "  recall: NOT MEASURABLE (|M| = 0; counts as not passed): FAIL",
    `  must-not-merge 0: ${r.mustNotMerge}: ${word(j.mustNotMerge.pass)}`,
  ];
  if (judgedSet) lines.push(`  VERDICT: ${word(j.allPass)}`);
  return lines;
}

export type DetailRow = { file: string; set: string; name: string; label: string; outcome: string; kind: "wrong" | "notMapped" | "traitNotFlagged" };

const describe = (o: Outcome) => (o.kind === "mapped" ? `mapped ${o.id}` : o.kind === "flagged" ? "flagged not-a-skill" : `not mapped (${o.how})`);

// The names of the items that went wrong or were not mapped: written to a gitignored file, never to the terminal.
export function detailRows(file: string, set: string, items: Item[]): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const { name, label, outcome } of items) {
    const skill = isSkillLabel(label);
    let kind: DetailRow["kind"] | null = null;
    if (outcome.kind === "mapped" && outcome.id !== label) kind = "wrong";
    else if (outcome.kind === "flagged" && label !== "not-a-skill") kind = "wrong";
    else if (outcome.kind === "notmapped" && skill) kind = "notMapped";
    else if (outcome.kind === "notmapped" && label === "not-a-skill") kind = "traitNotFlagged";
    if (kind) rows.push({ file, set, name, label, outcome: describe(outcome), kind });
  }
  return rows;
}

// The one-shot log: lines "set | date | vocabulary hash". The fresh set is measured once. A second measure of a set
// with a different vocabulary is "a second look"; with the same vocabulary it is a re-run.
export function repeatNote(logLines: string[], set: string, hash: string): string[] {
  const entries = logLines
    .map((l) => l.split("|").map((x) => x.trim()))
    .filter((p) => p.length === 3 && p[0] === set);
  if (entries.length === 0) return [];
  if (entries.some((e) => e[2] !== hash)) return ["REPEAT: second look, not the one-shot measure"];
  return [`RE-RUN: this set was already measured with this vocabulary on ${entries[entries.length - 1][1]}`];
}
