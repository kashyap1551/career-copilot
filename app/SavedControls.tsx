"use client";

import { useMemo, useState } from "react";
import type { BuiltProfile } from "@/lib/cv/profile";
import { KINDS, KIND_WORDS } from "@/lib/cv/profile";
import { skills } from "@/fixtures/skills";
import { forgetCodeOnDeleteAll } from "./accessFetch";
import { forgetConsent } from "./consent";
import { DELETE_ALL_DONE, TAB_ONLY_CONFIRM, TAB_ONLY_DONE, deleteAllMode, deleteAllShows } from "./deleteAll";
import { deleteStatus, SAVE_NOTICE, saveStatus } from "@/lib/saved/messages";
import { summarizeProfile } from "@/lib/saved/profile";
import type { SavedReading } from "@/lib/saved/types";
import { deleteAll, deleteJob, deleteProfile, listJobs, saveJob, saveProfile } from "@/lib/saved/saved";
import { adStatusKey, canSaveAd, listNotice, profileKey, statusVisible } from "@/lib/saved/ui";
import type { ExtractedAd } from "@/lib/schemas/job";
import type { SavedProfile } from "@/lib/saved/types";
import type { Skill } from "@/lib/engine/types";
import { openedReadings, rankedAdRows } from "./savedAdRows";
import { NO_ADS, type Saved } from "./useSaved";

// 6.1 part 3b: the profile controls on the page, in the style of the existing page. Display and wiring only: every decision
// (the words, what is offered, whether saving is available) is a plain function in lib/saved, with tests.
// saveProfile, saveJob, deleteProfile, deleteJob and deleteAll are called ONLY from the click handlers below (onSave,
// onSaveAd, onDeleteProfile, onDeleteAd, onDeleteAll): never from an effect, never while rendering. Nothing is saved
// without a click. (Opening a saved ad, in app/page.tsx, calls no save function at all.)

const button = "rounded border border-zinc-400 px-3 py-1 text-sm font-medium dark:border-zinc-600 disabled:opacity-40";
const quiet = "text-sm text-zinc-600 dark:text-zinc-400";

// The status line (one place for all messages about saving). A message about a profile is shown only while that same
// profile is on screen (`currentKey`; lib/saved/ui.ts, statusVisible): "Saved on this device." disappears when the person
// changes the confirm box, because the saved copy is then the OLD version. Decided at draw time: no effect, no write.
export function SavedStatus({ saved, currentKey }: { saved: Saved; currentKey: string | null }) {
  return statusVisible(saved.status, currentKey) ? (
    <p role="status" className={quiet}>
      {saved.status?.text}
    </p>
  ) : null;
}

// What is saved, read-only: exactly what is stored (decision 4 of the plan: a saved profile is used and deleted, not edited).
function SavedSummary({ record }: { record: SavedProfile }) {
  const s = summarizeProfile(record, skills);
  const c = s.constraints;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">Your saved profile (read-only)</p>
      <ul className="list-disc pl-5">
        {s.have.map((h) => (
          <li key={h.skillId}>
            <span className="font-medium">{h.name}</span>{" "}
            <span className={quiet}>
              {!h.known
                ? "(no longer in our skill list, so it is not used)"
                : h.line !== null
                  ? `(CV line ${h.line}: "${h.text}")`
                  : "(added by hand, no CV line, so it never counts as met)"}
            </span>
          </li>
        ))}
        {s.inProgress.map((p) => (
          <li key={p.skillId}>
            <span className="font-medium">{p.name}</span>{" "}
            <span className={quiet}>({p.known ? `learning, expected ${p.date}` : "no longer in our skill list"})</span>
          </li>
        ))}
      </ul>
      <p className={quiet}>
        Constraints set:{" "}
        {KINDS.filter((k) => s.set[k]).length === 0
          ? "none"
          : KINDS.filter((k) => s.set[k])
              .map((k) => {
                if (k === "language") return `${KIND_WORDS[k]} (${c.languages.map((l) => `${l.code} ${l.level}`).join(", ")})`;
                if (k === "location") return `${KIND_WORDS[k]} (${c.locations.join(", ")})`;
                if (k === "workMode") return `${KIND_WORDS[k]} (${c.workModes.join(", ")})`;
                if (k === "years") return `${KIND_WORDS[k]} (${c.years})`;
                return `${KIND_WORDS[k]} (${c.availableFrom})`;
              })
              .join("; ")}
      </p>
    </div>
  );
}

