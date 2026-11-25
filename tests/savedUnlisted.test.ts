import { describe, expect, it } from "vitest";
import { profileReport } from "@/app/fitReport";
import { roadmapBox } from "@/app/roadmap";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type BuiltProfile } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import { OLD_PROFILE_NOTE } from "@/lib/saved/messages";
import { builtFromSaved, profileNote, savedFromBuilt, sparseCvLines, summarizeProfile } from "@/lib/saved/profile";
import { loadProfile, saveProfile } from "@/lib/saved/saved";
import { MemoryStore } from "@/lib/saved/store";
import { profileKey } from "@/lib/saved/ui";
import type { SavedProfile } from "@/lib/saved/types";
import { INTAKE, job, LINES, SQL, UNLISTED, WOUND, EXCEL } from "./support/evidenceFixtures";

// EC-2, the saved side (docs/PLAN-EVERY-CV.md 4.6; tests SU1 to SU11). The saved profile holds the kept unlisted skills as an OPTIONAL field
// `unlistedKept` (no schema bump). Invented data; hand-worked. The person: SQL (line 2), and kept 'Wound care' (line 3, inferred) and 'Welding'
// (line 5, named); Patient intake (line 4) is not ticked.
const prop = (name: string, skillId: string, listed: boolean, line: number, label: "named" | "inferred"): CvSkill => ({ name, skillId, listed, line, quote: "q", label });
const PROPOSALS = [prop("SQL", "sql", true, 2, "named"), prop("Wound care", "new:wound-care", false, 3, "inferred"), prop("Patient intake", "new:patient-intake", false, 4, "inferred"), prop("Welding", "new:welding", false, 5, "named")];
const BUILT: BuiltProfile = buildProfile(LINES, PROPOSALS, { ...initialConfirm(PROPOSALS), keptIds: ["sql", "new:wound-care", "new:welding"] }, skills);
const STAMPS = { vocabularyHash: "v", readingVersion: "3" };
const T1 = new Date("2026-11-25T10:00:00.000Z");
const ctxOf = (store: MemoryStore) => ({ store, stamps: { ...STAMPS, adRequestHash: "h" } });
const WOUND_KEPT = { name: "Wound care", skillId: "new:wound-care", evidence: { line: 3, text: LINES[2] }, inferred: true };
const WELD_KEPT = { name: "Welding", skillId: "new:welding", evidence: { line: 5, text: LINES[4] }, inferred: false };

