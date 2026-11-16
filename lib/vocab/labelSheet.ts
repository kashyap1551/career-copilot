import { VOCAB } from "./index";

// The sheet for labelling the fresh set (npm run skill-ids): every skill id with its names, then the two special labels.
export function labelSheetLines(): string[] {
  return [
    "Skill ids: id | English name | German name",
    ...VOCAB.map((e) => `${e.id} | ${e.name} | ${e.de}`),
    "",
    "Two more labels:",
    "none = a real skill we do not list (it should stay unlisted)",
    "not-a-skill = a trait, a working environment or a vague phrase",
  ];
}