// Above the CV box: what was found on this device, and what the person can do with it.
export function SavedOffer({
  saved,
  usingSaved,
  onUse,
  onReadCvAgain,
  onForget,
}: {
  saved: Saved;
  usingSaved: SavedProfile | null;
  onUse: (record: SavedProfile) => void;
  onReadCvAgain: () => void;
  onForget: () => void;
}) {
  const { state, setStatus, clearOffer } = saved;
  const [dismissed, setDismissed] = useState(false);
  if (state.phase !== "ready") return null;
  const { offer, ctx, record } = state;

  // Click handler: delete ONLY the saved profile (also one that cannot be read or comes from a newer app).
  async function onDeleteProfile() {
    if (!ctx) return;
    setStatus("Deleting…");
    const result = await deleteProfile(ctx);
    setStatus(deleteStatus(result, "profile"));
    if (result.ok) {
      clearOffer();
      onForget();
    }
  }

  if (offer.kind === "unavailable") return <p className={quiet}>{offer.message}</p>;

  if (offer.kind === "problem") {
    return (
      <div className="flex flex-col gap-2 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
        <p role="alert">{offer.message}</p>
        <div>
          <button className={button} onClick={onDeleteProfile}>
            Delete it
          </button>
        </div>
      </div>
    );
  }

  if (usingSaved) {
    return (
      <div className="flex flex-col gap-2 rounded border border-zinc-300 p-3 dark:border-zinc-700">
        <SavedSummary record={usingSaved} />
        <div className="flex gap-2">
          <button className={button} onClick={onDeleteProfile}>
            Delete this profile
          </button>
          <button className={button} onClick={() => { onReadCvAgain(); setDismissed(true); }}>
            Read a CV again
          </button>
        </div>
      </div>
    );
  }

  if (offer.kind === "offer" && record && !dismissed) {
    return (
      <div className="flex flex-col gap-2 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
        <p className="font-medium">{offer.headline}</p>
        <p className={quiet}>{offer.details}</p>
        <div className="flex gap-2">
          {/* Nothing is used until this click. It only reads: it writes nothing. */}
          <button className={button} onClick={() => onUse(record)}>
            Use this profile
          </button>
          <button className={button} onClick={onDeleteProfile}>
            Delete this profile
          </button>
          <button className={button} onClick={() => setDismissed(true)}>
            Read a CV again
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// On the CV confirm screen, after the profile is built.
export function SaveProfileButton({ saved, built }: { saved: Saved; built: BuiltProfile }) {
  const { state, setStatus, clearOffer } = saved;
  const [busy, setBusy] = useState(false);
  if (state.phase !== "ready" || !state.available || !state.ctx) return null;
  const ctx = state.ctx;
  const key = profileKey(built); // the profile as it is NOW: the message below is about this one

  // Click handler: the ONLY place a profile is saved.
  async function onSave() {
    setBusy(true);
    setStatus("Saving…", key);
    const result = await saveProfile(ctx, built);
    setStatus(saveStatus(result), key);
    if (result.ok) clearOffer(); // what is on the page now is what is saved: no older offer
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <div>
        <button className={button} disabled={busy} onClick={onSave}>
          Save on this device
        </button>
      </div>
      <p className={quiet}>{SAVE_NOTICE}</p>
    </div>
  );
}

// Delete everything saved on this device: the profile and all saved ads (deleteAll clears both stores), and the access code and the tick kept in
// this tab. Shown whenever the page has finished checking (app/deleteAll.ts, deleteAllShows); when saving is not available it only forgets what the
// tab keeps and never calls deleteAll (deleteAllMode).
export function SavedDeleteAll({ saved, onForget, onWipe }: { saved: Saved; onForget: () => void; onWipe: () => void }) {
  const { state, setStatus, clearOffer } = saved;
  const [confirming, setConfirming] = useState(false);
  if (!deleteAllShows(state) || state.phase !== "ready") return null;
  const ctx = state.ctx;
  const tabOnly = deleteAllMode(state) === "tab-only";

  // Click handler (the second step, "Yes, delete everything"): the ONLY place everything is deleted.
  async function onDeleteAll() {
    setConfirming(false);
    forgetCodeOnDeleteAll(); // the access code kept in this tab goes first, whether or not the delete works (PLAN-ACCESS-CODE section 3)
    forgetConsent(); // so does the tick kept in this tab (PLAN-9.3 section 5)
    onWipe(); // and the answers of a check held in the page's memory (EC-4b), whether or not the delete works: no await before this line
    if (tabOnly || !ctx) {
      setStatus(TAB_ONLY_DONE); // saving is not available: nothing saved to delete, so deleteAll is not called
      return;
    }
    setStatus("Deleting…");
    const result = await deleteAll(ctx);
    setStatus(result.ok ? DELETE_ALL_DONE : deleteStatus(result, "everything"));
    if (result.ok) {
      clearOffer();
      saved.setAds(NO_ADS); // the list is empty now
      saved.setAdStatus(null);
      onForget();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {confirming ? (
        <>
          {tabOnly ? <span>{TAB_ONLY_CONFIRM}</span> : <span>Delete the saved profile and everything else saved on this device?</span>}
          <button className={button} onClick={onDeleteAll}>
            Yes, delete everything
          </button>
          <button className={button} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </>
      ) : (
        <button className={button} onClick={() => setConfirming(true)}>
          Delete everything saved on this device
        </button>
      )}
    </div>
  );
}

// ---- saved ads (6.1 part 3c) -------------------------------------------------------------------------------------------

// The one status line about saved ads (saving, opening, deleting one). A message about an ad is shown only while that ad's
// text is on screen (`adKey`); a message about the list (an ad deleted) has no key and is always shown.
export function AdStatus({ saved, adKey }: { saved: Saved; adKey: string | null }) {
  return statusVisible(saved.adStatus, [adKey]) ? (
    <p role="status" className={quiet}>
      {saved.adStatus?.text}
    </p>
  ) : null;
}

// After an ad was read by the AI: "Save this ad" with the notice. The only place an ad is saved.
export function SaveAdButton({
  saved,
  adText,
  extraction,
  reading,
}: {
  saved: Saved;
  adText: string;
  extraction: ExtractedAd | null;
  reading: SavedReading;
}) {
  const { state, setAdStatus, setAds } = saved;
  const [busy, setBusy] = useState(false);
  if (state.phase !== "ready" || !state.ctx || !canSaveAd(state.available, true)) return null;
  const ctx = state.ctx;

  // Click handler: the ONLY place an ad is saved. One record per ad text: saving the same text again replaces it.
  async function onSaveAd() {
    const key = adStatusKey(adText);
    setBusy(true);
    setAdStatus("Saving…", key);
    const result = await saveJob(ctx, { adText, extraction, reading });
    setAdStatus(saveStatus(result), key);
    if (result.ok) {
      const listed = await listJobs(ctx); // the list is refreshed after the click
      if (listed.ok) setAds({ list: listed.jobs, corrupted: listed.corrupted, newer: listed.newer });
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <div>
        <button className={button} disabled={busy} onClick={onSaveAd}>
          Save this ad
        </button>
      </div>
      <p className={quiet}>{SAVE_NOTICE}</p>
    </div>
  );
}

// "Saved ads": shown when there is at least one saved ad or something to say about the list. Each row: the label, the date,
// and (6.2, docs/PLAN-6.2.md) the fit level of the profile IN USE: the very profile the report uses, passed in as `profile`,
// never read from storage here. The level text is the report's own label (app/savedAdRows.ts), never written here.
// "Open" and "Delete". No cap on the number of ads.
export function SavedAdsList({
  saved,
  onOpen,
  profile,
  skills,
  readOnly = false,
}: {
  saved: Saved;
  onOpen: (id: string) => void;
  profile: BuiltProfile | null;
  skills: Skill[];
  readOnly?: boolean; // the demo list (step 9.1): no Delete button
}) {
  const { state, setAdStatus, setAds } = saved;
  const adList = state.phase === "ready" ? state.ads.list : NO_ADS.list;
  const stamps = state.phase === "ready" && state.ctx ? state.ctx.stamps : null;
  // Step 1 depends on the ads and the stamps only; step 2 also on the profile in use (so the rows follow the confirm screen).
  const opened = useMemo(() => (stamps ? openedReadings(adList, { stamps, skills }) : []), [adList, stamps, skills]);
  const view = useMemo(() => rankedAdRows(opened, profile, skills), [opened, profile, skills]);
  if (state.phase !== "ready" || !state.available || !state.ctx) return null;
  const ctx = state.ctx;
  const ads = state.ads;
  const notice = listNotice(ads.corrupted, ads.newer);
  if (view.rows.length === 0 && notice === null) return null;

  // Click handler: delete ONE saved ad; the list is updated from the result.
  async function onDeleteAd(id: string) {
    const result = await deleteJob(ctx, id);
    setAdStatus(deleteStatus(result, "ad"));
    if (result.ok) setAds({ ...ads, list: ads.list.filter((j) => j.id !== id) });
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
      <p className="font-medium">Saved ads</p>
      {view.note && <p className={quiet}>{view.note}</p>}
      {notice && (
        <ul className={`list-disc pl-5 ${quiet}`}>
          {notice.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <ul className="flex flex-col gap-2">
        {view.rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col">
              <span>
                {r.titleLine} <span className={quiet}>({r.date})</span>
              </span>
              {r.levelLine && <span>{r.levelLine}</span>}
              {r.namedReason && <span className={quiet}>{r.namedReason}</span>}
              {r.oldReadingLine && <span className={quiet}>{r.oldReadingLine}</span>}
              {r.errorLine && <span className={quiet}>{r.errorLine}</span>}
            </div>
            <button className={button} onClick={() => onOpen(r.id)}>
              Open
            </button>
            {!readOnly && (
              <button className={button} onClick={() => onDeleteAd(r.id)}>
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