describe("EC-2 saved profile with unlistedKept", () => {
  it("SU1: a round trip through the store keeps unlistedKept with the inferred flag, in order, and builtFromSaved fills it back", async () => {
    expect(BUILT.unlistedKept).toEqual([WOUND_KEPT, WELD_KEPT]);
    const store = new MemoryStore();
    expect(await saveProfile(ctxOf(store), BUILT)).toEqual({ ok: true });
    const loaded = await loadProfile(ctxOf(store));
    if (!loaded.ok || loaded.saved === null) throw new Error("not saved");
    expect(loaded.saved.unlistedKept).toEqual([WOUND_KEPT, WELD_KEPT]);
    expect(builtFromSaved(loaded.saved).unlistedKept).toEqual([WOUND_KEPT, WELD_KEPT]);
  });

  it("SU2: an OLD saved profile (no such field) opens as before: no field comes back, nothing breaks; the old-profile note is shown, and not for a new profile with nothing kept", async () => {
    const old = savedFromBuilt({ ...BUILT, unlistedKept: undefined }, STAMPS, T1);
    expect("unlistedKept" in old).toBe(false);
    const store = new MemoryStore();
    await store.put("profile", "current", old);
    const loaded = await loadProfile(ctxOf(store));
    expect(loaded.ok && loaded.saved !== null).toBe(true);
    if (!loaded.ok || loaded.saved === null) throw new Error("no profile");
    expect(builtFromSaved(loaded.saved).unlistedKept).toBeUndefined();
    expect(profileNote(loaded.saved)).toBe(OLD_PROFILE_NOTE);
    expect(OLD_PROFILE_NOTE).toBe("This saved profile was saved before unlisted skills were kept. Read your CV again to add them.");
    // a profile saved by this version with NOTHING kept carries an empty list, which is not "old"
    const fresh = savedFromBuilt({ ...BUILT, unlistedKept: [] }, STAMPS, T1);
    expect(fresh.unlistedKept).toEqual([]);
    expect(profileNote(fresh)).toBeNull();
    expect(profileNote(savedFromBuilt(BUILT, STAMPS, T1))).toBeNull();
  });

  it("SU3: the record is checked when it is read: a malformed entry (line 0, line 401, no name, a text that is not text) makes the profile 'corrupted', never trusted", async () => {
    const good = savedFromBuilt(BUILT, STAMPS, T1);
    const bad = (e: unknown) => ({ ...good, unlistedKept: [e] });
    for (const entry of [
      { ...WOUND_KEPT, evidence: { line: 0, text: "x" } },
      { ...WOUND_KEPT, evidence: { line: 401, text: "x" } },
      { skillId: "new:x", evidence: { line: 3, text: "x" } },
      { ...WOUND_KEPT, evidence: { line: 3, text: 7 } },
    ]) {
      const store = new MemoryStore();
      await store.put("profile", "current", bad(entry));
      expect(await loadProfile(ctxOf(store))).toEqual({ ok: false, reason: "corrupted" });
    }
    const store = new MemoryStore();
    await store.put("profile", "current", { ...good, unlistedKept: [{ ...WELD_KEPT, inferred: undefined }] }); // the flag is optional: absent means not inferred
    const loaded = await loadProfile(ctxOf(store));
    expect(loaded.ok).toBe(true);
  });

  it("SU4: the CV lines are rebuilt from the cited lines of the unlisted entries too, or the engine's line check would fail for them", () => {
    const saved = savedFromBuilt(BUILT, STAMPS, T1);
    // sql line 2, wound care line 3, welding line 5: five slots, the lines that are cited filled, line 1 and line 4 empty
    expect(builtFromSaved(saved).profile.cvLines).toEqual(["", LINES[1], LINES[2], "", LINES[4]]);
    expect(sparseCvLines(saved.skills, saved.unlistedKept)).toEqual(["", LINES[1], LINES[2], "", LINES[4]]);
    expect(sparseCvLines(saved.skills)).toEqual(["", LINES[1]]); // without the second argument it is what it was
  });

  it("SU5: a skill listed LATER is looked up again on load: the saved new:x becomes the real id, as a normal skill with its line; the others stay unlisted", () => {
    const saved = savedFromBuilt(BUILT, STAMPS, T1);
    const later = [...skills, { id: "welding", name: "Welding" }];
    const b = builtFromSaved(saved, later);
    expect(b.profile.skills).toContainEqual({ kind: "have", skillId: "welding", evidence: { line: 5, text: LINES[4] } });
    expect(b.unlistedKept).toEqual([WOUND_KEPT]);
    expect(builtFromSaved(saved).unlistedKept).toEqual([WOUND_KEPT, WELD_KEPT]); // with today's vocabulary nothing moves
    // if the person already has that skill from the CV, it is not added twice
    const twice = builtFromSaved({ ...saved, skills: [...saved.skills, { kind: "have", skillId: "welding", evidence: { line: 5, text: LINES[4] } }] }, later);
    expect(twice.profile.skills.filter((s) => s.skillId === "welding")).toHaveLength(1);
  });

  it("SU6: the profile key follows the saved content: a kept entry changes it; none, or an empty list, leaves it as it was", () => {
    const none = profileKey({ ...BUILT, unlistedKept: undefined });
    expect(profileKey({ ...BUILT, unlistedKept: [] })).toBe(none);
    expect(profileKey(BUILT)).not.toBe(none);
    expect(profileKey({ ...BUILT, unlistedKept: [WELD_KEPT, WOUND_KEPT] })).toBe(profileKey(BUILT)); // the order it was typed in is not content
    expect(profileKey({ ...BUILT, unlistedKept: [WOUND_KEPT] })).not.toBe(profileKey(BUILT));
  });

  it("SU7: a newer app's extra field in the record is kept (a loose object), and the kept entries are still there", async () => {
    const store = new MemoryStore();
    await store.put("profile", "current", { ...savedFromBuilt(BUILT, STAMPS, T1), futureField: { a: 1 } });
    const loaded = await loadProfile(ctxOf(store));
    if (!loaded.ok || loaded.saved === null) throw new Error("no profile");
    expect((loaded.saved as SavedProfile & { futureField?: unknown }).futureField).toEqual({ a: 1 });
    expect(loaded.saved.unlistedKept).toEqual([WOUND_KEPT, WELD_KEPT]);
  });

  it("SU8: a profile saved WITH unlistedKept and loaded gives the report and the roadmap the same same-name match as the freshly built one", async () => {
    const store = new MemoryStore();
    await saveProfile(ctxOf(store), BUILT);
    const loaded = await loadProfile(ctxOf(store));
    if (!loaded.ok || loaded.saved === null) throw new Error("no profile");
    const reloaded = builtFromSaved(loaded.saved);
    const j = job([SQL, EXCEL, WOUND, INTAKE]); // musts: SQL met, Excel missing, Wound care (same-name), Patient intake (unlisted, not kept)
    const fresh = profileReport(j, BUILT, skills, UNLISTED);
    const again = profileReport(j, reloaded, skills, UNLISTED);
    expect(again).toEqual(fresh);
    expect(fresh.rows.find((r) => r.quote === WOUND.quote)?.status).toBe("met");
    expect(fresh.couldNotJudge).toEqual({ musts: 1, nices: 0 });
    const ads = ["A", "B", "C", "D"].map((n) => ({ id: `ad-${n}`, job: { ...j, id: `ad-${n}`, title: `Ward ${n}` } }));
    const boxFresh = roadmapBox(BUILT, ads, skills, 4);
    const boxLoaded = roadmapBox(reloaded, ads, skills, 4);
    expect(boxLoaded).toEqual(boxFresh);
    expect(boxLoaded.partB.join("\n")).toContain("Ward A, Brindle Clinic (1 must-have not judged)"); // the report's count: 1
  });

  it("SU9: the on-screen summary of a saved profile lists the kept unlisted skills when there are some, and has no such entry when there are none", () => {
    expect(summarizeProfile(savedFromBuilt(BUILT, STAMPS, T1)).unlisted).toEqual([
      { name: "Wound care", line: 3, text: LINES[2], inferred: true },
      { name: "Welding", line: 5, text: LINES[4], inferred: false },
    ]);
    expect("unlisted" in summarizeProfile(savedFromBuilt({ ...BUILT, unlistedKept: undefined }, STAMPS, T1))).toBe(false);
  });

  it("SU10: saving does not change the built profile it was given (the entries are copied)", () => {
    const before = JSON.stringify(BUILT);
    const saved = savedFromBuilt(BUILT, STAMPS, T1);
    saved.unlistedKept?.push({ ...WELD_KEPT, name: "changed" });
    expect(JSON.stringify(BUILT)).toBe(before);
  });
});
