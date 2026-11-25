import { CV_TICK_NEEDED } from "@/lib/privacy/messages";

// Step 9.3, stage 2.4 (docs/PLAN-9.3.md section 4, Option C): the tick before the first CV send in a tab. Plain functions, tested without a browser
// (tests/consent.test.ts), in the style of app/accessFetch.ts: the store is passed in.
//
//  - The tick is kept in the TAB's storage only (gone when the tab closes), every access inside try/catch. If the tab's storage is unavailable or
//    throws, the tick is kept in the page's memory until reload; the app still works.
//  - sendIfAcknowledged is the gate: the CV send runs only when the box is ticked; otherwise NOTHING runs and the message says what to do.
//    The person presses the button again after ticking (a real AI call is never repeated behind their back).
//  - Only the CV send is gated. The ad send is not (the ad box has an info line and a link, no tick).
//  - Nothing under app/demo, lib/demo or app/DemoEntry.tsx imports this file (tests/demoView.test.ts V7).

export type TabStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "career-copilot.consent";
const GIVEN = "1";
let memoryGiven = false; // only used when the tab's storage cannot be used

function tabStore(): TabStore | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null; // reading the global itself can throw when storage is blocked
  }
}

// ---- the kept tick ----------------------------------------------------------------------------------------------------------------------------

export function readConsent(store: TabStore | null = tabStore()): boolean {
  if (store) {
    try {
      return store.getItem(STORAGE_KEY) === GIVEN;
    } catch {
      /* blocked: use the memory copy */
    }
  }
  return memoryGiven;
}

export function giveConsent(store: TabStore | null = tabStore()): void {
  memoryGiven = true;
  if (store) {
    try {
      store.setItem(STORAGE_KEY, GIVEN);
    } catch {
      /* blocked: the memory copy stays */
    }
  }
  notify();
}

export function forgetConsent(store: TabStore | null = tabStore()): void {
  memoryGiven = false;
  if (store) {
    try {
      store.removeItem(STORAGE_KEY);
    } catch {
      /* blocked: nothing more to do */
    }
  }
  notify();
}

// ---- the gate ---------------------------------------------------------------------------------------------------------------------------------

export type Gated<T> = { sent: true; value: T } | { sent: false; message: string };

// Runs `run` only when the box is ticked. When it is not, `run` is never called and nothing leaves the page.
export async function sendIfAcknowledged<T>(run: () => Promise<T>, store: TabStore | null = tabStore()): Promise<Gated<T>> {
  if (!readConsent(store)) return { sent: false, message: CV_TICK_NEEDED };
  return { sent: true, value: await run() };
}

// ---- for the checkbox (read without an effect: React's external-store hook) -----------------------------------------------------------------------

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
export function subscribeConsent(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
export const getConsentSnapshot = (): boolean => readConsent();
// While the page is built on the server and while it is hydrated, the box is unticked; the stored state is read right after (no hydration mismatch).
export const getConsentServerSnapshot = (): boolean => false;
