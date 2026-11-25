import {
  ACCESS_HEADER,
  CODE_FORGOTTEN_MESSAGE,
  CODE_KEPT_MESSAGE,
  EMPTY_CODE_MESSAGE,
  MAX_CODE_CHARS,
  NEED_CODE_MESSAGE,
  WRONG_CODE_MESSAGE,
} from "@/lib/ai/accessMessages";

// The page side of the access code (docs/PLAN-ACCESS-CODE.md, section 3). Plain functions, tested without a browser.
//
//  - The code is kept in the TAB's session storage only (gone when the tab closes), every access inside try/catch. Never a
//    store that outlives the tab: the saved profile and ads are kept on purpose, a code is a credential.
//  - If the tab's storage is unavailable or throws, the code is kept in the page's memory until reload; the app still works.
//  - ONE helper (postJson) sends the two requests: it adds the header, never touches the address, and turns a 401 into the
//    page's own message (the person presses the button again; a real AI call is never repeated behind their back).
//  - This file never imports the server-only access module (a guard test checks every client file).

export type AccessSource = "cv" | "ad";
type TabStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "career-copilot.access-code";
let memoryCode: string | null = null; // only used when the tab's storage cannot be used

function tabStore(): TabStore | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null; // reading the global itself can throw when storage is blocked
  }
}

// ---- the kept code ---------------------------------------------------------------------------------------------------

export function readAccessCode(store: TabStore | null = tabStore()): string | null {
  if (store) {
    try {
      return store.getItem(STORAGE_KEY);
    } catch {
      /* blocked: use the memory copy */
    }
  }
  return memoryCode;
}

// The typed code is trimmed and capped. Returns false (and keeps nothing) for an empty one.
export function keepAccessCode(code: string, store: TabStore | null = tabStore()): boolean {
  const clean = code.trim().slice(0, MAX_CODE_CHARS);
  if (clean === "") return false;
  memoryCode = clean;
  if (store) {
    try {
      store.setItem(STORAGE_KEY, clean);
    } catch {
      /* blocked: the memory copy stays */
    }
  }
  notify();
  return true;
}

export function forgetAccessCode(store: TabStore | null = tabStore()): void {
  memoryCode = null;
  if (store) {
    try {
      store.removeItem(STORAGE_KEY);
    } catch {
      /* blocked: nothing more to do */
    }
  }
  notify();
}

// "Delete everything saved on this device": the code is forgotten the moment the person confirms ("Yes, delete everything"),
// BEFORE the delete is attempted and whether or not the delete works. Never on Cancel (the Cancel handler does not call this).
// What the Access code box says is reset too (no source, no message), so it cannot keep saying "Access code kept in this tab" after the code is
// gone; forgetAccessCode then tells the boxes. The next send answers 401 and the box comes back with its need-code message. (The "Forget the
// code" link, forgetTypedCode, is a different path and keeps showing "The access code was forgotten.")
export function forgetCodeOnDeleteAll(store: TabStore | null = tabStore()): void {
  ui = { source: null, message: null };
  forgetAccessCode(store);
}

// ---- the request ----------------------------------------------------------------------------------------------------

export function accessHeaders(code: string | null): Record<string, string> {
  return code === null ? {} : { [ACCESS_HEADER]: code };
}

// A 401 after a send with no code asks for it; a 401 after a send WITH a code says it was not accepted.
export function accessAnswerMessage(sentCode: boolean): string {
  return sentCode ? WRONG_CODE_MESSAGE : NEED_CODE_MESSAGE;
}

export type PostResult = { kind: "answer"; res: Response } | { kind: "access"; message: string };

export async function postJson(
  url: string,
  body: unknown,
  opts: { source: AccessSource; fetch?: typeof fetch; store?: TabStore | null },
): Promise<PostResult> {
  const store = opts.store === undefined ? tabStore() : opts.store;
  const code = readAccessCode(store);
  const doFetch = opts.fetch ?? fetch;
  const res = await doFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...accessHeaders(code) },
    body: JSON.stringify(body),
  });
  if (res.status !== 401) return { kind: "answer", res };
  // A wrong code is removed at once, so a stale code is never sent again.
  if (code !== null) forgetAccessCode(store);
  const message = accessAnswerMessage(code !== null);
  showAccess(opts.source, message);
  return { kind: "access", message };
}

// ---- what the Access code box shows (read by app/AccessBox.tsx) ------------------------------------------------------

export type AccessUi = { source: AccessSource | null; message: string | null };
let ui: AccessUi = { source: null, message: null };
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
export const getAccessUi = (): AccessUi => ui;
export function showAccess(source: AccessSource, message: string | null) {
  ui = { source, message };
  notify();
}
export function subscribeAccess(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

// The three actions of the box (each also tells the box what to say).
export function submitTypedCode(source: AccessSource, typed: string): boolean {
  if (!keepAccessCode(typed)) {
    showAccess(source, EMPTY_CODE_MESSAGE);
    return false;
  }
  showAccess(source, CODE_KEPT_MESSAGE);
  return true;
}
export function forgetTypedCode(source: AccessSource): void {
  forgetAccessCode();
  showAccess(source, CODE_FORGOTTEN_MESSAGE);
}
