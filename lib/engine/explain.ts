import { languageName, MODE_NAMES } from "./match";
import type {
  Conflict,
  ConflictKind,
  FitLevel,
  Job,
  MatchResult,
  Profile,
  Requirement,
  RequirementResult,
} from "./types";
import type { BlockedJob, RankedSkill, TimelineEntry } from "./unlock";

// Plain-language sentences for the report, as pure functions: no printing,
// no AI. The command-line report uses them now; the web pages can later.
// Counts only, never percentages. English only for now.

export type NameOf = (skillId: string) => string;

export const YEARS_NOTE =
  "Note: years are compared with your total years of experience, not years per skill.";

export function levelName(level: FitLevel): string {
  return { strong: "Strong", good: "Good", stretch: "Stretch", longShot: "Long shot" }[level];
}

const KIND_LABELS: Record<ConflictKind, string> = {
  language: "language level",
  years: "years of experience",
  city: "location",
  workMode: "work mode",
  startDate: "start date",
};

export function jobLabel(job: Job): string {
  return job.company ? `${job.title}, ${job.company}` : job.title;
}

// ---- small helpers -----------------------------------------------------------

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// "A", "A or B", "A, B or C"
function joinOr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

// "A", "A and B", "A, B and C"
function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// A requirement is named by its acceptable skills: "Power BI or Tableau".
function requirementLabel(req: Requirement, nameOf: NameOf): string {
  return joinOr(req.skillIds.map(nameOf));
}

// ---- fit and reason ----------------------------------------------------------

// One short clause for a conflict, starting in lower case, for use inside the
// reason sentence. The full sentence is Conflict.message.
function conflictReason(c: Conflict): string {
  switch (c.kind) {
    case "language": {
      const name = languageName(c.code);
      const asked = `the ad asks for ${name}${c.required ? ` at ${c.required}` : ""}`;
      return `${asked} and your profile ${c.has ? `has ${c.has}` : `does not list ${name}`}`;
    }
    case "years":
      return `the ad asks for ${c.required} ${plural(c.required, "year", "years")} and your profile has ${c.has}`;
    case "city":
      return `the job is in ${c.required} and the cities on your profile are ${c.cities.join(", ") || "none"}`;
    case "workMode":
      return `the job is ${MODE_NAMES[c.required]} and your profile accepts ${c.accepted.map((m) => MODE_NAMES[m]).join(", ") || "none"}`;
    case "startDate":
      return `the ad wants a start by ${c.required} and you are available from ${c.available}`;
  }
}

// Why the level is what it is, in one or two sentences. When the skills are
// fine and a conflict decides, it says so.
export function explainFit(result: MatchResult, nameOf: NameOf): string {
  const total = result.counts.mustsTotal;
  const missing = result.musts.filter((m) => !m.met);
  const k = missing.length;
  const list = missing.map((m) => requirementLabel(m.requirement, nameOf)).join(", ");
  const meet = total === 1 ? "the only must-have" : `all ${total} must-haves`;
  const reasons = result.conflicts.map(conflictReason);

  switch (result.decidedBy) {
    case "all-musts-met":
      return total === 0
        ? "The ad lists no must-haves, and no conflict stands in the way."
        : `You meet ${meet} and no conflict stands in the way.`;

    case "one-must-missing":
      return `One must-have is missing (${list}). Nothing else stands in the way.`;

    case "one-closable-conflict":
      return `Your skills fit: you meet ${meet}. One thing stands in the way, and it could be closed: ${reasons[0]}.`;

    case "two-gaps":
      if (k === 2) return `Two must-haves are missing (${list}). Nothing else stands in the way.`;
      if (k === 1) return `One must-have is missing (${list}) and one conflict could be closed: ${reasons[0]}.`;
      return `Your skills fit: you meet ${meet}. Two things stand in the way, and both could be closed: ${reasons.join("; ")}.`;

    case "three-or-more-gaps": {
      const parts: string[] = [];
      if (k > 0) parts.push(`${k} ${plural(k, "must-have is", "must-haves are")} missing (${list})`);
      const c = reasons.length;
      if (c > 0) parts.push(`${c} ${plural(c, "conflict", "conflicts")} could be closed: ${reasons.join("; ")}`);
      return `Three or more gaps: ${parts.join(" and ")}.`;
    }

    default: {
      // "unclosable-conflict:<kind>": the first conflict that can't be closed.
      const decider = result.conflicts.find((c) => !c.closable)!;
      const deciding = `What decides this is ${KIND_LABELS[decider.kind]}: ${conflictReason(decider)}, and that can't be closed soon.`;
      if (k === 0) return `Your skills fit: you meet ${meet}. ${deciding}`;
      return `${deciding} Also, ${k} of ${total} must-haves ${plural(k, "is", "are")} missing (${list}).`;
    }
  }
}

