import { vocabPairs } from "../lib/engine/vocabPairs";
import { vocabHash } from "../lib/engine/vocabHash";
import { skills } from "../lib/vocab";

// npm run vocab-pairs: pairs of DIFFERENT skills that have two strings within the close-spelling allowance of each
// other (docs/PLAN-5.1.md, "5.2 stage 2 rules"). Vocabulary only (no ad names), no AI call, nothing edited.
//   check          a typo of one string can land on the other skill
//   tie-protected  no typo lands on the other skill, but a typo is equally close to both, so it goes to the review list

const pairs = vocabPairs(skills);
const check = pairs.filter((p) => p.label === "check").length;
const hash = vocabHash().slice(0, 10);
console.log(`VOCAB PAIRS (no AI call) | vocab ${hash} | pairs: ${pairs.length} (check ${check}, tie-protected ${pairs.length - check})`);
for (const p of pairs) {
  console.log(`${p.label.padEnd(13)} ${p.a} "${p.aText}" ~ ${p.b} "${p.bText}" | distance ${p.distance}`);
}
