"use client";

import { useEffect, useMemo, useState } from "react";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type ConfirmState } from "@/lib/cv/profile";
import { DEMO_FAILED, DEMO_LOADING, DEMO_PREPARED, DEMO_TRY } from "@/lib/demo/messages";
import { startDemo, type DemoState } from "@/lib/demo/start";
import { openJob } from "@/lib/saved/openJob";
import { loadJob } from "@/lib/saved/saved";
import type { SavedReading } from "@/lib/saved/types";
import { openView } from "@/lib/saved/ui";
import ConfirmBox from "../ConfirmBox";
import { reportNote } from "../reportText";
import ReportView from "../ReportView";
import { roadmapAds, roadmapBoxSafe } from "../roadmap";
import RoadmapView from "../RoadmapView";
import { openedReadings, reportFor } from "../savedAdRows";
import { SavedAdsList } from "../SavedControls";
import type { Saved } from "../useSaved";

// Step 9.1 (docs/PLAN-9.1.md): the demo page. An invented person, an invented CV and ten invented ads, all prepared in advance
// (lib/demo/data.ts) and worked out in this tab's memory by lib/demo/start.ts. This file only wires the page's own pieces
// together, the way app/page.tsx does: `buildProfile` for the ticked skills, `openedReadings` and `reportFor` for the fit
// levels, `roadmapAds` and `roadmapBoxSafe` for the "What to learn" box, `loadJob` and `openJob` to open an ad. It counts
// nothing and writes no label of its own. There is no text box, no button that reads, no save and no access code here.

const CITY = "Berlin";
const quiet = "text-sm text-zinc-600 dark:text-zinc-400";

export default function DemoPage() {
  const [demo, setDemo] = useState<DemoState | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [shown, setShown] = useState<SavedReading | null>(null);

  useEffect(() => {
    let alive = true;
    startDemo().then(
      (d) => {
        if (!alive) return;
        setDemo(d);
        setConfirm({ ...initialConfirm(d.cv.result.skills), cities: CITY });
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const built = useMemo(
    () => (demo && confirm ? buildProfile(demo.cv.lines, demo.cv.result.skills, confirm, skills) : null),
    [demo, confirm],
  );

  // The same object the real page's list expects. It only ever reads from this tab's own memory store; the setters do nothing.
  const saved: Saved | null = useMemo(
    () =>
      demo
        ? {
            state: {
              phase: "ready",
              ctx: demo.ctx,
              offer: { kind: "nothing" },
              record: null,
              available: true,
              ads: { list: demo.ads, corrupted: 0, newer: 0 },
            },
            status: null,
            setStatus: () => {},
            adStatus: null,
            setAdStatus: () => {},
            clearOffer: () => {},
            setAds: () => {},
          }
        : null,
    [demo],
  );

  const opened = useMemo(
    () => (demo ? openedReadings(demo.ads, { stamps: demo.ctx.stamps, skills }) : []),
    [demo],
  );
  const roadmap = useMemo(() => roadmapBoxSafe(built, roadmapAds(opened), skills), [built, opened]);

  // Click handler: open one ad from the list. It reads the record from this tab's memory and decides how to show it, as the real page does.
  async function onOpenAd(id: string) {
    if (!demo) return;
    const loaded = await loadJob(demo.ctx, id);
    if (!loaded.ok || loaded.job === null) return;
    const result = openJob(loaded.job, { stamps: demo.ctx.stamps, skills });
    if (!openView(result.kind).showReading || result.kind === "newer-version") return;
    setShown(result.reading);
  }

  if (failed) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-8">
        <p role="alert" className="rounded border border-red-400 p-3 text-red-600 dark:text-red-400">
          {DEMO_FAILED}
        </p>
      </main>
    );
  }
  if (!demo || !confirm || !built || !saved) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-8">
        <p className={quiet}>{DEMO_LOADING}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Career Co-pilot demo</h1>
      <p className={quiet}>{DEMO_PREPARED}</p>
      <p className="text-sm">{DEMO_TRY}</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">The invented CV</h2>
        <details className="text-sm">
          <summary className="cursor-pointer">Show the eight lines of the invented CV</summary>
          <ol className="mt-2 list-decimal pl-5 font-mono">
            {demo.cv.lines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ol>
        </details>
        <ConfirmBox proposals={demo.cv.result.skills} confirm={confirm} onChange={setConfirm} built={built} />
      </section>

      <SavedAdsList saved={saved} onOpen={onOpenAd} profile={built} skills={skills} readOnly />
      <RoadmapView box={roadmap} />

      {shown && (
        <ReportView
          title={`${shown.job.title}${shown.job.company ? `, ${shown.job.company}` : ""}`}
          report={reportFor(shown, built, skills, demo.cv.result.unlisted)}
          note={reportNote("cv")}
          notCounted={shown.notCounted ?? []}
        />
      )}
    </main>
  );
}
