// Step 4.1: a CV file (PDF, Word or plain text) to text, in the browser.
// No AI, no network, nothing stored: the file is read from memory and the text
// is handed back. Tests prove fetch is never called (tests/fileToText.test.ts).

import { MAX_CV_CHARS, MAX_CV_FILE_BYTES, MAX_CV_PAGES } from "./limits";

export { MAX_CV_CHARS, MAX_CV_FILE_BYTES, MAX_CV_PAGES };

export type FileTextProblem =
  | "too-big" // the file is over MAX_CV_FILE_BYTES
  | "too-long" // the text is over MAX_CV_CHARS (or the PDF over MAX_CV_PAGES)
  | "unsupported" // not a .pdf, .docx or .txt
  | "no-text" // nothing readable inside (a scan, or an empty file)
  | "unreadable"; // damaged, or protected by a password

export type FileTextResult =
  | { ok: true; text: string }
  | { ok: false; problem: FileTextProblem; message: string };

const fail = (problem: FileTextProblem, message: string): FileTextResult => ({
  ok: false,
  problem,
  message,
});

// Line endings, stray control characters and runs of blank lines. Words are
// never changed.
export function tidyText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function finish(raw: string): FileTextResult {
  const text = tidyText(raw);
  if (text === "") {
    return fail(
      "no-text",
      "No text was found in this file. It may be a scan (a picture of a page). Paste your CV text into the box instead.",
    );
  }
  if (text.length > MAX_CV_CHARS) {
    return fail(
      "too-long",
      `This CV is too long. The limit is ${MAX_CV_CHARS.toLocaleString("en-US")} characters.`,
    );
  }
  return { ok: true, text };
}

async function pdfToText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // The "legacy" build is used everywhere: pdf.js's own build for Node (the
  // tests) and for browsers without the newest features, so one code path is
  // tested. In the browser it runs in a worker, which Next bundles from here.
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  // pdf.js 6 has no "isEvalSupported" option any more (checked in the
  // package), and neither of its builds calls eval or new Function.
  // Wasm, remote fonts and worker fetches are off, so no request is made.
  const task = pdfjs.getDocument({
    data: bytes,
    useWasm: false,
    useWorkerFetch: false,
    useSystemFonts: false,
    disableFontFace: true,
    enableXfa: false,
    verbosity: 0, // errors only: pdf.js prints no warning about a file
  });
  const doc = await task.promise;
  try {
    if (doc.numPages > MAX_CV_PAGES) {
      throw new TooLongError();
    }
    let out = "";
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ("str" in item) out += item.str + (item.hasEOL ? "\n" : "");
      }
      out += "\n";
      if (out.length > MAX_CV_CHARS * 2) throw new TooLongError();
    }
    return out;
  } finally {
    await task.destroy();
  }
}

class TooLongError extends Error {}

async function docxToText(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser.min.js");
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  // mammoth puts a blank line between paragraphs; one paragraph is one line.
  return result.value.replace(/\n\n+/g, "\n");
}

export async function fileToText(file: File): Promise<FileTextResult> {
  const name = file.name.toLowerCase();
  const kind = name.endsWith(".pdf")
    ? "pdf"
    : name.endsWith(".docx")
      ? "docx"
      : name.endsWith(".txt")
        ? "txt"
        : null;
  if (kind === null) {
    return fail(
      "unsupported",
      "This file type is not supported. Use a PDF, a Word file (.docx) or a .txt file, or paste your CV text into the box.",
    );
  }
  if (file.size > MAX_CV_FILE_BYTES) {
    return fail(
      "too-big",
      `This file is too big. The limit is ${MAX_CV_FILE_BYTES / (1024 * 1024)} MB.`,
    );
  }

  try {
    if (kind === "txt") return finish(await file.text());
    const bytes = new Uint8Array(await file.arrayBuffer());
    return finish(kind === "pdf" ? await pdfToText(bytes) : await docxToText(bytes));
  } catch (error) {
    if (error instanceof TooLongError) {
      return fail(
        "too-long",
        `This CV is too long. The limit is ${MAX_CV_PAGES} pages or ${MAX_CV_CHARS.toLocaleString("en-US")} characters.`,
      );
    }
    // Nothing from the file goes to the console: only that reading failed.
    return fail(
      "unreadable",
      "This file could not be read. It may be damaged or protected by a password. Paste your CV text into the box instead.",
    );
  }
}
