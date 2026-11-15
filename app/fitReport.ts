import { conflictLine, levelName } from "@/lib/engine/explain";
import { languageName, match, MODE_NAMES } from "@/lib/engine/match";
import type { ConflictKind, Job, Skill } from "@/lib/engine/types";
import { KINDS, KIND_WORDS, type BuiltProfile, type Kind } from "@/lib/cv/profile";
import { countsSentence, NOT_JUDGED_SENTENCE, type RequirementRow } from "./skillsOnly";

// Step 4.3: the fit report for a confirmed profile. Pure functions (no AI, no
// network). It judges only the kinds of constraint the person set AND the ad
// states; every other kind is listed as "not judged", with the reason, and the
// label says which kinds were judged. The engine is not changed: the kinds the
// person did not set are passed to it as "not stated". See docs/PLAN-4.3.md.

export type ProfileReport = {
  fitLabel: string; // "Good (skills only)" or "Stretch (judged: skills, years)"
  explanation: string;
  counts: { mustsMet: number; mustsTotal: number; nicesMet: number; nicesTotal: number };
  rows: RequirementRow[];
  unlistedRequirements: number;
  judged: Kind[];
  notJudged: string[];
  conflicts: string[];
  checkYourself: string[];
};

const CAP: Record<Kind, string> = {
  location: "Location",
  language: "Language",
  workMode: "Work mode",
  years: "Years",
  startDate: "Start date",
};

const CONFLICT_KIND: Record<ConflictKind, Kind> = {
  language: "language",
  years: "years",
  city: "location",
  workMode: "workMode",
  startDate: "startDate",
};

// Does the ad state this kind in a way the engine can judge?
function statedByAd(kind: Kind, job: Job): boolean {
  const c = job.constraints;
  switch (kind) {
    case "location":
      return c.location !== null && c.remote !== null && c.remote !== "remote";
    case "language":
      return c.languages.length > 0;
    case "workMode":
      return c.remote !== null;
    case "years":
      return c.minYears !== null;
    case "startDate":
      return c.startDate !== null;
  }
}

// What the ad says for this kind, in words, or null.
function adSays(kind: Kind, job: Job): string | null {
  const c = job.constraints;
  switch (kind) {
    case "location":
      return c.location;
    case "language":
      return c.languages.length === 0
        ? null
        : c.languages.map((l) => `${languageName(l.code)}${l.level ? ` at ${l.level}` : ""}`).join(", ");
    case "workMode":
      return c.remote === null ? null : MODE_NAMES[c.remote];
    case "years":
      return c.minYears === null ? null : `${c.minYears} ${c.minYears === 1 ? "year" : "years"}`;
    case "startDate":
      return c.startDate;
  }
}

export function profileReport(job: Job, built: BuiltProfile, skills: Skill[], unlisted: Skill[]): ProfileReport {
  const { profile, set } = built;

  // The engine only sees the kinds the person set. If only a location is set,
  // every work mode is accepted, so the city check still runs.
  const engineJob: Job = {
    ...job,
    constraints: {
      ...job.constraints,
      languages: set.language ? job.constraints.languages : [],
      location: set.location ? job.constraints.location : null,
      remote: set.workMode || set.location ? job.constraints.remote : null,
    },
  };
  const engineProfile = {
    ...profile,
    constraints: {
      ...profile.constraints,
      workModes: set.workMode ? profile.constraints.workModes : (["onsite", "hybrid", "remote"] as const).slice(),
    },
  };
  const result = match(engineProfile, engineJob);

  const judged = KINDS.filter((k) => set[k] && statedByAd(k, job));
  const notJudgedKinds = KINDS.filter((k) => !judged.includes(k));

  const nameOf = (id: string) =>
    skills.find((s) => s.id === id)?.name ?? unlisted.find((s) => s.id === id)?.name ?? id;
  const labelOf = (ids: string[]) => ids.map(nameOf).join(" or ");

  const rows: RequirementRow[] = [...result.musts, ...result.nices].map((r) => {
    const label = labelOf(r.requirement.skillIds);
    const base = { quote: r.requirement.quote, importance: r.requirement.importance, label };
    if (r.met && r.metBy) {
      return {
        ...base,
        status: "met" as const,
        detail: `${nameOf(r.metBy.skillId)}: CV line ${r.metBy.evidence.line}: "${r.metBy.evidence.text}"`,
      };
    }
    if (r.requirement.skillIds.every((id) => id.startsWith("new:"))) {
      return {
        ...base,
        status: "unlisted" as const,
        detail: `${label}: not in our skill list yet, so it can't be matched with your CV`,
      };
    }
    if (r.reason === "in-progress") {
      return { ...base, status: "missing" as const, detail: `${label}: in progress, expected ${r.expectedDate}` };
    }
    if (r.reason === "no-cv-line") {
      return {
        ...base,
        status: "missing" as const,
        detail: `${label}: added by hand with no CV line, so it does not count. Add a line about it to your CV text and read again.`,
      };
    }
    return { ...base, status: "missing" as const, detail: `${label}: not on your profile` };
  });

  const conflicts = result.conflicts.filter((c) => judged.includes(CONFLICT_KIND[c.kind])).map(conflictLine);

  const notJudged: string[] = [];
  for (const k of notJudgedKinds) {
    const says = adSays(k, job);
    if (!set[k]) {
      notJudged.push(
        says !== null
          ? `${CAP[k]}: the ad says ${says}; not judged because you did not set yours.`
          : `${CAP[k]}: not judged (you did not set yours, and the ad does not say).`,
      );
    } else {
      notJudged.push(`${CAP[k]}: not judged (the ad does not say).`);
    }
  }
  // A judged kind can still have a part the engine could not compare (a language with no level).
  for (const n of result.notJudged) {
    const k = CONFLICT_KIND[n.kind];
    if (judged.includes(k)) notJudged.push(`${CAP[k]}: ${n.reason}`);
  }

  const missing = result.musts.filter((m) => !m.met).map((m) => labelOf(m.requirement.skillIds));
  const counts = countsSentence(result.counts.mustsTotal, missing, "on your profile");
  let explanation: string;
  if (judged.length === 0) {
    explanation = `${counts} ${NOT_JUDGED_SENTENCE}`;
  } else {
    const found =
      conflicts.length === 0
        ? "No conflict was found in what you set."
        : conflicts.length === 1
          ? "1 conflict was found in what you set (listed below)."
          : `${conflicts.length} conflicts were found in what you set (listed below).`;
    const rest = notJudgedKinds.length > 0 ? ` Not judged here: ${notJudgedKinds.map((k) => KIND_WORDS[k]).join(", ")}.` : "";
    explanation = `${counts} ${found}${rest}`;
  }

  return {
    fitLabel: `${levelName(result.level)} (${judged.length === 0 ? "skills only" : `judged: skills, ${judged.map((k) => KIND_WORDS[k]).join(", ")}`})`,
    explanation,
    counts: result.counts,
    rows,
    unlistedRequirements: rows.filter((r) => r.status === "unlisted").length,
    judged,
    notJudged,
    conflicts,
    checkYourself: result.checkYourself,
  };
}
