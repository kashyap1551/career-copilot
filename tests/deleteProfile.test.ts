import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile } from "@/lib/cv/profile";
import { deleteProfile, listJobs, loadProfile, saveJob, saveProfile, type SavedContext } from "@/lib/saved/saved";
import { MemoryStore, StoreError, type KeyValueStore } from "@/lib/saved/store";

// 6.1 part 3b, step 2: deleteProfile removes ONLY the profile. Hand-worked: a profile and one job are saved; after
// deleteProfile there is no profile and the one job is still listed.

const ctxOf = (store: KeyValueStore): SavedContext => ({ store, stamps: { vocabularyHash: "v", readingVersion: "3", adRequestHash: "a" }, now: () => new Date("2026-11-16T10:00:00.000Z") });
const BUILT = buildProfile(["Wrote SQL"], [], { keptIds: [], added: [], inProgress: [], languages: [], cities: "", workModes: [], years: "", availableFrom: "" }, skills);
const JOB = { adText: "An ad.", extraction: null, reading: { job: { id: "j", title: "T", company: null, source: null, constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] }, requirements: [] }, removed: [], moved: [], unlisted: [], notCounted: [] } };

describe("deleteProfile", () => {
  it("D1: deletes the profile and leaves the saved jobs alone", async () => {
    const store = new MemoryStore();
    await saveProfile(ctxOf(store), BUILT);
    await saveJob(ctxOf(store), JOB);
    expect(await deleteProfile(ctxOf(store))).toEqual({ ok: true });
    expect(await loadProfile(ctxOf(store))).toEqual({ ok: true, saved: null });
    const list = await listJobs(ctxOf(store));
    expect(list.ok && list.jobs.length).toBe(1);
  });

  it("D2: it also deletes a corrupted or newer-version profile (the person chose to delete it), and deleting nothing is fine", async () => {
    const store = new MemoryStore();
    await store.put("profile", "current", { schemaVersion: 99, mystery: true });
    expect(await deleteProfile(ctxOf(store))).toEqual({ ok: true });
    expect(await store.get("profile", "current")).toBeUndefined();
    expect(await deleteProfile(ctxOf(store))).toEqual({ ok: true });
  });

  it("D3: a store problem is a result, not a throw", async () => {
    const base = new MemoryStore();
    const broken: KeyValueStore = { get: (a, b) => base.get(a, b), put: (a, b, c) => base.put(a, b, c), list: (a) => base.list(a), clear: () => base.clear(), delete: async () => { throw new StoreError("unavailable"); } };
    expect(await deleteProfile(ctxOf(broken))).toEqual({ ok: false, reason: "unavailable" });
  });
});
