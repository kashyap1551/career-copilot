import { levelName } from "./explain";
import { conditionRowsLines } from "./evalEveryCvReport";
import { bar, numbersOf, type PairResult, type RowDetail } from "./evalEveryCvCheckScore";
import type { ConfirmMode } from "./evalEveryCvCheckScore";
import type { FitLevel } from "./types";

// What the check eval prints and writes (docs/PLAN-EVERY-CV.md, the check eval). Pure text and data, no file, no AI. Counts, not made-up percentages
// (project rule 6): the bar's own percentages are named next to the count. Nothing here holds an access code, an address or an environment value.

export type CheckInfo = {
  runId: string;
  fingerprint: string;
  counted: boolean;
  confirm: ConfirmMode;
  dry: boolean;
  head: string;
  baselineRun: string;
  keyCommit: string;
  model: string;
  requestHash: string;
  instructionsLength: number;
  readingVersion: string;
  vocabulary: string;
};
export type CheckReportInput = {
  info: CheckInfo;
  results: PairResult[];
  stopped: { pair: string } | null; // a 429
  failed: { pair: string; reason: string }[];
};

const row = (cells: (string | number)[]) => `| ${cells.join(" | ")} |`;
const table = (head: string[], rows: (string | number)[][]) => [row(head), row(head.map(() => "---")), ...rows.map(row)].join("\n");
const levelText = (l: FitLevel | "no-level" | null) => (l === null ? "-" : l === "no-level" ? "No level" : levelName(l));
const CLASS_WORDS: Record<string, string> = { agree: "Agree", "false-met": "False met", "false-missing": "False missing", "could-not-judge": "Could not judge", dropped: "Dropped", other: "Other" };
const passWord = (p: boolean) => (p ? "pass" : "FAIL");

function requirementRow(pair: string, r: RowDetail): (string | number)[] {
  const note = [r.wrongEvidence ? "wrong-evidence candidate" : "", r.unsure ? "UNSURE (not counted)" : ""].filter((x) => x !== "").join("; ");
  return [
    pair,
    r.id,
    r.tag,
    r.unsure ? `${r.keyVerdict} (unsure)` : r.keyVerdict,
    r.keyLines.length === 0 ? "-" : r.keyLines.join(", "),
    r.source,
    r.final === "met" ? `met (line ${r.finalLine})` : r.final,
    r.ai === null ? "-" : r.ai.verdict,
    r.ai?.entryName ?? "-",
    r.ai?.line ?? "-",
    r.ai?.quote === null || r.ai === null ? "-" : `"${r.ai.quote}"`,
    CLASS_WORDS[r.class] ?? r.class,
    note,
  ];
}

