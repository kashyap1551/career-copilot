"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import AccessBox from "./AccessBox";
import { postJson } from "./accessFetch";
import { forgetConsent, getConsentServerSnapshot, getConsentSnapshot, giveConsent, sendIfAcknowledged, subscribeConsent } from "./consent";
import { fileToText, MAX_CV_CHARS } from "@/lib/cv/fileToText";
import { MAX_CV_LINES, MAX_LINE_CHARS } from "@/lib/cv/limits";
import { numberLines } from "@/lib/cv/numberLines";
import { removeContactDetails } from "@/lib/cv/redact";
import type { CvBuildResult, CvRemovalReason } from "@/lib/engine/fromCv";
import { CV_INFO_LINE, CV_TICK, CV_TICK_NEEDED, LINK_PRIVACY_NOTICE } from "@/lib/privacy/messages";

// Steps 4.1 and 4.2: choose a CV file (PDF, Word or .txt) or paste the text.
// The file is read on this device. Before anything is sent, email addresses,
// phone numbers and web links are removed here and the lines are numbered; the
// numbered lines shown below are EXACTLY what the "Send for reading" button
// sends (docs/PLAN-4.2.md). Nothing is stored here (a confirmed profile is saved only by a click, app/SavedControls.tsx).

const REASONS: Record<CvRemovalReason, string> = {
  "no-name": "it had no usable name",
  "name-too-long": "its name was too long",
  "not-a-skill": "it is not a skill a CV can show (for example a personal trait)",
  "line-out-of-range": "it cited a line that does not exist",
  "quote-too-short": "its quote had no real word",
  "quote-not-in-line": "its quote is not in the line it cited",
  "too-many": "there were too many skills",
};

