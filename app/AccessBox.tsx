"use client";

import { useState, useSyncExternalStore } from "react";
import {
  forgetTypedCode,
  getAccessUi,
  readAccessCode,
  submitTypedCode,
  subscribeAccess,
  type AccessSource,
} from "./accessFetch";
import { ACCESS_LABEL, FORGET_CODE_LABEL, MAX_CODE_CHARS, USE_CODE_LABEL } from "@/lib/ai/accessMessages";

// The small "Access code" box (docs/PLAN-ACCESS-CODE.md, section 3). It appears next to the button that got a 401 (source
// "cv" or "ad"), and the ad box also shows it while a code is kept, so "Forget the code" is always reachable. The typed
// code goes to app/accessFetch.ts (tab storage); nothing is sent until the person presses the real button again.
const button = "rounded border border-zinc-400 px-3 py-1 text-sm font-medium dark:border-zinc-600 disabled:opacity-40";
const NO_CODE = () => null;

export default function AccessBox({ source }: { source: AccessSource }) {
  const ui = useSyncExternalStore(subscribeAccess, getAccessUi, getAccessUi);
  const kept = useSyncExternalStore(subscribeAccess, () => readAccessCode(), NO_CODE);
  const [typed, setTyped] = useState("");
  const shown = ui.source === source || (source === "ad" && kept !== null);
  if (!shown) return null;
  const id = `access-code-${source}`;

  // Click handler: keeps the typed code in this tab, and empties the field.
  function onUse() {
    if (submitTypedCode(source, typed)) setTyped("");
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-amber-500 p-3 text-sm">
      {ui.source === source && ui.message && <p role="alert">{ui.message}</p>}
      <div className="flex flex-wrap items-end gap-2">
        <label htmlFor={id} className="font-medium">
          {ACCESS_LABEL}
        </label>
        <input
          id={id}
          type="password"
          autoComplete="off"
          maxLength={MAX_CODE_CHARS}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="rounded border border-zinc-400 bg-transparent px-2 py-1 dark:border-zinc-600"
        />
        <button className={button} onClick={onUse}>
          {USE_CODE_LABEL}
        </button>
        {kept !== null && (
          <button className="text-sm underline" onClick={() => forgetTypedCode(source)}>
            {FORGET_CODE_LABEL}
          </button>
        )}
      </div>
    </div>
  );
}
