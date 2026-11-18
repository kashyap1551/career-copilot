import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import BulletsView, { BulletsBody } from "@/app/BulletsView";
import { bulletsAsText, type BulletsPhase } from "@/app/bullets";
import { buildProfile, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job, Requirement } from "@/lib/engine/types";
import * as messages from "@/lib/saved/messages";
import { ad } from "./support/roadmapFixtures";
import { adsViaPage } from "./support/viaPage";

// Step 8.3, stage 4, tests first (docs/PLAN-8.3.md v2, section 2 and 0.2, 0.21, 0.26; tests T16-like texts, T21, T27, T28 and T42). The words of the block (the owner's texts of
// 0.2 win), the markup of each state, the copy text, and the block as a whole on the page's own ads. react-dom/server, no JSX. Invented text only.

const decode = (t: string) => t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const buttons = (html: string) => [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ text: decode(m[2]), disabled: /\bdisabled\b/.test(m[1]) }));
const paras = (html: string) => [...html.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)].map((m) => ({ attrs: m[1], text: decode(m[2]) }));
const items = (html: string) =>
  [...html.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => ({
    pair: /data-pair="(\d+)"/.exec(m[1])?.[1] ?? "",
    parts: [...m[2].matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g)].map((p) => ({ source: /data-source/.test(p[1]), text: decode(p[2]) })),
  }));
const body = (phase: BulletsPhase, copyStatus: "idle" | "copied" | "failed" = "idle") =>
  renderToStaticMarkup(createElement(BulletsBody, { phase, copyStatus, onPress: () => {}, onHide: () => {}, onCopy: () => {} }));

const L4 = "Answered the phone and kept the stock sheet up to date in Excel";
const SHOWN = [
  { pair: 1, line: 4, text: "Kept the stock sheet up to date in Excel", source: `from your CV line 4: "${L4}"` },
  { pair: 2, line: 5, text: "Helped customers at the counter", source: "from your CV line 5" },
];

describe("the words of the block (the owner's texts of 0.2 win)", () => {
  it("W1 to W14: the exact texts", () => {
    expect(messages.BULLETS_BUTTON_OPEN).toBe("Write CV bullets for this ad");
    expect(messages.BULLETS_BUTTON_WAITING).toBe("Writing bullets...");
    expect(messages.BULLETS_BUTTON_CLOSE).toBe("Hide the bullets");
    expect(messages.bulletsNotice(5)).toBe("This sends the ad's requirement lines and up to 5 lines of your own CV to the AI service (Groq). We store nothing and do not log the text.");
    expect(messages.BULLETS_TITLE).toBe("CV bullets for this ad");
    expect(messages.BULLETS_INTRO).toBe("Each bullet is built from the words of the CV line shown under it. Read each one before you use it.");
    expect(messages.sourceLine(3, "Answered the phone")).toBe('from your CV line 3: "Answered the phone"');
    expect(messages.sourceLineOnly(3)).toBe("from your CV line 3");
    expect(messages.droppedLine(1)).toBe("1 bullet was dropped by the checks: it did not stay close enough to your CV line.");
    expect(messages.droppedLine(2)).toBe("2 bullets were dropped by the checks: they did not stay close enough to your CV line.");
    expect(messages.droppedLine(5)).toBe("5 bullets were dropped by the checks: they did not stay close enough to your CV line.");
    expect(messages.BULLETS_NONE_PASSED).toBe("No bullet passed the checks, so none is shown. You can try again, or use your CV lines as they are.");
    expect(messages.BULLETS_NOTHING_TO_WRITE).toBe("No requirement of this ad is met by a line of your CV, so there is nothing to write from.");
    expect(messages.BULLETS_COPY).toBe("Copy bullets as text");
    expect(messages.REPORT_COPIED).toBe("Copied.");
    expect(messages.REPORT_COPY_FAILED).toBe("Could not copy. Select the text and copy it by hand.");
    expect(messages.BULLETS_TIMEOUT_LINE).toBe("The AI did not answer in time. Please try again.");
  });
  it("the three new plain lines (copies of the page's own texts, and the analogue of the other failure lines)", () => {
    expect(messages.COULD_NOT_REACH_LINE).toBe("Could not reach the server. Check your connection and try again.");
    expect(messages.serverErrorLine(500)).toBe("The server returned an error (500).");
    expect(messages.BULLETS_FAILED_LINE).toBe("The CV bullets could not be worked out.");
  });
});