export default function CvBox({ onRead }: { onRead: (lines: string[], result: CvBuildResult) => void }) {
  const [cvText, setCvText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CvBuildResult | null>(null);
  const [readLines, setReadLines] = useState<string | null>(null); // the lines of the last successful reading
  const [fileName, setFileName] = useState<string | null>(null);
  // Stage 2.4 (PLAN-9.3 section 4): the tick before the first CV send in this tab. Read from the tab's storage WITHOUT an effect (the external-store
  // hook): while the page is built and hydrated the box is unticked, then it shows the stored state, also after a reload of the same tab.
  const acknowledged = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot);
  const [tickNeeded, setTickNeeded] = useState(false);

  // What would be sent: contact details removed, then lines numbered.
  const lines = useMemo(() => numberLines(removeContactDetails(cvText)), [cvText]);
  const sentChars = lines.reduce((n, l) => n + l.length, 0);
  const problem =
    lines.length === 0
      ? "Add your CV text first."
      : sentChars > MAX_CV_CHARS
        ? `Too long: ${sentChars.toLocaleString("en-US")} of ${MAX_CV_CHARS.toLocaleString("en-US")} characters.`
        : lines.length > MAX_CV_LINES
          ? `Too many lines: ${lines.length} of ${MAX_CV_LINES}.`
          : lines.some((l) => l.length > MAX_LINE_CHARS)
            ? `A line is longer than ${MAX_LINE_CHARS.toLocaleString("en-US")} characters; split it.`
            : null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setReading(true);
    setMessage(null); // an old red message goes away as soon as a new file is chosen
    setError(null);
    const r = await fileToText(file);
    setReading(false);
    if (r.ok) {
      setCvText(r.text);
      setFileName(file.name);
      setMessage(null);
      setError(null);
    } else {
      setFileName(null);
      setMessage(r.message);
    }
    input.value = ""; // so the same file can be chosen again
  }

  async function send() {
    // The gate is the first thing that happens: unticked, nothing below runs and nothing is sent (tests/consent.test.ts C1 and G1).
    const gated = await sendIfAcknowledged(async () => {
      setSending(true);
      setError(null);
      setMessage(null);
      setResult(null);
      try {
        // One helper sends it (app/accessFetch.ts): it adds the access code header; a 401 shows the Access code box instead.
        const sent = await postJson("/api/cv", { lines }, { source: "cv" });
        if (sent.kind === "access") return;
        const res = sent.res;
        const data = await res.json().catch(() => null);
        if (!res.ok) setError(data?.error ?? `The server returned an error (${res.status}).`);
        else {
          setResult(data as CvBuildResult);
          setReadLines(lines.join("\n"));
          onRead(lines, data as CvBuildResult);
        }
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      } finally {
        setSending(false);
      }
    });
    setTickNeeded(!gated.sent);
  }

  function onTick(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) giveConsent();
    else forgetConsent();
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Your CV</h2>
      <p className="rounded border border-amber-500 p-3 text-sm">
        Testing only: use a made-up CV for now, not a real one.
      </p>
      <p className="text-sm font-medium">Choose a PDF, Word (.docx) or .txt file, or paste the text below</p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="cv-file"
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={onFile}
          disabled={reading}
          className="peer sr-only"
        />
        <label
          htmlFor="cv-file"
          className="cursor-pointer rounded border-2 border-foreground px-5 py-2 text-sm font-semibold peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-40"
        >
          Choose file
        </label>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{fileName ?? "No file chosen"}</span>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The file is read on your device. Nothing is sent until you press &ldquo;Send for reading&rdquo;.
      </p>

      {reading && <p className="text-sm">Reading the file…</p>}
      {message && (
        <p role="alert" className="rounded border border-red-400 p-3 text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}

      <label htmlFor="cv-text" className="text-sm font-medium">
        Your CV text (what was read from the file, or paste it here)
      </label>
      <textarea
        id="cv-text"
        value={cvText}
        onChange={(e) => {
          setCvText(e.target.value);
          setResult(null);
        }}
        placeholder="Your CV text appears here…"
        rows={10}
        className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
      />

      {lines.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">What will be sent ({lines.length} lines, {sentChars.toLocaleString("en-US")} characters)</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
            {lines.map((l, i) => `${i + 1}: ${l}`).join("\n")}
          </pre>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {CV_INFO_LINE}{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" prefetch={false} className="underline">
            {LINK_PRIVACY_NOTICE}
          </Link>
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={acknowledged} onChange={onTick} />
          {CV_TICK}
        </label>
        <div>
          <button
            onClick={send}
            disabled={sending || problem !== null}
            className="rounded bg-foreground px-5 py-2 font-medium text-background disabled:opacity-40"
          >
            {sending ? "Reading…" : "Send for reading"}
          </button>
          {problem && lines.length > 0 && <span className="ml-3 text-sm text-red-600 dark:text-red-400">{problem}</span>}
          {tickNeeded && !acknowledged && (
            <span role="alert" className="ml-3 text-sm text-red-600 dark:text-red-400">
              {CV_TICK_NEEDED}
            </span>
          )}
        </div>
      </div>

      <AccessBox source="cv" />

      {error && (
        <p role="alert" className="rounded border border-red-400 p-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-2">
          <p className="font-medium">
            {result.skills.length} {result.skills.length === 1 ? "skill" : "skills"} found
            {result.duplicates > 0 ? `, ${result.duplicates} repeated ${result.duplicates === 1 ? "one" : "ones"} left out` : ""}.
            Confirm them below.
          </p>
          {readLines !== null && readLines !== lines.join("\n") && (
            <p className="rounded border border-amber-500 p-3 text-sm">
              Your CV text has changed since it was read. Press &ldquo;Send for reading&rdquo; again to use the change.
            </p>
          )}
          {result.removed.length > 0 && (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              <p>
                {result.removed.length} {result.removed.length === 1 ? "item" : "items"} removed because a check failed:
              </p>
              <ul className="list-disc pl-5">
                {result.removed.map((r, i) => (
                  <li key={i}>
                    {r.name} (line {r.line}): {REASONS[r.why]}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
