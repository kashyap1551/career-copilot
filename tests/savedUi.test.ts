import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import { ALL_DELETED, PROFILE_DELETED, SAVED_OK, SAVE_NOTICE, deleteStatus, saveStatus, savedMessage } from "@/lib/saved/messages";
import { savedFromBuilt } from "@/lib/saved/profile";
import { profileOfferState, savingAvailable } from "@/lib/saved/ui";
import type { FailureReason } from "@/lib/saved/types";

// 6.1 part 3b: every decision the page makes lives in a plain function (lib/saved/messages.ts, lib/saved/ui.ts) and is
// tested here; the components only wire them. Exact strings are the ones the owner approved.

describe("savedMessage: the five reasons, exact strings", () => {
  const expected: Record<FailureReason, string> = {
    unavailable: "Saving is not available in this browser (private mode, blocked storage, or a page that is not secure). Everything else still works.",
    quota: "Your browser says its storage is full, so nothing was saved.",
    failed: "Saving did not work, and we could not confirm that anything was saved.",
    corrupted: "The saved data could not be read. You can delete it below.",
    "newer-version": "This was saved by a newer version of the app, so it is left untouched. You can delete it below.",
  };
  it("U1: each reason gives exactly its string", () => {
    for (const reason of Object.keys(expected) as FailureReason[]) expect(savedMessage(reason)).toBe(expected[reason]);
    expect(Object.keys(expected)).toHaveLength(5);
  });

  it("U2: the notice next to the Save button is the one-line wording from PLAN-6.1", () => {
    expect(SAVE_NOTICE).toBe("Saved on this device, in this browser only. It is not sent anywhere. You can delete it at any time. In a private window it is deleted when you close the window.");
    expect(SAVE_NOTICE).not.toContain("\n");
  });
});

describe("the status after a click", () => {
  it("U3: a successful save says 'Saved on this device.'; a failed one says the message for its reason", () => {
    expect(SAVED_OK).toBe("Saved on this device.");
    expect(saveStatus({ ok: true })).toBe("Saved on this device.");
    for (const reason of ["unavailable", "quota", "failed"] as const) expect(saveStatus({ ok: false, reason })).toBe(savedMessage(reason));
  });

  it("U4: deleting: success texts for everything and for the profile; a failure says so plainly (never 'saving did not work')", () => {
    expect(ALL_DELETED).toBe("Everything saved on this device was deleted.");
    expect(PROFILE_DELETED).toBe("The saved profile was deleted.");
    expect(deleteStatus({ ok: true }, "everything")).toBe("Everything saved on this device was deleted.");
    expect(deleteStatus({ ok: true }, "profile")).toBe("The saved profile was deleted.");
    expect(deleteStatus({ ok: false, reason: "failed" }, "everything")).toBe("Could not delete everything. Try again, or clear this site's data in your browser settings.");
    expect(deleteStatus({ ok: false, reason: "failed" }, "profile")).toBe("Could not delete the saved profile. Try again, or clear this site's data in your browser settings.");
    expect(deleteStatus({ ok: false, reason: "unavailable" }, "profile")).toBe(savedMessage("unavailable"));
  });
});

// The made-up profile: SQL (line 2), Tableau (line 3), Python by hand; location, language, work mode, years set.
const LINES = ["Robin Sample", "Wrote SQL queries to reconcile order data", "Built dashboards in Tableau"];
const p = (name: string, skillId: string, line: number, quote: string): CvSkill => ({ name, skillId, listed: true, line, quote, label: "named" });
const CONFIRM: ConfirmState = {
  keptIds: ["sql", "tableau"], added: ["Python"], inProgress: [{ name: "React", date: "2027-06-01" }],
  languages: [{ code: "en", level: "C1" }], cities: "Berlin", workModes: ["hybrid"], years: "3", availableFrom: "",
};
const built = buildProfile(LINES, [p("SQL", "sql", 2, "Wrote SQL queries"), p("Tableau", "tableau", 3, "dashboards in Tableau")], CONFIRM, skills);
const saved = savedFromBuilt(built, { vocabularyHash: "v", readingVersion: "3" }, new Date("2026-11-16T10:00:00.000Z"));

describe("profileOfferState: what the page shows after loading", () => {
  it("U5: nothing saved: nothing is shown (the page looks as it does today)", () => {
    expect(profileOfferState({ ok: true, saved: null })).toEqual({ kind: "nothing" });
  });

  // By hand: 3 'have' skills (SQL, Tableau, Python by hand), 1 in progress (React), constraints set: location, language,
  // work mode, years (start date not set). savedAt 2026-11-16T10:00 -> the date shown is 2026-11-16.
  it("U6: a saved profile: the headline with the date, and the counts line", () => {
    const state = profileOfferState({ ok: true, saved });
    expect(state).toMatchObject({
      kind: "offer",
      headline: "A profile is saved on this device (2026-11-16)",
      details: "3 skills, 1 in progress; constraints set: location, language, work mode, years",
    });
  });

  it("U7: one skill, none in progress, no constraint set: singular and 'none'", () => {
    const one = { ...saved, skills: [saved.skills[0]], set: { location: false, language: false, workMode: false, years: false, startDate: false } };
    expect(profileOfferState({ ok: true, saved: one })).toMatchObject({ kind: "offer", details: "1 skill, 0 in progress; constraints set: none" });
  });

  it("U8: a corrupted or newer-version record is a problem with its message, never an offer", () => {
    expect(profileOfferState({ ok: false, reason: "corrupted" })).toEqual({ kind: "problem", reason: "corrupted", message: savedMessage("corrupted") });
    expect(profileOfferState({ ok: false, reason: "newer-version" })).toEqual({ kind: "problem", reason: "newer-version", message: savedMessage("newer-version") });
  });

  it("U9: any other failure to read (unavailable, failed, quota) means saving is not available: the unavailable message", () => {
    for (const reason of ["unavailable", "failed", "quota"] as const) {
      expect(profileOfferState({ ok: false, reason })).toEqual({ kind: "unavailable", message: savedMessage("unavailable") });
    }
  });
});

describe("savingAvailable: whether the Save controls are shown", () => {
  it("U10: only when the stamps could be computed AND the browser database could be read", () => {
    expect(savingAvailable({ ok: true }, { kind: "nothing" })).toBe(true);
    expect(savingAvailable({ ok: true }, { kind: "offer", headline: "h", details: "d", date: "2026-11-16" })).toBe(true);
    expect(savingAvailable({ ok: true }, { kind: "problem", reason: "corrupted", message: "m" })).toBe(true); // the person can still delete it
    expect(savingAvailable({ ok: true }, { kind: "unavailable", message: "m" })).toBe(false);
    expect(savingAvailable({ ok: false }, { kind: "nothing" })).toBe(false);
  });
});
