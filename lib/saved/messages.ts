import type { Failed, FailureReason } from "./types";

// The words the page uses about saving (6.1 part 3b). Plain functions, so the exact strings are tested; the components
// only show them. A timed-out or failed write says "could not confirm", never "not saved": a write that timed out may
// still land later.

export const SAVED_OK = "Saved on this device.";
export const ALL_DELETED = "Everything saved on this device was deleted.";
export const PROFILE_DELETED = "The saved profile was deleted.";
export const AD_DELETED = "The saved ad was deleted.";
export const AD_GONE = "That saved ad is no longer there.";

// The one-line notice next to the Save button (docs/PLAN-6.1.md, section 2).
// (6.1 part 3c fix: the shared-computer sentence is the reviewer's privacy decision: anyone who can use this browser can
// open the site and see what is saved.)
export const SAVE_NOTICE =
  "Saved on this device, in this browser only. It is not sent anywhere, and anyone who can use this browser can see it. You can delete it at any time. In a private window it is deleted when you close the window.";

const MESSAGES: Record<FailureReason, string> = {
  unavailable: "Saving is not available in this browser (private mode, blocked storage, or a page that is not secure). Everything else still works.",
  quota: "Your browser says its storage is full, so nothing was saved.",
  failed: "Saving did not work, and we could not confirm that anything was saved.",
  corrupted: "The saved data could not be read. You can delete it below.",
  "newer-version": "This was saved by a newer version of the app, so it is left untouched. You can delete it below.",
};

export function savedMessage(reason: FailureReason): string {
  return MESSAGES[reason];
}

// The status line after the person clicks Save.
export function saveStatus(result: { ok: true } | Failed): string {
  return result.ok ? SAVED_OK : savedMessage(result.reason);
}

// The status line after a click on a Delete button. A failed delete says so plainly (it must never say "saving did not
// work"); an unavailable store keeps the unavailable message.
export function deleteStatus(result: { ok: true } | Failed, what: "everything" | "profile" | "ad"): string {
  if (result.ok) return what === "everything" ? ALL_DELETED : what === "profile" ? PROFILE_DELETED : AD_DELETED;
  if (result.reason === "unavailable") return savedMessage("unavailable");
  const thing = what === "everything" ? "everything" : what === "profile" ? "the saved profile" : "the saved ad";
  return `Could not delete ${thing}. Try again, or clear this site's data in your browser settings.`;
}

// What the page says when a saved ad is opened, by the outcome of openJob (lib/saved/openJob.ts). null: nothing to say.
export type OpenKind = "newer-version" | "as-stored" | "rechecked" | "older-instructions" | "cannot-recheck";
const OPEN_MESSAGES: Record<OpenKind, string | null> = {
  "newer-version": "This ad was saved by a newer version of the app, so it is left untouched.",
  "as-stored": null,
  rechecked: "Checked again on this device with the current skill list. The saved copy was not changed, and no AI call was made.",
  "older-instructions": "This ad was read with older instructions for the AI, so you see the old reading. You can read it again with the AI (one AI call).",
  "cannot-recheck": "This saved ad cannot be checked again here, so you see the old reading. You can read it again with the AI (one AI call).",
};
export function openMessage(kind: OpenKind): string | null {
  return OPEN_MESSAGES[kind];
}

// 6.2 (docs/PLAN-6.2.md): what the list of saved ads says besides the level. The level text itself is never written here:
// it is the label the report returns (app/fitReport.ts).
export const NO_PROFILE_IN_USE_NOTE =
  'No fit levels yet: no profile is in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.';
export const OLD_READING_LINE = "Old reading: open it to read it again.";
export const LEVEL_FAILED_LINE = "A level could not be worked out for this ad.";

// The held-back line of the "What to learn" box (docs/PLAN-7.1.md, Amendments 1 and 2). Only the WORDS live here;
// `heldBackLine` in app/roadmap.ts chooses singular or plural and puts them together. Example, for one ad of four:
// "1 of your 4 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it."
export const HELD_BACK_OF = "of your";
export const HELD_BACK_COUNTED = "counted saved";
export const HELD_BACK_AD = { one: "ad", many: "ads" };
export const HELD_BACK_IS = { one: "is", many: "are" };
export const HELD_BACK_REASON = "held back by something other than skills";
export const HELD_BACK_TAIL = {
  one: "so learning the skills above may not open it",
  many: "so learning the skills above may not open them",
};

// The words of the "What to learn" box (docs/PLAN-7.1.md sections 1, 4, 5 and Amendments 1 to 4). Plain functions and constants,
// so the exact strings are tested; app/roadmap.ts only chooses and joins them and the view only shows them. The lines of
// Part B are the ones the command-line report prints (lib/engine/report-text.ts): tests/roadmap.test.ts U12 holds the two
// together line by line.
const noun = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const NO_PROFILE_NOTE =
  'What to learn needs a profile in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.';

