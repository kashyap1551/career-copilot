import type { BuiltProfile } from "@/lib/cv/profile";
import type { FitLevel, Job, Skill } from "@/lib/engine/types";
import { LEVEL_FAILED_LINE, NO_PROFILE_IN_USE_NOTE, OLD_READING_LINE } from "@/lib/saved/messages";
import { openJob, type OpenedJob } from "@/lib/saved/openJob";
import type { CurrentStamps, SavedJob } from "@/lib/saved/types";
import { jobRows } from "@/lib/saved/ui";
import { profileReport, type ProfileReport } from "./fitReport";

// Step 6.2 (docs/PLAN-6.2.md, APPROVED revision 2): the fit level on each row of the saved ads. Pure code: no AI, no
// network, no storage. This file only READS what it is given; it never writes anything and never reads the saved profile:
// the profile is the one the page's report uses (`profile = savedBuilt ?? built`), passed in.
//
// The label of a row is never written here: it is `fitLabel` of the report. Rows and the opened report both come from
// reportFor, so for the same ad and the same profile their texts cannot differ.

// The ONE function that turns a reading and the profile in use into a report. The page's own report uses it too.
export function reportFor(
  reading: { job: Job; unlisted: Skill[] },
  profile: BuiltProfile,
  skills: Skill[],
  extraUnlisted: Skill[] = [],
): ProfileReport {
  return profileReport(reading.job, profile, skills, [...reading.unlisted, ...extraUnlisted]);
}

// Step 1, independent of the profile: which reading each saved ad shows (as stored, or re-checked in the browser from the
// stored extraction; the same decision Open makes). A record that makes openJob throw is kept, marked "failed".
export type OpenedAd = { id: string; savedAt: string; titleLine: string; date: string; opened: OpenedJob | { kind: "failed" } };

export function openedReadings(ads: SavedJob[], current: { stamps: CurrentStamps; skills: Skill[] }): OpenedAd[] {
  return ads.map((ad) => {
    let titleLine = "Saved ad";
    let date = String(ad.savedAt ?? "").slice(0, 10);
    try {
      const row = jobRows([ad])[0];
      titleLine = row.label;
      date = row.date;
    } catch {
      /* keep the plain fallbacks: the record is still listed */
    }
    try {
      return { id: ad.id, savedAt: ad.savedAt, titleLine, date, opened: openJob(ad, current) };
    } catch {
      return { id: ad.id, savedAt: ad.savedAt, titleLine, date, opened: { kind: "failed" as const } };
    }
  });
}

export type AdRow = {
  id: string;
  titleLine: string;
  date: string;
  levelText: string | null; // the report's label, or null (no profile in use, or the level could not be worked out)
  levelLine: string | null; // "Fit: <levelText>"
  namedReason: string | null;
  oldReadingLine: string | null;
  errorLine: string | null;
  error: boolean;
  rank: number; // 0 to 3 for a level, 4 for "no level" and for a row whose level could not be worked out
};

const RANK: Record<FitLevel, number> = { strong: 0, good: 1, stretch: 2, longShot: 3 };
const NO_LEVEL_RANK = 4;

// Step 2: the rows for the profile in use. No profile in use: no level on any row, date order, one note. With a profile:
// ranked by level, then newest first, then id (the order of the list of saved ads). One failing row never stops the others.
export function rankedAdRows(
  opened: OpenedAd[],
  profile: BuiltProfile | null,
  skills: Skill[],
): { rows: AdRow[]; note: string | null } {
  const rows: AdRow[] = opened.map((ad) => {
    const base = { id: ad.id, titleLine: ad.titleLine, date: ad.date };
    if (profile === null) {
      return { ...base, levelText: null, levelLine: null, namedReason: null, oldReadingLine: null, errorLine: null, error: false, rank: 0 };
    }
    try {
      const o = ad.opened;
      if (o.kind === "failed" || o.kind === "newer-version") throw new Error("this record could not be opened");
      const report = reportFor(o.reading, profile, skills);
      return {
        ...base,
        levelText: report.fitLabel,
        levelLine: `Fit: ${report.fitLabel}`,
        namedReason: report.namedReason,
        oldReadingLine: o.kind === "older-instructions" || o.kind === "cannot-recheck" ? OLD_READING_LINE : null,
        errorLine: null,
        error: false,
        rank: report.level === null ? NO_LEVEL_RANK : RANK[report.level],
      };
    } catch {
      return { ...base, levelText: null, levelLine: null, namedReason: null, oldReadingLine: null, errorLine: LEVEL_FAILED_LINE, error: true, rank: NO_LEVEL_RANK };
    }
  });
  const dateOf = new Map(opened.map((a) => [a.id, a.savedAt]));
  rows.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const sa = dateOf.get(a.id) ?? "";
    const sb = dateOf.get(b.id) ?? "";
    return sa === sb ? a.id.localeCompare(b.id) : sa < sb ? 1 : -1;
  });
  return { rows, note: profile === null && rows.length > 0 ? NO_PROFILE_IN_USE_NOTE : null };
}
