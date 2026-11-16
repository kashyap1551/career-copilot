"use client";

import { useCallback, useEffect, useState } from "react";
import { currentStamps } from "@/lib/saved/currentStamps";
import { createIdbStore } from "@/lib/saved/idbStore";
import { savedMessage } from "@/lib/saved/messages";
import { listJobs, loadProfile, type SavedContext } from "@/lib/saved/saved";
import { profileOfferState, savingAvailable, type ProfileOfferState, type StatusLine } from "@/lib/saved/ui";
import type { SavedJob, SavedProfile } from "@/lib/saved/types";
import { withTimeout } from "@/lib/saved/withTimeout";

// The saved-on-this-device state of the page (6.1, profile and ads). The decisions are plain functions in lib/saved
// (messages.ts, ui.ts), tested; this hook only wires them.
//
// What runs on its own, in the effect below, is READ-ONLY: currentStamps(), loadProfile() and listJobs(). Opening the
// browser database for the read can create it EMPTY; nothing is written. saveProfile, saveJob, deleteProfile, deleteJob and
// deleteAll are called only from click handlers (app/SavedControls.tsx and app/page.tsx), never from an effect and never
// while rendering.

// 10 seconds: a browser database that never answers must not leave the page on "Saving..." for ever. Creating the store
// touches nothing (the adapter opens the database on its first call).
const pageStore = withTimeout(createIdbStore(), 10_000);

export type SavedAds = { list: SavedJob[]; corrupted: number; newer: number };
const NO_ADS: SavedAds = { list: [], corrupted: 0, newer: 0 };

export type SavedState =
  | { phase: "checking" }
  | { phase: "ready"; ctx: SavedContext | null; offer: ProfileOfferState; record: SavedProfile | null; available: boolean; ads: SavedAds };

export function useSaved() {
  const [state, setState] = useState<SavedState>({ phase: "checking" });
  // Messages about saving, each tied to what it spoke about (lib/saved/ui.ts: statusVisible). `status` is about the profile
  // (or about everything); `adStatus` is about saved ads.
  const [status, setStatusLine] = useState<StatusLine | null>(null);
  const [adStatus, setAdStatusLine] = useState<StatusLine | null>(null);
  const setStatus = useCallback((text: string | null, key: string | null = null) => setStatusLine(text === null ? null : { text, key }), []);
  const setAdStatus = useCallback((text: string | null, key: string | null = null) => setAdStatusLine(text === null ? null : { text, key }), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const stamps = await currentStamps();
      if (!alive) return;
      if (!stamps.ok) {
        setState({ phase: "ready", ctx: null, offer: { kind: "unavailable", message: savedMessage("unavailable") }, record: null, available: false, ads: NO_ADS });
        return;
      }
      const ctx: SavedContext = { store: pageStore, stamps: stamps.stamps };
      const loaded = await loadProfile(ctx); // a READ
      const listed = await listJobs(ctx); // a READ
      if (!alive) return;
      const offer = profileOfferState(loaded);
      setState({
        phase: "ready",
        ctx,
        offer,
        record: loaded.ok ? loaded.saved : null,
        available: savingAvailable({ ok: true }, offer),
        ads: listed.ok ? { list: listed.jobs, corrupted: listed.corrupted, newer: listed.newer } : NO_ADS,
      });
    })();
    return () => {
      alive = false;
    };
  }, []);

  // After a click changed what is saved: nothing is offered any more until the next visit.
  const clearOffer = useCallback(() => {
    setState((s) => (s.phase === "ready" ? { ...s, offer: { kind: "nothing" }, record: null } : s));
  }, []);

  // The list of saved ads, set from the RESULT of a click (a save, a delete, delete everything).
  const setAds = useCallback((ads: SavedAds) => {
    setState((s) => (s.phase === "ready" ? { ...s, ads } : s));
  }, []);

  return { state, status, setStatus, adStatus, setAdStatus, clearOffer, setAds };
}

export type Saved = ReturnType<typeof useSaved>;
export { NO_ADS };
