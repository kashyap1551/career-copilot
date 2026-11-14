import { fitLevel } from "./fit";
import {
  LANGUAGE_CLOSABLE_LEVELS,
  START_DATE_CLOSABLE_DAYS,
  YEARS_CLOSABLE_SHORTFALL,
} from "./rules";
import {
  LANGUAGE_LEVELS,
  type Conflict,
  type Evidence,
  type Job,
  type MatchResult,
  type NotJudged,
  type Profile,
  type Requirement,
  type RequirementResult,
  type WorkMode,
} from "./types";

// Plain code: no AI, no network, no clock. Everything here is a rule written
// down in docs/DECISIONS.md and docs/SPRINT.md.

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  fr: "French",
  hi: "Hindi",
  kn: "Kannada",
  pt: "Portuguese",
};
const languageName = (code: string) =>
  LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();

const MODE_NAMES: Record<WorkMode, string> = {
  onsite: "on-site",
  hybrid: "hybrid",
  remote: "remote",
};

const same = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// "2026-12-01" -> whole days since 1970, or null if it isn't a real date.
function dayNumber(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(ms) ? null : Math.round(ms / 86_400_000);
}

// ---- Requirements ----------------------------------------------------------

// "No evidence, never met": a skill only counts if its cited CV line exists
// and says exactly what the citation says.
function citesCvLine(profile: Profile, evidence: Evidence): boolean {
  return profile.cvLines[evidence.line - 1] === evidence.text;
}

function checkRequirement(
  profile: Profile,
  requirement: Requirement,
): RequirementResult {
  for (const id of requirement.skillIds) {
    for (const skill of profile.skills) {
      if (
        skill.kind === "have" &&
        skill.skillId === id &&
        skill.evidence !== null &&
        citesCvLine(profile, skill.evidence)
      ) {
        return {
          requirement,
          met: true,
          metBy: { skillId: id, evidence: skill.evidence },
          reason: null,
          expectedDate: null,
        };
      }
    }
  }

  // Not met. Say why: learning it, on the profile without a valid CV line,
  // or not there at all. Learning it comes first because it has a date.
  const wanted = (id: string) => requirement.skillIds.includes(id);
  const learning = profile.skills
    .flatMap((s) => (s.kind === "inProgress" && wanted(s.skillId) ? [s] : []))
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  if (learning.length > 0) {
    return {
      requirement,
      met: false,
      metBy: null,
      reason: "in-progress",
      expectedDate: learning[0].expectedDate,
    };
  }
  const withoutLine = profile.skills.some(
    (s) => s.kind === "have" && wanted(s.skillId),
  );
  return {
    requirement,
    met: false,
    metBy: null,
    reason: withoutLine ? "no-cv-line" : "not-on-profile",
    expectedDate: null,
  };
}

// ---- Constraints -----------------------------------------------------------

type Checks = { conflicts: Conflict[]; notJudged: NotJudged[] };

function checkLanguages(profile: Profile, job: Job, out: Checks) {
  for (const asked of job.constraints.languages) {
    const name = languageName(asked.code);
    const has = profile.constraints.languages.find((l) =>
      same(l.code, asked.code),
    );

    if (!has) {
      out.conflicts.push({
        kind: "language",
        closable: false,
        code: asked.code,
        required: asked.level,
        has: null,
        levelsShort: null,
        message: `The ad asks for ${name}${asked.level ? ` at ${asked.level}` : ""}; your profile does not list ${name}.`,
      });
      continue;
    }
    if (asked.level === null) {
      out.notJudged.push({
        kind: "language",
        reason: `The ad names ${name} but no level, so your level was not compared.`,
      });
      continue;
    }
    const short =
      LANGUAGE_LEVELS.indexOf(asked.level) - LANGUAGE_LEVELS.indexOf(has.level);
    if (short > 0) {
      out.conflicts.push({
        kind: "language",
        closable: short <= LANGUAGE_CLOSABLE_LEVELS,
        code: asked.code,
        required: asked.level,
        has: has.level,
        levelsShort: short,
        message: `The ad asks for ${name} at ${asked.level}; your profile has ${has.level} (${short === 1 ? "one level" : `${short} levels`} short).`,
      });
    }
  }
}

