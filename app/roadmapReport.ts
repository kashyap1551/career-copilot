import type { BuiltProfile } from "@/lib/cv/profile";
import { ROADMAP_FROM_JOBS } from "@/lib/engine/roadmapJobs";
import type { Job, Skill } from "@/lib/engine/types";
import {
  rankingNoneLine,
  RANKING_HEADER,
  REPORT_FAILED_LINE,
  REPORT_FOOTNOTE,
  REPORT_TITLE,
  reportAskedLine,
  reportBasisLine,
} from "@/lib/saved/messages";
import { roadmapInputs, roadmapParts } from "./roadmap";

// Step 8.1 (docs/PLAN-8.1.md): the roadmap report, built by pure code. No AI, no network, no store, no clock. The numbers and the engine's
// sentences come from the same inputs and builders as the "What to learn" box (app/roadmap.ts: `roadmapInputs`, `roadmapParts`), so the two
// cannot disagree; this file only chooses and joins lines. The words are constants in lib/saved/messages.ts.

export type ReportLine = { text: string; sub: boolean };
export type RoadmapReport = { title: string; lines: ReportLine[] };
export type ReportOutcome = { kind: "none" } | { kind: "ready"; report: RoadmapReport } | { kind: "failed"; line: string };

// What the person sees after pressing the copy button, and the record of the last attempt: the status AND the text it described.
export type CopyStatus = "idle" | "copied" | "failed";
export type CopyRecord = { status: "copied" | "failed"; text: string };

const line = (text: string): ReportLine => ({ text, sub: false });

// Null when there is nothing to report: no profile in use, no saved ad, no counted ad, or fewer counted ads than the roadmap needs.
export function roadmapReport(
  built: BuiltProfile | null,
  ads: { id: string; job: Job }[],
  skills: Skill[],
  fromJobs: number = ROADMAP_FROM_JOBS,
): RoadmapReport | null {
  const r = roadmapInputs(built, ads, skills);
  if (r.kind !== "ready" || r.M < fromJobs) return null;
  const parts = roadmapParts(r);

  const lines: ReportLine[] = [line(reportBasisLine(r.M))];
  if (r.notCounted) lines.push(line(r.notCounted));
  lines.push(line(parts.alreadyStrong));
  if (parts.ranking.length === 0) {
    lines.push(line(rankingNoneLine(parts.groups.alreadyStrong.length > 0)));
  } else {
    lines.push(line(RANKING_HEADER));
    parts.ranking.forEach((entry, i) => {
      lines.push(line(`${i + 1}. ${entry.text}`));
      // The asked numbers are looked up BY SKILL ID in the gap list, never by position; no line when the skill has no counts.
      const row = r.gaps.rows.find((g) => g.skillId === entry.skillId);
      const asked = row ? reportAskedLine(row.mustAds, row.niceAds, r.M) : null;
      if (asked) lines.push({ text: asked, sub: true });
    });
    lines.push(line(REPORT_FOOTNOTE));
  }
  lines.push(...parts.blocked.map(line), ...parts.timeline.map(line));
  return { title: REPORT_TITLE, lines };
}

// What the page calls: a throw while working out the report (a damaged record, say) gives one line instead of an error page.
export function roadmapReportSafe(
  built: BuiltProfile | null,
  ads: { id: string; job: Job }[],
  skills: Skill[],
  fromJobs: number = ROADMAP_FROM_JOBS,
): ReportOutcome {
  try {
    const report = roadmapReport(built, ads, skills, fromJobs);
    return report ? { kind: "ready", report } : { kind: "none" };
  } catch {
    return { kind: "failed", line: REPORT_FAILED_LINE };
  }
}

// The plain text of the report: the title first, then every line, a sub line indented four spaces, joined with newlines, no trailing one.
export function reportAsText(report: RoadmapReport): string {
  return [report.title, ...report.lines.map((l) => (l.sub ? `    ${l.text}` : l.text))].join("\n");
}

// Writes `text` once through `write` and ALWAYS resolves: "copied" when the write resolves, "failed" when it is refused (a rejection) or
// throws at once (a missing browser feature throws before any promise exists). The caller passes the real write in.
export async function copyReport(text: string, write: (text: string) => Promise<void>): Promise<CopyStatus> {
  try {
    await write(text);
    return "copied";
  } catch {
    return "failed";
  }
}

// The status to show: the last attempt's, but only while the text on screen is still the text that attempt described.
export function shownCopyStatus(record: CopyRecord | null, currentText: string): CopyStatus {
  return record !== null && record.text === currentText ? record.status : "idle";
}
