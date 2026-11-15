import type { ScoredAd } from "./evalRun";
import { injectionVerdict, sumScores, targetCount, targetMet, type AdScore, type Totals } from "./evalScore";

// The text the eval prints (docs/PLAN-3.2.md, section 5). Counts only, never
// percentages. While the holdout is hidden, its ads appear only as one block
// of totals: no per-ad line, no quote, no skill name.

export type ReportInput = {
  usage?: { inputTokens: number; outputTokens: number; calls: number };
  limits?: Record<string, string>;
  partial?: boolean; // a run of some ads only (--only): no totals, no target
  scored: ScoredAd[];
  failed: { id: string; reason: string }[];
  skipped: { id: string; reason: string }[];
  reveal: boolean; // true once the owner says tuning is done
};

const countsLine = (t: Totals) =>
  `must-haves found ${t.found} of ${t.mustTotal} | wrong importance ${t.wrongImportance} | missed ${t.missedMust} must, ${t.missedNice} nice | invented ${t.invented} | name differs ${t.nameDiffers} | widened ${t.widened} | narrowed ${t.narrowed} | removed ${t.removed}`;

const constraintCounts = (t: Totals) =>
  `constraints: right ${t.fields.right}, not stated ${t.fields.notStated}, wrong ${t.fields.wrong}, missed ${t.fields.missed}, invented ${t.fields.invented} | languages: right ${t.languages.right}, wrong ${t.languages.wrong}, missed ${t.languages.missed}, invented ${t.languages.invented} | conditions: found ${t.conditions.found}, missed ${t.conditions.missed}, extra ${t.conditions.extra}`;

function adLines(id: string, s: AdScore): string[] {
  const r = s.requirements;
  const c = s.constraints;
  const lines = [
    `${id}: must-haves found ${r.found} of ${r.mustTotal} | wrong importance ${r.mustReadAsNice + r.niceReadAsMust} | missed ${r.missedMust} must, ${r.missedNice} nice | invented ${r.invented} | name differs ${r.nameDiffers} | widened ${r.widened} | narrowed ${r.narrowed} | removed ${s.removed.length}`,
  ];
  for (const m of r.details.missed) lines.push(`  missed (${m.importance}): "${m.quote}" [${m.skills.join(", ")}]`);
  for (const w of r.details.wrongImportance) lines.push(`  wrong importance: "${w.quote}" (key ${w.key}, AI ${w.ai})`);
  for (const i of r.details.invented) lines.push(`  invented: "${i.quote}" [${i.skills.join(", ")}]`);
  for (const n of r.details.nameDiffers) lines.push(`  name differs: "${n.quote}": key [${n.key.join(", ")}], AI [${n.ai.join(", ")}]`);
  for (const w of r.details.widened) lines.push(`  widened: "${w.quote}": key [${w.key.join(", ")}], AI [${w.ai.join(", ")}]`);
  for (const w of r.details.narrowed) lines.push(`  narrowed: "${w.quote}": key [${w.key.join(", ")}], AI [${w.ai.join(", ")}]`);
  for (const h of r.details.mergeHints) lines.push(`  merge hint: "${h.quote}" shares its quote with a matched item, so the AI may have merged two requirements`);
  for (const x of s.removed) lines.push(`  removed by the check: ${x.what} (${x.why}): "${x.text}"`);
  const f = c.fields;
  lines.push(`  constraints: title ${f.title} | company ${f.company} | location ${f.location} | work mode ${f.workMode} | years ${f.minYears} | start date ${f.startDate}`);
  lines.push(`  languages: right ${c.languages.right}, wrong ${c.languages.wrong}, missed ${c.languages.missed}, invented ${c.languages.invented}`);
  lines.push(`  conditions: found ${c.conditions.found}, missed ${c.conditions.missed}, extra ${c.conditions.extra}`);
  return lines;
}

// The totals over the ads that count (known cases left out), whether the run
// is complete, and whether the 3.3 target is met.
export function summarize(input: Pick<ReportInput, "scored" | "failed" | "skipped">) {
  const totals = sumScores(input.scored.filter((x) => !x.ad.known).map((x) => x.score));
  const complete = input.failed.length === 0 && input.skipped.length === 0;
  return { totals, complete, met: targetMet(totals, complete) };
}

export function formatReport(input: ReportInput): string {
  const { scored, failed, skipped, reveal } = input;
  const normal = scored.filter((x) => !x.ad.known);
  const known = scored.filter((x) => x.ad.known);
  const hidden = reveal ? [] : normal.filter((x) => x.ad.holdout);
  const shown = normal.filter((x) => !hidden.includes(x));

  const out: string[] = ["EVAL REPORT"];
  out.push(`Ads scored: ${scored.length}, failed: ${failed.length}, skipped: ${skipped.length}`);
  out.push("");

  for (const x of shown) out.push(...adLines(x.ad.id, x.score), "");

  if (hidden.length > 0) {
    const t = sumScores(hidden.map((x) => x.score));
    out.push(`HOLDOUT (${hidden.length} ads): totals only`);
    out.push(`  ${countsLine(t)}`);
    out.push(`  ${constraintCounts(t)}`);
    out.push("");
  }

  if (known.length > 0) {
    out.push("KNOWN CASES (reported apart, not in the target)");
    for (const x of known) {
      const { company, injectedCompany } = x.ad.key;
      if (company !== null && injectedCompany !== undefined) {
        const verdict = injectionVerdict(x.job, company, injectedCompany);
        const got = x.job.company === null ? "nothing" : `"${x.job.company}"`;
        out.push(`  ${x.ad.id}: company -> ${verdict} (returned ${got})`);
      } else {
        out.push(`  ${x.ad.id}: no injection set in the key`);
      }
      // A known case is synthetic and never in the holdout: show its details.
      out.push(...adLines(x.ad.id, x.score).map((line) => `  ${line}`));
    }
    out.push("");
  }

  for (const f of failed) out.push(`FAILED: ${f.id} (${f.reason})`);
  for (const s of skipped) out.push(`SKIPPED: ${s.id} (${s.reason})`);
  if (failed.length > 0 || skipped.length > 0) out.push("");

  const budget = () => {
    const n = (v: number) => v.toLocaleString("en-US");
    if (input.usage) {
      const u = input.usage;
      out.push(`TOKENS: in ${n(u.inputTokens)}, out ${n(u.outputTokens)}, total ${n(u.inputTokens + u.outputTokens)} (from ${u.calls} calls)`);
    }
    if (input.limits && Object.keys(input.limits).length > 0) {
      out.push(`RATE LIMITS (Groq's answer to the last call): ${Object.entries(input.limits).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }
  };
  if (input.partial) {
    out.push("PARTIAL RUN (--only): no totals and no target for this run.");
    budget();
    return out.join("\n") + "\n";
  }
  const { totals, complete, met } = summarize(input);
  out.push(`TOTALS (${normal.length} ads, known cases left out): ${countsLine(totals)}`);
  out.push(
    `TARGET: found ${totals.found} of ${totals.mustTotal}; target ${targetCount(totals.mustTotal)} or more; invented ${totals.invented} -> ${met ? "MET" : "NOT MET"}${complete ? "" : " (INCOMPLETE RUN: an ad failed or was skipped)"}`,
  );
  budget();
  return out.join("\n") + "\n";
}
