import { MAX_SHOWN } from "./bulletsFrom";
import type { BulletsEvalRow, BulletsEvalRun } from "./evalBulletsRun";

// Step 8.3, stage 5 (docs/PLAN-8.3.md v2, section 4 "What is measured", M1 to M5, amendments 0.20 and 0.27): the numbers and the printed report of
// `npm run eval-bullets`, and the review sheet. Pure code: counts only, no percentages. The material is invented, so the sheet may quote bullets and lines; the
// printed report never does.

export type LangSummary = { calls: number; asked: number; accepted: number; shown: number; runsWithAccepted: number };

export type BulletsSummary = {
  runs: number; // calls + runs with no pair + failed runs
  calls: number; // answered calls
  noPairs: number;
  failed: number;
  asked: number;
  accepted: number; // M4: asked - dropped, counted BEFORE the cap of 3 (0.27)
  shown: number; // what the page would show: at most 3 a run
  dropped: number;
  byReason: Record<string, number>; // M3
  runsWithAccepted: number;
  unchanged: number; // 0.20: accepted bullets that equal their cited line, lower-case with spaces collapsed
  en: LangSummary;
  de: LangSummary;
  tokensIn: number; // M5
  tokensOut: number;
  seconds: number;
  passLines: { accepted20: boolean; yield40: boolean; runs10: boolean }; // the yield lines of the plan (M1 is the reviewer's, by hand)
};

