import type { NotCounted } from "@/lib/engine/fromAd";
import { checkYourselfRows, couldNotJudgeCounts, couldNotJudgeNote, notCountedSentence } from "./reportText";
import type { RequirementRow } from "./skillsOnly";

// The fit report as shown on the page: the same for a confirmed CV profile and
// for a typed list (the data is built by pure functions in app/fitReport.ts and
// app/skillsOnly.ts). Display only.

export type ReportViewData = {
  fitLabel: string;
  explanation: string;
  counts: { mustsMet: number; mustsTotal: number; nicesMet: number; nicesTotal: number };
  rows: RequirementRow[];
  unlistedRequirements: number; // requirements not in our skill list yet: "could not judge", never counted
  couldNotJudge?: { musts: number; nices: number };
  notJudged: string[];
  conflicts: string[];
  satisfied?: string[]; // "Location: fine. ..." one line for each judged kind without a conflict

  checkYourself: string[];
};

export default function ReportView({
  title,
  report,
  note,
  extra,
  notCounted = [],
}: {
  title: string;
  report: ReportViewData;
  note: string;
  extra?: React.ReactNode;
  notCounted?: NotCounted[];
}) {
  const notCountedText = notCountedSentence(notCounted.length);
  const couldNotJudgeText = couldNotJudgeCounts(report.couldNotJudge?.musts ?? 0, report.couldNotJudge?.nices ?? 0);
  const couldNotJudgeAmber = couldNotJudgeNote(report.unlistedRequirements);
  const checkRows = checkYourselfRows(report.checkYourself, notCounted);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="font-semibold">Fit: {report.fitLabel}</p>
      <p>{report.explanation}</p>
      <p className="text-sm">
        Must-haves met: {report.counts.mustsMet} of {report.counts.mustsTotal}. Nice-to-haves met:{" "}
        {report.counts.nicesMet} of {report.counts.nicesTotal}.
        {couldNotJudgeText ? ` ${couldNotJudgeText}` : ""}
        {notCountedText ? ` ${notCountedText}` : ""}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{note}</p>

      {couldNotJudgeAmber && <p className="rounded border border-amber-500 p-3 text-sm">{couldNotJudgeAmber}</p>}

      {report.conflicts.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Conflicts found in what you set:</p>
          <ul className="list-disc pl-5">
            {report.conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {report.satisfied && report.satisfied.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Checked and fine:</p>
          <ul className="list-disc pl-5">
            {report.satisfied.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {(["must", "nice"] as const).map((kind) => {
        const rows = report.rows.filter((r) => r.importance === kind);
        if (rows.length === 0) return null;
        return (
          <div key={kind}>
            <h3 className="font-semibold">{kind === "must" ? "Must-haves" : "Nice-to-haves"}</h3>
            <ul className="mt-1 flex flex-col gap-3">
              {rows.map((r, i) => (
                <li key={i} className="border-l-2 border-zinc-300 pl-3 dark:border-zinc-700">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">&ldquo;{r.quote}&rdquo;</p>
                  <p className="text-sm">
                    <span className="font-medium">
                      {r.status === "met" ? "Met" : r.status === "unlisted" ? "Could not judge" : "Missing"}
                    </span>{" "}
                    &mdash; {r.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {extra}

      {report.notJudged.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Not judged:</p>
          <ul className="list-disc pl-5">
            {report.notJudged.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {checkRows.length > 0 && (
        <div className="text-sm">
          <p className="font-medium">Check this yourself:</p>
          <ul className="list-disc pl-5">
            {checkRows.map((r, i) => (
              <li key={i}>
                &ldquo;{r.quote}&rdquo;
                {r.note ? <span className="text-zinc-600 dark:text-zinc-400"> ({r.note})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
