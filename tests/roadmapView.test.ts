import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RoadmapView from "@/app/RoadmapView";
import type { RoadmapBox } from "@/app/roadmap";

// Step 7.3, T20 (docs/PLAN-7.3.md section 7): what the view DRAWS. The source guards (tests/roadmapGuards.test.ts) read the file as text and
// cannot see this. react-dom/server is already installed; no config change, no JSX (createElement), no new dependency. Every expected text is
// written by hand from the shape the view must have: one section titled "What to learn" holding up to three lists in this order: Part A,
// Part B, the timeline. None is copied from running the view.

const render = (box: RoadmapBox) => renderToStaticMarkup(createElement(RoadmapView, { box }));

// React escapes text (an apostrophe becomes &#x27;), so the helper decodes the few entities it writes before comparing: the page shows the
// line, not the entity.
const decode = (t: string) =>
  t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const lists = (html: string): string[][] =>
  [...html.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/g)].map((m) => [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((li) => decode(li[1])));

const FRAMING = "These counts assume you learn each skill by its expected date.";
const H1_TIMELINE = [
  "Timeline from skills in progress:",
  FRAMING,
  "By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).",
];
const PART_A = ["You meet every requirement we could judge in your 10 saved ads."];
const PART_B = ["Already Strong: none", "Skills to build, in order:", "1. Tableau: unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 1 job.", "Blocked jobs: none"];
const box = (over: Partial<RoadmapBox> = {}): RoadmapBox => ({ noProfile: null, partA: PART_A, partB: PART_B, counted: 10, alreadyStrongIds: [], timeline: H1_TIMELINE, ...over });

describe("T20: the view draws the timeline as a third list", () => {
  it("T20a: three lists in one section titled What to learn: Part A, Part B, then the timeline, each line one item, in order", () => {
    const html = render(box());
    expect((html.match(/<section/g) ?? []).length).toBe(1);
    expect(html).toContain('aria-label="What to learn"');
    expect(html).toContain(">What to learn</p>");
    const l = lists(html);
    expect(l.length).toBe(3);
    expect(l[0]).toEqual(PART_A);
    expect(l[1]).toEqual(PART_B);
    expect(l[2]).toEqual(H1_TIMELINE);
  });

  it("T20b: the same box with an empty timeline draws two lists, and the framing sentence appears nowhere", () => {
    const html = render(box({ timeline: [] }));
    expect(lists(html).length).toBe(2);
    expect(lists(html)[1]).toEqual(PART_B);
    expect(html).not.toContain("These counts assume");
  });

  it("T20c: a line with an apostrophe is drawn as the same text (the entity is decoded for the comparison)", () => {
    const line = "By 2026-01-15 (Tableau): 0 more Strong matches. Tableau doesn't unlock a job yet.";
    const l = lists(render(box({ timeline: ["Timeline from skills in progress:", FRAMING, line] })));
    expect(l[2][2]).toBe(line);
  });

  it("T20d: nothing to show draws nothing; a box with only a timeline draws one list", () => {
    expect(render(box({ partA: [], partB: [], timeline: [] }))).toBe("");
    const only = lists(render(box({ partA: [], partB: [], timeline: H1_TIMELINE })));
    expect(only.length).toBe(1);
    expect(only[0]).toEqual(H1_TIMELINE);
  });
});