// Part A, the gap list
export const gapTitle = (counted: number) => `Skills you are missing across your ${counted} saved ${noun(counted, "ad", "ads")}`;
export const GAP_SUBTITLE = "(Counted against the profile in use. Must-haves and nice-to-haves are counted apart.)";
export const learningNote = (date: string) => ` (you are learning it, expected ${date})`;
export const NO_CV_LINE_NOTE = " (on your profile without a CV line, so it does not count)";
const adsCount = (n: number) => `${n} ${noun(n, "ad", "ads")}`;
export function gapRowText(name: string, note: string, mustAds: number, niceAds: number): string {
  const parts = [
    ...(mustAds > 0 ? [`must-have in ${adsCount(mustAds)}`] : []),
    ...(niceAds > 0 ? [`nice-to-have in ${adsCount(niceAds)}`] : []),
  ];
  return `${name}${note}: ${parts.join(", ")}`;
}
export const ALTERNATIVES_NOTE = "A requirement that accepts several skills is counted once for each of them.";
export const meetEveryLine = (counted: number) =>
  `You meet every requirement we could judge in your ${counted} saved ${noun(counted, "ad", "ads")}.`;
export const couldNotJudgeLine = (n: number) =>
  n === 1
    ? "1 requirement in your saved ads is not in our skill list yet, so we could not judge it. It is not counted."
    : `${n} requirements in your saved ads are not in our skill list yet, so we could not judge them. They are not counted.`;
export function notCountedLine(noRequirements: number, noMustHave: number): string | null {
  const n = noRequirements + noMustHave;
  if (n === 0) return null;
  if (n === 1) {
    return noRequirements === 1
      ? "1 saved ad is not counted: the AI found no requirements in it."
      : "1 saved ad is not counted: the AI found no must-have we could judge in it.";
  }
  return `${n} saved ads are not counted (no requirements found, or no must-have we could judge).`;
}

// Part B, the roadmap
export const thresholdLine = (have: number, from: number) =>
  `The roadmap shows from ${from} saved ads we could judge. You have ${have}. Save ${Math.max(from - have, 0)} more to see it.`;
export const unjudgedCaveat = (n: number) => ` (${n} must-${noun(n, "have", "haves")} not judged)`;
export const alreadyStrongLine = (labels: string[]) =>
  labels.length === 0
    ? "Already Strong: none"
    : `Already Strong: ${labels.length} ${noun(labels.length, "job", "jobs")} (${labels.join("; ")})`;
export const RANKING_HEADER = "Skills to build, in order:";
export const rankingNoneLine = (otherStrong: boolean) =>
  `Skills to build, in order: none. No ${otherStrong ? "other " : ""}saved job can become a Strong match by skills alone.`;
export const BLOCKED_NONE = "Blocked jobs: none";
export const blockedCountLine = (n: number) => `Blocked jobs (skills alone can't make these Strong): ${n}`;

// Step 7.3 (docs/PLAN-7.3.md section 1): the timeline. The header and the "none" line are the words of the command-line report
// (lib/engine/report-text.ts); the framing sentence is the page's own. The `By DATE (...)` lines are the engine's (explainTimelineEntry).
export const TIMELINE_HEADER = "Timeline from skills in progress:";
export const TIMELINE_FRAMING = "These counts assume you learn each skill by its expected date.";
export const TIMELINE_NONE = "Timeline from skills in progress: none.";

export const WHAT_TO_LEARN = "What to learn";

export const ROADMAP_FAILED_LINE = "What to learn could not be worked out.";

// Step 8.1 (docs/PLAN-8.1.md section 1): the words of the roadmap report. The report's other sentences are the box's own constants
// (alreadyStrongLine, RANKING_HEADER, rankingNoneLine, the blocked and timeline lines) and the engine's sentences, never retyped.
export const REPORT_BUTTON_OPEN = "Make my roadmap report";
export const REPORT_BUTTON_CLOSE = "Hide the roadmap report";
export const REPORT_TITLE = "Your roadmap report";
export const reportBasisLine = (counted: number) =>
  `Based on ${counted} saved ${noun(counted, "ad", "ads")} we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.`;
// The sub line under a ranked skill: how many of the counted ads ask for it (the gap counts of step 7.1). Null when it has no counts.
export function reportAskedLine(must: number, nice: number, counted: number): string | null {
  const of = `of your ${counted} saved ${noun(counted, "ad", "ads")}`;
  if (must > 0 && nice > 0) return `Asked as a must-have in ${must} ${of}, and as a nice-to-have in ${nice}.`;
  if (must > 0) return `Asked as a must-have in ${must} ${of}.`;
  if (nice > 0) return `Asked as a nice-to-have in ${nice} ${of}.`;
  return null;
}
export const REPORT_FOOTNOTE =
  "A skill can be asked in more ads than it unlocks: an ad may need more than one skill, may already be unlocked by a skill higher up this list, or may be held back by something other than skills.";
