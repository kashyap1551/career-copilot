import { levelName } from "./explain";
import { CLASSES, summarizeBaseline, type CompareRow, type PairBaseline, type RequirementClass } from "./evalEveryCvCompare";
import type { CallRecord, Failure } from "./evalEveryCvRun";
import type { FitLevel } from "./types";

// What the baseline run writes and prints (docs/PLAN-EVERY-CV.md section 10, EC-0). Pure text and data: no file, no AI. Counts only, never
// a made-up percentage (project rule 6). Nothing here holds a line of a CV, an access code, an address or an environment value.

export type RunInfo = { runId: string; fingerprint: string; keyCommit: string; vocabulary: string; dry: boolean };
export type ReportInput = {
  info: RunInfo;
  pairs: PairBaseline[]; // the HEADLINE set: today, before the kept skills (compareBaseline withKept false)
  pairsAfter?: PairBaseline[]; // the second set: after the same-name match, before the AI check (withKept true), same pairs in the same order
  calls: CallRecord[];
  stopped: { pair: string; kind: "cv" | "ad" } | null; // a 429
  failed: Failure[];
};

const CLASS_WORDS: Record<RequirementClass, string> = {
  agree: "Agree",
  "false-met": "False met",
  "false-missing": "False missing",
  "could-not-judge": "Could not judge",
  dropped: "Dropped",
  other: "Other",
};
const levelText = (l: FitLevel | "no-level" | null) => (l === null ? "-" : l === "no-level" ? "No level" : levelName(l));
const row = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
const table = (head: string[], rows: (string | number)[][]) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const ceilingText = (c: { reachable: number; total: number }) => (c.total === 0 ? "no figure" : `${c.reachable} of ${c.total}`);

const BEFORE = "before the kept skills";
const AFTER = "after the same-name match";

// What the same-name match ALONE changed (docs/PLAN-EVERY-CV.md, EC-0c): the requirements that moved from "could not judge" to met or to missing,
// and every same-name MISTAKE: the match says met, the key says partly or none (unsure rows are left out, as in every total).
export type SameNameEffect = {
  toMet: number;
  toMissing: number;
  mistakes: { pair: string; id: string; quote: string; line: number; verdict: string }[];
};
export function sameNameEffect(before: PairBaseline[], after: PairBaseline[]): SameNameEffect {
  const out: SameNameEffect = { toMet: 0, toMissing: 0, mistakes: [] };
  for (const b of before) {
    const a = after.find((x) => x.pair === b.pair);
    if (!a) continue;
    for (const rowB of b.rows) {
      const rowA = a.rows.find((r) => r.id === rowB.id);
      if (!rowA || rowB.unsure || rowB.today.kind !== "unjudged") continue;
      if (rowA.today.kind === "met") {
        out.toMet++;
        if (rowA.verdict === "partly" || rowA.verdict === "none") out.mistakes.push({ pair: b.pair, id: rowB.id, quote: rowB.quote, line: rowA.today.line, verdict: rowA.verdict });
      } else if (rowA.today.kind === "missing") {
        out.toMissing++;
      }
    }
  }
  return out;
}

// The table on the screen: one row for each pair (two when the second set is given: before, then after the same-name match), no CV text, no
// sentence of an ad.
export function summaryTable(pairs: PairBaseline[], after?: PairBaseline[]): string {
  const rowOf = (p: PairBaseline, mode: string | null) => [
        p.pair,
        ...(mode === null ? [] : [mode]),
        levelText(p.keyLevel),
        levelText(p.today.level),
        p.levelVsKey,
        p.counted.agree,
        p.counted["false-met"],
        p.counted["false-missing"],
        p.counted["could-not-judge"],
        p.counted.dropped,
        `${p.answered} of ${p.countedTotal}`,
        ceilingText(p.ceiling),
      ];
  const head = ["Pair", "Key level", "Today", "Against key", "Agree", "False met", "False missing", "Could not judge", "Dropped", "Answered", "Ceiling"];
  if (!after) return table(head, pairs.map((p) => rowOf(p, null))) + "\n";
  return (
    table(
      [head[0], "Mode", ...head.slice(1)],
      pairs.flatMap((p) => {
        const a = after.find((x) => x.pair === p.pair);
        return a ? [rowOf(p, BEFORE), rowOf(a, AFTER)] : [rowOf(p, BEFORE)];
      }),
    ) + "\n"
  );
}

function tokenTotals(calls: CallRecord[]) {
  const input = calls.reduce((n, c) => n + c.input, 0);
  const output = calls.reduce((n, c) => n + c.output, 0);
  return { input, output, total: input + output };
}

export function baselineJson(r: ReportInput) {
  const t = tokenTotals(r.calls);
  return {
    info: r.info,
    // The headline set (today, before the kept skills): the layout of the single-set report is kept.
    pairs: r.pairs,
    summary: summarizeBaseline(r.pairs),
    // The second set: after the same-name match, before the AI check.
    ...(r.pairsAfter
      ? { afterSameName: { pairs: r.pairsAfter, summary: summarizeBaseline(r.pairsAfter), effect: sameNameEffect(r.pairs, r.pairsAfter) } }
      : {}),
    tokens: { ...t, calls: r.calls },
    rate429: r.stopped,
    failed: r.failed,
  };
}

