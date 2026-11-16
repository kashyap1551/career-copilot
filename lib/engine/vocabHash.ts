import { createHash } from "node:crypto";
import { vocabularyCanonicalText, type VocabParts } from "../vocab/canonical";

// THE vocabulary hash: the skills, the not-a-skill phrases, the names left unlisted on purpose AND the never-map list.
// Every script that prints or uses a vocabulary hash (eval, eval-cv, vocab-check, vocab-pairs, map-measure, neighbours)
// calls this one function, so none can forget a part of the vocabulary. Node only (it hashes with node:crypto); the
// browser uses lib/vocab/webHash.ts, which hashes the SAME canonical text (lib/vocab/canonical.ts). `parts` replaces some
// or all of the live vocabulary (tests hash altered copies this way); with no argument it hashes the live vocabulary.
export function vocabHash(parts: Partial<VocabParts> = {}): string {
  return createHash("sha256").update(vocabularyCanonicalText(parts)).digest("hex");
}
