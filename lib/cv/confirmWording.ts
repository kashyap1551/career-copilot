// The words of the confirm box about a skill that is not in our skill list yet (docs/PLAN-EVERY-CV.md 4.1). Such a skill is now KEPT with its CV line
// and checked against an ad by the AI, so the old "it can't be matched with an ad" is no longer true. DRAFT wording: the owner approves it.

// After the CV line of a skill row.
export const UNLISTED_TAG = "not in our skill list yet; it is checked against an ad by the AI, with your CV line as proof";

// In the list of names that are not in our list, for a name read from the CV.
export const keptLineText = (line: number) => `kept with CV line ${line} (checked against an ad by the AI)`;