// The order of M3's list (docs/PLAN-8.3.md section 4), then the two reasons it does not name.
const REASON_ORDER = [
  "new-number", "new-date", "new-skill", "new-name", "new-claim", "lost-qualifier", "new-word", "reordered",
  "bad-length", "bad-citation", "check-failed", "repeated-pair", "missing",
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const acceptedOf = (r: BulletsEvalRow) => r.asked - r.dropped.length; // 0.27: counted before the cap
const shownOf = (r: BulletsEvalRow) => Math.min(MAX_SHOWN, acceptedOf(r));

function langSummary(rows: BulletsEvalRow[]): LangSummary {
  return {
    calls: rows.length,
    asked: rows.reduce((n, r) => n + r.asked, 0),
    accepted: rows.reduce((n, r) => n + acceptedOf(r), 0),
    shown: rows.reduce((n, r) => n + shownOf(r), 0),
    runsWithAccepted: rows.filter((r) => acceptedOf(r) > 0).length,
  };
}

export function summarizeBullets(run: BulletsEvalRun): BulletsSummary {
  const rows = run.rows;
  const asked = rows.reduce((n, r) => n + r.asked, 0);
  const dropped = rows.reduce((n, r) => n + r.dropped.length, 0);
  const accepted = asked - dropped;
  const byReason: Record<string, number> = {};
  for (const r of rows) for (const d of r.dropped) byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
  let unchanged = 0;
  for (const r of rows) {
    for (const b of r.accepted) {
      const line = r.pairs.find((p) => p.id === b.pair);
      if (line !== undefined && norm(b.text) === norm(line.text)) unchanged++;
    }
  }
  const runsWithAccepted = rows.filter((r) => acceptedOf(r) > 0).length;
  return {
    runs: rows.length + run.noPairs.length + run.failed.length,
    calls: rows.length,
    noPairs: run.noPairs.length,
    failed: run.failed.length,
    asked,
    accepted,
    shown: rows.reduce((n, r) => n + shownOf(r), 0),
    dropped,
    byReason,
    runsWithAccepted,
    unchanged,
    en: langSummary(rows.filter((r) => r.lang === "en")),
    de: langSummary(rows.filter((r) => r.lang === "de")),
    tokensIn: rows.reduce((n, r) => n + (r.usage?.inputTokens ?? 0), 0),
    tokensOut: rows.reduce((n, r) => n + (r.usage?.outputTokens ?? 0), 0),
    seconds: Math.round(rows.reduce((n, r) => n + r.seconds, 0) * 10) / 10,
    passLines: { accepted20: accepted >= 20, yield40: asked > 0 && accepted * 100 >= asked * 40, runs10: runsWithAccepted >= 10 },
  };
}

const yn = (b: boolean) => (b ? "yes" : "NO");
const n0 = (n: number) => n.toLocaleString("en-US");

// At most 12 lines, whatever happens (the script prints this, a fingerprint line and two "saved" lines: 15 at most).
export function formatBulletsReport(run: BulletsEvalRun, counted: boolean): string {
  const s = summarizeBullets(run);
  const L: string[] = [];
  L.push(counted ? "BULLETS EVAL (counted run)" : "BULLETS EVAL: CALIBRATION RUN (not counted)");
  L.push(`RUNS: ${s.runs} | calls ${s.calls} | no pairs, no call ${s.noPairs} | failed ${s.failed}`);
  L.push(`PAIRS: asked ${s.asked} | accepted ${s.accepted} (before the cap of ${MAX_SHOWN}) | shown ${s.shown} (at most ${MAX_SHOWN} a run) | dropped ${s.dropped}`);
  const known = REASON_ORDER.filter((k) => (s.byReason[k] ?? 0) > 0);
  const others = Object.keys(s.byReason).filter((k) => !REASON_ORDER.includes(k)).sort();
  const reasons = [...known, ...others].map((k) => `${k} ${s.byReason[k]}`);
  L.push(`M3 DROPPED BY REASON: ${reasons.length === 0 ? "none" : reasons.join(", ")}`);
  const lang = (name: string, x: LangSummary) =>
    `M4 ${name}: accepted ${x.accepted} of ${x.asked} asked, shown ${x.shown} | runs with an accepted bullet ${x.runsWithAccepted} of ${x.calls}`;
  L.push(lang("ENGLISH", s.en));
  L.push(lang("GERMAN", s.de));
  L.push(`M4 ALL: runs with an accepted bullet ${s.runsWithAccepted} of ${s.calls} | UNCHANGED ${s.unchanged} of ${s.accepted} accepted`);
  L.push(
    `YIELD LINES: accepted 20 or more: ${yn(s.passLines.accepted20)} | accepted at least 40% of asked: ${yn(s.passLines.yield40)} | 10 of 15 runs with an accepted bullet: ${yn(s.passLines.runs10)}`,
  );
  L.push("M1 INVENTED: counted by hand from the review sheet (this script cannot count it)");
  L.push(`M5: calls ${s.calls} | tokens ${n0(s.tokensIn + s.tokensOut)} (${n0(s.tokensIn)} in, ${n0(s.tokensOut)} out) | seconds ${s.seconds}`);
  if (run.failed.length > 0) {
    const shown = run.failed.slice(0, 3).map((f) => `${f.cv} on ${f.job} (${f.reason})`);
    const more = run.failed.length > 3 ? `; and ${run.failed.length - 3} more` : "";
    L.push(`FAILED: ${shown.join("; ")}${more}`);
  }
  if (!run.complete) L.push("VERDICT: the run is INCOMPLETE and cannot count");
  else if (!counted) L.push("VERDICT: calibration run, not counted (the yield lines are for information)");
  else L.push(`VERDICT: yield lines ${s.passLines.accepted20 && s.passLines.yield40 && s.passLines.runs10 ? "met" : "NOT met"}; M1 and the verdict are the reviewer's, from the review sheet`);
  return L.join("\n") + "\n";
}

// The run's name in the saved files: an EDGE run is marked (0.30); a row with no set (the older material) is not.
const runLabel = (r: { cv: string; job: string; set?: "main" | "edge" }) => `${r.cv} x ${r.job}${r.set === "edge" ? " (EDGE)" : ""}`;

// One line for each of the runs, for the saved file (not printed).
export function perRunLines(run: BulletsEvalRun): string[] {
  const out: string[] = [];
  for (const r of run.rows) {
    const reasons = r.dropped.length === 0 ? "none" : r.dropped.map((d) => `pair ${d.pair} ${d.reason}`).join(", ");
    out.push(`${runLabel(r)} (${r.lang}): asked ${r.asked}, accepted ${acceptedOf(r)}, shown ${shownOf(r)}, dropped ${r.dropped.length} (${reasons}), ${r.usage ? `${r.usage.inputTokens} in, ${r.usage.outputTokens} out` : "no usage"}, ${r.seconds} s`);
  }
  for (const r of run.noPairs) out.push(`${runLabel(r)}: no pair, no call`);
  for (const r of run.failed) out.push(`${runLabel(r)}: FAILED (${r.reason})`);
  return out;
}

// A table cell keeps the text word for word (spaces included); only a pipe or a line break, which would break the table, is replaced.
const cell = (s: string) => s.replace(/\|/g, "/").replace(/[\r\n]+/g, " ");

// One line for each dropped bullet, for the saved full output (never printed): the run, the pair, the reason code, the AI's own text and the cited CV line, both word
// for word (amendment 0.29). A row with no captured text (an older writer) adds nothing.
const shownText = (texts: string[]) => (texts.length === 0 ? "(none)" : texts.map((t) => `"${t}"`).join(" ; "));
const citedLine = (r: BulletsEvalRow, pair: number) => {
  const p = r.pairs.find((x) => x.id === pair);
  return p === undefined ? "(line not found)" : `line ${p.line}: "${p.text}"`;
};
export function droppedLines(run: BulletsEvalRun): string[] {
  const out: string[] = [];
  for (const r of run.rows) {
    for (const d of r.droppedDetail ?? []) {
      out.push(`DROPPED ${runLabel(r)} | pair ${d.pair} | ${d.reason} | AI text: ${shownText(d.texts)} | cited ${citedLine(r, d.pair)}`);
    }
  }
  return out;
}

// The review sheet: every accepted bullet (before the cap of 3) next to the CV line it came from, with two empty columns for the reviewer. The text is invented, so
// it may be read and pasted; the folder is never committed.
export function reviewSheet(run: BulletsEvalRun): string {
  const L: string[] = [];
  L.push("# Bullets eval: review sheet (invented material only; never commit)");
  L.push("");
  L.push("Read each accepted bullet next to its CV line. INVENTED = yes when the bullet says a fact the line does not say: a new fact, a dropped limit, an order or joined");
  L.push("meaning that changes the sense, or anything else. Write the sub-kind in the column. Note a trivial bullet that only repeats a skill-list line in the last column.");
  L.push("");
  L.push("| run | pair | cited CV line | bullet | INVENTED (yes/no) | note: trivial bullet from a skill-list line |");
  L.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of run.rows) {
    for (const b of r.accepted) {
      const p = r.pairs.find((x) => x.id === b.pair);
      const cited = p === undefined ? "(line not found)" : `line ${p.line}: "${cell(p.text)}"`;
      L.push(`| ${runLabel(r)} | ${b.pair} | ${cited} | "${cell(b.text)}" |  |  |`);
    }
  }
  // Second section (amendment 0.29): every dropped bullet with the AI's own text, so a rule that is too strict can be told from a bad bullet, and wrong-line facts
  // (M2, not counted by the script) can be read by eye. Left out when no row carries the text.
  if (run.rows.some((r) => (r.droppedDetail ?? []).length > 0)) {
    L.push("");
    L.push("## Dropped bullets: the AI's own text next to the reason code and the cited CV line (read them for a rule that is too strict, and for wrong-line facts by eye)");
    L.push("");
    L.push("| run | pair | reason | AI's own text | cited CV line | rule too strict? (yes/no) |");
    L.push("| --- | --- | --- | --- | --- | --- |");
    for (const r of run.rows) {
      for (const d of r.droppedDetail ?? []) {
        const text = d.texts.length === 0 ? "(none)" : d.texts.map((t) => `"${cell(t)}"`).join(" ; ");
        const p = r.pairs.find((x) => x.id === d.pair);
        const cited = p === undefined ? "(line not found)" : `line ${p.line}: "${cell(p.text)}"`;
        L.push(`| ${runLabel(r)} | ${d.pair} | ${d.reason} | ${text} | ${cited} |  |`);
      }
    }
  }
  return L.join("\n") + "\n";
}

