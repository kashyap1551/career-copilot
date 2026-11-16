import { vocabularyHash } from "./evalFingerprint";
import { LEFT_UNLISTED, NEVER_MAP, NOT_A_SKILL, VOCAB } from "../vocab";

// THE vocabulary hash: the skills, the not-a-skill phrases, the names left unlisted on purpose AND the never-map list.
// Every script that prints or uses a vocabulary hash (eval, eval-cv, vocab-check, vocab-pairs, map-measure, neighbours)
// calls this one function, so none can forget a part of the vocabulary. Node only (it hashes with node:crypto), so the
// browser never imports it.
export function vocabHash(): string {
  return vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED, NEVER_MAP });
}
