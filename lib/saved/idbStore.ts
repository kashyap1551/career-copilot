import { StoreError, type KeyValueStore, type StoreProblem } from "./store";
import type { StoreName } from "./types";

// The IndexedDB adapter (docs/PLAN-6.1.md, sections 4 and 6; part 3a of the build order). Thin on purpose: it only opens,
// reads and writes by key; every rule is in the logic layer above, which is tested on the in-memory double. The success
// path here (a real database) can only be checked in a real browser: by reading this file and by the manual checklist.
//
// Rules this file keeps:
//  - NOTHING touches `indexedDB` at import time. Next renders pages on the server first, where `indexedDB` does not exist;
//    every access is inside a function. A missing `indexedDB` is StoreError("unavailable").
//  - ONE connection, opened on first use; the open PROMISE is cached; a FAILED open is forgotten so a later call can try
//    again; `onversionchange` (another tab upgrades the database) and `onclose` close and forget the connection.
//  - A WRITE (put, delete, clear) is done only when the TRANSACTION completes (`oncomplete`), never when the request
//    succeeds. A transaction is a group of operations that all happen or none do; `oncomplete` is the browser saying the
//    group is safely stored, while a request's `onsuccess` only says the operation was queued, and the transaction can
//    still abort afterwards (quota, a closing page). `onabort` and `onerror` reject. A READ may resolve on `onsuccess`.
//  - Every rejection is a StoreError (the logic layer turns it into { ok: false, reason }). No node: imports.

const DB_NAME = "career-copilot";
const DB_VERSION = 1;

// One object store per StoreName, with out-of-line keys (the key is passed to put, as in MemoryStore). IndexedDB stores
// structured clones, so values go in as they are: no JSON. The Exhaustive type makes tsc fail if StoreName gains a member.
const STORE_NAMES = ["profile", "jobs"] as const satisfies readonly StoreName[];
export type StoreNamesAreExhaustive = [Exclude<StoreName, (typeof STORE_NAMES)[number]>] extends [never] ? true : never;

// The reason for an error. Pure, so it is tested without a browser.
//  quota        QuotaExceededError (by name), or code 22 (the standard code) or 1014 (older Firefox)
//  unavailable  SecurityError, InvalidStateError (storage blocked, or the connection is closing)
//  a StoreError keeps its own reason; anything else (DataCloneError, an abort, undefined, a string...) is "failed".
export function mapIdbError(err: unknown): StoreProblem {
  if (err instanceof StoreError) return err.reason;
  const e = (typeof err === "object" && err !== null ? err : {}) as { name?: unknown; code?: unknown };
  const name = typeof e.name === "string" ? e.name : "";
  const code = typeof e.code === "number" ? e.code : undefined;
  if (name === "QuotaExceededError" || code === 22 || code === 1014) return "quota";
  if (name === "SecurityError" || name === "InvalidStateError") return "unavailable";
  return "failed";
}

const fail = (e: unknown) => new StoreError(mapIdbError(e));

// ---- the connection --------------------------------------------------------------------------------------------------

let opening: Promise<IDBDatabase> | null = null;

function connect(): Promise<IDBDatabase> {
  if (opening !== null) return opening;
  const attempt = new Promise<IDBDatabase>((resolve, reject) => {
    let factory: IDBFactory | undefined;
    try {
      factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB; // reading it can itself throw in some browsers
    } catch {
      factory = undefined;
    }
    if (!factory) {
      reject(new StoreError("unavailable"));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(fail(e));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORE_NAMES) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    request.onsuccess = () => {
      const db = request.result;
      const forget = () => {
        if (opening === attempt) opening = null;
      };
      db.onversionchange = () => {
        db.close();
        forget();
      };
      db.onclose = forget;
      resolve(db);
    };
    request.onerror = () => reject(fail(request.error));
    request.onblocked = () => reject(new StoreError("failed")); // an older connection in another tab will not let go
  });
  opening = attempt;
  // A failed open is forgotten, so the next call tries again instead of reusing a dead promise.
  attempt.catch(() => {
    if (opening === attempt) opening = null;
  });
  return attempt;
}

// ---- reads (resolve on the request's onsuccess) ----------------------------------------------------------------------

async function read<T>(store: StoreName, work: (os: IDBObjectStore, done: (value: T) => void, bad: (e: unknown) => void) => void): Promise<T> {
  const db = await connect();
  return new Promise<T>((resolve, reject) => {
    try {
      const os = db.transaction(store, "readonly").objectStore(store);
      work(os, resolve, (e) => reject(fail(e)));
    } catch (e) {
      reject(fail(e));
    }
  });
}

// ---- writes (resolve ONLY when the transaction completes) ------------------------------------------------------------

async function write(stores: StoreName | StoreName[], work: (t: IDBTransaction) => void): Promise<void> {
  const db = await connect();
  return new Promise<void>((resolve, reject) => {
    let t: IDBTransaction;
    try {
      t = db.transaction(stores, "readwrite");
      // Rejections come from the transaction's own events. A synchronous throw (a DataCloneError from put, a closing
      // connection) is caught here.
      t.oncomplete = () => resolve();
      t.onabort = () => reject(fail(t.error));
      t.onerror = (event) => reject(fail((event.target as IDBRequest | null)?.error ?? t.error));
      work(t);
    } catch (e) {
      reject(fail(e));
    }
  });
}

// ---- the store -------------------------------------------------------------------------------------------------------

export function createIdbStore(): KeyValueStore {
  return {
    // A missing key is `undefined` (never null), as in MemoryStore.
    get(store, key) {
      return read<unknown | undefined>(store, (os, done, bad) => {
        const request = os.get(key);
        request.onsuccess = () => done(request.result === undefined ? undefined : request.result);
        request.onerror = () => bad(request.error);
      });
    },

    put(store, key, value) {
      return write(store, (t) => {
        t.objectStore(store).put(value, key);
      });
    },

    // Deleting a key that is not there is not an error (IndexedDB agrees).
    delete(store, key) {
      return write(store, (t) => {
        t.objectStore(store).delete(key);
      });
    },

    // Every record of one store as { key, value }, in KEY order (a cursor). MemoryStore lists in insertion order; the logic
    // layer sorts what it lists, so callers do not depend on the order.
    list(store) {
      return read<{ key: string; value: unknown }[]>(store, (os, done, bad) => {
        const out: { key: string; value: unknown }[] = [];
        const request = os.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor === null) {
            done(out);
            return;
          }
          out.push({ key: String(cursor.key), value: cursor.value });
          cursor.continue();
        };
        request.onerror = () => bad(request.error);
      });
    },

    // Both object stores, in ONE transaction: all of it happens or none.
    clear() {
      return write([...STORE_NAMES], (t) => {
        for (const name of STORE_NAMES) t.objectStore(name).clear();
      });
    },
  };
}
