import type { CvRunResult } from "./evalCvRun";
import { passLines, type CvScore } from "./evalCvScore";

// The printed report of `npm run eval-cv` (docs/PLAN-4.2.md, section d).
// Counts and the invented or unmatched items only. The CVs are made up, so the
// quotes of invented and unmatched items are safe to print. No percentages.

const pad = (s: string | number, n: number) => String(s).padStart(n);

function removedTotal(s: CvScore): number {
  return Object.values(s.removed).reduce((a, b) => a + (b ?? 0), 0);
}

export function formatCvReport(run: CvRunResult, counted: boolean): string {
  const scores = run.rows.map((r) => r.score);
  const L: string[] = [];
  L.push(counted ? "CV EVAL (counted run)" : "CV EVAL: CALIBRATION RUN (not counted)");
  L.push(`${"cv".padEnd(18)} kept tied named inferred removed dupes ${"found".padStart(9)} invented unmatched`);
  for (const s of scores) {
    L.push(
      `${s.cv.padEnd(18)} ${pad(s.kept, 4)} ${pad(s.tied, 4)} ${pad(s.named, 5)} ${pad(s.inferred, 8)} ${pad(removedTotal(s), 7)} ${pad(s.duplicates, 5)} ${pad(`${s.found} of ${s.keyItems}`, 9)} ${pad(s.invented.length, 8)} ${pad(s.unmatched.length, 9)}`,
    );
  }
  const sum = (f: (s: CvScore) => number) => scores.reduce((a, s) => a + f(s), 0);
  L.push(
    `TOTALS: kept ${sum((s) => s.kept)} | tied ${sum((s) => s.tied)} | named ${sum((s) => s.named)} | inferred ${sum((s) => s.inferred)} | removed ${sum(removedTotal)} | duplicates ${sum((s) => s.duplicates)} | found ${sum((s) => s.found)} of ${sum((s) => s.keyItems)} | invented (a) ${sum((s) => s.invented.length)} | unmatched inferred (b) ${sum((s) => s.unmatched.length)} | injected ${sum((s) => s.injected)}`,
  );

  const reasons: Record<string, number> = {};
  for (const s of scores) for (const [why, n] of Object.entries(s.removed)) reasons[why] = (reasons[why] ?? 0) + (n ?? 0);
  L.push(`REMOVED BY REASON: ${Object.keys(reasons).length === 0 ? "none" : Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(", ")}`);

  L.push("INVENTED (a):");
  const invented = scores.flatMap((s) => s.invented.map((x) => ({ cv: s.cv, x })));
  if (invented.length === 0) L.push("  none");
  for (const { cv, x } of invented) {
    L.push(`  ${cv}: ${x.skill.name} @ line ${x.skill.line} "${x.skill.quote}" (${x.reason})${x.injected ? " [injected]" : ""}`);
  }
  L.push("UNMATCHED INFERRED (b):");
  const unmatched = scores.flatMap((s) => s.unmatched.map((x) => ({ cv: s.cv, x })));
  if (unmatched.length === 0) L.push("  none");
  for (const { cv, x } of unmatched) {
    L.push(`  ${cv}: line ${x.skill.line}, ${x.skill.name}, "${x.skill.quote}"`);
  }

  const p = passLines(scores);
  L.push(`PASS LINES: every kept skill tied to a line that holds its quote: ${p.tied ? "yes" : "NO"} | invented (a) 0: ${p.invented ? "yes" : "NO"}`);
  L.push(`CVs: scored ${scores.length}, failed ${run.failed.length}${run.complete ? "" : " (the run is INCOMPLETE and cannot count)"}`);
  for (const f of run.failed) L.push(`FAILED: ${f.id} (${f.reason})`);
  for (const r of run.retried) L.push(`${r.id}: retried once after status ${r.code} (the retry ${r.recovered ? "worked" : "failed too"})`);
  const verdict = !counted ? "calibration run: not counted" : p.met && run.complete ? "MET" : "NOT MET";
  L.push(`VERDICT: ${verdict}`);
  L.push(`TOKENS: ${(run.usage.inputTokens + run.usage.outputTokens).toLocaleString("en-US")} in total for ${run.usage.calls} calls (${run.usage.inputTokens.toLocaleString("en-US")} in, ${run.usage.outputTokens.toLocaleString("en-US")} out)`);
  if (run.limits && Object.keys(run.limits).length > 0) {
    L.push(`RATE LIMITS (Groq's answer, last call): ${Object.entries(run.limits).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  return L.join("\n") + "\n";
}
