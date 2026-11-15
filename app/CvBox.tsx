"use client";

import { useState } from "react";
import { fileToText, MAX_CV_CHARS } from "@/lib/cv/fileToText";

// Step 4.1: choose a CV file (PDF, Word or .txt) or paste the text; the text
// appears in the box so the person sees exactly what was read. The file is read
// on this device and nothing is sent anywhere in this step. The box is the
// fallback for scans and unsupported files.

export default function CvBox() {
  const [cvText, setCvText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setReading(true);
    setMessage(null);
    const result = await fileToText(file);
    setReading(false);
    if (result.ok) {
      setCvText(result.text);
    } else {
      setMessage(result.message);
    }
    input.value = ""; // so the same file can be chosen again
  }

  const tooLong = cvText.length > MAX_CV_CHARS;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Your CV</h2>
      <label htmlFor="cv-file" className="text-sm font-medium">
        Choose a PDF, Word (.docx) or .txt file, or paste the text below
      </label>
      <input
        id="cv-file"
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={onFile}
        disabled={reading}
        className="text-sm"
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The file is read on your device. In this step nothing is sent anywhere.
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
        onChange={(e) => setCvText(e.target.value)}
        placeholder="Your CV text appears here…"
        rows={12}
        className="w-full rounded border border-zinc-300 bg-transparent p-3 font-mono text-sm dark:border-zinc-700"
      />
      <p
        className={`text-sm ${tooLong ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}
      >
        {cvText.length.toLocaleString("en-US")} of {MAX_CV_CHARS.toLocaleString("en-US")} characters
        {tooLong ? ": too long, shorten it before the next step" : ""}
      </p>
    </section>
  );
}
