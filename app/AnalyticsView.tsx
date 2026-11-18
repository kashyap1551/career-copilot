"use client";

import { useState } from "react";
import { ANALYTICS_BUTTON_CLOSE, ANALYTICS_BUTTON_OPEN } from "@/lib/saved/messages";
import type { Analytics, AnalyticsOutcome } from "./analytics";

// Step 8.2 (docs/PLAN-8.2.md sections 2 and 6): the analytics, drawn. The shell keeps only the open or closed state; the open body is a pure component.
// Every sentence comes from lib/saved/messages.ts or from the analytics' own lines; nothing is written here. A level line carries one plain bar, a
// decoration marked aria-hidden: the printed line says the same in words and numbers, so nothing is carried by colour or length alone. Nothing is
// copied, saved, downloaded or sent.

const quiet = "text-sm text-zinc-600 dark:text-zinc-400";
const button = "rounded border border-zinc-400 px-3 py-1 text-sm font-medium dark:border-zinc-600 disabled:opacity-40";

// The width of a bar: n of `of`, in percent (a drawing of a count; the printed number is always the count).
const widthOf = (n: number, of: number) => (of > 0 ? Number(((n / of) * 100).toFixed(2)) : 0);

export function AnalyticsOpen({ analytics }: { analytics: Analytics }) {
  return (
    <section aria-label={analytics.title} className="flex flex-col gap-2 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
      <p className="font-medium">{analytics.title}</p>
      <ul className="flex flex-col gap-1">
        {analytics.lines.map((line, i) => (
          <li
            key={`${i}-${line.text}`}
            data-kind={line.kind}
            className={line.kind === "heading" ? "mt-2 break-words font-medium" : line.kind === "note" ? `break-words ${quiet}` : "break-words"}
          >
            {line.text}
            {line.bar && (
              <div aria-hidden="true" data-bar={`${line.bar.n}/${line.bar.of}`} className="mt-1 h-2 w-full rounded bg-zinc-200 dark:bg-zinc-800">
                <div className="h-2 rounded bg-zinc-500 dark:bg-zinc-400" style={{ width: `${widthOf(line.bar.n, line.bar.of)}%` }}></div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// The shell the page mounts only while the report exists, so the block that goes away and comes back starts closed.
export default function AnalyticsView({ outcome }: { outcome: AnalyticsOutcome }) {
  const [open, setOpen] = useState(false);

  if (outcome.kind === "none") return null;
  if (outcome.kind === "failed") return <p className={quiet}>{outcome.line}</p>;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button className={button} onClick={() => setOpen(!open)}>
          {open ? ANALYTICS_BUTTON_CLOSE : ANALYTICS_BUTTON_OPEN}
        </button>
      </div>
      {open && <AnalyticsOpen analytics={outcome.analytics} />}
    </div>
  );
}
