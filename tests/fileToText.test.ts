import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fileToText,
  MAX_CV_CHARS,
  MAX_CV_FILE_BYTES,
  tidyText,
} from "@/lib/cv/fileToText";

// Step 4.1. The expected text is the made-up CV in
// fixtures/synthetic-cvs/files/made-up-cv.txt, written out by hand here (7
// lines, no blank lines). The same CV was turned into a PDF (macOS cupsfilter)
// and a DOCX (macOS textutil); both must give the same 7 lines. image-only.pdf
// is a picture of a blank page (macOS sips): no text layer.

const EXPECTED = [
  "Alex Example, Data Assistant, Sampletown",
  "2021-2024 Data Assistant, Imaginary Retail GmbH",
  "Built weekly sales reports in Excel with pivot tables",
  "Wrote SQL queries to pull order data for the finance team",
  "Learning Python through an online course",
  "Languages: English (fluent), German (B1)",
  "BSc Business Administration, 2020",
].join("\n");

const fixture = (name: string) =>
  new File([readFileSync(`fixtures/synthetic-cvs/files/${name}`)], name);

afterEach(() => vi.restoreAllMocks());

describe("fileToText", () => {
  it("F1: a .txt file gives its 7 lines", async () => {
    expect(await fileToText(fixture("made-up-cv.txt"))).toEqual({ ok: true, text: EXPECTED });
  });

  it("F2: the PDF with a text layer gives the same 7 lines", async () => {
    expect(await fileToText(fixture("made-up-cv.pdf"))).toEqual({ ok: true, text: EXPECTED });
  });

  it("F3: the DOCX gives the same 7 lines, with no blank lines between paragraphs", async () => {
    expect(await fileToText(fixture("made-up-cv.docx"))).toEqual({ ok: true, text: EXPECTED });
  });

  it("F4: an image-only PDF says no text was found", async () => {
    const r = await fileToText(fixture("image-only.pdf"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problem).toBe("no-text");
      expect(r.message).toMatch(/paste your CV text/i);
    }
  });

  it("F5: other file types are refused, by name", async () => {
    for (const name of ["cv.doc", "cv.png", "cv.pages", "cv"]) {
      const r = await fileToText(new File(["x"], name));
      expect(r.ok === false && r.problem).toBe("unsupported");
    }
  });

  it("F6: a file over 5 MB is refused before it is read; exactly 5 MB is not", async () => {
    const over = new File([new Uint8Array(MAX_CV_FILE_BYTES + 1)], "big.txt");
    const r = await fileToText(over);
    expect(r.ok === false && r.problem).toBe("too-big");
    const exact = new File([new Uint8Array(MAX_CV_FILE_BYTES).fill(97)], "exact.txt");
    const r2 = await fileToText(exact);
    expect(r2.ok === false && r2.problem).toBe("too-long"); // passes the size check, then fails the character limit
  });

  it("F7: 20,000 characters pass, 20,001 do not", async () => {
    const ok = await fileToText(new File(["a".repeat(MAX_CV_CHARS)], "a.txt"));
    expect(ok.ok).toBe(true);
    const long = await fileToText(new File(["a".repeat(MAX_CV_CHARS + 1)], "a.txt"));
    expect(long.ok === false && long.problem).toBe("too-long");
  });

  it("F8: an empty or blank file says no text", async () => {
    for (const body of ["", "   \n\n \t "]) {
      const r = await fileToText(new File([body], "empty.txt"));
      expect(r.ok === false && r.problem).toBe("no-text");
    }
  });

  it("F9: a damaged PDF or DOCX is unreadable, and nothing is written to the console", async () => {
    const spies = (["log", "error", "warn", "info"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    for (const name of ["broken.pdf", "broken.docx"]) {
      const r = await fileToText(new File(["this is not a real file"], name));
      expect(r.ok === false && r.problem).toBe("unreadable");
    }
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("F10: no network call is made for any file type (fetch is never called)", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("fetch must not be called");
    });
    vi.stubGlobal("fetch", fetchSpy);
    for (const name of ["made-up-cv.txt", "made-up-cv.pdf", "made-up-cv.docx", "image-only.pdf"]) {
      await fileToText(fixture(name));
    }
    await fileToText(new File(["not a pdf"], "broken.pdf"));
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("tidyText", () => {
  it("T1: line endings, trailing spaces and long runs of blank lines; words untouched", () => {
    expect(tidyText("a\r\nb  \r\n\r\n\r\n\r\nc\rd")).toBe("a\nb\n\nc\nd");
  });

  it("T2: control characters go, tabs and ordinary text stay", () => {
    expect(tidyText("x\u0000y\tz\u0007")).toBe("xy\tz");
  });
});