// The three tables of one set: per pair, per requirement, and the cross-language totals. `level` is the heading level of the three ("###").
// EC-8c (AM20): the condition rows, in their own table, for the baseline report and the check eval report alike. Never hidden, in no number.
export const CONDITION_ROWS_HEADING = "## Condition rows (typed by the person, never decided from the CV text; not counted)";
export function conditionRowsLines(
  pairs: { pair: string; conditionRows: CompareRow[]; keyLevel: FitLevel | "no-level" | null; keyLevelWithConditions: FitLevel | "no-level" | null }[],
): string[] {
  const rows = pairs.flatMap((p) => p.conditionRows.map((x) => ({ pair: p.pair, x })));
  const out = [CONDITION_ROWS_HEADING, ""];
  if (rows.length === 0) return [...out, "No condition rows.", ""];
  out.push(
    table(
      ["Pair", "Req", "Tag", "Key verdict", "Key lines", "Sentence", "Note"],
      rows.map(({ pair, x }) => [pair, x.id, x.tag, x.verdict, x.keyLines.join(", ") || "-", x.quote, x.unsure ? "you marked it unsure" : ""]),
    ),
    "",
  );
  for (const p of pairs.filter((q) => q.conditionRows.length > 0)) out.push(`${p.pair}: key level without these rows ${levelText(p.keyLevel)}, with them ${levelText(p.keyLevelWithConditions)}.`);
  out.push("");
  return out;
}

function setTables(pairs: PairBaseline[]): string[] {
  const s = summarizeBaseline(pairs);
  const a = s.all;
  const out: string[] = [];
  out.push("### Per pair", "");
  out.push(
    table(
      ["Pair", "Key level", "Today's label", "Against key", ...CLASSES.filter((c) => c !== "other").map((c) => CLASS_WORDS[c]), "Answered", "Unsure rows (not counted)"],
      pairs.map((p) => [
        p.pair + (p.crossLanguage ? " (cross-language)" : ""),
        levelText(p.keyLevel),
        p.today.label,
        p.levelVsKey,
        p.counted.agree,
        p.counted["false-met"],
        p.counted["false-missing"],
        p.counted["could-not-judge"],
        p.counted.dropped,
        `${p.answered} of ${p.countedTotal}`,
        p.unsureRows.length,
      ]),
    ),
    "",
  );
  out.push(
    `Totals over ${pairs.length} pairs: ${CLASSES.filter((c) => c !== "other").map((c) => `${CLASS_WORDS[c]} ${a.counted[c]}`).join(", ")}. Answered: ${a.answered} of ${a.total}.`,
    `Level against the key's: stronger ${s.levels.stronger}, equal ${s.levels.equal}, weaker ${s.levels.weaker}, not comparable ${s.levels["not comparable"]}.`,
    "",
  );
  out.push("### Per requirement", "");
  out.push(
    table(
      ["Pair", "Req", "Tag", "Key verdict", "Today", "Class", "Note"],
      pairs.flatMap((p) =>
        p.rows.map((x) => [
          p.pair,
          x.id,
          x.tag,
          x.verdict,
          x.today.kind === "met" ? `met (line ${x.today.line})` : x.today.kind === "missing" ? "missing" : x.today.kind === "unjudged" ? "could not judge" : "not read",
          CLASS_WORDS[x.class],
          [x.unsure ? "UNSURE (not counted)" : "", x.droppedWhere ?? ""].filter((n) => n !== "").join("; "),
        ]),
      ),
    ),
    "",
  );
  const extras = pairs.flatMap((p) => p.extras.map((e) => `${p.pair}: "${e.quote}" (${e.importance}, ${e.status === "unjudged" ? "could not judge" : e.status})`));
  out.push(`Requirements the ad reading has that are in no key sentence: ${extras.length}.`, ...extras.map((e) => `- ${e}`), "");
  out.push("### Cross-language pairs (06 and 10)", "");
  const c = s.crossLanguage;
  out.push(
    c.pairs.length === 0
      ? "No cross-language pair in this run."
      : `${c.pairs.join(", ")}: ${CLASSES.filter((k) => k !== "other").map((k) => `${CLASS_WORDS[k]} ${c.counted[k]}`).join(", ")}. Answered: ${c.answered} of ${c.total}. Recall ceiling: ${ceilingText(c.ceiling)}.`,
    "",
  );
  return out;
}

