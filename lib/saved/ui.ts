import { KINDS, KIND_WORDS, type BuiltProfile } from "../cv/profile";
import { stableStringify } from "../engine/stableStringify";
import type { Skill } from "../engine/types";
import { skills as liveVocabulary } from "../vocab";
import { savedMessage } from "./messages";
import { summarizeProfile } from "./profile";
import type { loadProfile } from "./saved";
import type { FailureReason } from "./types";

// Every decision of the profile controls on the page, as plain functions (6.1 part 3b). The components only wire them.

type Loaded = Awaited<ReturnType<typeof loadProfile>>;

export type ProfileOfferState =
  | { kind: "nothing" } // nothing saved: the page looks as it does today
  | { kind: "offer"; date: string; headline: string; details: string } // a profile is saved: offered, never used until a click
  | { kind: "problem"; reason: Extract<FailureReason, "corrupted" | "newer-version">; message: string } // shown with a Delete button, never used
  | { kind: "unavailable"; message: string }; // the database could not be read: saving is not available

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// What to show after loadProfile. A record that is corrupted or from a newer app is a problem (the person can delete it);
// any other failure to READ means the browser database cannot be used, so saving is not available.
export function profileOfferState(loaded: Loaded, vocabulary: Skill[] = liveVocabulary): ProfileOfferState {
  if (loaded.ok) {
    if (loaded.saved === null) return { kind: "nothing" };
    const summary = summarizeProfile(loaded.saved, vocabulary);
    const date = loaded.saved.savedAt.slice(0, 10);
    const kinds = KINDS.filter((k) => summary.set[k]).map((k) => KIND_WORDS[k]);
    return {
      kind: "offer",
      date,
      headline: `A profile is saved on this device (${date})`,
      details: `${plural(summary.have.length, "skill", "skills")}, ${summary.inProgress.length} in progress; constraints set: ${kinds.length > 0 ? kinds.join(", ") : "none"}`,
    };
  }
  if (loaded.reason === "corrupted" || loaded.reason === "newer-version") {
    return { kind: "problem", reason: loaded.reason, message: savedMessage(loaded.reason) };
  }
  return { kind: "unavailable", message: savedMessage("unavailable") };
}

// Are the Save controls shown? Only when the stamps could be computed AND the browser database could be read.
export function savingAvailable(stamps: { ok: boolean }, offer: ProfileOfferState): boolean {
  return stamps.ok && offer.kind !== "unavailable";
}

// The key of the profile on the page: what saving it would store (the skills with their cited lines, the constraints, the
// kinds the person set), as text with sorted keys. The same content gives the same key; no time is in it, and what is not
// saved (notes, problems, names not in our skill list) is not in it. The status line is tied to a key.
export function profileKey(built: BuiltProfile): string {
  return stableStringify({ skills: built.profile.skills, constraints: built.profile.constraints, set: built.set });
}

// A message about saving, tied to the key of the profile it spoke about (null for a message that is about no profile in
// particular, such as "Everything saved on this device was deleted.").
export type StatusLine = { text: string; key: string | null };

// The status line never claims something that is no longer true: a message about a profile is shown only while that same
// profile (the same key) is on screen. No effect is needed: it is decided when the page is drawn.
export function statusVisible(status: StatusLine | null, currentKey: string | null): boolean {
  if (status === null) return false;
  return status.key === null || status.key === currentKey;
}
