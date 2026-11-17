import { conflictLine, levelName } from "@/lib/engine/explain";
import { noLevelReason } from "@/lib/engine/judgeable";
import { languageName, match, MODE_NAMES } from "@/lib/engine/match";
import type { FitLevel, Job, Requirement, RequirementResult, Skill } from "@/lib/engine/types";
import { engineView } from "@/lib/cv/engineView";
import { CONFLICT_KIND, KINDS, KIND_WORDS, type BuiltProfile, type Kind } from "@/lib/cv/profile";
import {
  countsSentence,
  fitLabelText,
  NO_REQUIREMENTS_SENTENCE,
  NO_SKILLS_PROFILE_SENTENCE,
  noMustHaveJudgeableSentence,
  NOT_JUDGED_SENTENCE,
  type RequirementRow,
} from "./skillsOnly";

// Step 4.3 (changed by docs/PLAN-FIT-LEVEL.md): the fit report for a confirmed profile. Pure functions (no AI, no
// network). It judges only the kinds of constraint the person set AND the ad
// states; every other kind is listed as "not judged", with the reason, and the
// label says which kinds were judged. The engine is not changed: the kinds the
// person did not set are passed to it as "not stated". See docs/PLAN-4.3.md.

export type ProfileReport = {
  fitLabel: string; // "Good (skills only)" or "Stretch (judged: skills, years)"
  level: FitLevel | null; // the level the label names; null when no level is shown (the list of saved ads sorts on it)
  namedReason: string | null; // the lead sentence of the explanation for a Long shot set by a conflict that can't be closed, else null
  explanation: string;
  counts: { mustsMet: number; mustsTotal: number; nicesMet: number; nicesTotal: number };
  rows: RequirementRow[];
  unlistedRequirements: number; // requirements not in our skill list yet: shown as "could not judge", never counted
  couldNotJudge: { musts: number; nices: number }; // the same, apart
  judged: Kind[];
  notJudged: string[];
  conflicts: string[];
  conflictKinds: Kind[]; // the kind of each conflict above, in the same order
  satisfied: string[]; // one short line for each judged kind that has no conflict ("Location: fine. ...")
  checkYourself: string[];
};

