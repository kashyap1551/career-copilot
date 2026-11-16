import { stableStringify } from "../engine/stableStringify";
import { LEFT_UNLISTED, NEVER_MAP, NOT_A_SKILL, VOCAB, type LeftUnlisted, type NeverMap, type NotASkillEntry, type VocabEntry } from "./index";

// THE canonical text of the vocabulary: the skills, the not-a-skill phrases, the names left unlisted on purpose AND the
// never-map list, as JSON with sorted keys. ONE pure function; the Node vocabulary hash (lib/engine/vocabHash.ts) and the
// browser one (./webHash.ts) both hash exactly this text (UTF-8 in both), so they cannot drift apart. No node: import.
export type VocabParts = { VOCAB: VocabEntry[]; NOT_A_SKILL: NotASkillEntry[]; LEFT_UNLISTED: LeftUnlisted[]; NEVER_MAP: NeverMap[] };

// `parts` replaces some or all of the live vocabulary (tests hash altered copies this way).
export function vocabularyCanonicalText(parts: Partial<VocabParts> = {}): string {
  return stableStringify({
    VOCAB: parts.VOCAB ?? VOCAB,
    NOT_A_SKILL: parts.NOT_A_SKILL ?? NOT_A_SKILL,
    LEFT_UNLISTED: parts.LEFT_UNLISTED ?? LEFT_UNLISTED,
    NEVER_MAP: parts.NEVER_MAP ?? NEVER_MAP,
  });
}
