import type { EvalAd } from "./evalRun";
import { matchRequirements } from "./evalMatch";
import type { BuildResult } from "./fromAd";
import { quotesMatch } from "./quoteMatch";
import type { Skill } from "./types";

// `npm run eval -- --show <ad id>` (docs/PLAN-3.3.md, C4): the AI's reading of
// one tuning ad next to the key, to see what it returned instead of guessing
// from the report. It must never show the holdout, so it refuses before any AI
// call, and the formatter refuses again. Pure code.

export function showRefusal(id: string, holdoutIds: ReadonlySet<string>): string | null {
  const wanted = id.trim().toLowerCase();
  if (holdoutIds.has(wanted)) {
    return `Refused: ${wanted} is a holdout ad. --show only works on tuning ads, and the holdout stays unseen until the owner says tuning is done.`;
  }
  return null;
}

const quote = (s: string | null) => (s === null ? "nothing" : `"${s}"`);
const row = (label: string, key: string, ai: string) => `  ${label.padEnd(11)}: key ${key} | AI ${ai}`;
const langs = (l: { code: string; level: string | null }[]) =>
  l.length === 0 ? "nothing" : l.map((x) => `${x.code} ${x.level ?? "(no level)"}`).join(", ");

export function formatShow(ad: EvalAd, result: BuildResult, skills: Skill[]): string {
  if (ad.holdout) throw new Error("holdout ad: --show refuses it");

  const { key } = ad;
  const c = result.job.constraints;
  const title = result.job.title === "Untitled job" ? null : result.job.title;
  const quotes = (list: { quote: string }[]) => (list.length === 0 ? "none" : list.map((x) => `"${x.quote}"`).join("; "));

  const lines: string[] = [
    `SHOW ${ad.id}: key on the left, the AI's reading on the right (one AI call; a tuning ad).`,
    "",
    "CONSTRAINTS",
    row("title", quote(key.title), quote(title)),
    row("company", quote(key.company), quote(result.job.company)),
    row("location", quote(key.location), quote(c.location)),
    row("work mode", key.workMode ? key.workMode.value : "nothing", c.remote ?? "nothing"),
    row("years", key.minYears ? String(key.minYears.years) : "nothing", c.minYears === null ? "nothing" : String(c.minYears)),
    row("start date", key.startDate ? key.startDate.date : "nothing", c.startDate ?? "nothing"),
    row("languages", langs(key.languages), langs(c.languages)),
    "  conditions :",
    `    key: ${quotes(key.otherConditions)}`,
    `    AI: ${quotes(c.otherConditions)}`,
    "",
    "REQUIREMENTS (paired by quote)",
  ];

  const match = matchRequirements(key.requirements, result.job.requirements, skills);
  const partner = new Map(match.pairs.map((p) => [p.key, p.extracted]));
  key.requirements.forEach((k, i) => {
    const e = partner.get(i);
    if (e === undefined) {
      lines.push(`  MISSED  ${k.importance} "${k.quote}" [${k.skills.join(", ")}]`);
    } else {
      const ai = result.job.requirements[e];
      lines.push(`  paired  ${k.importance} "${k.quote}" [${k.skills.join(", ")}] <-> AI ${ai.importance} "${ai.quote}" [${ai.skillIds.join(", ")}]`);
    }
  });
  for (const e of match.extras) {
    const ai = result.job.requirements[e];
    const accepted = key.acceptedExtras.some((x) => quotesMatch(x.quote, ai.quote));
    lines.push(`  EXTRA (${accepted ? "accepted" : "invented"}) ${ai.importance} "${ai.quote}" [${ai.skillIds.join(", ")}]`);
  }

  lines.push("", "REMOVED BY THE CHECK");
  if (result.removed.length === 0) lines.push("  nothing");
  for (const r of result.removed) lines.push(`  ${r.what} (${r.why}): "${r.text}"`);
  return lines.join("\n") + "\n";
}
