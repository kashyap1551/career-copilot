import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import { ALL_DELETED, PROFILE_DELETED, SAVED_OK, SAVE_NOTICE, deleteStatus, saveStatus, savedMessage } from "@/lib/saved/messages";
import { savedFromBuilt } from "@/lib/saved/profile";
import { skills as fixtureSkills } from "@/fixtures/skills";
import { skills as liveSkills } from "@/lib/vocab";
import { summarizeProfile } from "@/lib/saved/profile";
import { profileKey, profileOfferState, savingAvailable, statusVisible } from "@/lib/saved/ui";
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
    // 6.1 part 3c fix: the reviewer's privacy decision adds the shared-computer sentence ("and anyone who can use this browser can see it").
    // 9.3 (wording sheet item 7): "It is not sent anywhere" became "Saving does not send it anywhere": a saved ad can be read again with the AI, which sends its text again.
    expect(SAVE_NOTICE).toBe("Saved on this device, in this browser only. Saving does not send it anywhere, and anyone who can use this browser can see it. You can delete it at any time. In a private window it is deleted when you close the window.");
    expect(SAVE_NOTICE).not.toBe("Saved on this device, in this browser only. It is not sent anywhere. You can delete it at any time. In a private window it is deleted when you close the window."); // the old wording must fail
    expect(SAVE_NOTICE.endsWith("In a private window it is deleted when you close the window.")).toBe(true);
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

// ---- 6.1 part 3b fixes ---------------------------------------------------------------------------------------------

// The key of the profile on screen = what saving it would store (the skills with their cited lines, the constraints, the
// kinds set), as text. The same content gives the same key; no time is in it. The status line is tied to a key, so
// "Saved on this device." is never shown next to a profile that differs from the saved copy.
describe("profileKey", () => {
  const build = (over: Partial<ConfirmState> = {}) =>
    buildProfile(LINES, [p("SQL", "sql", 2, "Wrote SQL queries"), p("Tableau", "tableau", 3, "dashboards in Tableau")], { ...CONFIRM, ...over }, skills);

  it("K1: the same confirm state built twice gives equal keys (no time in it)", async () => {
    const a = profileKey(build());
    await new Promise((r) => setTimeout(r, 5)); // a few milliseconds later
    expect(profileKey(build())).toBe(a);
  });

  it("K2: removing one kept skill gives a different key", () => {
    expect(profileKey(build({ keptIds: ["sql"] }))).not.toBe(profileKey(build()));
  });

  it("K3: changing the cities text gives a different key", () => {
    expect(profileKey(build({ cities: "Hamburg" }))).not.toBe(profileKey(build()));
  });

  it("K4: adding an in-progress skill gives a different key", () => {
    expect(profileKey(build({ inProgress: [...CONFIRM.inProgress, { name: "Docker", date: "2027-09-01" }] }))).not.toBe(profileKey(build()));
  });

  it("K5: what is not saved does not change the key: a name that stays off the profile (not in our skill list) only adds a note", () => {
    // By hand: 'Zymurgy' is in no list, so it lands in `unmatchable`, not in profile.skills; the saved content is the same.
    const withUnlisted = build({ added: [...CONFIRM.added, "Zymurgy"] });
    expect(withUnlisted.unmatchable.length).toBeGreaterThan(build().unmatchable.length);
    expect(profileKey(withUnlisted)).toBe(profileKey(build()));
  });
});

// By hand: a status is tied to the key of the profile it spoke about. Shown when that key is the one on screen; a status
// with no key (a delete message) is always shown; a status about a profile is hidden when nothing is on screen.
describe("statusVisible", () => {
  it("K6: shown for the same key, hidden for another key or for no profile, always shown without a key; nothing to show for no status", () => {
    expect(statusVisible({ text: "Saved on this device.", key: "A" }, "A")).toBe(true);
    expect(statusVisible({ text: "Saved on this device.", key: "A" }, "B")).toBe(false);
    expect(statusVisible({ text: "Saved on this device.", key: "A" }, null)).toBe(false);
    expect(statusVisible({ text: "Everything saved on this device was deleted.", key: null }, "B")).toBe(true);
    expect(statusVisible({ text: "Everything saved on this device was deleted.", key: null }, null)).toBe(true);
    expect(statusVisible(null, "A")).toBe(false);
  });

  it("K7: the person edits back to the saved content: the old 'Saved' line is true again and is shown again (the key is equal)", () => {
    expect(statusVisible({ text: "Saved on this device.", key: "A" }, "B")).toBe(false);
    expect(statusVisible({ text: "Saved on this device.", key: "A" }, "A")).toBe(true);
  });
});

