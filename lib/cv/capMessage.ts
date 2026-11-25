import { MAX_SKILLS, type CvRemoval } from "../engine/fromCv";

// The 60-skill cap, as its own line (docs/PLAN-EVERY-CV.md 4.1). The CV reading keeps the first 60 skills in the AI's order (lib/engine/fromCv.ts);
// the rest are removed as "too-many". That is not a failed check, so it is told apart from the failed checks and it names what was left out.
// DRAFT wording: the owner approves it. Pure text.

const NAMES_SHOWN = 20;

export function capMessage(removed: CvRemoval[]): string | null {
  const names = removed.filter((r) => r.why === "too-many").map((r) => r.name);
  if (names.length === 0) return null;
  const shown = names.slice(0, NAMES_SHOWN).join(", ");
  const list = names.length > NAMES_SHOWN ? `${shown}, and ${names.length - NAMES_SHOWN} more` : shown;
  const head =
    names.length === 1
      ? `Your CV showed 1 more skill than the ${MAX_SKILLS} we keep. It was left out: ${list}.`
      : `Your CV showed ${names.length} more skills than the ${MAX_SKILLS} we keep. These were left out: ${list}.`;
  return `${head} Pick the ones that matter by unticking others and sending again, or shorten the CV.`;
}
