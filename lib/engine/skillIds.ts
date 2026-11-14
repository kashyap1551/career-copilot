import { foldText } from "./text";
import type { Skill } from "./types";

// Skill names to skill ids, until Day 5 builds the real vocabulary. Pure code.
// A name that matches a skill in the current list gets that skill's id.
// Any other name gets a provisional id made from its own text, "new:docker",
// so the same unlisted skill gets the same id wherever it is written (in an
// ad, or in a list of skills a person pastes).

// "Node.js" -> "node-js", "C++" -> "c-plus-plus", "Führerschein" -> "fuhrerschein"
export function slugOf(name: string): string {
  return foldText(name)
    .replace(/\+/g, " plus ")
    .replace(/#/g, " sharp ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/ /g, "-");
}

// null when the name has nothing to make an id from ("???").
export function skillIdFor(
  name: string,
  skills: Skill[],
): { id: string; listed: boolean } | null {
  const slug = slugOf(name);
  if (slug === "") return null;
  const hit = skills.find((s) => s.id === slug || slugOf(s.name) === slug);
  return hit ? { id: hit.id, listed: true } : { id: `new:${slug}`, listed: false };
}
