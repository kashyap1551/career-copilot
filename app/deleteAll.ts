// Step 9.3, stage 2.5 (docs/PLAN-9.3.md section 5, amendment A13): the small pure part of "Delete everything saved on this device", beside the
// control in app/SavedControls.tsx. The three strings are DRAFT (the owner approves the wording); the two functions decide when the control is shown
// and what it may touch. Plain functions, tested without a browser (tests/deleteMyData.test.ts D3, D4).

// Shown after a successful delete (the saved profile and ads are gone, and the tab's access code and tick were forgotten first).
export const DELETE_ALL_DONE =
  "Deleted: the saved profile and ads on this device, and the access code and the tick kept for this tab. Text still on the screen goes away when you reload the page.";

// When saving is not available there is nothing saved to delete: the control then only forgets what this tab keeps.
export const TAB_ONLY_CONFIRM = "Forget the access code and the tick for this tab?";
export const TAB_ONLY_DONE = "Forgotten: the access code and the tick kept for this tab. Text still on the screen goes away when you reload the page.";

type SavedShape = { phase: string; available?: boolean; ctx?: unknown };

// Shown as soon as the page has finished checking, whether or not saving works: the access code and the tick live in the tab, not in the saved-data
// database, so they can be forgotten even when saving is unavailable.
export function deleteAllShows(state: SavedShape): boolean {
  return state.phase === "ready";
}

export type DeleteMode = "everything" | "tab-only";

// "everything" only when saving works AND there is a saved-data context to delete in. Otherwise "tab-only": the saved-data delete is never called.
export function deleteAllMode(state: SavedShape): DeleteMode {
  return state.phase === "ready" && state.available === true && state.ctx != null ? "everything" : "tab-only";
}
