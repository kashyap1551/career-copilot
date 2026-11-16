"use client";

import { useMemo, useState } from "react";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type ConfirmState } from "@/lib/cv/profile";
import type { BuildResult, RemovalReason } from "@/lib/engine/fromAd";
import type { CvBuildResult } from "@/lib/engine/fromCv";
import ConfirmBox from "./ConfirmBox";
import CvBox from "./CvBox";
import { profileReport } from "./fitReport";
import ReportView from "./ReportView";
import { closeMatchLines, reportNote } from "./reportText";
import { readSkillList, skillsOnlyReport } from "./skillsOnly";

// One page, in this order: your CV, confirm your profile, the job ad, the
// report (D6; nothing is stored). The AI reads the CV and the ad; plain code
// builds the profile from what the person confirms and judges the ad against it,
// only on the constraints the person set. A typed list of skills (step 3.4)
// stays as a collapsed option and is used only when no CV has been read.

const REASONS: Record<RemovalReason, string> = {
  "not-in-ad": "it wasn't in your ad",
  "no-skill": "it named no skill",
  "number-not-in-quote": "its number wasn't in the quoted words",
  "number-out-of-range": "its number was out of range",
  "no-full-date": "the quoted words have no full date",
  "date-mismatch": "its date didn't match the quoted words",
  "level-not-in-quote": "the level wording wasn't in the quoted words",
  "several-cities": "the ad names several cities",
  "tag-not-sentence": "it was only a tag, not a sentence",
};

export default function Home() {
  const [text, setText] = useState("");
  const [skillText, setSkillText] = useState("");
  const [result, setResult] = useState<BuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The last successful reading of the CV, and what the person has confirmed.
  const [cvRead, setCvRead] = useState<{ lines: string[]; result: CvBuildResult } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  async function readAd() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      // If the server's answer is not JSON (for example a timeout page),
      // fall back to a plain message instead of crashing.
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? `The server returned an error (${res.status}).`);
      } else {
        setResult(data as BuildResult);
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onCvRead(lines: string[], r: CvBuildResult) {
    setCvRead({ lines, result: r });
    setConfirm(initialConfirm(r.skills)); // a new reading starts a new confirmation
  }

  // All recomputed in the browser when anything changes: no new AI call.
  const built = useMemo(
    () => (cvRead && confirm ? buildProfile(cvRead.lines, cvRead.result.skills, confirm, skills) : null),
    [cvRead, confirm],
  );
  const list = useMemo(() => readSkillList(skillText, skills), [skillText]);
  const report = useMemo(() => {
    if (!result) return null;
    if (built) {
      return {
        kind: "cv" as const,
        view: profileReport(result.job, built, skills, [...result.unlisted, ...cvRead!.result.unlisted]),
      };
    }
    return {
      kind: "list" as const,
      view: { ...skillsOnlyReport(result.job, list.cvLines, list.lines, skills, result.unlisted), conflicts: [] as string[] },
    };
  }, [result, built, cvRead, list]);

  // Names the reader matched by close spelling (stage 2): one short line each; exact matches show nothing.
  const closeLines = result ? closeMatchLines(result.job.requirements, (id) => skills.find((k) => k.id === id)?.name ?? id) : [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Career Co-pilot</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Add your CV, confirm your profile, paste a job ad, and see where you stand.
      </p>

      <CvBox onRead={onCvRead} />

      {cvRead && confirm && built && (
        <ConfirmBox
          proposals={cvRead.result.skills}
          confirm={confirm}
          onChange={setConfirm}
          built={built}
        />
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Or type a list of skills instead</summary>
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor="skills" className="font-medium">
            Your skills, one per line (from your list, not a CV)
          </label>
          <textarea
            id="skills"
            value={skillText}
            onChange={(e) => setSkillText(e.target.value)}
            placeholder={"SQL\nExcel\nPython"}
            rows={6}
            className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
          />
          {built && (
            <p className="text-zinc-600 dark:text-zinc-400">
              You have a confirmed CV profile, so this list is ignored. Reload the page to use only a list.
            </p>
          )}
        </div>
      </details>

      <h2 className="text-lg font-semibold">The job ad</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the job ad here…"
        rows={16}
        className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
      />

      <div>
        <button
          onClick={readAd}
          disabled={loading || text.trim() === ""}
          className="rounded bg-foreground px-5 py-2 font-medium text-background disabled:opacity-40"
        >
          {loading ? "Reading…" : "Read this ad"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded border border-red-400 p-3 text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result && report && (
        <>
          <ReportView
            title={`${result.job.title}${result.job.company ? `, ${result.job.company}` : ""}`}
            report={report.view}
            note={reportNote(report.kind)}
            notCounted={result.notCounted ?? []}
            extra={
              report.kind === "list" && list.lines.some((l) => !l.listed) ? (
                <div className="text-sm">
                  <p className="font-medium">On your list, not in our skill list yet:</p>
                  <ul className="list-disc pl-5">
                    {list.lines
                      .filter((l) => !l.listed)
                      .map((l) => (
                        <li key={l.line}>
                          {l.text}: not in our skill list yet, so it can&apos;t be matched with your CV (your list, line {l.line})
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null
            }
          />

          <section className="flex flex-col gap-3">
            <h2 className="mt-4 font-semibold">What the AI read</h2>

            {result.removed.length > 0 && (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  {result.removed.length} {result.removed.length === 1 ? "item" : "items"} removed
                  because a check failed:
                </p>
                <ul className="list-disc pl-5">
                  {result.removed.map((r, i) => (
                    <li key={i}>
                      {r.what}: {REASONS[r.why]} (&ldquo;{r.text}&rdquo;)
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.moved.length > 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {result.moved.length} {result.moved.length === 1 ? "line" : "lines"} moved to
                &ldquo;check this yourself&rdquo; because it couldn&apos;t be checked.
              </p>
            )}

            {result.unlisted.length > 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Not in our skill list yet: {result.unlisted.map((s) => s.name).join(", ")}.
              </p>
            )}

            {closeLines.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                {closeLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}

            <details>
              <summary className="cursor-pointer text-sm">The checked reading as JSON</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
                {JSON.stringify(result.job, null, 2)}
              </pre>
            </details>
          </section>
        </>
      )}
    </main>
  );
}
