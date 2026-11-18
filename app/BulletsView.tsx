"use client";

import { useMemo, useState } from "react";
import type { BuiltProfile } from "@/lib/cv/profile";
import { MAX_PAIRS } from "@/lib/engine/bulletPairs";
import type { Job } from "@/lib/engine/types";
import {
  BULLETS_BUTTON_CLOSE,
  BULLETS_BUTTON_OPEN,
  BULLETS_BUTTON_WAITING,
  BULLETS_COPY,
  BULLETS_FAILED_LINE,
  BULLETS_INTRO,
  BULLETS_NONE_PASSED,
  BULLETS_NOTHING_TO_WRITE,
  BULLETS_TITLE,
  bulletsNotice,
  droppedLine,
  REPORT_COPIED,
  REPORT_COPY_FAILED,
} from "@/lib/saved/messages";
import { bulletCandidatesSafe, bulletsAsText, createBulletsRunner, type BulletsOutcome, type BulletsPhase } from "./bullets";
import { copyReport, shownCopyStatus, type CopyRecord, type CopyStatus } from "./roadmapReport";

// Step 8.3 (docs/PLAN-8.3.md v2, stage 4): the "CV bullets for this ad" block, drawn. The logic is in app/bullets.ts; every sentence comes from lib/saved/messages.ts or from
// the bullets themselves; nothing is written here. One click is one call, nothing is stored, the bullets are shown with the CV line they came from, and the person copies them
// only by pressing the button (the clipboard is written in `onCopy` below and nowhere else).

const quiet = "text-sm text-zinc-600 dark:text-zinc-400";
const button = "rounded border border-zinc-400 px-3 py-1 text-sm font-medium dark:border-zinc-600 disabled:opacity-40";

export function BulletsBody({
  phase,
  copyStatus,
  onPress,
  onHide,
  onCopy,
}: {
  phase: BulletsPhase;
  copyStatus: CopyStatus;
  onPress: () => void;
  onHide: () => void;
  onCopy: () => void;
}) {
  if (phase.kind === "waiting") {
    return (
      <div>
        <button className={button} disabled>
          {BULLETS_BUTTON_WAITING}
        </button>
      </div>
    );
  }
  if (phase.kind === "shown") {
    return (
      <section aria-label={BULLETS_TITLE} className="flex flex-col gap-2 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
        <p className="font-medium">{BULLETS_TITLE}</p>
        <div>
          <button className={button} onClick={onHide}>
            {BULLETS_BUTTON_CLOSE}
          </button>
        </div>
        <p className={quiet}>{BULLETS_INTRO}</p>
        <ul className="flex flex-col gap-2">
          {phase.bullets.map((b, i) => (
            <li key={`${i}-${b.pair}`} data-pair={b.pair} className="flex flex-col gap-1">
              <p className="break-words">{b.text}</p>
              <p data-source className={`break-words pl-4 ${quiet}`}>
                {b.source}
              </p>
            </li>
          ))}
        </ul>
        {phase.dropped > 0 && <p className={quiet}>{droppedLine(phase.dropped)}</p>}
        <div>
          <button className={button} onClick={onCopy}>
            {BULLETS_COPY}
          </button>
        </div>
        {copyStatus === "copied" && (
          <p role="status" className={quiet}>
            {REPORT_COPIED}
          </p>
        )}
        {copyStatus === "failed" && (
          <p role="status" className={quiet}>
            {REPORT_COPY_FAILED}
          </p>
        )}
      </section>
    );
  }
  // closed, after nothing passed, or after a failure: the closed block (a new press is a new, visible call)
  return (
    <div className="flex flex-col gap-2">
      {phase.kind === "none-passed" && <p className={quiet}>{BULLETS_NONE_PASSED}</p>}
      {phase.kind === "failed" && (
        <p role="alert" className={quiet}>
          {phase.line}
        </p>
      )}
      <div>
        <button className={button} onClick={onPress}>
          {BULLETS_BUTTON_OPEN}
        </button>
      </div>
      <p className={quiet}>{bulletsNotice(MAX_PAIRS)}</p>
    </div>
  );
}

const toPhase = (o: BulletsOutcome): BulletsPhase => (o.kind === "access" ? { kind: "idle" } : o);

// Mounted by the page (with a key that changes with the ad and the profile) whenever a profile is in use and an ad is on screen.
export default function BulletsView({ job, built }: { job: Job; built: BuiltProfile | null }) {
  const candidates = useMemo(() => bulletCandidatesSafe(job, built), [job, built]);
  const [runner] = useState(() => createBulletsRunner());
  const [phase, setPhase] = useState<BulletsPhase>({ kind: "idle" });
  const [record, setRecord] = useState<CopyRecord | null>(null);

  if (candidates.kind === "failed") {
    return (
      <p role="alert" className={quiet}>
        {BULLETS_FAILED_LINE}
      </p>
    );
  }
  if (candidates.pairs.length === 0) return <p className={quiet}>{BULLETS_NOTHING_TO_WRITE}</p>;
  const pairs = candidates.pairs;

  const text = phase.kind === "shown" ? bulletsAsText(phase.bullets) : "";

  // Click handler: one call, and none while one is waiting. A 401 has opened the access code box; the block goes back to its closed state.
  async function onPress() {
    const started = runner.press(pairs);
    if (started === null) return;
    setPhase({ kind: "waiting" });
    setRecord(null);
    setPhase(toPhase(await started));
  }

  // Click handler: the only place the clipboard is written. It never throws: copyReport answers "failed" for a refusal or a missing browser feature.
  async function onCopy() {
    const status = await copyReport(text, (t) => navigator.clipboard.writeText(t));
    setRecord({ status, text });
  }

  return (
    <BulletsBody
      phase={phase}
      copyStatus={shownCopyStatus(record, text)}
      onPress={onPress}
      onHide={() => {
        setPhase({ kind: "idle" });
        setRecord(null);
      }}
      onCopy={onCopy}
    />
  );
}
