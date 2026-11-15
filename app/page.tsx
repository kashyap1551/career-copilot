"use client";

import { useMemo, useState } from "react";
import { skills } from "@/fixtures/skills";
import type { BuildResult, RemovalReason } from "@/lib/engine/fromAd";
import { readSkillList, skillsOnlyReport } from "./skillsOnly";

// Steps 3.1 and 3.4: paste a job ad and a list of skills. The AI reads the ad;
// plain code judges it against the list, on skills only. The list is not a CV
// (see docs/DECISIONS.md): Day 4 replaces it with real CV lines.

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

  // Recomputed when the list changes, with no new AI call.
  const list = useMemo(() => readSkillList(skillText, skills), [skillText]);
  const report = useMemo(
    () =>
      result
        ? skillsOnlyReport(result.job, list.cvLines, list.lines, skills, result.unlisted)
        : null,
    [result, list],
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Career Co-pilot</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Paste a job ad and a list of your skills, and see where you stand on skills.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the job ad here…"
        rows={16}
        className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
      />

      <label htmlFor="skills" className="text-sm font-medium">
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
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {result.job.title}
            {result.job.company ? `, ${result.job.company}` : ""}
          </h2>
          <p className="font-semibold">Fit: {report.fitLabel}</p>
          <p>{report.explanation}</p>
          <p className="text-sm">
            Must-haves met: {report.counts.mustsMet} of {report.counts.mustsTotal}. Nice-to-haves
            met: {report.counts.nicesMet} of {report.counts.nicesTotal}.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Skills only: a skill counts because it is on your list (from your list, not a CV).
            Language, location, work mode, years and start date are not judged.
          </p>

          {report.unlistedRequirements > 0 && (
            <p className="rounded border border-amber-500 p-3 text-sm">
              {report.unlistedRequirements} of {report.rows.length}{" "}
              {report.rows.length === 1 ? "requirement is" : "requirements are"} not in our skill
              list yet, so they count as not met.
            </p>
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
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        &ldquo;{r.quote}&rdquo;
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">
                          {r.status === "met" ? "Met" : r.status === "unlisted" ? "Not met" : "Missing"}
                        </span>{" "}
                        &mdash; {r.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {list.lines.some((l) => !l.listed) && (
            <div className="text-sm">
              <p className="font-medium">On your list, not in our skill list yet:</p>
              <ul className="list-disc pl-5">
                {list.lines
                  .filter((l) => !l.listed)
                  .map((l) => (
                    <li key={l.line}>
                      {l.text}: not in our skill list yet, so it can&apos;t be matched with your CV
                      (your list, line {l.line})
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {report.notJudged.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Not judged (skills only):</p>
              <ul className="list-disc pl-5">
                {report.notJudged.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {report.checkYourself.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">Check this yourself:</p>
              <ul className="list-disc pl-5">
                {report.checkYourself.map((q, i) => (
                  <li key={i}>&ldquo;{q}&rdquo;</li>
                ))}
              </ul>
            </div>
          )}

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

          <details>
            <summary className="cursor-pointer text-sm">The checked reading as JSON</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
              {JSON.stringify(result.job, null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}