describe("one vocabulary", () => {
  it("V1: fixtures/skills is the live vocabulary itself (the same array), so the page and lib/saved cannot name skills differently", () => {
    expect(fixtureSkills).toBe(liveSkills);
  });

  it("V2: the summary of a saved profile names a skill that is only in the live vocabulary (not one of the original 17)", () => {
    const onlyLive = saved.skills.concat([{ kind: "have", skillId: "experimentation", evidence: null }]);
    const summary = summarizeProfile({ ...saved, skills: onlyLive });
    expect(summary.have.find((h) => h.skillId === "experimentation")).toMatchObject({ name: "Experimentation", known: true });
  });
});

// ---- 6.1 part 3c fix: the key does not depend on the ORDER of skills ------------------------------------------------
// By hand: buildProfile lists the kept CV skills in the order of the AI's proposals (never in the order they were ticked), so
// ticking order cannot matter for them. But the skills the person ADDED by hand, and the ones IN PROGRESS, are listed in the
// order they were typed: removing one and adding it again puts it last. The saved content is the same set, so the key must be
// the same, and the "Saved on this device." line must come back.
describe("profileKey does not depend on the order of skills", () => {
  const build = (over: Partial<ConfirmState> = {}) =>
    buildProfile(LINES, [p("SQL", "sql", 2, "Wrote SQL queries"), p("Tableau", "tableau", 3, "dashboards in Tableau")], { ...CONFIRM, ...over }, skills);

  it("O1a (guard, passes at once): the same kept CV skills ticked in a different order give equal keys", () => {
    expect(profileKey(build({ keptIds: ["tableau", "sql"] }))).toBe(profileKey(build({ keptIds: ["sql", "tableau"] })));
  });

  it("O1b: skills added by hand in a different order give equal keys (Python then Docker, or Docker then Python)", () => {
    expect(profileKey(build({ added: ["Python", "Docker"] }))).toBe(profileKey(build({ added: ["Docker", "Python"] })));
  });

  it("O1c: skills in progress in a different order give equal keys", () => {
    const a = { name: "React", date: "2027-06-01" };
    const b = { name: "Docker", date: "2027-09-01" };
    expect(profileKey(build({ inProgress: [a, b] }))).toBe(profileKey(build({ inProgress: [b, a] })));
  });

  it("O2a (guard, passes at once): unticking a kept CV skill and ticking it again gives the key it had before", () => {
    const before = profileKey(build());
    expect(profileKey(build({ keptIds: ["sql"] }))).not.toBe(before); // unticked
    expect(profileKey(build({ keptIds: ["tableau", "sql"] }))).toBe(before); // ticked again (it is now last in keptIds)
  });

  it("O2b: removing a hand-added skill and adding it again (it is now last) gives the key it had before", () => {
    const before = profileKey(build({ added: ["Python", "Docker"] }));
    expect(profileKey(build({ added: ["Python"] }))).not.toBe(before); // removed
    expect(profileKey(build({ added: ["Python", "Docker"] }))).toBe(before);
    expect(profileKey(build({ added: ["Docker", "Python"] }))).toBe(before); // added again, order changed
  });

  it("O3 (guard, passes at once): a different cited line for the same skill gives a different key", () => {
    const first = buildProfile(LINES, [p("SQL", "sql", 2, "Wrote SQL queries")], { ...CONFIRM, keptIds: ["sql"] }, skills);
    const moved = buildProfile(LINES, [p("SQL", "sql", 3, "dashboards in Tableau")], { ...CONFIRM, keptIds: ["sql"] }, skills);
    expect(profileKey(moved)).not.toBe(profileKey(first));
  });
});
