import type { StoreName } from "./types";

// The storage interface (docs/PLAN-6.1.md, section 4): five methods, no library. The IndexedDB adapter (part 3 of 6.1)
// implements it; `MemoryStore` is the double that every test uses. An adapter reports a problem by throwing a
// `StoreError` (anything else thrown counts as "failed"); the logic layer turns it into a result and never throws.

export type StoreProblem = "unavailable" | "quota" | "failed";

export class StoreError extends Error {
  reason: StoreProblem;
  constructor(reason: StoreProblem) {
    super(`storage: ${reason}`);
    this.name = "StoreError";
    this.reason = reason;
  }
}

export interface KeyValueStore {
  get(store: StoreName, key: string): Promise<unknown | undefined>;
  put(store: StoreName, key: string, value: unknown): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  list(store: StoreName): Promise<{ key: string; value: unknown }[]>;
  clear(): Promise<void>; // both stores
}

// In memory. Values are copied on the way in and out, like a real store, so a caller cannot change what is kept.
// `writes` counts put, delete and clear calls, so a test can prove that nothing was written without a click.
export class MemoryStore implements KeyValueStore {
  private data: Record<StoreName, Map<string, unknown>> = { profile: new Map(), jobs: new Map() };
  writes = 0;

  async get(store: StoreName, key: string): Promise<unknown | undefined> {
    const v = this.data[store].get(key);
    return v === undefined ? undefined : structuredClone(v);
  }

  async put(store: StoreName, key: string, value: unknown): Promise<void> {
    this.writes++;
    this.data[store].set(key, structuredClone(value));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    this.writes++;
    this.data[store].delete(key);
  }

  async list(store: StoreName): Promise<{ key: string; value: unknown }[]> {
    return [...this.data[store].entries()].map(([key, value]) => ({ key, value: structuredClone(value) }));
  }

  async clear(): Promise<void> {
    this.writes++;
    this.data.profile.clear();
    this.data.jobs.clear();
  }
}