// ---- Step 8.3, stage 5c (amendment 0.30): the report of the manifest's run, MAIN and EDGE apart ------------------------------------------------------------------

// A row, a no-pair run or a failed run with no set (the older material) is a MAIN run.
const inSet = (set: "main" | "edge", x: { set?: "main" | "edge" }) => (x.set ?? "main") === set;
function subRun(run: BulletsEvalRun, set: "main" | "edge"): BulletsEvalRun {
  return {
    rows: run.rows.filter((r) => inSet(set, r)),
    noPairs: run.noPairs.filter((r) => inSet(set, r)),
    failed: run.failed.filter((r) => inSet(set, r)),
    complete: run.complete,
  };
}

function reasonsText(byReason: Record<string, number>): string {
  const known = REASON_ORDER.filter((k) => (byReason[k] ?? 0) > 0);
  const others = Object.keys(byReason).filter((k) => !REASON_ORDER.includes(k)).sort();
  const list = [...known, ...others].map((k) => `${k} ${byReason[k]}`);
  return list.length === 0 ? "none" : list.join(", ");
}

// At most 12 lines, whatever happens (the script prints this, a fingerprint line and two "saved" lines: 15 at most). The yield lines and the runs-with-a-bullet
// numbers are over the MAIN set only; the EDGE set has its own line and is not in any yield denominator; M1 is by hand for both.
export function formatBulletsReportBySet(run: BulletsEvalRun, counted: boolean): string {
  const main = summarizeBullets(subRun(run, "main"));
  const edge = summarizeBullets(subRun(run, "edge"));
  const all = summarizeBullets(run);
  const L: string[] = [];
  L.push(counted ? "BULLETS EVAL (counted run): MAIN and EDGE" : "BULLETS EVAL: CALIBRATION RUN (not counted): MAIN and EDGE");
  L.push(`MAIN: runs ${main.runs} | calls ${main.calls} | no pairs, no call ${main.noPairs} | failed ${main.failed} | asked ${main.asked} | accepted ${main.accepted} (before the cap of ${MAX_SHOWN}) | shown ${main.shown} | dropped ${main.dropped}`);
  L.push(`M3 MAIN DROPPED BY REASON: ${reasonsText(main.byReason)}`);
  const lang = (name: string, x: LangSummary) =>
    `M4 MAIN ${name}: accepted ${x.accepted} of ${x.asked} asked, shown ${x.shown} | runs with an accepted bullet ${x.runsWithAccepted} of ${x.calls}`;
  L.push(lang("ENGLISH", main.en));
  L.push(lang("GERMAN", main.de));
  L.push(`M4 MAIN ALL: runs with an accepted bullet ${main.runsWithAccepted} of ${main.runs} | UNCHANGED ${main.unchanged} of ${main.accepted} accepted`);
  L.push(
    `YIELD LINES (MAIN only): accepted 20 or more: ${yn(main.passLines.accepted20)} | accepted at least 40% of asked: ${yn(main.passLines.yield40)} | 10 or more main runs with an accepted bullet: ${yn(main.passLines.runs10)}`,
  );
  L.push(`EDGE (not in the yield): runs ${edge.runs} | calls ${edge.calls} | asked ${edge.asked} | accepted ${edge.accepted} | shown ${edge.shown} | dropped ${edge.dropped} (${reasonsText(edge.byReason)}) | UNCHANGED ${edge.unchanged}`);
  L.push("M1 INVENTED: counted by hand from the review sheet for MAIN and EDGE alike (this script cannot count it)");
  L.push(`M5: calls ${all.calls} | tokens ${n0(all.tokensIn + all.tokensOut)} (${n0(all.tokensIn)} in, ${n0(all.tokensOut)} out) | seconds ${all.seconds}`);
  if (run.failed.length > 0) {
    const shown = run.failed.slice(0, 3).map((f) => `${runLabel(f)} (${f.reason})`);
    const more = run.failed.length > 3 ? `; and ${run.failed.length - 3} more` : "";
    L.push(`FAILED: ${shown.join("; ")}${more}`);
  }
  if (!run.complete) L.push("VERDICT: the run is INCOMPLETE and cannot count");
  else if (!counted) L.push("VERDICT: calibration run, not counted (the yield lines are for information)");
  else L.push(`VERDICT: MAIN yield lines ${main.passLines.accepted20 && main.passLines.yield40 && main.passLines.runs10 ? "met" : "NOT met"}; M1 (MAIN and EDGE) and the verdict are the reviewer's, from the review sheet`);
  return L.join("\n") + "\n";
}