const CAP: Record<Kind, string> = {
  location: "Location",
  language: "Language",
  workMode: "Work mode",
  years: "Years",
  startDate: "Start date",
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

  // The engine only sees the kinds the person set and the requirements in our skill list: lib/cv/engineView.ts (the
  // same construction the roadmap uses; docs/PLAN-7.1.md section 5).
  const { engineJob, engineProfile, couldNotJudge } = engineView(job, built);
  const result = match(engineProfile, engineJob);

  const judged = KINDS.filter((k) => set[k] && statedByAd(k, job));
  const notJudgedKinds = KINDS.filter((k) => !judged.includes(k));

  const nameOf = (id: string) =>
    skills.find((s) => s.id === id)?.name ?? unlisted.find((s) => s.id === id)?.name ?? id;
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
        detail: `${nameOf(r.metBy.skillId)}: CV line ${r.metBy.evidence.line}: "${r.metBy.evidence.text}"`,
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

  // No filter is needed: the engine only saw the kinds that are judged (the others
  // were passed as "not stated"), so every conflict is of a judged kind. The grid
  // test R14 in tests/profileReport.test.ts checks that fact over 2,048 inputs.
  const conflicts = result.conflicts.map(conflictLine);
  const conflictKinds = result.conflicts.map((c) => CONFLICT_KIND[c.kind]);

  const notJudged: string[] = [];
  for (const k of notJudgedKinds) {
    const says = adSays(k, job);
    if (!set[k]) {
      notJudged.push(
        says !== null
          ? `${CAP[k]}: the ad says ${says}; not judged because you did not set yours.`
          : `${CAP[k]}: not judged (you did not set yours, and the ad does not say).`,
      );
    } else if (k === "location" && says !== null) {
      // The ad does name a city, so never say it "does not say" (docs/PLAN-4.3.md, R13). The engine
      // does not compare a city when the work mode is unknown, and a remote job needs none.
      notJudged.push(
        job.constraints.remote === "remote"
          ? `Location: the ad says ${says}, but the job is remote, so no city is needed; not judged.`
          : `Location: the ad says ${says} but not whether the job is on-site, hybrid or remote; not judged.`,
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

  const unjudgedMusts = couldNotJudge.filter((r) => r.importance === "must").length;
  const unjudgedNices = couldNotJudge.length - unjudgedMusts;
  const noLevel = noLevelReason({
    requirements: job.requirements.length,
    judgedMusts: result.counts.mustsTotal,
    unjudgedMusts,
    skillCount: profile.skills.length,
  });

  const missing = result.musts.filter((m) => !m.met).map((m) => labelOf(m.requirement.skillIds));
  const counts = countsSentence(result.counts.mustsTotal, missing, "on your profile", unjudgedMusts);
  let usual: string;
  if (judged.length === 0) {
    usual = `${counts} ${NOT_JUDGED_SENTENCE}`;
  } else {
    const found =
      conflicts.length === 0
        ? "No conflict was found in what you set."
        : conflicts.length === 1
          ? "1 conflict was found in what you set (listed below)."
          : `${conflicts.length} conflicts were found in what you set (listed below).`;
    const rest = notJudgedKinds.length > 0 ? ` Not judged here: ${notJudgedKinds.map((k) => KIND_WORDS[k]).join(", ")}.` : "";
    usual = `${counts} ${found}${rest}`;
  }

  // (b) A Long shot decided by a conflict that can't be closed soon says which one (the first, the one fitLevel names).
  let explanation = usual;
  let namedReason: string | null = null;
  if (noLevel === "no-requirements") {
    explanation = NO_REQUIREMENTS_SENTENCE;
  } else if (noLevel === "no-must-have-judgeable") {
    explanation = noMustHaveJudgeableSentence(unjudgedMusts);
  } else if (noLevel === "no-skills") {
    explanation = `${NO_SKILLS_PROFILE_SENTENCE} ${usual}`;
  } else if (result.decidedBy.startsWith("unclosable-conflict:")) {
    const decider = result.conflicts.find((c) => !c.closable);
    if (decider) {
      namedReason = `Long shot because of ${KIND_WORDS[CONFLICT_KIND[decider.kind]]}: ${decider.message} That can't be closed soon.`;
      explanation = `${namedReason} ${usual}`;
    }
  }

  // (c) One short line for each kind that was judged and is fine, in the fixed order. A kind with a conflict gets none; a
  // kind the engine could not compare gets none (a language is judged one by one: only those with a level and no conflict).
  const cannotCompare = new Set(result.notJudged.map((n) => CONFLICT_KIND[n.kind]));
  const satisfied: string[] = [];
  for (const k of judged) {
    if (conflictKinds.includes(k)) continue;
    const c = job.constraints;
    if (k === "language") {
      const parts = c.languages.flatMap((l) => {
        if (l.level === null) return [];
        const has = profile.constraints.languages.find((x) => x.code.toLowerCase() === l.code.toLowerCase());
        return has ? [`The ad asks for ${languageName(l.code)} at ${l.level}; your profile has ${has.level}.`] : [];
      });
      if (parts.length > 0) satisfied.push(`Language: fine. ${parts.join(" ")}`);
      continue;
    }
    if (cannotCompare.has(k)) continue;
    if (k === "location" && c.location !== null) satisfied.push(`Location: fine. The job is in ${c.location}, and ${c.location} is on your profile.`);
    else if (k === "workMode" && c.remote !== null)
      satisfied.push(`Work mode: fine. The job is ${MODE_NAMES[c.remote]}, and your profile accepts ${MODE_NAMES[c.remote]}.`);
    else if (k === "years" && c.minYears !== null && profile.constraints.years !== null)
      satisfied.push(`Years: fine. The ad asks for ${c.minYears} ${c.minYears === 1 ? "year" : "years"}; your profile has ${profile.constraints.years}.`);
    else if (k === "startDate" && c.startDate !== null && profile.constraints.availableFrom !== null)
      satisfied.push(`Start date: fine. The ad wants a start by ${c.startDate}; you are available from ${profile.constraints.availableFrom}.`);
  }

  const inner = judged.length === 0 ? "skills only" : `judged: skills, ${judged.map((k) => KIND_WORDS[k]).join(", ")}`;
  return {
    fitLabel: fitLabelText(levelName(result.level), noLevel, inner, unjudgedMusts, "profile"),
    level: noLevel === null ? result.level : null,
    namedReason,
    explanation,
    counts: result.counts,
    rows,
    unlistedRequirements: couldNotJudge.length,
    couldNotJudge: { musts: unjudgedMusts, nices: unjudgedNices },
    judged,
    notJudged,
    conflicts,
    conflictKinds,
    satisfied,
    checkYourself: result.checkYourself,
  };
}
