import { levelName } from "@/lib/engine/explain";
import { languageName, match, MODE_NAMES } from "@/lib/engine/match";
import { noLevelReason, splitJudgeable, type NoLevelReason } from "@/lib/engine/judgeable";
import { skillIdFor } from "@/lib/engine/skillIds";
import type { Job, Profile, Requirement, RequirementResult, Skill } from "@/lib/engine/types";

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
  unlistedRequirements: number; // requirements whose skills are all unlisted: shown as "could not judge", never counted
  couldNotJudge: { musts: number; nices: number }; // the same, apart (docs/PLAN-FIT-LEVEL.md (a))
  notJudged: string[];
  checkYourself: string[];
};

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
// The counts sentence, shared with the confirmed-profile report (app/fitReport.ts). `couldNotJudge` is the number of
// must-haves that are not in our skill list yet: they are not in `total` and are named at the end (docs/PLAN-FIT-LEVEL.md W1).
export function countsSentence(total: number, missing: string[], where = "on your list", couldNotJudge = 0): string {
  if (total === 0) return "The ad lists no must-haves.";
  const tail = couldNotJudge > 0 ? `, plus ${couldNotJudge} ${couldNotJudge === 1 ? "must-have" : "must-haves"} we could not judge` : "";
  if (missing.length === 0)
    return (total === 1 ? `You meet the only must-have ${where}` : `You meet all ${total} must-haves ${where}`) + `${tail}.`;
  if (missing.length === 1) return `One must-have is missing: ${missing[0]}${tail}.`;
  return `${missing.length} of ${total} must-haves are missing: ${missing.join(", ")}${tail}.`;
}

export function skillsOnlyExplanation(total: number, missing: string[], couldNotJudge = 0): string {
  return `${countsSentence(total, missing, "on your list", couldNotJudge)} ${NOT_JUDGED_SENTENCE}`;
}

// ---- no level, and the label (docs/PLAN-FIT-LEVEL.md W5, W6, W9) -----------------------------------------------------

export const NO_SKILLS_PROFILE_SENTENCE = "No level yet: there are no skills on your profile. Add skills first.";
// The AI found no requirement at all in the ad (Amendment 4).
export const NO_REQUIREMENTS_SENTENCE = "No level can be shown: no requirements were found in this ad, so check that the whole ad was pasted.";
export const NO_SKILLS_LIST_SENTENCE = "No level yet: your list has no skills we can match. Add skills first.";

// Every must-have of the ad is not in our skill list yet, so none could be judged (n is how many the ad has).
export function noMustHaveJudgeableSentence(n: number): string {
  return n === 1
    ? "No level can be shown: the ad's only must-have is not in our skill list yet, so it could not be judged."
    : `No level can be shown: none of the ad's ${n} must-haves is in our skill list yet, so none could be judged.`;
}

// "Strong (skills only)", "At best Strong (skills only; 1 must-have not judged)", "Stretch (skills only; 2 must-haves judged by AI)", or the
// "No level (...)" label. `inner` is "skills only" or "judged: skills, ...". Inside the brackets, in this order: the kinds judged, then (rule R5,
// docs/PLAN-EVERY-CV.md 4.4) how many must-haves were judged by the AI, then how many were not judged at all. Rule R7: when 1 or more must-haves
// are not judged, the level can only be lower than it reads, so it reads "At best <level>"; Long shot keeps its plain name because nothing is
// lower, and a "No level" label is not a level, so it carries neither the caveat nor "At best". With no AI-judged and no unjudged must-have the
// text is what it was before.
export function fitLabelText(
  levelName: string,
  noLevel: NoLevelReason | null,
  inner: string,
  unjudgedMusts: number,
  where: "profile" | "list",
  aiMusts = 0,
): string {
  if (noLevel === "no-requirements") return "No level (no requirements found in this ad)";
  if (noLevel === "no-must-have-judgeable") return "No level (no must-have we could judge)";
  if (noLevel === "no-skills") return `No level (no skills on your ${where})`;
  const noun = (n: number) => (n === 1 ? "must-have" : "must-haves");
  const ai = aiMusts > 0 ? `; ${aiMusts} ${noun(aiMusts)} judged by AI` : "";
  const caveat = unjudgedMusts > 0 ? `; ${unjudgedMusts} ${noun(unjudgedMusts)} not judged` : "";
  const atBest = unjudgedMusts > 0 && levelName !== "Long shot" ? "At best " : "";
  return `${atBest}${levelName} (${inner}${ai}${caveat})`;
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
  // docs/PLAN-FIT-LEVEL.md (a): the level is decided from the requirements in our skill list only.
  const { judged, couldNotJudge } = splitJudgeable(job);
  const result = match(profile, skillsOnlyJob(judged));
  const unjudgedMusts = couldNotJudge.filter((r) => r.importance === "must").length;
  const unjudgedNices = couldNotJudge.length - unjudgedMusts;

  const nameOf = (id: string) =>
    skills.find((s) => s.id === id)?.name ??
    unlisted.find((s) => s.id === id)?.name ??
    id;
  const labelOf = (ids: string[]) => ids.map(nameOf).join(" or ");

  // Rows in the ad's order, musts then nice-to-haves; an unlisted requirement keeps its place and says "could not judge".
  const byRequirement = new Map<Requirement, RequirementResult>();
  for (const r of [...result.musts, ...result.nices]) byRequirement.set(r.requirement, r);
  const inOrder = [...job.requirements.filter((r) => r.importance === "must"), ...job.requirements.filter((r) => r.importance === "nice")];
  const rows: RequirementRow[] = inOrder.map((requirement) => {
    const label = labelOf(requirement.skillIds);
    const base = { quote: requirement.quote, importance: requirement.importance, label };
    const r = byRequirement.get(requirement);
    if (!r) {
      return { ...base, status: "unlisted" as const, detail: `${label}: not in our skill list yet, so we could not judge it.` };
    }
    if (r.met && r.metBy) {
      return {
        ...base,
        status: "met" as const,
        detail: `${nameOf(r.metBy.skillId)}: from your list, line ${r.metBy.evidence.line}: "${r.metBy.evidence.text}"`,
      };
    }
    return { ...base, status: "missing" as const, detail: `${label}: not on your list` };
  });

  const noLevel = noLevelReason({
    requirements: job.requirements.length,
    judgedMusts: result.counts.mustsTotal,
    unjudgedMusts,
    skillCount: profile.skills.length,
  });
  const missing = result.musts.filter((m) => !m.met).map((m) => labelOf(m.requirement.skillIds));
  const usual = skillsOnlyExplanation(result.counts.mustsTotal, missing, unjudgedMusts);
  const explanation =
    noLevel === "no-requirements"
      ? NO_REQUIREMENTS_SENTENCE
      : noLevel === "no-must-have-judgeable"
        ? noMustHaveJudgeableSentence(unjudgedMusts)
        : noLevel === "no-skills"
          ? `${NO_SKILLS_LIST_SENTENCE} ${usual}`
          : usual;

  return {
    fitLabel: fitLabelText(levelName(result.level), noLevel, "skills only", unjudgedMusts, "list"),
    explanation,
    counts: result.counts,
    rows,
    unlistedRequirements: couldNotJudge.length,
    couldNotJudge: { musts: unjudgedMusts, nices: unjudgedNices },
    notJudged: notJudgedLines(job),
    checkYourself: result.checkYourself,
  };
}
