import { StoreError, type KeyValueStore } from "./store";

// A timeout around every store call (6.1 part 3b). A browser database that never answers (it happens, notably in Safari)
// would leave the page stuck on "Saving..." for ever. A call that does not settle within `ms` rejects with
// StoreError("failed"); the timer is cleared as soon as the call settles; a real error (a StoreError with its own reason,
// or any other) is passed on unchanged. A timed-out WRITE may still land later: the page's words say "could not confirm",
// never "not saved". No node: import.
export function withTimeout(store: KeyValueStore, ms: number): KeyValueStore {
  const guard = <T>(call: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new StoreError("failed")), ms);
      let pending: Promise<T>;
      try {
        pending = call();
      } catch (e) {
        clearTimeout(timer);
        reject(e);
        return;
      }
      pending.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  return {
    get: (s, key) => guard(() => store.get(s, key)),
    put: (s, key, value) => guard(() => store.put(s, key, value)),
    delete: (s, key) => guard(() => store.delete(s, key)),
    list: (s) => guard(() => store.list(s)),
    clear: () => guard(() => store.clear()),
  };
}
