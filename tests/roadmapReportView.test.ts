import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoadmapReport } from "@/app/roadmapReport";
import RoadmapReportView, { RoadmapReportOpen, type CopyStatus } from "@/app/RoadmapReportView";

// Step 8.1, T12 and T23 (docs/PLAN-8.1.md sections 1 and 7): what the view DRAWS. react-dom/server, createElement, no JSX, no config
// change. The shapes below are the plan's markup spec (section 1, "How it is drawn"): the closed shell draws one button and nothing else;
// the open body is one <section aria-label="Your roadmap report"> with the title, one <ul> of <li>, a sub line as <li data-sub="true">,
// the Copy button, and, when the status is not "idle", one <p> with the status line. The view was a stub when these were written, so they failed on assertions.

const TITLE = "Your roadmap report";
const REPORT: RoadmapReport = {
  title: TITLE,
  lines: [
    { text: "Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.", sub: false },
    { text: "1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery). Total so far: 2 jobs.", sub: false },
    { text: "Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.", sub: true },
    { text: "Blocked jobs: none", sub: false },
  ],
};

// React escapes text (an apostrophe becomes &#x27;), so the helper decodes the few entities it writes before comparing: the page shows the
// line, not the entity.
const decode = (t: string) => t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const items = (html: string): { text: string; sub: boolean }[] =>
  [...html.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => ({ text: decode(m[2]), sub: /data-sub="true"/.test(m[1]) }));
const buttons = (html: string): string[] => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => decode(m[1]));
const open = (report: RoadmapReport, copyStatus: CopyStatus) => renderToStaticMarkup(createElement(RoadmapReportOpen, { report, copyStatus, onCopy: () => {} }));

describe("T12: the report view", () => {
  it("T12a: the closed shell draws one button, 'Make my roadmap report', and nothing else (no list, no report text)", () => {
    const html = renderToStaticMarkup(createElement(RoadmapReportView, { outcome: { kind: "ready", report: REPORT } }));
    expect(buttons(html)).toEqual(["Make my roadmap report"]);
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("Blocked jobs");
  });

  it("T12b: the open body: the title, then the lines as list items in order, the sub line marked", () => {
    const html = open(REPORT, "idle");
    expect(html).toContain('aria-label="Your roadmap report"');
    expect(html).toContain(TITLE);
    expect((html.match(/<ul/g) ?? []).length).toBe(1);
    expect(items(html)).toEqual(REPORT.lines);
  });

  it("T12c: a label with <, & and ' is drawn as the same text and no raw tag is written", () => {
    const odd: RoadmapReport = { title: TITLE, lines: [{ text: "1. Python: unlocks 1 job (R&D <b>Analyst</b>, O'Neil Ltd). Total so far: 1 job.", sub: false }] };
    const html = open(odd, "idle");
    expect(items(html)).toEqual(odd.lines);
    expect(html).not.toContain("<b>");
  });

  it("T12d: nothing to report draws nothing; a throw draws the failed line and no button", () => {
    expect(renderToStaticMarkup(createElement(RoadmapReportView, { outcome: { kind: "none" } }))).toBe("");
    const failed = renderToStaticMarkup(createElement(RoadmapReportView, { outcome: { kind: "failed", line: "The roadmap report could not be worked out." } }));
    expect(failed).toContain("The roadmap report could not be worked out.");
    expect(buttons(failed)).toEqual([]);
  });
});

describe("T23: the pure open-state component, Copy and its status", () => {
  it("T23a: it shows the Copy button 'Copy report as text'", () => {
    expect(buttons(open(REPORT, "idle"))).toEqual(["Copy report as text"]);
  });

  it("T23b: idle shows no status line", () => {
    const html = open(REPORT, "idle");
    expect(html).not.toContain("Copied.");
    expect(html).not.toContain("Could not copy");
  });

  it("T23c: copied shows 'Copied.' and not the failure line", () => {
    const html = open(REPORT, "copied");
    expect(html).toContain("Copied.");
    expect(html).not.toContain("Could not copy");
  });

  it("T23d: failed shows 'Could not copy. Select the text and copy it by hand.' and not 'Copied.'", () => {
    const html = open(REPORT, "failed");
    expect(html).toContain("Could not copy. Select the text and copy it by hand.");
    expect(html).not.toContain("Copied.");
  });
});
