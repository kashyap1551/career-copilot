"use client";

import { useState } from "react";
import { REPORT_BUTTON_CLOSE, REPORT_BUTTON_OPEN, REPORT_COPIED, REPORT_COPY, REPORT_COPY_FAILED } from "@/lib/saved/messages";
import { copyReport, reportAsText, shownCopyStatus, type CopyRecord, type CopyStatus, type ReportOutcome, type RoadmapReport } from "./roadmapReport";

// Step 8.1 (docs/PLAN-8.1.md sections 1 and 5): the roadmap report, drawn. The shell keeps the open or closed state and the record of the
// last copy attempt; the open body is a pure component. Every sentence comes from lib/saved/messages.ts or from the report's own lines;
// nothing is written here. The ONLY place the browser's clipboard is named is the function `onCopy` below, which a click calls: nothing
// is copied while drawing, nothing is downloaded, nothing is sent. Hiding the report resets the copy record.

export type { CopyStatus } from "./roadmapReport";

const quiet = "text-sm text-zinc-600 dark:text-zinc-400";
const button = "rounded border border-zinc-400 px-3 py-1 text-sm font-medium dark:border-zinc-600 disabled:opacity-40";

// The open report: the title, one list of lines (a sub line is marked and indented), the copy button, and, after a copy, its status.
export function RoadmapReportOpen({ report, copyStatus, onCopy }: { report: RoadmapReport; copyStatus: CopyStatus; onCopy: () => void }) {
  return (
    <section aria-label={report.title} className="flex flex-col gap-2 rounded border border-zinc-300 p-3 text-sm dark:border-zinc-700">
      <p className="font-medium">{report.title}</p>
      <ul className="flex flex-col gap-1">
        {report.lines.map((line, i) => (
          <li key={`${i}-${line.text}`} data-sub={line.sub ? "true" : undefined} className={line.sub ? `break-words pl-4 ${quiet}` : "break-words"}>
            {line.text}
          </li>
        ))}
      </ul>
      <div>
        <button className={button} onClick={onCopy}>
          {REPORT_COPY}
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

// The shell the page mounts only while a report exists, so a report that goes away and comes back starts closed.
export default function RoadmapReportView({ outcome }: { outcome: ReportOutcome }) {
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState<CopyRecord | null>(null);

  if (outcome.kind === "none") {
    return null;
  }
  if (outcome.kind === "failed") {
    return <p className={quiet}>{outcome.line}</p>;
  }

  const report = outcome.report;
  const text = reportAsText(report);

  // The click handler: the only place the clipboard is written. It never throws: copyReport answers "failed" for a refusal or a
  // missing browser feature, and the answer is kept with the text it described.
  async function onCopy() {
    const status = await copyReport(text, (t) => navigator.clipboard.writeText(t));
    setRecord({ status, text });
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          className={button}
          onClick={() => {
            if (open) setRecord(null); // hiding resets the status
            setOpen(!open);
          }}
        >
          {open ? REPORT_BUTTON_CLOSE : REPORT_BUTTON_OPEN}
        </button>
      </div>
      {open && <RoadmapReportOpen report={report} copyStatus={shownCopyStatus(record, text)} onCopy={onCopy} />}
    </div>
  );
}
