"use client";

import Link from "next/link";
import { useState } from "react";
import AccessBox from "./AccessBox";
import { liveMessage, runCheck, type CheckOutcome } from "./runCheck";
import { checkBoxState, type CheckPlan, type Checked } from "@/lib/cv/checkPlan";
import { CHECK_BUTTON, CHECK_NO_ENTRIES, CHECK_NOT_CHECKED, CHECK_RUNNING } from "@/lib/cv/checkWording";
import { CHECK_INFO_LINE, CHECK_TICK_NEEDED, LINK_PRIVACY_NOTICE } from "@/lib/privacy/messages";

// EC-4b (docs/PLAN-EVERY-CV.md, EC-4 proposal): the button that checks the ad's open requirements against the CV lines the person confirmed. It is drawn
// inside the report (ReportView's `extra`). The tick is the CV box's own: there is no second tick here, and a click with no tick shows CHECK_TICK_NEEDED.
// Nothing is sent until the click; the click logic is app/runCheck.ts. The words are in lib/cv/checkWording.ts (DRAFT) and lib/privacy/messages.ts.
// The answers live in the PAGE's memory (app/page.tsx), never here, and never in storage.

export default function CheckBox({
  plan,
  checked,
  generation,
  hasProfile,
  onChecked,
}: {
  plan: CheckPlan;
  checked: Checked | null; // what the page holds from an earlier check (may be stale)
  generation: number; // the page's generation at draw time: a reply that comes back after a newer one is dropped by the page
  hasProfile: boolean;
  onChecked: (clickGeneration: number, outcome: CheckOutcome) => void; // EVERY outcome goes to the page, which decides what changes
}) {
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<string | null>(null); // the message of the last click when it did not end in answers

  const state = checkBoxState(plan, hasProfile);
  if (state === "hidden") return null;
  if (state === "no-entries") return <p className="text-sm text-zinc-600 dark:text-zinc-400">{CHECK_NO_ENTRIES}</p>;

  async function onCheck() {
    const clickGeneration = generation;
    setLast(null); // a click clears the last message first
    setRunning(true);
    const outcome = await runCheck(plan);
    setRunning(false);
    if (outcome.kind === "tick") setLast(CHECK_TICK_NEEDED);
    else if (outcome.kind === "failed") setLast(outcome.message);
    onChecked(clickGeneration, outcome);
  }

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {CHECK_INFO_LINE}{" "}
        <Link href="/privacy" target="_blank" rel="noopener noreferrer" prefetch={false} className="underline">
          {LINK_PRIVACY_NOTICE}
        </Link>
      </p>
      <div>
        <button
          onClick={onCheck}
          disabled={running}
          className="rounded border border-zinc-400 px-4 py-2 text-sm font-medium dark:border-zinc-600 disabled:opacity-40"
        >
          {running ? CHECK_RUNNING : CHECK_BUTTON(plan.requirements.length)}
        </button>
      </div>
      {plan.notChecked > 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">{CHECK_NOT_CHECKED(plan.notChecked)}</p>}
      <p aria-live="polite" className="text-sm">
        {liveMessage(last, checked, plan)}
      </p>
      <AccessBox source="check" />
    </section>
  );
}
