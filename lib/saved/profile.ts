import { MAX_CV_LINES } from "../cv/limits";
import type { BuiltProfile, KeptEntry } from "../cv/profile";
import { readNameId } from "../engine/readName";
import type { ProfileSkill, Skill } from "../engine/types";
import { skills as liveVocabulary } from "../vocab";
import { OLD_PROFILE_NOTE } from "./messages";
import { SCHEMA_VERSION, type SavedProfile } from "./types";

// Pure helpers for the stored profile (docs/PLAN-6.1.md, sections 1 and 2a). No storage here.

// The CV is not stored. The engine's check (match.ts, citesCvLine) compares a skill's cited line with
// profile.cvLines[line - 1], so the lines are rebuilt from the cited evidence alone: an array as long as the highest
// cited line, the cited text at its place, "" elsewhere. After saving, that check is satisfied by construction (it is
// built from the same text); the real guard is at build time, when the AI's quote is checked against the real CV.
// A cited line outside 1..MAX_CV_LINES (the most lines a CV can have here) is ignored, so the array can never be
// huge: that skill then ties to no CV line and is not met.
const usable = (line: number) => Number.isInteger(line) && line >= 1 && line <= MAX_CV_LINES;
// EC-2: the kept unlisted skills (`kept`) cite lines too, so their lines are rebuilt as well, or the engine's check would fail for them.
export function sparseCvLines(skills: ProfileSkill[], kept: { evidence: { line: number; text: string } }[] = []): string[] {
  const cited: { line: number; text: string }[] = [];
  for (const s of skills) if (s.kind === "have" && s.evidence && usable(s.evidence.line)) cited.push(s.evidence);
  for (const k of kept) if (usable(k.evidence.line)) cited.push(k.evidence);
  const longest = cited.reduce((n, e) => Math.max(n, e.line), 0);
  const lines: string[] = Array.from({ length: longest }, () => "");
  for (const e of cited) if (lines[e.line - 1] === "") lines[e.line - 1] = e.text;
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
    // Written whenever the built profile knows the field (an empty list when nothing is kept); absent for a profile built by older code.
    ...(built.unlistedKept !== undefined
      ? { unlistedKept: built.unlistedKept.map((k) => ({ name: k.name, skillId: k.skillId, evidence: { line: k.evidence.line, text: k.evidence.text }, inferred: k.inferred })) }
      : {}),
  };
}

// The note for an opened saved profile: the old-profile sentence when the record has no `unlistedKept` field at all, else null.
export function profileNote(saved: SavedProfile): string | null {
  return saved.unlistedKept === undefined ? OLD_PROFILE_NOTE : null;
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
  // EC-2: each kept unlisted skill is looked up again with the same function the CV reading uses. If the vocabulary lists it now, it becomes a
  // normal skill with its CV line (once); if not, it stays a kept unlisted skill under the id that function gives.
  let kept: KeptEntry[] | undefined;
  if (saved.unlistedKept !== undefined) {
    kept = [];
    for (const k of saved.unlistedKept) {
      const evidence = { line: k.evidence.line, text: k.evidence.text };
      const found = readNameId(k.name, vocabulary);
      if (found !== null && found.listed) {
        if (!skills.some((s) => s.skillId === found.id)) skills.push({ kind: "have", skillId: found.id, evidence });
      } else {
        const skillId = found === null ? k.skillId : found.id;
        if (!kept.some((x) => x.skillId === skillId)) kept.push({ name: k.name, skillId, evidence, inferred: k.inferred === true });
      }
    }
  }
  return {
    profile: {
      id: "confirmed-profile",
      name: "You",
      cvLines: sparseCvLines(skills, kept ?? []),
      skills: structuredClone(skills),
      constraints: structuredClone(saved.constraints),
    },
    set: { ...saved.set },
    problems: [],
    notes: [],
    handAdded: [],
    unmatchable: [],
    ...(kept !== undefined ? { unlistedKept: kept } : {}),
  };
}

export type ProfileSummary = {
  have: { skillId: string; name: string; known: boolean; line: number | null; text: string | null }[];
  inProgress: { skillId: string; name: string; known: boolean; date: string }[];
  constraints: SavedProfile["constraints"];
  set: SavedProfile["set"];
  unlisted?: { name: string; line: number; text: string; inferred: boolean }[]; // only when some are kept
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
  const base = { have, inProgress, constraints: structuredClone(saved.constraints), set: { ...saved.set } };
  const kept = saved.unlistedKept ?? [];
  return kept.length === 0
    ? base
    : { ...base, unlisted: kept.map((k) => ({ name: k.name, line: k.evidence.line, text: k.evidence.text, inferred: k.inferred === true })) };
}
