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
