// The data shapes the rules engine works on. Pure types: no AI, no network.
//
// A skill is only ever an id ("sql"); names are for display. Dates are plain
// text like "2026-12-20", so they survive browser storage and tests never
// depend on the clock. Constraints (languages, place, work mode, years, start
// date) are kept apart from skills, on both the job side and the person side.

export type SkillId = string;

export type Skill = {
  id: SkillId;
  name: string;
  // From the vocabulary (lib/vocab): other ways the skill is written. A skill
  // without them is matched by its id and name only, as before Day 5.
  de?: string; // the German name
  aliases?: string[];
  // A single letter or a very common word ("R", "C", "Go"): it matches only
  // when the whole name equals it, never after level or version words are dropped.
  exactOnly?: boolean;
};

// Language levels on the CEFR scale, lowest to highest.
export const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export type WorkMode = "onsite" | "hybrid" | "remote";

// ---- Jobs ------------------------------------------------------------------

export type JobLanguage = {
  code: string; // "de", "en"
  // null = the ad names the language but not a level ("not stated").
  // How ad wording maps to a level is written down in docs/DECISIONS.md
  // (the 2026-11-14 line on language wording).
  level: LanguageLevel | null;
};

export type JobConstraints = {
  languages: JobLanguage[];
  location: string | null; // null = not stated
  remote: WorkMode | null; // null = not stated
  minYears: number | null; // years of experience the ad asks for
  startDate: string | null; // "2026-12-01"
  // Eligibility conditions code can't judge (education level, graduation year,
  // work permit...). Quote copied exactly from the ad. The report lists them
  // as "check this yourself" and they are never scored.
  otherConditions: { quote: string }[];
};

// A name the reader wrote that was matched to a skill by CLOSE SPELLING (stage 2): the original wording, the skill it
// was read as, and the vocabulary term it matched. Shown on the page; the engine ignores it.
export type CloseMatch = { name: string; skillId: SkillId; via: string };

export type Requirement = {
  // Any one of these counts as met ("Power BI or Tableau"). A normal
  // requirement has exactly one id. Never empty.
  skillIds: SkillId[];
  importance: "must" | "nice";
  quote: string; // the ad's own words, copied exactly
  // Only when a name was matched by close spelling (absent otherwise; an exact match carries nothing extra).
  closeMatches?: CloseMatch[];
};

export type Job = {
  id: string;
  title: string;
  company: string | null;
  source: string | null; // where the public ad came from
  constraints: JobConstraints;
  requirements: Requirement[];
};

// ---- People ----------------------------------------------------------------

export type ProfileLanguage = {
  code: string;
  level: LanguageLevel;
};

export type ProfileConstraints = {
  languages: ProfileLanguage[];
  locations: string[]; // cities the person can work in
  workModes: WorkMode[];
  years: number | null; // years of experience
  availableFrom: string | null; // "2026-12-01"
};

// A CV line the person's skill is tied to.
export type Evidence = {
  line: number; // 1-based position in Profile.cvLines
  text: string; // that line, word for word
};

// Two kinds, so "in progress" can't be mistaken for "have".
export type ProfileSkill =
  // evidence null = the person added it by hand with no CV line.
  // The engine never counts a skill without evidence as met.
  | { kind: "have"; skillId: SkillId; evidence: Evidence | null }
  | { kind: "inProgress"; skillId: SkillId; expectedDate: string };

export type Profile = {
  id: string;
  name: string;
  cvLines: string[];
  skills: ProfileSkill[];
  constraints: ProfileConstraints;
};

// ---- Results ---------------------------------------------------------------

export type FitLevel = "strong" | "good" | "stretch" | "longShot";

export type ConflictKind =
  | "language"
  | "years"
  | "city"
  | "workMode"
  | "startDate";

// Which rule set the level. Conflicts that can't be closed soon are checked
// first, so a job that is a Long shot for that reason says so even when many
// must-haves are also missing.
export type DecidedBy =
  | "all-musts-met"
  | "one-must-missing"
  | "one-closable-conflict"
  | "two-gaps"
  | "three-or-more-gaps"
  | `unclosable-conflict:${ConflictKind}`;

export type Conflict = {
  closable: boolean;
  // A plain sentence, written by code, safe to show the person.
  message: string;
} & (
  | {
      kind: "language";
      code: string;
      required: LanguageLevel | null; // null = the ad names no level
      has: LanguageLevel | null; // null = the person doesn't list the language
      levelsShort: number | null; // null when the language is missing
    }
  | { kind: "years"; required: number; has: number; yearsShort: number }
  | { kind: "city"; required: string; cities: string[] }
  | { kind: "workMode"; required: WorkMode; accepted: WorkMode[] }
  | {
      kind: "startDate";
      required: string;
      available: string;
      daysLate: number;
    }
);

// Something the ad or the profile doesn't say, so it was not judged.
export type NotJudged = { kind: ConflictKind; reason: string };

export type RequirementResult = {
  requirement: Requirement;
  met: boolean;
  // The skill that met it, with the CV line that proves it.
  metBy: { skillId: SkillId; evidence: Evidence } | null;
  // Why it is not met. null when met.
  //  "no-cv-line"     the skill is on the profile but ties to no valid CV line
  //  "in-progress"    the person is learning it (see expectedDate)
  //  "not-on-profile" nothing on the profile matches
  reason: "no-cv-line" | "in-progress" | "not-on-profile" | null;
  expectedDate: string | null;
};

export type MatchResult = {
  profileId: string;
  jobId: string;
  level: FitLevel;
  decidedBy: DecidedBy;
  musts: RequirementResult[];
  nices: RequirementResult[];
  // Counts only, never percentages.
  counts: {
    mustsMet: number;
    mustsTotal: number;
    nicesMet: number;
    nicesTotal: number;
  };
  // In this order: language, years, city, workMode, startDate.
  conflicts: Conflict[];
  notJudged: NotJudged[];
  // The ad's otherConditions, exact quotes, never scored.
  checkYourself: string[];
};