export const REPORT_COPY = "Copy report as text";
export const REPORT_COPIED = "Copied.";
export const REPORT_COPY_FAILED = "Could not copy. Select the text and copy it by hand.";
export const REPORT_FAILED_LINE = "The roadmap report could not be worked out.";

// Step 8.2 (docs/PLAN-8.2.md section 2, A1 to A16): the words of the analytics block. The level names are the engine's own (`levelName`), the skill rows
// are the box's own (`gapRowText`, `learningNote`, `NO_CV_LINE_NOTE`) and the basis, not-counted and several-skills lines are reused; none is retyped.
export const ANALYTICS_BUTTON_OPEN = "Show my analytics";
export const ANALYTICS_BUTTON_CLOSE = "Hide the analytics";
export const ANALYTICS_TITLE = "Your analytics";
export const LEVELS_TITLE = "Fit levels across your saved ads";
export const LEVELS_NOTE = "(These are the levels shown on your saved ads, counted against the profile in use.)";
export const levelCountLine = (name: string, n: number, counted: number): string => `${name}: ${n} of your ${counted} saved ${noun(counted, "ad", "ads")}`;
export const NO_LEVEL_NAME = "No level";
export const NO_LEVEL_NOTE = "No level means the app could not judge those ads; the saved ads list says why for each.";
export const askedTitle = (counted: number): string => `Skills asked across your ${counted} saved ${noun(counted, "ad", "ads")}`;
export const ON_PROFILE_NOTE = " (on your profile)";
export const NOT_ON_PROFILE_NOTE = " (not on your profile)";
export const moreSkillsLine = (n: number): string =>
  n === 1 ? "1 more skill is asked in your saved ads and is not shown." : `${n} more skills are asked in your saved ads and are not shown.`;
export const yoursTitle = (counted: number): string => `Skills of yours that are asked for in your ${counted} saved ${noun(counted, "ad", "ads")}`;
export const yoursNoneLine = (counted: number): string => `${yoursTitle(counted)}: none.`;
export const ANALYTICS_FAILED_LINE = "The analytics could not be worked out.";

// ---- Step 8.3 (docs/PLAN-8.3.md v2): the words of the bullets block ----------------------------------------------------------------------------------------
// The texts of W4, W6, W8 and W9 were decided by the owner (0.2) and win over any other wording. W12 is REPORT_COPIED and REPORT_COPY_FAILED above. The route's own
// plain messages are shown as the route sends them.
export const BULLETS_BUTTON_OPEN = "Write CV bullets for this ad"; // W1
export const BULLETS_BUTTON_WAITING = "Writing bullets..."; // W2
export const BULLETS_BUTTON_CLOSE = "Hide the bullets"; // W3
export const bulletsNotice = (maxLines: number) =>
  `This sends the ad's requirement lines and up to ${maxLines} lines of your own CV to the AI service (Groq). We store nothing and do not log the text.`; // W4
export const BULLETS_TITLE = "CV bullets for this ad"; // W5
export const BULLETS_INTRO = "Each bullet is built from the words of the CV line shown under it. Read each one before you use it."; // W6
export const sourceLine = (line: number, text: string) => `from your CV line ${line}: "${text}"`; // W7
export const sourceLineOnly = (line: number) => `from your CV line ${line}`; // W7 when the bullet equals its line: the line is shown once (0.21)
export const droppedLine = (dropped: number) =>
  dropped <= 0
    ? ""
    : dropped === 1
      ? "1 bullet was dropped by the checks: it did not stay close enough to your CV line."
      : `${dropped} bullets were dropped by the checks: they did not stay close enough to your CV line.`; // W8
export const BULLETS_NONE_PASSED = "No bullet passed the checks, so none is shown. You can try again, or use your CV lines as they are."; // W9
export const BULLETS_NOTHING_TO_WRITE = "No requirement of this ad is met by a line of your CV, so there is nothing to write from."; // W10
export const BULLETS_COPY = "Copy bullets as text"; // W11
export const BULLETS_TIMEOUT_LINE = "The AI did not answer in time. Please try again."; // W14
// Plain lines the plan had not worded (0.26): the text of the page's own lines for a lost connection and an error answer, and the analogue of
// ROADMAP_FAILED_LINE and ANALYTICS_FAILED_LINE for an unexpected throw or an answer in a wrong shape.
export const COULD_NOT_REACH_LINE = "Could not reach the server. Check your connection and try again.";
export const serverErrorLine = (status: number) => `The server returned an error (${status}).`;
export const BULLETS_FAILED_LINE = "The CV bullets could not be worked out.";