// For the one-line summary: when every must-have is met but the level is held
// down by conflicts, what they are. null otherwise.
export function heldBackBy(result: MatchResult): string | null {
  const missing = result.musts.some((m) => !m.met);
  if (missing || result.conflicts.length === 0) return null;
  const labels = [...new Set(result.conflicts.map((c) => KIND_LABELS[c.kind]))];
  return joinAnd(labels);
}

// ---- must-haves, conflicts -----------------------------------------------------

// One line saying how a requirement stands: the CV line that proves it, or
// why it is missing.
export function describeRequirement(
  r: RequirementResult,
  profile: Profile,
  nameOf: NameOf,
): { status: "met" | "missing"; text: string } {
  if (r.met && r.metBy) {
    return {
      status: "met",
      text: `${nameOf(r.metBy.skillId)}, CV line ${r.metBy.evidence.line}: "${r.metBy.evidence.text}"`,
    };
  }
  const label = requirementLabel(r.requirement, nameOf);
  if (r.reason === "in-progress") {
    const learning = r.requirement.skillIds.find((id) =>
      profile.skills.some(
        (s) => s.kind === "inProgress" && s.skillId === id && s.expectedDate === r.expectedDate,
      ),
    );
    return {
      status: "missing",
      text: `${nameOf(learning ?? r.requirement.skillIds[0])}: in progress, expected ${r.expectedDate}`,
    };
  }
  if (r.reason === "no-cv-line") {
    return {
      status: "missing",
      text: `${label}: on your profile but tied to no CV line, so it isn't counted`,
    };
  }
  return { status: "missing", text: `${label}: not on your profile` };
}

export function conflictLine(c: Conflict): string {
  return `(${c.closable ? "could be closed" : "can't be closed soon"}) ${c.message}`;
}

export function blockedHeader(b: BlockedJob): string {
  const n = b.conflicts.length;
  const cannot = b.conflicts.some((c) => !c.closable);
  if (n === 1) {
    return cannot ? "blocked by 1 thing; it can't be closed soon" : "blocked by 1 thing; it could be closed";
  }
  return cannot
    ? `blocked by ${n} things; at least one can't be closed soon`
    : `blocked by ${n} things; all of them could be closed`;
}

// ---- roadmap -----------------------------------------------------------------

export function explainRankedSkill(
  entry: RankedSkill,
  closer: { jobId: string; stillNeeds: Requirement[] }[],
  nameOf: NameOf,
  labelOf: (jobId: string) => string,
): string {
  const name =
    nameOf(entry.skillId) +
    (entry.inProgress ? ` (in progress, expected ${entry.inProgress})` : "");
  const n = entry.newlyUnlocked.length;
  if (n > 0) {
    return `${name}: unlocks ${n} ${plural(n, "job", "jobs")} (${entry.newlyUnlocked.map(labelOf).join("; ")}). Total so far: ${entry.totalUnlocked} ${plural(entry.totalUnlocked, "job", "jobs")}.`;
  }
  if (closer.length === 0) return `${name}: brings no job closer.`;
  const parts = closer.map(
    (c) =>
      `together with ${joinAnd(c.stillNeeds.map((r) => requirementLabel(r, nameOf)))}, unlocks ${labelOf(c.jobId)}`,
  );
  return `${name}: ${parts.join("; ")}.`;
}

export function explainTimelineEntry(
  entry: TimelineEntry,
  nameOf: NameOf,
  labelOf: (jobId: string) => string,
): string {
  const skills = entry.skills.map(nameOf).join(", ");
  const head = `By ${entry.date} (${skills}): ${entry.moreStrong} more Strong ${plural(entry.moreStrong, "match", "matches")}`;
  if (entry.moreStrong === 0) {
    const who = entry.skills.length === 1 ? `${skills} doesn't` : "These skills don't";
    return `${head}. ${who} unlock a job yet.`;
  }
  return `${head} (${entry.jobs.map(labelOf).join("; ")}).`;
}
