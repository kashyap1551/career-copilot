import { nameKeys } from "../engine/skillIds";
import type { Skill } from "../engine/types";
import { LEFT_UNLISTED_V0, NEVER_MAP_V0, NOT_A_SKILL_V0, VOCAB_V0, type LeftUnlisted, type NeverMap, type NotASkillEntry, type VocabEntry } from "./data";

// The vocabulary the app uses (data in ./data.ts, docs/PLAN-5.1.md). Typed data
// and two small views of it. No AI, no network.

export type { LeftUnlisted, NeverMap, NotASkillEntry, VocabEntry };
export const VOCAB: VocabEntry[] = VOCAB_V0;
export const NOT_A_SKILL: NotASkillEntry[] = NOT_A_SKILL_V0;

// The list `skillIdFor` and the readers use. The 17 original skills come first,
// with their ids and names unchanged.
export const skills: Skill[] = VOCAB.map((e) => ({
  id: e.id,
  name: e.name,
  de: e.de,
  aliases: e.aliases,
  ...(e.exactOnly ? { exactOnly: true } : {}),
}));

const notASkillKeys = new Set(NOT_A_SKILL.flatMap((n) => [nameKeys(n.phrase).exact, nameKeys(n.de).exact]));

// Is this name a phrase that is not a skill a CV can show (a personal trait, a
// working environment, a vague phrase, a role or domain description)? Tried the
// same way as a skill: exactly as written, then without level and filler words.
export function isNotASkill(name: string): boolean {
  const { exact, stripped, plain } = nameKeys(name);
  return [exact, stripped, plain].some((k) => k !== "" && notASkillKeys.has(k));
}

export const LEFT_UNLISTED: LeftUnlisted[] = LEFT_UNLISTED_V0;
export const NEVER_MAP: NeverMap[] = NEVER_MAP_V0;

const undecidedKeys = new Set(VOCAB.flatMap((e) => e.undecided.map((u) => nameKeys(u).exact)));
const leftUnlistedKeys = new Set(LEFT_UNLISTED.map((l) => nameKeys(l.name).exact));

export type NameStatus = "mapped" | "not-a-skill" | "undecided" | "left-unlisted" | "unmapped";

// Where a name stands, for the coverage check: in the vocabulary, on the not-a-skill list, an alias the owner has not
// decided yet, a name left unlisted on purpose, or none of these.
export function nameStatus(name: string, idOf: (n: string) => { listed: boolean } | null): NameStatus {
  if (idOf(name)?.listed) return "mapped";
  if (isNotASkill(name)) return "not-a-skill";
  const { exact, stripped } = nameKeys(name);
  if (undecidedKeys.has(exact) || undecidedKeys.has(stripped)) return "undecided";
  if (leftUnlistedKeys.has(exact) || leftUnlistedKeys.has(stripped)) return "left-unlisted";
  return "unmapped";
}
