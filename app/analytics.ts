import type { BuiltProfile } from "@/lib/cv/profile";
import { askedSkills, tallyLevels, type AskedRow } from "@/lib/engine/analytics";
import { levelName } from "@/lib/engine/explain";
import { ROADMAP_FROM_JOBS } from "@/lib/engine/roadmapJobs";
import type { Skill } from "@/lib/engine/types";
import {
  ALTERNATIVES_NOTE,
  askedTitle,
  gapRowText,
  learningNote,
  LEVELS_NOTE,
  LEVELS_TITLE,
  levelCountLine,
  moreSkillsLine,
  NO_CV_LINE_NOTE,
  NO_LEVEL_NAME,
  NO_LEVEL_NOTE,
  NOT_ON_PROFILE_NOTE,
  ON_PROFILE_NOTE,
  ANALYTICS_TITLE,
  reportBasisLine,
  yoursNoneLine,
  yoursTitle,
} from "@/lib/saved/messages";
import { profileReport } from "./fitReport";
import type { RoadmapInputs } from "./roadmap";

// Step 8.2 (docs/PLAN-8.2.md sections 2 and 6): the analytics block, built by pure code. No AI, no network, no store, no clock. The counts come from
// lib/engine/analytics.ts and from the box's own inputs (`roadmapInputs`); the level of each counted ad is `profileReport(...).level`, the value the
// saved ads list shows. This file chooses and joins lines; every word is a constant in lib/saved/messages.ts.

export const ANALYTICS_TOP = 10;

// The line kinds (plan section 2, rule 2): basis; heading for the three block headings; note for A7, A9b and A12; level for the level lines (the only
// lines with a bar); skill for the asked rows; plain for the not-counted line, the more-skills line and the your-skills none line.
export type AnalyticsLine = {
  text: string;
  kind: "basis" | "note" | "heading" | "level" | "skill" | "plain";
  bar: { n: number; of: number } | null;
};
export type Analytics = { title: string; lines: AnalyticsLine[] };
export type AnalyticsOutcome = { kind: "none" } | { kind: "ready"; analytics: Analytics } | { kind: "failed"; line: string };

const line = (text: string, kind: AnalyticsLine["kind"]): AnalyticsLine => ({ text, kind, bar: null });

// The first `top` rows and any following row whose counts equal the last shown row's (a cut never splits a tie); `more` is how many are hidden.
function cut(rows: AskedRow[], top: number): { shown: AskedRow[]; more: number } {
  const limit = Math.max(1, top);
  if (rows.length <= limit) return { shown: rows, more: 0 };
  const last = rows[limit - 1];
  let n = limit;
  while (n < rows.length && rows[n].mustAds === last.mustAds && rows[n].niceAds === last.niceAds) n++;
  return { shown: rows.slice(0, n), more: rows.length - n };
}

const standingNote = (standing: AskedRow["standing"]): string =>
  standing === "have" ? ON_PROFILE_NOTE : standing === "no-cv-line" ? NO_CV_LINE_NOTE : standing === "none" ? NOT_ON_PROFILE_NOTE : learningNote(standing.slice("learning:".length));

// Null when there is nothing to show: no profile in use, no counted ad, or fewer counted ads than the gate (the report's own gate).
export function analyticsFrom(
  inputs: RoadmapInputs,
  built: BuiltProfile | null,
  skills: Skill[],
  top: number = ANALYTICS_TOP,
  fromJobs: number = ROADMAP_FROM_JOBS,
): Analytics | null {
  if (built === null || inputs.kind !== "ready" || inputs.M < fromJobs) return null;
  const { M, counted, notCounted, nameOf, engineProfile, engineJobs } = inputs;

  const tally = tallyLevels(counted.map((c) => profileReport(c.ad.job, built, skills, []).level));
  const rows = askedSkills(engineProfile, engineJobs, nameOf);
  const yours = rows.filter((r) => r.standing === "have");
  const skillLine = (r: AskedRow) => line(gapRowText(nameOf(r.skillId), standingNote(r.standing), r.mustAds, r.niceAds), "skill");
  const level = (name: string, n: number): AnalyticsLine => ({ text: levelCountLine(name, n, M), kind: "level", bar: { n, of: M } });

  const lines: AnalyticsLine[] = [line(reportBasisLine(M), "basis")];
  if (notCounted) lines.push(line(notCounted, "plain"));

  // The fit levels: the four levels always, "No level" and its note only when some ad has none.
  lines.push(line(LEVELS_TITLE, "heading"), line(LEVELS_NOTE, "note"));
  lines.push(level(levelName("strong"), tally.strong), level(levelName("good"), tally.good), level(levelName("stretch"), tally.stretch), level(levelName("longShot"), tally.longShot));
  if (tally.none > 0) lines.push(level(NO_LEVEL_NAME, tally.none), line(NO_LEVEL_NOTE, "note"));

  // The asked skills: heading, rows, the more-skills line, then the several-skills note (plan section 2, rule 1).
  lines.push(line(askedTitle(M), "heading"));
  const asked = cut(rows, top);
  lines.push(...asked.shown.map(skillLine));
  if (asked.more > 0) lines.push(line(moreSkillsLine(asked.more), "plain"));
  if (engineJobs.some((job) => job.requirements.some((r) => r.skillIds.length > 1))) lines.push(line(ALTERNATIVES_NOTE, "note"));

  // The person's own skills (the ones the engine counts as met), cut from THEIR OWN list; never the several-skills note.
  if (yours.length === 0) {
    lines.push(line(yoursNoneLine(M), "plain"));
  } else {
    lines.push(line(yoursTitle(M), "heading"));
    const own = cut(yours, top);
    lines.push(...own.shown.map(skillLine));
    if (own.more > 0) lines.push(line(moreSkillsLine(own.more), "plain"));
  }
  return { title: ANALYTICS_TITLE, lines };
}
