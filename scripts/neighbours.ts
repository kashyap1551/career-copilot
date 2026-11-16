import fs from "node:fs";
import path from "node:path";
import { vocabularyHash } from "../lib/engine/evalFingerprint";
import { compactLines, loadWords, neighbourPairs } from "../lib/engine/neighbours";
import { isNotASkill, LEFT_UNLISTED, NOT_A_SKILL, skills, VOCAB } from "../lib/vocab";

// npm run neighbours: the ordinary English words (from /usr/share/dict/words) that close spelling would map to a
// skill (docs/PLAN-5.1.md). No AI call; the vocabulary is not edited and no never-map list is added: the owner decides
// that from this output. Prints the total and ALL (skill, word) pairs, one line per skill, and writes the same lines to
// eval-runs/neighbours.txt (gitignored).

const DICT = "/usr/share/dict/words";
if (!fs.existsSync(DICT)) {
  console.log(`NEIGHBOUR AUDIT: ${DICT} does not exist on this machine, so the audit is skipped.`);
  process.exit(0);
}

const words = loadWords(fs.readFileSync(DICT, "utf8"));
const pairs = neighbourPairs(skills, words, isNotASkill);
const hash = vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED }).slice(0, 10);
const longWords = words.filter((w) => w.length >= 6).length;
const affected = new Set(pairs.map((p) => p.id)).size;

console.log(
  `NEIGHBOUR AUDIT (no AI call) | vocab ${hash} | dictionary ${DICT}: ${words.length.toLocaleString("en-US")} lowercase words, ${longWords.toLocaleString("en-US")} of 6+ letters | pairs: ${pairs.length} (skills with a neighbour: ${affected})`,
);
// One line per skill: "skill: word(d), word(d)". The total, then ALL pairs; the same lines go to eval-runs/neighbours.txt.
const lines = compactLines(pairs);
console.log(`All ${pairs.length} (skill, word) pairs, ${lines.length} skills:`);
for (const l of lines) console.log("  " + l);

const dir = path.join(process.cwd(), "eval-runs");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "neighbours.txt"), lines.join("\n") + "\n");
console.log("(the same lines: eval-runs/neighbours.txt, gitignored)");