describe("T21: the states of the block", () => {
  it("T21 closed: one button 'Write CV bullets for this ad' and the notice, nothing else", () => {
    const html = body({ kind: "idle" });
    expect(buttons(html)).toEqual([{ text: "Write CV bullets for this ad", disabled: false }]);
    expect(paras(html).map((p) => p.text)).toEqual([messages.bulletsNotice(5)]);
    expect(html).not.toContain("<ul");
  });
  it("T21 waiting: one disabled button 'Writing bullets...'", () => {
    expect(buttons(body({ kind: "waiting" }))).toEqual([{ text: "Writing bullets...", disabled: true }]);
  });
  it("T21 shown: the title, 'Hide the bullets', the intro, each bullet with its source line, the dropped line, 'Copy bullets as text'", () => {
    const html = body({ kind: "shown", bullets: SHOWN, dropped: 2 });
    expect(html).toContain('aria-label="CV bullets for this ad"');
    expect(buttons(html).map((b) => b.text)).toEqual(["Hide the bullets", "Copy bullets as text"]);
    expect(paras(html).filter((p) => !/data-source/.test(p.attrs)).map((p) => p.text)).toEqual([
      "CV bullets for this ad",
      messages.BULLETS_INTRO,
      "Kept the stock sheet up to date in Excel",
      "Helped customers at the counter",
      "2 bullets were dropped by the checks: they did not stay close enough to your CV line.",
    ]);
    expect(items(html)).toEqual([
      { pair: "1", parts: [{ source: false, text: "Kept the stock sheet up to date in Excel" }, { source: true, text: `from your CV line 4: "${L4}"` }] },
      { pair: "2", parts: [{ source: false, text: "Helped customers at the counter" }, { source: true, text: "from your CV line 5" }] },
    ]);
  });
  it("T21 shown: no dropped line when nothing was dropped; the singular for one", () => {
    expect(paras(body({ kind: "shown", bullets: SHOWN, dropped: 0 })).map((p) => p.text).join("|")).not.toContain("dropped");
    expect(paras(body({ kind: "shown", bullets: SHOWN, dropped: 1 })).map((p) => p.text)).toContain("1 bullet was dropped by the checks: it did not stay close enough to your CV line.");
  });
  it("T21 the copy status: 'Copied.' or the refusal line appears after a copy, none before", () => {
    const shown: BulletsPhase = { kind: "shown", bullets: SHOWN, dropped: 0 };
    expect(body(shown)).not.toContain("Copied.");
    expect(paras(body(shown, "copied")).map((p) => p.text)).toContain("Copied.");
    expect(paras(body(shown, "failed")).map((p) => p.text)).toContain("Could not copy. Select the text and copy it by hand.");
  });
  it("T21 nothing passed: the line W9 alone (no dropped line), then the closed block so the person may press again", () => {
    const html = body({ kind: "none-passed" });
    expect(paras(html).map((p) => p.text)).toEqual([messages.BULLETS_NONE_PASSED, messages.bulletsNotice(5)]);
    expect(buttons(html)).toEqual([{ text: "Write CV bullets for this ad", disabled: false }]);
  });
  it("T21 a failure: one plain line, then the closed block (a new press is a new call)", () => {
    for (const line of ["The AI reading is paused right now. Please try again later.", messages.BULLETS_TIMEOUT_LINE, messages.COULD_NOT_REACH_LINE]) {
      const html = body({ kind: "failed", line });
      expect(paras(html)[0].text).toBe(line);
      expect(paras(html)[0].attrs).toContain('role="alert"');
      expect(buttons(html)).toEqual([{ text: "Write CV bullets for this ad", disabled: false }]);
    }
  });
  it("T21 a bullet with <, & and ' is drawn as the same text and no raw tag is written", () => {
    const odd = { pair: 1, line: 1, text: "R&D <b>Tool</b> O'Neil", source: "from your CV line 1" };
    const html = body({ kind: "shown", bullets: [odd], dropped: 0 });
    expect(items(html)[0].parts[0].text).toBe("R&D <b>Tool</b> O'Neil");
    expect(html).not.toContain("<b>");
  });
});

describe("T27: the copy text", () => {
  it("T27: '- ' in front of each bullet, no line markers, no trailing newline", () => {
    expect(bulletsAsText(SHOWN)).toBe("- Kept the stock sheet up to date in Excel\n- Helped customers at the counter");
    expect(bulletsAsText(SHOWN).endsWith("\n")).toBe(false);
    expect(bulletsAsText([])).toBe("");
  });
});

// ---- the block as a whole, on the page's own ads ------------------------------------------------------------------------------------------
const prop = (name: string, skillId: string, line: number, quote: string): CvSkill => ({ name, skillId, listed: true, line, quote, label: "named" });
const confirm = (o: Partial<ConfirmState>): ConfirmState => ({ keptIds: [], added: [], inProgress: [], languages: [], cities: "Berlin", workModes: [], years: "", availableFrom: "", ...o });
const req = (id: string, quote: string): Requirement => ({ skillIds: [id], importance: "must", quote });
const CV = ["Sam Placeholder", "x", "y", L4];
const onScreen = (r: Requirement[]): Job => adsViaPage([ad("j1", "Invented Ad", "Invented Co", r)])[0].job;
const view = (job: Job, built: ReturnType<typeof buildProfile> | null) => renderToStaticMarkup(createElement(BulletsView, { job, built }));

describe("T28 and T42: the block on the page's ads", () => {
  const withExcel = buildProfile(CV, [prop("Excel", "excel", 4, "Excel")], confirm({ keptIds: ["excel"] }), skills);
  it("T28: a profile that meets a requirement: the closed block (button and notice)", () => {
    const html = view(onScreen([req("excel", "Excel is required.")]), withExcel);
    expect(buttons(html)).toEqual([{ text: "Write CV bullets for this ad", disabled: false }]);
    expect(paras(html).map((p) => p.text)).toEqual([messages.bulletsNotice(5)]);
  });
  it("T28: a requirement the profile does not meet: only the line 'No requirement of this ad is met ...', no button", () => {
    const html = view(onScreen([req("python", "Python is required.")]), withExcel);
    expect(paras(html).map((p) => p.text)).toEqual([messages.BULLETS_NOTHING_TO_WRITE]);
    expect(buttons(html)).toEqual([]);
  });
  it("T28: no profile skills at all: the same line", () => {
    const html = view(onScreen([req("excel", "Excel is required.")]), buildProfile(CV, [], confirm({}), skills));
    expect(paras(html).map((p) => p.text)).toEqual([messages.BULLETS_NOTHING_TO_WRITE]);
  });
  it("T42: an unexpected throw (a reading with no requirements) is one plain line and no button, not an exception", () => {
    const broken = { ...onScreen([req("excel", "Excel is required.")]), requirements: undefined } as never as Job;
    let html = "";
    expect(() => (html = view(broken, withExcel))).not.toThrow();
    expect(paras(html).map((p) => p.text)).toEqual([messages.BULLETS_FAILED_LINE]);
    expect(buttons(html)).toEqual([]);
  });
});
