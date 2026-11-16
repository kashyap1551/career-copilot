import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile } from "@/lib/cv/profile";
import { loadProfile, saveProfile, type SavedContext } from "@/lib/saved/saved";
import { MemoryStore, StoreError, type KeyValueStore } from "@/lib/saved/store";
import { withTimeout } from "@/lib/saved/withTimeout";

// 6.1 part 3b, step 1: a timeout around every store call. A browser database that never answers (it happens, notably in
// Safari) would leave the page stuck on "Saving..." for ever. A call that does not settle within `ms` rejects with
// StoreError("failed"); the timer is cleared when the call settles; a real error is passed on unchanged.
// Hand-worked: with a limit of 10,000 ms, a call that never settles is still pending at 9,999 ms and has rejected at 10,000.

const STAMPS = { vocabularyHash: "v", readingVersion: "3", adRequestHash: "a" };
const ctxOf = (store: KeyValueStore): SavedContext => ({ store, stamps: STAMPS, now: () => new Date("2026-11-16T10:00:00.000Z") });
const BUILT = buildProfile(["Wrote SQL"], [], { keptIds: [], added: [], inProgress: [], languages: [], cities: "", workModes: [], years: "", availableFrom: "" }, skills);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("W1: a get that never settles: pending at 9,999 ms; at 10,000 ms loadProfile returns { ok: false, reason: 'failed' }", async () => {
    const never: KeyValueStore = { ...new MemoryStore(), get: () => new Promise(() => {}), put: async () => {}, delete: async () => {}, list: async () => [], clear: async () => {} };
    const pending = loadProfile(ctxOf(withTimeout(never, 10_000)));
    let settled = false;
    void pending.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    expect(await pending).toEqual({ ok: false, reason: "failed" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("W2: a store that answers at once is passed through unchanged, and no timer is left running afterwards", async () => {
    const store = withTimeout(new MemoryStore(), 10_000);
    expect((await saveProfile(ctxOf(store), BUILT)).ok).toBe(true);
    const loaded = await loadProfile(ctxOf(store));
    expect(loaded.ok && loaded.saved !== null).toBe(true);
    expect(await store.get("profile", "nothing-here")).toBeUndefined();
    expect(await store.list("jobs")).toEqual([]);
    await store.clear();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("W3: a store whose put rejects with StoreError('quota') keeps the reason 'quota' (the timeout does not rewrite real errors); no timer left", async () => {
    const full: KeyValueStore = { ...new MemoryStore(), get: async () => undefined, put: async () => { throw new StoreError("quota"); }, delete: async () => {}, list: async () => [], clear: async () => {} };
    expect(await saveProfile(ctxOf(withTimeout(full, 10_000)), BUILT)).toEqual({ ok: false, reason: "quota" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("W4: a plain error and a synchronous throw are passed on too (and clear the timer)", async () => {
    const odd: KeyValueStore = { ...new MemoryStore(), get: () => { throw new Error("sync boom"); }, put: async () => { throw new Error("async boom"); }, delete: async () => {}, list: async () => [], clear: async () => {} };
    const s = withTimeout(odd, 10_000);
    await expect(s.get("jobs", "x")).rejects.toThrow("sync boom");
    await expect(s.put("jobs", "x", {})).rejects.toThrow("async boom");
    expect(vi.getTimerCount()).toBe(0);
  });
});