function checkYears(profile: Profile, job: Job, out: Checks) {
  const required = job.constraints.minYears;
  const has = profile.constraints.years;
  if (required === null) {
    out.notJudged.push({
      kind: "years",
      reason: "The ad does not say how many years of experience it wants.",
    });
    return;
  }
  if (has === null) {
    out.notJudged.push({
      kind: "years",
      reason: "Your profile does not give your years of experience.",
    });
    return;
  }
  const short = required - has;
  if (short > 0) {
    out.conflicts.push({
      kind: "years",
      closable: short <= YEARS_CLOSABLE_SHORTFALL,
      required,
      has,
      yearsShort: short,
      message: `The ad asks for ${plural(required, "year", "years")} of experience; your profile has ${has} (${plural(short, "year", "years")} short). Years are compared with your total years of experience, not years per skill.`,
    });
  }
}

// City first, then work mode, so conflicts come out in a fixed order.
// A remote job needs no city, so a missing city on a remote job is not
// "not judged"; it simply doesn't matter.
function checkPlace(profile: Profile, job: Job, out: Checks) {
  const mode = job.constraints.remote;
  if (mode === null) {
    out.notJudged.push({
      kind: "workMode",
      reason: "The ad does not say if the job is on-site, hybrid or remote.",
    });
    return;
  }

  // Hybrid counts as on-site: three days in the office still means being there.
  if (mode !== "remote") {
    const city = job.constraints.location;
    if (city === null) {
      out.notJudged.push({
        kind: "city",
        reason: "The ad does not say where the job is.",
      });
    } else if (!profile.constraints.locations.some((c) => same(c, city))) {
      const list = profile.constraints.locations.join(", ") || "none";
      out.conflicts.push({
        kind: "city",
        closable: false,
        required: city,
        cities: profile.constraints.locations,
        message: `The job is in ${city}; the cities on your profile are: ${list}.`,
      });
    }
  }

  if (!profile.constraints.workModes.includes(mode)) {
    const list =
      profile.constraints.workModes.map((m) => MODE_NAMES[m]).join(", ") ||
      "none";
    out.conflicts.push({
      kind: "workMode",
      closable: false,
      required: mode,
      accepted: profile.constraints.workModes,
      message: `The job is ${MODE_NAMES[mode]}; your profile accepts: ${list}.`,
    });
  }
}

function checkStartDate(profile: Profile, job: Job, out: Checks) {
  const required = job.constraints.startDate;
  const available = profile.constraints.availableFrom;
  if (required === null) {
    out.notJudged.push({
      kind: "startDate",
      reason: "The ad does not give a start date.",
    });
    return;
  }
  if (available === null) {
    out.notJudged.push({
      kind: "startDate",
      reason: "Your profile does not say when you are available.",
    });
    return;
  }
  const wanted = dayNumber(required);
  const from = dayNumber(available);
  if (wanted === null || from === null) {
    out.notJudged.push({
      kind: "startDate",
      reason: "A start date could not be read, so it was not compared.",
    });
    return;
  }
  const late = from - wanted;
  if (late > 0) {
    out.conflicts.push({
      kind: "startDate",
      closable: late <= START_DATE_CLOSABLE_DAYS,
      required,
      available,
      daysLate: late,
      message: `The ad wants a start by ${required}; you are available from ${available} (${plural(late, "day", "days")} later).`,
    });
  }
}

// ---- The whole match -------------------------------------------------------

export function match(profile: Profile, job: Job): MatchResult {
  const results = job.requirements.map((r) => checkRequirement(profile, r));
  const musts = results.filter((r) => r.requirement.importance === "must");
  const nices = results.filter((r) => r.requirement.importance === "nice");

  const out: Checks = { conflicts: [], notJudged: [] };
  checkLanguages(profile, job, out);
  checkYears(profile, job, out);
  checkPlace(profile, job, out);
  checkStartDate(profile, job, out);

  const mustsMet = musts.filter((r) => r.met).length;
  const { level, decidedBy } = fitLevel({
    missingMusts: musts.length - mustsMet,
    conflicts: out.conflicts,
  });

  return {
    profileId: profile.id,
    jobId: job.id,
    level,
    decidedBy,
    musts,
    nices,
    counts: {
      mustsMet,
      mustsTotal: musts.length,
      nicesMet: nices.filter((r) => r.met).length,
      nicesTotal: nices.length,
    },
    conflicts: out.conflicts,
    notJudged: out.notJudged,
    checkYourself: job.constraints.otherConditions.map((c) => c.quote),
  };
}
