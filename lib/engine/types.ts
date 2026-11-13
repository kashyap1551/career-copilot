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

export type Requirement = {
  skillId: SkillId;
  importance: "must" | "nice";
  quote: string; // the ad's own words, copied exactly
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
