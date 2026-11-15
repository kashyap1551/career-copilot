import { levelName } from "@/lib/engine/explain";
import { languageName, match, MODE_NAMES } from "@/lib/engine/match";
import { skillIdFor } from "@/lib/engine/skillIds";
import type { Job, Profile, Skill } from "@/lib/engine/types";

// Step 3.4 page logic, as pure functions (no AI, no network): a pasted list of
// skills becomes a provisional profile, and the job is judged on skills only.
// Both choices are in docs/DECISIONS.md and are replaced by real CV lines on
// Day 4.

export type ListLine = {
  line: number; // 1-based, counting only non-empty lines
  text: string;
  skillId: string | null; // null: nothing to make an id from
  listed: boolean; // is the skill in our skill list?
};

// One skill per line. Empty lines are skipped and don't take a number.
export function readSkillList(
  text: string,
  skills: Skill[],
): { cvLines: string[]; lines: ListLine[] } {
  const cvLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const lines = cvLines.map((t, i) => {
    const hit = skillIdFor(t, skills);
    return {
      line: i + 1,
      text: t,
      skillId: hit ? hit.id : null,
      listed: hit !== null && hit.listed,
    };
  });
  return { cvLines, lines };
}

// Each listed skill cites the list line it came from ("your list, line n").
// A skill that is not in our skill list is left out: it can't be matched with
// an ad's skill (docs/SPRINT.md, the step 3.4 note), so nothing it names can
// count as met. The first line wins when a skill is listed twice.
export function profileFromList(cvLines: string[], lines: ListLine[]): Profile {
  const seen = new Set<string>();
  const skills: Profile["skills"] = [];
  for (const l of lines) {
    if (!l.listed || l.skillId === null || seen.has(l.skillId)) continue;
    seen.add(l.skillId);
    skills.push({
      kind: "have",
      skillId: l.skillId,
      evidence: { line: l.line, text: l.text },
    });
  }
  return {
    id: "pasted-list",
    name: "You",
    cvLines,
    skills,
    constraints: {
      languages: [],
      locations: [],
      workModes: [],
      years: null,
      availableFrom: null,
    },
  };
}

export type RequirementRow = {
  quote: string;
  importance: "must" | "nice";
  label: string; // "Power BI or Tableau"
  status: "met" | "missing" | "unlisted";
  detail: string;
};

export type SkillsOnlyReport = {
  fitLabel: string; // "Good (skills only)"
  explanation: string;
  counts: { mustsMet: number; mustsTotal: number; nicesMet: number; nicesTotal: number };
  rows: RequirementRow[];
  unlistedRequirements: number; // requirements whose skills are all unlisted
  notJudged: string[];
  checkYourself: string[];
};

const isUnlistedId = (id: string) => id.startsWith("new:");

// The job's constraints go in as "not stated" so the engine judges skills
// only; the real ones are listed as "not judged". otherConditions stay: the
// engine only copies them out as "check this yourself".
function skillsOnlyJob(job: Job): Job {
  return {
    ...job,
    constraints: {
      languages: [],
      location: null,
      remote: null,
      minYears: null,
      startDate: null,
      otherConditions: job.constraints.otherConditions,
    },
  };
}

export function notJudgedLines(job: Job): string[] {
  const c = job.constraints;
  const out: string[] = [];
  for (const l of c.languages) {
    const name = languageName(l.code);
    out.push(`Language: ${l.level ? `${name} at ${l.level}` : name}`);
  }
  if (c.location !== null) out.push(`Location: ${c.location}`);
  if (c.remote !== null) out.push(`Work mode: ${MODE_NAMES[c.remote]}`);
  if (c.minYears !== null) out.push(`Years of experience: ${c.minYears}`);
  if (c.startDate !== null) out.push(`Start date: ${c.startDate}`);
  return out.map((s) => `${s}: not judged`);
}

const NOT_JUDGED_SENTENCE =
  "Location, language, work mode, years and start date are not judged here.";

// Written here, not by explainFit: that text says what "stands in the way",
// which is unknown when the job's constraints are not judged. This one only
// says what the counts show.
// The counts sentence, shared with the confirmed-profile report (app/fitReport.ts).
export function countsSentence(total: number, missing: string[], where = "on your list"): string {
  if (total === 0) return "The ad lists no must-haves.";
  if (missing.length === 0)
    return total === 1 ? `You meet the only must-have ${where}.` : `You meet all ${total} must-haves ${where}.`;
  if (missing.length === 1) return `One must-have is missing: ${missing[0]}.`;
  return `${missing.length} of ${total} must-haves are missing: ${missing.join(", ")}.`;
}

export function skillsOnlyExplanation(total: number, missing: string[]): string {
  return `${countsSentence(total, missing)} ${NOT_JUDGED_SENTENCE}`;
}

export { NOT_JUDGED_SENTENCE };

export function skillsOnlyReport(
  job: Job,
  cvLines: string[],
  lines: ListLine[],
  skills: Skill[],
  unlisted: Skill[],
): SkillsOnlyReport {
  const profile = profileFromList(cvLines, lines);
  const result = match(profile, skillsOnlyJob(job));

  const nameOf = (id: string) =>
    skills.find((s) => s.id === id)?.name ??
    unlisted.find((s) => s.id === id)?.name ??
    id;
  const labelOf = (ids: string[]) => ids.map(nameOf).join(" or ");

  const rows: RequirementRow[] = [...result.musts, ...result.nices].map((r) => {
    const label = labelOf(r.requirement.skillIds);
    const base = { quote: r.requirement.quote, importance: r.requirement.importance, label };
    if (r.met && r.metBy) {
      return {
        ...base,
        status: "met" as const,
        detail: `${nameOf(r.metBy.skillId)}: from your list, line ${r.metBy.evidence.line}: "${r.metBy.evidence.text}"`,
      };
    }
    if (r.requirement.skillIds.every(isUnlistedId)) {
      return {
        ...base,
        status: "unlisted" as const,
        detail: `${label}: not in our skill list yet, so it can't be matched with your CV`,
      };
    }
    return { ...base, status: "missing" as const, detail: `${label}: not on your list` };
  });

  return {
    fitLabel: `${levelName(result.level)} (skills only)`,
    explanation: skillsOnlyExplanation(
      result.counts.mustsTotal,
      result.musts.filter((m) => !m.met).map((m) => labelOf(m.requirement.skillIds)),
    ),
    counts: result.counts,
    rows,
    unlistedRequirements: rows.filter((r) => r.status === "unlisted").length,
    notJudged: notJudgedLines(job),
    checkYourself: result.checkYourself,
  };
}
