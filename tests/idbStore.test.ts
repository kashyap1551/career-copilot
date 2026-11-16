import { afterEach, describe, expect, it, vi } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile } from "@/lib/cv/profile";
import { createIdbStore, mapIdbError } from "@/lib/saved/idbStore";
import {
  deleteAll, deleteJob, listJobs, loadJob, loadProfile, saveJob, saveProfile, type SavedContext,
} from "@/lib/saved/saved";
import { StoreError } from "@/lib/saved/store";

// 6.1 part 3a: the IndexedDB adapter, the part that needs no browser. The success path (a real database, oncomplete
// versus onsuccess, 15 jobs surviving a reload) cannot be tested without a real browser: it is checked by reading
// lib/saved/idbStore.ts and by the manual checklist (3c). Here: the error mapper, and the whole failure path in Node,
// where `indexedDB` does not exist. Hand-worked expectations in the comments.

afterEach(() => vi.unstubAllGlobals());

describe("mapIdbError: the reason for an error", () => {
  // By the rule of the plan: QuotaExceededError (name, or code 22, or Firefox's 1014) -> quota; SecurityError and
  // InvalidStateError -> unavailable; a StoreError keeps its own reason; anything else (DataCloneError, undefined,
  // an unknown name, a string) -> failed.
  it("M1: quota by name and by code", () => {
    expect(mapIdbError(new DOMException("full", "QuotaExceededError"))).toBe("quota");
    expect(mapIdbError({ name: "SomethingElse", code: 22 })).toBe("quota");
    expect(mapIdbError({ code: 1014 })).toBe("quota");
  });

  it("M2: SecurityError and InvalidStateError are 'unavailable'", () => {
    expect(mapIdbError(new DOMException("blocked", "SecurityError"))).toBe("unavailable");
    expect(mapIdbError(new DOMException("closing", "InvalidStateError"))).toBe("unavailable");
  });

  it("M3: a StoreError keeps its own reason, whatever it is", () => {
    for (const reason of ["unavailable", "quota", "failed"] as const) expect(mapIdbError(new StoreError(reason))).toBe(reason);
  });

  it("M4: everything else is 'failed': DataCloneError, an abort, undefined, null, a string, a plain error", () => {
    expect(mapIdbError(new DOMException("cannot clone", "DataCloneError"))).toBe("failed");
    expect(mapIdbError(new DOMException("aborted", "AbortError"))).toBe("failed");
    for (const x of [undefined, null, "QuotaExceededError", new Error("boom"), 42, {}]) expect(mapIdbError(x)).toBe("failed");
  });
});

describe("importing the adapter touches nothing (Next renders pages on the server first, where indexedDB does not exist)", () => {
  it("I1: in Node (no indexedDB) the import does not throw", async () => {
    expect("indexedDB" in globalThis).toBe(false);
    vi.resetModules();
    await expect(import("@/lib/saved/idbStore")).resolves.toBeDefined();
  });

  it("I2: even where indexedDB exists, importing never calls it", async () => {
    const open = vi.fn();
    vi.stubGlobal("indexedDB", { open });
    vi.resetModules();
    await import("@/lib/saved/idbStore");
    expect(open).not.toHaveBeenCalled();
  });
});

describe("with no indexedDB (Node) every call fails the same way: unavailable", () => {
  const store = createIdbStore();
  const ctx: SavedContext = { store, stamps: { vocabularyHash: "v", readingVersion: "3", adRequestHash: "a" }, now: () => new Date("2026-11-16T10:00:00.000Z") };

  it("A1: the store rejects with a StoreError whose reason is 'unavailable', for each of the five methods", async () => {
    for (const call of [
      () => store.get("profile", "current"), () => store.put("jobs", "x", { a: 1 }), () => store.delete("jobs", "x"),
      () => store.list("jobs"), () => store.clear(),
    ]) await expect(call()).rejects.toMatchObject({ name: "StoreError", reason: "unavailable" });
  });

  it("A2: a failed open is forgotten: the second call fails again the same way (it does not hang or reuse a dead promise)", async () => {
    await expect(store.get("profile", "current")).rejects.toMatchObject({ reason: "unavailable" });
    await expect(store.get("profile", "current")).rejects.toMatchObject({ reason: "unavailable" });
  });

  it("A3: inside the logic layer, every function RETURNS { ok: false, reason: 'unavailable' } and none throws", async () => {
    const b = buildProfile(["Wrote SQL"], [], { keptIds: [], added: [], inProgress: [], languages: [], cities: "", workModes: [], years: "", availableFrom: "" }, skills);
    const input = { adText: "An ad.", extraction: null, reading: { job: { id: "j", title: "T", company: null, source: null, constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] }, requirements: [] }, removed: [], moved: [], unlisted: [], notCounted: [] } };
    const results = [
      await saveProfile(ctx, b), await loadProfile(ctx), await saveJob(ctx, input), await listJobs(ctx),
      await loadJob(ctx, "x"), await deleteJob(ctx, "x"), await deleteAll(ctx),
    ];
    for (const r of results) expect(r).toEqual({ ok: false, reason: "unavailable" });
  });
});