export function checkMarkdown(r: CheckReportInput): string {
  const n = numbersOf(r.results);
  const b = bar(n);
  const ok = (id: string) => passWord(b.items.find((i) => i.id === id)!.pass);
  const out: string[] = [];
  out.push(`# Check eval ${r.info.runId}${r.info.dry ? " (DRY: canned example, nothing real)" : ""}`, "");
  out.push(r.info.counted ? "COUNTED run." : "NOT COUNTED (calibration or a shorter run).");
  out.push(
    `Fingerprint ${r.info.fingerprint.slice(0, 10)} | request ${r.info.requestHash} | INSTRUCTIONS ${r.info.instructionsLength} characters | model ${r.info.model} | reading version ${r.info.readingVersion} | vocab ${r.info.vocabulary.slice(0, 10)} | confirm ${r.info.confirm}`,
    `Baseline run ${r.info.baselineRun} | key commit ${r.info.keyCommit} | git HEAD ${r.info.head}`,
    "",
  );
  if (r.stopped) out.push(`STOPPED: the AI service answered 429 (busy) at ${r.stopped.pair}. Nothing was retried. What was done before it is in this report.`, "");
  for (const f of r.failed) out.push(`${f.pair}: the call failed (${f.reason}). It was not retried.`);
  if (r.failed.length > 0) out.push("");

  out.push("## Against the bar", "");
  out.push(
    `1. False met: ${n.falseMet} (1a ${n.falseMetA}, 1b ${n.wrongEvidence}) ${ok("1")} (bar: 0)`,
    `2. Levels: stronger ${n.levels.stronger}, equal ${n.levels.equal}, weaker ${n.levels.weaker}, ceiling ${n.levels.ceiling}, not comparable ${n.levels["not comparable"]} ${ok("2")} (bar: 0 stronger and at least 8 equal of 10)`,
    `3. Answered: ${n.answered} of ${n.sent} ${ok("3")} (bar: at least 90% of the requirements sent)`,
    `4. Key met found: ${n.found} of ${n.keyMet} ${ok("4")} (bar: at least 80%)`,
    `5. 429 seen: ${n.real429} ${ok("5")} (bar: none)`,
    `6. Biggest call: ${n.biggestCall} tokens ${ok("6")} (bar: at most 7000)`,
    `7. Thrown away: ${n.thrown} of ${n.sent} ${ok("7")} (bar: at most 10%)`,
    "",
    b.pass ? "BAR MET." : "BAR NOT MET.",
    "",
  );

  out.push("## Per pair", "");
  out.push(
    table(
      ["Pair", "Requirements sent", "Entries available", "Entries sent", "Dropped by the cap", "Estimated tokens", "Tokens in + out", "Attempts", "Elapsed ms", "Key level", "Check level", "Ceiling", "Against key", "Unsure musts"],
      r.results.map((p) => [
        p.pair,
        p.sent,
        p.entriesAvailable,
        p.entriesSent,
        p.entriesDropped,
        p.estimate ?? "-",
        p.call ? p.call.inputTokens + p.call.outputTokens : "-",
        p.call ? p.call.attempts : "-",
        p.call ? p.call.ms : "-",
        levelText(p.keyLevel),
        levelText(p.checkLevel),
        p.levelVsKey === "ceiling" ? "yes" : "no",
        p.levelVsKey,
        p.unsureMusts,
      ]),
    ),
    "",
  );
  const notes = r.results.flatMap((p) => [
    p.noCall ? `${p.pair}: no call was made (${p.noCall === "no-requirements" ? "no open requirement" : "no CV line to send"}).` : "",
    p.failure ? `${p.pair}: no answers (${p.failure}).` : "",
    p.notChecked > 0 ? `${p.pair}: ${p.notChecked} open requirement(s) did not fit in one check and stay not judged.` : "",
    p.entriesDropped > 0 ? `${p.pair}: the cap dropped ${p.entriesDropped} CV line${p.entriesDropped === 1 ? "" : "s"}.` : "",
    `${p.pair}: label before the check "${p.labelBefore}", after "${p.label}".`,
  ]);
  out.push(...notes.filter((x) => x !== ""), "");

  // wrong-evidence candidates first, then every other disagreement, then the rest
  const counted = r.results.flatMap((p) => p.rows.filter((x) => !x.unsure).map((x) => ({ pair: p.pair, x })));
  const rank = (x: RowDetail) => (x.wrongEvidence ? 0 : x.class !== "agree" ? 1 : 2);
  const sorted = counted.map((c, i) => ({ ...c, i })).sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i);
  out.push("## Per requirement (wrong-evidence candidates first, then disagreements, then the rest)", "");
  out.push(
    table(
      ["Pair", "Req", "Tag", "Key verdict", "Key lines", "Source", "Final", "AI verdict", "AI entry", "AI line", "AI quote", "Class", "Note"],
      sorted.map((c) => requirementRow(c.pair, c.x)),
    ),
    "",
  );
  const unsure = r.results.flatMap((p) => p.unsureRows.map((x) => requirementRow(p.pair, x)));
  out.push(`## Unsure key rows (not counted, never hidden): ${unsure.length}`, "");
  if (unsure.length > 0) out.push(table(["Pair", "Req", "Tag", "Key verdict", "Key lines", "Source", "Final", "AI verdict", "AI entry", "AI line", "AI quote", "Class", "Note"], unsure), "");
  out.push(...conditionRowsLines(r.results));
  return out.join("\n");
}

export function checkJson(r: CheckReportInput) {
  const numbers = numbersOf(r.results);
  return { info: r.info, numbers, bar: bar(numbers), pairs: r.results, stopped: r.stopped, failed: r.failed };
}
