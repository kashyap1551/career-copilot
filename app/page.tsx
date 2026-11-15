"use client";

import { useState } from "react";
import type { BuildResult, RemovalReason } from "@/lib/engine/fromAd";

// Step 3.1 page: paste a job ad, see the checked reading of it. The fit
// report on this page comes in step 3.4.

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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Career Co-pilot</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Paste a job ad and see what the AI reads in it.
      </p>

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

      {result && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">What the AI read</h2>

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

          <pre className="whitespace-pre-wrap break-words rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
            {JSON.stringify(result.job, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
