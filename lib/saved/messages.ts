import type { Failed, FailureReason } from "./types";

// The words the page uses about saving (6.1 part 3b). Plain functions, so the exact strings are tested; the components
// only show them. A timed-out or failed write says "could not confirm", never "not saved": a write that timed out may
// still land later.

export const SAVED_OK = "Saved on this device.";
export const ALL_DELETED = "Everything saved on this device was deleted.";
export const PROFILE_DELETED = "The saved profile was deleted.";

// The one-line notice next to the Save button (docs/PLAN-6.1.md, section 2).
export const SAVE_NOTICE =
  "Saved on this device, in this browser only. It is not sent anywhere. You can delete it at any time. In a private window it is deleted when you close the window.";

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
export function deleteStatus(result: { ok: true } | Failed, what: "everything" | "profile"): string {
  if (result.ok) return what === "everything" ? ALL_DELETED : PROFILE_DELETED;
  if (result.reason === "unavailable") return savedMessage("unavailable");
  return `Could not delete ${what === "everything" ? "everything" : "the saved profile"}. Try again, or clear this site's data in your browser settings.`;
}
