"use client";

import { useState } from "react";
import type { BuiltProfile } from "@/lib/cv/profile";
import { KINDS, KIND_WORDS } from "@/lib/cv/profile";
import { skills } from "@/fixtures/skills";
import { deleteStatus, SAVE_NOTICE, saveStatus } from "@/lib/saved/messages";
import { summarizeProfile } from "@/lib/saved/profile";
import { deleteAll, deleteProfile, saveProfile } from "@/lib/saved/saved";
import type { SavedProfile } from "@/lib/saved/types";
import type { Saved } from "./useSaved";

// 6.1 part 3b: the profile controls on the page, in the style of the existing page. Display and wiring only: every decision
// (the words, what is offered, whether saving is available) is a plain function in lib/saved, with tests.
// saveProfile, deleteProfile and deleteAll are called ONLY from the click handlers below (onSave, onDeleteProfile,
// onDeleteAll): never from an effect, never while rendering. A profile is never saved without the click.

const button = "rounded border border-zinc-400 px-3 py-1 text-sm font-medium dark:border-zinc-600 disabled:opacity-40";
const quiet = "text-sm text-zinc-600 dark:text-zinc-400";

// The status line (one place for all messages about saving).
export function SavedStatus({ saved }: { saved: Saved }) {
  return saved.status ? (
    <p role="status" className={quiet}>
      {saved.status}
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

  // Click handler: the ONLY place a profile is saved.
  async function onSave() {
    setBusy(true);
    setStatus("Saving…");
    const result = await saveProfile(ctx, built);
    setStatus(saveStatus(result));
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

// Whenever saving is available: delete everything (the profile now; the saved jobs when 3c adds them).
export function SavedDeleteAll({ saved, onForget }: { saved: Saved; onForget: () => void }) {
  const { state, setStatus, clearOffer } = saved;
  const [confirming, setConfirming] = useState(false);
  if (state.phase !== "ready" || !state.available || !state.ctx) return null;
  const ctx = state.ctx;

  // Click handler (the second step, "Yes, delete everything"): the ONLY place everything is deleted.
  async function onDeleteAll() {
    setConfirming(false);
    setStatus("Deleting…");
    const result = await deleteAll(ctx);
    setStatus(deleteStatus(result, "everything"));
    if (result.ok) {
      clearOffer();
      onForget();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {confirming ? (
        <>
          <span>Delete the saved profile and everything else saved on this device?</span>
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
