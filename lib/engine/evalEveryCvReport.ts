import { levelName } from "./explain";
import { CLASSES, summarizeBaseline, type PairBaseline, type RequirementClass } from "./evalEveryCvCompare";
import type { CallRecord, Failure } from "./evalEveryCvRun";
import type { FitLevel } from "./types";

// What the baseline run writes and prints (docs/PLAN-EVERY-CV.md section 10, EC-0). Pure text and data: no file, no AI. Counts only, never
// a made-up percentage (project rule 6). Nothing here holds a line of a CV, an access code, an address or an environment value.

export type RunInfo = { runId: string; fingerprint: string; keyCommit: string; vocabulary: string; dry: boolean };
export type ReportInput = {
  info: RunInfo;
  pairs: PairBaseline[];
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

// The table on the screen: one row for each pair, no CV text, no sentence of an ad.
export function summaryTable(pairs: PairBaseline[]): string {
  return (
    table(
      ["Pair", "Key level", "Today", "Against key", "Agree", "False met", "False missing", "Could not judge", "Dropped", "Answered", "Ceiling"],
      pairs.map((p) => [
        p.pair,
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
      ]),
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
    pairs: r.pairs,
    summary: summarizeBaseline(r.pairs),
    tokens: { ...t, calls: r.calls },
    rate429: r.stopped,
    failed: r.failed,
  };
}

export function baselineMarkdown(r: ReportInput): string {
  const s = summarizeBaseline(r.pairs);
  const t = tokenTotals(r.calls);
  const out: string[] = [];
  out.push(`# Baseline of today's product on the accuracy pairs${r.info.dry ? " (DRY RUN: canned readings, not a real run)" : ""}`, "");
  out.push(`Run ${r.info.runId} | fingerprint ${r.info.fingerprint.slice(0, 10)} | key files at commit ${r.info.keyCommit} | vocabulary ${r.info.vocabulary.slice(0, 10)}`, "");
  if (r.stopped) out.push(`**The run was stopped by a 429 (busy) at ${r.stopped.pair}, ${r.stopped.kind === "cv" ? "CV read" : "ad read"}. Nothing was retried; the pairs after it were not read.**`, "");
  for (const f of r.failed) out.push(`**${f.pair}: the ${f.kind === "cv" ? "CV" : "ad"} read failed (${f.reason}). It is not in the tables.**`, "");

  out.push("## Per pair", "");
  out.push(
    table(
      ["Pair", "Key level", "Today's label", "Against key", ...CLASSES.filter((c) => c !== "other").map((c) => CLASS_WORDS[c]), "Answered", "Unsure rows (not counted)"],
      r.pairs.map((p) => [
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
  const a = s.all;
  out.push(
    `Totals over ${r.pairs.length} pairs: ${CLASSES.filter((c) => c !== "other").map((c) => `${CLASS_WORDS[c]} ${a.counted[c]}`).join(", ")}. Answered today: ${a.answered} of ${a.total}.`,
    `Level today against the key's: stronger ${s.levels.stronger}, equal ${s.levels.equal}, weaker ${s.levels.weaker}, not comparable ${s.levels["not comparable"]}.`,
    "",
  );

  out.push("## Per requirement", "");
  out.push(
    table(
      ["Pair", "Req", "Tag", "Key verdict", "Today", "Class", "Note"],
      r.pairs.flatMap((p) =>
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
  const extras = r.pairs.flatMap((p) => p.extras.map((e) => `${p.pair}: "${e.quote}" (${e.importance}, ${e.status === "unjudged" ? "could not judge" : e.status})`));
  out.push(`Requirements the ad reading has that are in no key sentence: ${extras.length}.`, ...extras.map((e) => `- ${e}`), "");

  out.push("## Recall ceiling", "");
  out.push(
    table(
      ["Pair", "Reachable", "Recoverable by option (i)", "Needs option (ii)", "Key 'met' rows", "Ceiling"],
      [...r.pairs.map((p) => [p.pair, p.ceiling.reachable, p.ceiling.recoverable, p.ceiling.needsPromptChange, p.ceiling.total, ceilingText(p.ceiling)]),
        ["All", a.ceiling.reachable, a.ceiling.recoverable, a.ceiling.needsPromptChange, a.ceiling.total, ceilingText(a.ceiling)]],
    ),
    "",
  );

  out.push("## Cross-language pairs (06 and 10)", "");
  const c = s.crossLanguage;
  out.push(
    c.pairs.length === 0
      ? "No cross-language pair in this run."
      : `${c.pairs.join(", ")}: ${CLASSES.filter((k) => k !== "other").map((k) => `${CLASS_WORDS[k]} ${c.counted[k]}`).join(", ")}. Answered today: ${c.answered} of ${c.total}. Recall ceiling: ${ceilingText(c.ceiling)}.`,
    "",
  );

  out.push("## Tokens", "");
  out.push(table(["Pair", "Read", "Input", "Output"], r.calls.map((x) => [x.pair, x.kind === "cv" ? "CV" : "ad", x.input, x.output])), "");
  out.push(`Total: ${t.total} tokens (${t.input} in, ${t.output} out) in ${r.calls.length} calls. 429: ${r.stopped ? `yes, at ${r.stopped.pair}` : "none"}.`, "");

  out.push("## How to read this", "");
  out.push(
    "This is what the product says TODAY (before the new check exists), set against the answers you wrote in the keys.",
    "- **Agree**: today's page says what your key says (met on both sides, or \"missing\" where your key says partly or none).",
    "- **False met**: the page says met, but your key says partly or none. This is the error to watch most.",
    "- **False missing**: the page says missing, but your key says met.",
    "- **Could not judge**: the requirement is not in our skill list, so the page sets it aside and says so. This is the size of the problem the new check is meant to solve.",
    "- **Dropped**: the sentence did not come out of the ad reading at all (the reader set it aside as a trait or a condition, or lost it). The Note column says where it went.",
    "- **Answered** counts the rows where the page gives met or missing. Rows you marked unsure are listed but are in no total.",
    "- **Key level** comes from your verdicts with the product's own fit rules (partly counts as missing, nice-to-haves never count). **Against key** says whether today's level reads stronger, equal or weaker than that.",
    "- **Recall ceiling**: for every requirement your key marks met, is there a confirmed skill entry on one of the CV lines you cited? If not, no check, however good, could find it. \"Recoverable\" means an unticked inferred skill sits on the line (option (i)); \"needs option (ii)\" means no skill was read from that line at all (a CV prompt change).",
    "- In this run only the skills named in the CV are ticked (as the page does it); the inferred ones are not.",
    "- A key sentence that names two skills is read as two requirements; the sentence is \"missing\" if any is missing, otherwise \"could not judge\" if any could not be judged, otherwise \"met\".",
    "",
  );
  return out.join("\n");
}