export function baselineMarkdown(r: ReportInput): string {
  const s = summarizeBaseline(r.pairs);
  const a = s.all;
  const t = tokenTotals(r.calls);
  const out: string[] = [];
  out.push(`# Baseline of today's product on the accuracy pairs${r.info.dry ? " (DRY RUN: canned readings, not a real run)" : ""}`, "");
  out.push(`Run ${r.info.runId} | fingerprint ${r.info.fingerprint.slice(0, 10)} | key files at commit ${r.info.keyCommit} | vocabulary ${r.info.vocabulary.slice(0, 10)}`, "");
  if (r.stopped) out.push(`**The run was stopped by a 429 (busy) at ${r.stopped.pair}, ${r.stopped.kind === "cv" ? "CV read" : "ad read"}. Nothing was retried; the pairs after it were not read.**`, "");
  for (const f of r.failed) out.push(`**${f.pair}: the ${f.kind === "cv" ? "CV" : "ad"} read failed (${f.reason}). It is not in the tables.**`, "");

  out.push("## Today, before the kept skills (the original problem)", "");
  out.push(...setTables(r.pairs));

  if (r.pairsAfter) {
    out.push("## After the same-name match, before the AI check", "");
    out.push(...setTables(r.pairsAfter));
    const e = sameNameEffect(r.pairs, r.pairsAfter);
    out.push("### What the same-name match alone changed", "");
    out.push(
      `${e.toMet} ${e.toMet === 1 ? "requirement" : "requirements"} moved from could not judge to met, ${e.toMissing} to missing.`,
      `Same-name mistakes (the match says met, the key says partly or none): ${e.mistakes.length}`,
      ...e.mistakes.map((m) => `- ${m.pair}, ${m.id}, CV line ${m.line}, key says ${m.verdict}: "${m.quote}"`),
      "",
    );
  }

  out.push(...conditionRowsLines(r.pairs));

  out.push("## Recall ceiling", "");
  out.push(
    table(
      ["Pair", "Reachable", "Recoverable by option (i)", "Needs option (ii)", "Key 'met' rows", "Ceiling"],
      [...r.pairs.map((p) => [p.pair, p.ceiling.reachable, p.ceiling.recoverable, p.ceiling.needsPromptChange, p.ceiling.total, ceilingText(p.ceiling)]),
        ["All", a.ceiling.reachable, a.ceiling.recoverable, a.ceiling.needsPromptChange, a.ceiling.total, ceilingText(a.ceiling)]],
    ),
    "(The same in both sets: it does not depend on the mode.)",
    "",
  );

  out.push("## Tokens", "");
  out.push(table(["Pair", "Read", "Input", "Output"], r.calls.map((x) => [x.pair, x.kind === "cv" ? "CV" : "ad", x.input, x.output])), "");
  out.push(`Total: ${t.total} tokens (${t.input} in, ${t.output} out) in ${r.calls.length} calls. 429: ${r.stopped ? `yes, at ${r.stopped.pair}` : "none"}.`, "");

  out.push("## How to read this", "");
  out.push(
    "This is what the product says, set against the answers you wrote in the keys. There are two sets of tables.",
    "- **Today, before the kept skills (the original problem)** is the product as it was before the kept skills existed: a requirement that is not in our skill list is set aside as \"could not judge\". This is the headline.",
    "- **After the same-name match, before the AI check** is the product as it is now: a skill the person confirmed that is not in our list is kept with its CV line, and a requirement with exactly the same name is met by it. The block \"What the same-name match alone changed\" says how many requirements moved, and lists every mistake (the match says met, the key says partly or none).",
    "- **Agree**: the page says what your key says (met on both sides, or \"missing\" where your key says partly or none).",
    "- **False met**: the page says met, but your key says partly or none. This is the error to watch most.",
    "- **False missing**: the page says missing, but your key says met.",
    "- **Could not judge**: the requirement is not in our skill list, so the page sets it aside and says so. This is the size of the problem the AI check is meant to solve.",
    "- **Dropped**: the sentence did not come out of the ad reading at all (the reader set it aside as a trait or a condition, or lost it). The Note column says where it went.",
    "- **Answered** counts the rows where the page gives met or missing. Rows you marked unsure are listed but are in no total.",
    "- **Condition rows** (AM20): a key sentence the ad reading put into the ad's conditions (years, language, other conditions) and not into a requirement. The person types those; the CV text never decides them. They have their own table, and they are in no count, no ceiling and no key level.",
    "- **Key level** comes from your verdicts with the product's own fit rules (partly counts as missing, nice-to-haves never count). **Against key** says whether the page's level reads stronger, equal or weaker than that.",
    "- **Recall ceiling**: for every requirement your key marks met, is there a confirmed skill entry on one of the CV lines you cited? If not, no check, however good, could find it. \"Recoverable\" means an unticked inferred skill sits on the line (option (i)); \"needs option (ii)\" means no skill was read from that line at all (a CV prompt change). It is the same in both sets.",
    "- In this run only the skills named in the CV are ticked (as the page does it); the inferred ones are not.",
    "- A key sentence that names two skills is read as two requirements; the sentence is \"missing\" if any is missing, otherwise \"could not judge\" if any could not be judged, otherwise \"met\".",
    "",
  );
  return out.join("\n");
}
