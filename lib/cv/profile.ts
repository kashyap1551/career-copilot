import type { CvSkill } from "../engine/fromCv";
import { skillIdFor } from "../engine/skillIds";
import type { ConflictKind, LanguageLevel, Profile, ProfileSkill, Skill, WorkMode } from "../engine/types";

// Step 4.3: what the person confirms on the confirm screen becomes the Profile
// the rules engine uses. Pure code: no AI, no network, nothing stored. The
// rules and hand-worked cases are in docs/PLAN-4.3.md.

// The kinds of constraint a person can set, in the order the report names them.
export type Kind = "location" | "language" | "workMode" | "years" | "startDate";
export const KINDS: Kind[] = ["location", "language", "workMode", "years", "startDate"];
export const KIND_WORDS: Record<Kind, string> = {
  location: "location",
  language: "language",
  workMode: "work mode",
  years: "years",
  startDate: "start date",
};

// Which kind of constraint the person sets each kind of engine conflict belongs to (the engine says "city", the page
// says "location"). The ONE table; the report and the gap list both use it (docs/PLAN-7.1.md, Amendment 2 (3)).
export const CONFLICT_KIND: Record<ConflictKind, Kind> = {
  language: "language",
  years: "years",
  city: "location",
  workMode: "workMode",
  startDate: "startDate",
};

// Everything the person can change on the confirm screen, as typed.
export type ConfirmState = {
  keptIds: string[]; // skill ids ticked from the CV proposals
  added: string[]; // names added by hand (no CV line)
  inProgress: { name: string; date: string }[]; // skills being learned, with an expected date
  languages: { code: string; level: LanguageLevel }[];
  cities: string; // comma separated
  workModes: WorkMode[];
  years: string; // "" = not set
  availableFrom: string; // "" = not set, else YYYY-MM-DD
};

export type BuiltProfile = {
  profile: Profile;
  set: Record<Kind, boolean>; // which kinds the person set
  problems: string[]; // input that could not be used
  notes: string[]; // input that was ignored on purpose
  handAdded: { name: string; skillId: string; listed: boolean }[];
  // Unlisted names (not in our skill list). The engine never gets them: they
  // cannot be matched with an ad (docs/SPRINT.md, the step 3.4 note).
  unmatchable: { name: string; where: "cv" | "hand" | "progress" }[];
};

// Named skills are pre-ticked; inferred ones are not ("from your wording, keep
// only if true", decision D7).
export function initialConfirm(proposals: CvSkill[]): ConfirmState {
  return {
    keptIds: proposals.filter((p) => p.label === "named").map((p) => p.skillId),
    added: [],
    inProgress: [],
    languages: [],
    cities: "",
    workModes: [],
    years: "",
    availableFrom: "",
  };
}

// A real calendar date written YYYY-MM-DD ("2027-02-30" is not one).
export function isRealDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((t) => {
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function buildProfile(
  lines: string[],
  proposals: CvSkill[],
  confirm: ConfirmState,
  skills: Skill[],
): BuiltProfile {
  const problems: string[] = [];
  const notes: string[] = [];
  const handAdded: BuiltProfile["handAdded"] = [];
  const unmatchable: BuiltProfile["unmatchable"] = [];
  const profileSkills: ProfileSkill[] = [];
  const fromCv = new Set<string>(); // listed ids that have a CV line

  // 1. Ticked proposals, each citing its line and that line's exact text.
  for (const p of proposals) {
    if (!confirm.keptIds.includes(p.skillId)) continue;
    if (!p.listed) {
      unmatchable.push({ name: p.name, where: "cv" });
      continue;
    }
    if (p.line < 1 || p.line > lines.length || fromCv.has(p.skillId)) continue;
    fromCv.add(p.skillId);
    profileSkills.push({ kind: "have", skillId: p.skillId, evidence: { line: p.line, text: lines[p.line - 1] } });
  }

  // 2. Added by hand: no CV line, so the engine never counts them.
  const handIds = new Set<string>();
  for (const raw of confirm.added) {
    const name = raw.trim();
    if (name === "") continue;
    const id = skillIdFor(name, skills);
    if (id === null) {
      problems.push(`Could not use "${name}" as a skill name.`);
      continue;
    }
    if (fromCv.has(id.id)) {
      notes.push(`${name} is already on your profile from your CV, so adding it by hand is ignored.`);
      continue;
    }
    if (handIds.has(id.id)) continue;
    handIds.add(id.id);
    handAdded.push({ name, skillId: id.id, listed: id.listed });
    if (id.listed) profileSkills.push({ kind: "have", skillId: id.id, evidence: null });
    else unmatchable.push({ name, where: "hand" });
  }

  // 3. In progress: needs a real expected date.
  const progressIds = new Set<string>();
  for (const entry of confirm.inProgress) {
    const name = entry.name.trim();
    if (name === "") continue;
    const id = skillIdFor(name, skills);
    if (id === null) {
      problems.push(`Could not use "${name}" as a skill name.`);
      continue;
    }
    if (fromCv.has(id.id)) {
      notes.push(`${name} is already on your profile from your CV, so "in progress" is ignored.`);
      continue;
    }
    if (!isRealDate(entry.date.trim())) {
      problems.push(`Add a valid expected date for ${name}.`);
      continue;
    }
    if (progressIds.has(id.id)) continue;
    progressIds.add(id.id);
    if (id.listed) profileSkills.push({ kind: "inProgress", skillId: id.id, expectedDate: entry.date.trim() });
    else unmatchable.push({ name, where: "progress" });
  }

  // 4. Constraints. A kind is "set" when it holds at least one valid value.
  const locations = uniqueBy(
    confirm.cities.split(",").map((c) => c.trim()).filter((c) => c !== ""),
    (c) => c.toLowerCase(),
  );
  const languages = uniqueBy(
    confirm.languages.filter((l) => l.code.trim() !== ""),
    (l) => l.code.toLowerCase(),
  ).map((l) => ({ code: l.code.toLowerCase(), level: l.level }));
  const workModes = uniqueBy(confirm.workModes, (m) => m);

  let years: number | null = null;
  const yearsText = confirm.years.trim();
  if (yearsText !== "") {
    const n = /^\d{1,2}$/.test(yearsText) ? Number(yearsText) : NaN;
    if (n >= 0 && n <= 50) years = n;
    else problems.push("Years of experience must be a whole number from 0 to 50.");
  }

  let availableFrom: string | null = null;
  const fromText = confirm.availableFrom.trim();
  if (fromText !== "") {
    if (isRealDate(fromText)) availableFrom = fromText;
    else problems.push("Available from must be a date like 2027-03-01.");
  }

  return {
    profile: {
      id: "confirmed-profile",
      name: "You",
      cvLines: lines,
      skills: profileSkills,
      constraints: { languages, locations, workModes, years, availableFrom },
    },
    set: {
      location: locations.length > 0,
      language: languages.length > 0,
      workMode: workModes.length > 0,
      years: years !== null,
      startDate: availableFrom !== null,
    },
    problems,
    notes,
    handAdded,
    unmatchable,
  };
}
