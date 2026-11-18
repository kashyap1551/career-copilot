import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Analytics } from "@/app/analytics";
import AnalyticsView, { AnalyticsOpen } from "@/app/AnalyticsView";

// Step 8.2, stage 1, tests first (docs/PLAN-8.2.md sections 2 and 8: T17 and T18): what the view DRAWS. react-dom/server, createElement, no JSX.
// The markup spec below extends section 2 (the plan fixes the bar as an `aria-hidden` element carrying the count; the exact attributes are fixed
// HERE, before any code): the closed shell draws one button and nothing else; the open body is one <section aria-label="Your analytics"> with the
// title in a <p>, one <ul> of <li>, each <li> carrying data-kind="<kind>"; a level line also holds ONE bar,
// <div aria-hidden="true" data-bar="n/of"><div style="width:P%"></div></div>, P being n/of in percent; no other line holds a bar.
// The view was a stub when these were written (it draws nothing), so the tests failed on assertions.

const TITLE = "Your analytics";
const ANALYTICS: Analytics = {
  title: TITLE,
  lines: [
    { text: "Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.", kind: "basis", bar: null },
    { text: "Fit levels across your saved ads", kind: "heading", bar: null },
    { text: "(These are the levels shown on your saved ads, counted against the profile in use.)", kind: "note", bar: null },
    { text: "Strong: 1 of your 4 saved ads", kind: "level", bar: { n: 1, of: 4 } },
    { text: "Good: 3 of your 4 saved ads", kind: "level", bar: { n: 3, of: 4 } },
    { text: "Stretch: 0 of your 4 saved ads", kind: "level", bar: { n: 0, of: 4 } },
    { text: "Long shot: 0 of your 4 saved ads", kind: "level", bar: { n: 0, of: 4 } },
    { text: "Skills asked across your 4 saved ads", kind: "heading", bar: null },
    { text: "SQL (on your profile): must-have in 3 ads", kind: "skill", bar: null },
  ],
};

const decode = (t: string) => t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const BAR = /<div[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/div><\/div>/g;
type Item = { text: string; kind: string; bars: string[] };
const items = (html: string): Item[] =>
  [...html.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => ({
    text: decode(m[2].replace(BAR, "")),
    kind: /data-kind="(\w+)"/.exec(m[1])?.[1] ?? "",
    bars: m[2].match(BAR) ?? [],
  }));
const buttons = (html: string): string[] => [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => decode(m[1]));
const open = (analytics: Analytics) => renderToStaticMarkup(createElement(AnalyticsOpen, { analytics }));

describe("T17: the analytics view", () => {
  it("T17a: the closed shell draws one button, 'Show my analytics', and nothing else (no list, no analytics text)", () => {
    const html = renderToStaticMarkup(createElement(AnalyticsView, { outcome: { kind: "ready", analytics: ANALYTICS } }));
    expect(buttons(html)).toEqual(["Show my analytics"]);
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("Fit levels");
  });

  it("T17b: the open body: the title, then the lines as list items in order with their kinds; only the level lines carry a bar", () => {
    const html = open(ANALYTICS);
    expect(html).toContain('aria-label="Your analytics"');
    expect(html).toContain(TITLE);
    expect((html.match(/<ul/g) ?? []).length).toBe(1);
    const got = items(html);
    expect(got.map((i) => [i.text, i.kind])).toEqual(ANALYTICS.lines.map((l) => [l.text, l.kind]));
    expect(got.map((i) => i.bars.length)).toEqual([0, 0, 0, 1, 1, 1, 1, 0, 0]);
    expect(html).toContain('data-bar="1/4"');
    expect(html).toContain('data-bar="3/4"');
    expect(html).toContain('data-bar="0/4"');
  });

  it("T17c: a skill name with <, & and ' is drawn as the same text and no raw tag is written", () => {
    const odd: Analytics = { title: TITLE, lines: [{ text: "R&D <b>Tool</b> (not on your profile): must-have in 1 ad, O'Neil", kind: "skill", bar: null }] };
    const html = open(odd);
    expect(items(html).map((i) => i.text)).toEqual([odd.lines[0].text]);
    expect(html).not.toContain("<b>");
  });

  it("T17d: nothing to show draws nothing; a throw draws the failed line and no button", () => {
    expect(renderToStaticMarkup(createElement(AnalyticsView, { outcome: { kind: "none" } }))).toBe("");
    const failed = renderToStaticMarkup(createElement(AnalyticsView, { outcome: { kind: "failed", line: "The analytics could not be worked out." } }));
    expect(failed).toContain("The analytics could not be worked out.");
    expect(buttons(failed)).toEqual([]);
  });
});

describe("T18: the bar matches its line", () => {
  it("T18: every level line's bar carries the two numbers printed in the line, its width is n/of in percent, and no printed text contains '%'", () => {
    const html = open(ANALYTICS);
    const levels = items(html).filter((i) => i.kind === "level");
    expect(levels.length).toBe(4);
    const WIDTH = ["25%", "75%", "0%", "0%"]; // 1/4, 3/4, 0/4, 0/4 worked by hand
    levels.forEach((l, i) => {
      const nums = /: (\d+) of your (\d+) saved ads?$/.exec(l.text);
      expect(nums, `numbers in "${l.text}"`).not.toBeNull();
      const [, n, of] = nums as RegExpExecArray;
      expect(l.bars.length).toBe(1);
      expect(l.bars[0]).toContain(`data-bar="${n}/${of}"`);
      expect(l.bars[0]).toContain(`width:${WIDTH[i]}`);
    });
    for (const i of items(html)) expect(i.text, `a printed % in "${i.text}"`).not.toContain("%");
  });
});
