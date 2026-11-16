"use client";

import { useCallback, useEffect, useState } from "react";
import { currentStamps } from "@/lib/saved/currentStamps";
import { createIdbStore } from "@/lib/saved/idbStore";
import { savedMessage } from "@/lib/saved/messages";
import { loadProfile, type SavedContext } from "@/lib/saved/saved";
import { profileOfferState, savingAvailable, type ProfileOfferState } from "@/lib/saved/ui";
import type { SavedProfile } from "@/lib/saved/types";
import { withTimeout } from "@/lib/saved/withTimeout";

// The saved-on-this-device state of the page (6.1 part 3b, profile only). The decisions are plain functions in lib/saved
// (messages.ts, ui.ts), tested; this hook only wires them.
//
// What runs on its own, in the effect below, is READ-ONLY: currentStamps() and loadProfile(). Opening the browser database
// for the read can create it EMPTY; nothing is written. saveProfile, deleteProfile and deleteAll are called only from click
// handlers in app/SavedControls.tsx, never from an effect and never while rendering.

// 10 seconds: a browser database that never answers must not leave the page on "Saving..." for ever. Creating the store
// touches nothing (the adapter opens the database on its first call).
const pageStore = withTimeout(createIdbStore(), 10_000);

export type SavedState =
  | { phase: "checking" }
  | { phase: "ready"; ctx: SavedContext | null; offer: ProfileOfferState; record: SavedProfile | null; available: boolean };

export function useSaved() {
  const [state, setState] = useState<SavedState>({ phase: "checking" });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stamps = await currentStamps();
      if (!alive) return;
      if (!stamps.ok) {
        setState({ phase: "ready", ctx: null, offer: { kind: "unavailable", message: savedMessage("unavailable") }, record: null, available: false });
        return;
      }
      const ctx: SavedContext = { store: pageStore, stamps: stamps.stamps };
      const loaded = await loadProfile(ctx); // a READ
      if (!alive) return;
      const offer = profileOfferState(loaded);
      setState({ phase: "ready", ctx, offer, record: loaded.ok ? loaded.saved : null, available: savingAvailable({ ok: true }, offer) });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // After a click changed what is saved: nothing is offered any more until the next visit.
  const clearOffer = useCallback(() => {
    setState((s) => (s.phase === "ready" ? { ...s, offer: { kind: "nothing" }, record: null } : s));
  }, []);

  return { state, status, setStatus, clearOffer };
}

export type Saved = ReturnType<typeof useSaved>;
