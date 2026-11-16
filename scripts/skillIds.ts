import { labelSheetLines } from "../lib/vocab/labelSheet";

// npm run skill-ids: every skill id with its English and German name, then the two special labels. For filling in
// fixtures/real-ads/fresh-labels-TODO.json. No AI call.
console.log(labelSheetLines().join("\n"));
