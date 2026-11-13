"use client";

import { useState } from "react";
import type { JobAd } from "@/lib/schemas/job";

// Day 1 page: paste a job ad, see the AI's schema-checked reading of it.
export default function Home() {
  const [text, setText] = useState("");
  const [job, setJob] = useState<JobAd | null>(null);
  const [removed, setRemoved] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function readAd() {
    setLoading(true);
    setError(null);
    setJob(null);
    setRemoved(0);
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
        setJob(data.job);
        setRemoved(data.removed ?? 0);
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

      {job && (
        <section>
          <h2 className="mb-2 font-semibold">What the AI read</h2>
          {removed > 0 && (
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
              {removed} {removed === 1 ? "item" : "items"} removed because{" "}
              {removed === 1 ? "it wasn't" : "they weren't"} in your ad.
            </p>
          )}
          <pre className="whitespace-pre-wrap break-words rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
            {JSON.stringify(job, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
