import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Step 7.1e source guards (docs/PLAN-7.1.md section 6 and U11; modelled on tests/savedAdRowsGuards.test.ts). They read the
// source files: the "What to learn" box only reads. RoadmapView.tsx does not exist yet, so the second block is red.

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const FILES = ["app/roadmap.ts", "app/RoadmapView.tsx"] as const;

// Comments and import lines removed, so only code is looked at.
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .split("\n")
    .filter((l) => !/^\s*import\s/.test(l) && !/^\s*}\s*from\s/.test(l))
    .join("\n");

describe("the box only reads: no save, delete, fetch, storage or effect in app/roadmap.ts and app/RoadmapView.tsx", () => {
  for (const f of FILES) {
    it(`${f} calls no save or delete function, no fetch, no storage, no effect`, () => {
      const src = read(f);
      for (const w of ["saveJob", "saveProfile", "deleteJob", "deleteProfile", "deleteAll", "loadProfile", "loadJob", "listJobs", "fetch(", ".put(", ".delete(", "indexedDB", "localStorage", "sessionStorage", "useEffect", "XMLHttpRequest"]) {
        expect(code(src), `${f} must not contain "${w}"`).not.toContain(w);
      }
    });
  }

  it("the view has no button or form that saves or calls anything: no onClick and no <form", () => {
    const src = code(read("app/RoadmapView.tsx"));
    expect(src).not.toContain("onClick");
    expect(src).not.toContain("<form");
  });
});

// A string or template literal of four or more words is a sentence. Short labels (a heading, a one-word kind) are allowed.
const SENTENCE_LITERAL = /(["'`])(?:(?!\1).)*?[A-Za-z]+(?: [A-Za-z'.,:;()-]+){3,}(?:(?!\1).)*?\1/;
// JSX text: what sits between ">" and "<" (not inside {}, and not the ">" of an arrow "=>"), four or more words.
const JSX_TEXT = />([^<>{}]*[A-Za-z][^<>{}]*)</g;
const jsxSentences = (src: string) =>
  [...src.matchAll(new RegExp(`(?<![=-])${JSX_TEXT.source}`, "g"))]
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    .filter((t) => t.split(" ").filter((w) => /[A-Za-z]/.test(w)).length >= 4);

describe("no sentence literal: the words are constants in lib/saved/messages.ts", () => {
  for (const f of FILES) {
    it(`${f} has no string literal of four or more words`, () => {
      const hit = code(read(f)).split("\n").find((l) => SENTENCE_LITERAL.test(l));
      expect(hit, `${f} holds a sentence literal: ${hit}`).toBeUndefined();
    });
  }

  // JSX only exists in the .tsx file: the scan on a .ts file reads TypeScript (">" of a comparison up to the next "<") and finds
  // false text, so it runs on the view only.
  it("app/RoadmapView.tsx has no JSX text of four or more words (Amendment 4 (5))", () => {
    expect(jsxSentences(code(read("app/RoadmapView.tsx"))), "app/RoadmapView.tsx holds a sentence as JSX text").toEqual([]);
  });
});

describe("the view keys each line by its position (Amendment 6 (4))", () => {
  it("app/RoadmapView.tsx never keys a line by its text alone, and every key mentions an index", () => {
    const src = code(read("app/RoadmapView.tsx"));
    expect(src).not.toContain("key={line}");
    const keyLines = src.split("\n").filter((l) => l.includes("key="));
    expect(keyLines.length).toBeGreaterThanOrEqual(2); // Part A and Part B
    for (const l of keyLines) expect(l, `key without an index: ${l}`).toMatch(/\b(i|index|idx)\b/);
  });
});

describe("the guards themselves: both patterns pinned on examples", () => {
  it("flags a sentence as a string literal and as JSX text; lets short labels and short templates through", () => {
    // flagged
    expect(SENTENCE_LITERAL.test('const a = "The roadmap shows from ten saved ads";')).toBe(true);
    expect(jsxSentences("<p>The roadmap shows from ten saved ads</p>")).toEqual(["The roadmap shows from ten saved ads"]);
    // not flagged
    expect(SENTENCE_LITERAL.test('const b = "What to learn";')).toBe(false);
    expect(SENTENCE_LITERAL.test('const c = ", ";')).toBe(false);
    expect(SENTENCE_LITERAL.test("const d = `${x} of your ${y}`;")).toBe(false); // fewer than 4 words between the ${} pieces
    expect(jsxSentences("<h2>What to learn</h2>")).toEqual([]);
    expect(jsxSentences("<li>{line}</li>")).toEqual([]);
    expect(jsxSentences("const f = (x) => <li>{x}</li>;")).toEqual([]); // the ">" of an arrow is not JSX text
  });
});

// ---- Step 7.3 (docs/PLAN-7.3.md section 7, T14 and T15): source guards for the timeline. Appended; no existing case is touched.

describe("T14: the timeline and the ranking are computed from the very same two values", () => {
  it("T14: app/roadmap.ts calls unlockTimeline(...) with exactly the arguments of rankMissingSkills(...)", () => {
    const src = code(read("app/roadmap.ts"));
    const args = (fn: string) => [...src.matchAll(new RegExp(`\\b${fn}\\(([^()]*)\\)`, "g"))].map((m) => m[1].replace(/\s+/g, " ").trim());
    const ranking = args("rankMissingSkills");
    const timeline = args("unlockTimeline");
    expect(ranking.length).toBeGreaterThanOrEqual(1);
    expect(timeline, "app/roadmap.ts must call unlockTimeline once").toHaveLength(1);
    expect(timeline[0]).toBe(ranking[0]);
  });
});

describe("T15: no clock, and the view draws the timeline by position", () => {
  it("T15a: no Date.now, new Date or performance.now in app/roadmap.ts, app/RoadmapView.tsx or lib/engine/unlock.ts (code only)", () => {
    for (const f of ["app/roadmap.ts", "app/RoadmapView.tsx", "lib/engine/unlock.ts"]) {
      for (const w of ["Date.now", "new Date", "performance.now"]) expect(code(read(f)), `${f} must not contain "${w}"`).not.toContain(w);
    }
  });

  it("T15b: app/RoadmapView.tsx maps box.timeline, with a key that mentions an index, and still has no onClick", () => {
    const src = code(read("app/RoadmapView.tsx"));
    expect(src).toContain("box.timeline");
    const keyLines = src.split("\n").filter((l) => l.includes("key="));
    expect(keyLines.length).toBeGreaterThanOrEqual(3); // Part A, Part B and the timeline
    for (const l of keyLines) expect(l, `key without an index: ${l}`).toMatch(/\b(i|index|idx)\b/);
    expect(src).not.toContain("onClick");
  });
});
