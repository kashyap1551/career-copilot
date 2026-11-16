import type { BuiltProfile } from "../cv/profile";
import type { ProfileSkill, Skill } from "../engine/types";
import { skills as liveVocabulary } from "../vocab";
import { SCHEMA_VERSION, type SavedProfile } from "./types";

// Pure helpers for the stored profile (docs/PLAN-6.1.md, sections 1 and 2a). No storage here.

// The CV is not stored. The engine's check (match.ts, citesCvLine) compares a skill's cited line with
// profile.cvLines[line - 1], so the lines are rebuilt from the cited evidence alone: an array as long as the highest
// cited line, the cited text at its place, "" elsewhere. After saving, that check is satisfied by construction (it is
// built from the same text); the real guard is at build time, when the AI's quote is checked against the real CV.
export function sparseCvLines(skills: ProfileSkill[]): string[] {
  let longest = 0;
  for (const s of skills) if (s.kind === "have" && s.evidence) longest = Math.max(longest, s.evidence.line);
  const lines: string[] = Array.from({ length: longest }, () => "");
  for (const s of skills) {
    if (s.kind === "have" && s.evidence && lines[s.evidence.line - 1] === "") lines[s.evidence.line - 1] = s.evidence.text;
  }
  return lines;
}

// What is kept: the profile's skills (with their cited lines), constraints and the kinds set, plus the stamps.
export function savedFromBuilt(
  built: BuiltProfile,
  stamps: { vocabularyHash: string; readingVersion: string },
  now: Date,
): SavedProfile {
  return {
    schemaVersion: SCHEMA_VERSION,
    savedAt: now.toISOString(),
    skills: structuredClone(built.profile.skills),
    constraints: structuredClone(built.profile.constraints),
    set: { ...built.set },
    stamps: { vocabularyHash: stamps.vocabularyHash, readingVersion: stamps.readingVersion },
  };
}

// A skill id that is no longer in the vocabulary is shown, never counted as met: it is left out of what the engine gets.
export function unknownSkillIds(saved: SavedProfile, vocabulary: Skill[] = liveVocabulary): string[] {
  const known = new Set(vocabulary.map((s) => s.id));
  return saved.skills.map((s) => s.skillId).filter((id) => !known.has(id));
}

// The profile the page and the engine use: problems, notes, handAdded and unmatchable are empty (they belong to the
// confirm screen, which a loaded profile does not have).
export function builtFromSaved(saved: SavedProfile, vocabulary: Skill[] = liveVocabulary): BuiltProfile {
  const known = new Set(vocabulary.map((s) => s.id));
  const skills = saved.skills.filter((s) => known.has(s.skillId));
  return {
    profile: {
      id: "confirmed-profile",
      name: "You",
      cvLines: sparseCvLines(skills),
      skills: structuredClone(skills),
      constraints: structuredClone(saved.constraints),
    },
    set: { ...saved.set },
    problems: [],
    notes: [],
    handAdded: [],
    unmatchable: [],
  };
}

export type ProfileSummary = {
  have: { skillId: string; name: string; known: boolean; line: number | null; text: string | null }[];
  inProgress: { skillId: string; name: string; known: boolean; date: string }[];
  constraints: SavedProfile["constraints"];
  set: SavedProfile["set"];
};

// The read-only summary the page shows for a loaded profile (part 3): exactly what is stored.
export function summarizeProfile(saved: SavedProfile, vocabulary: Skill[] = liveVocabulary): ProfileSummary {
  const byId = new Map(vocabulary.map((s) => [s.id, s.name]));
  const nameOf = (id: string) => byId.get(id) ?? id;
  const have: ProfileSummary["have"] = [];
  const inProgress: ProfileSummary["inProgress"] = [];
  for (const s of saved.skills) {
    if (s.kind === "have") {
      have.push({ skillId: s.skillId, name: nameOf(s.skillId), known: byId.has(s.skillId), line: s.evidence?.line ?? null, text: s.evidence?.text ?? null });
    } else {
      inProgress.push({ skillId: s.skillId, name: nameOf(s.skillId), known: byId.has(s.skillId), date: s.expectedDate });
    }
  }
  return { have, inProgress, constraints: structuredClone(saved.constraints), set: { ...saved.set } };
}
