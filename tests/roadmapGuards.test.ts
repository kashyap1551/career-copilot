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

// ---- Step 8.1 (docs/PLAN-8.1.md section 7, T14, T15, T16 and T24): source guards for the roadmap report. Appended; no existing case is
// touched. The two new files were stubs when these were written: the "must not contain" guards were green on a stub by nature, the "must contain" ones were red.

const REPORT_FILES = ["app/roadmapReport.ts", "app/RoadmapReportView.tsx"] as const;

describe("T14: the report only reads, makes no call, uses no clock and no AI", () => {
  for (const f of REPORT_FILES) {
    it(`T14: ${f} has no fetch, storage, save or delete call, no effect, no @/lib/ai import, no clock`, () => {
      const src = read(f);
      for (const w of ["fetch(", "localStorage", "sessionStorage", "indexedDB", "saveJob", "saveProfile", "deleteJob", "deleteProfile", "deleteAll", "useEffect", "@/lib/ai", "Date.now", "new Date", "performance.now"]) {
        expect(code(src), `${f} must not contain "${w}"`).not.toContain(w);
      }
      expect(src, `${f} must not import @/lib/ai`).not.toMatch(/from\s+["']@\/lib\/ai/);
    });
  }
});

describe("T15: no sentence in the new files; the view keys each line by position", () => {
  for (const f of REPORT_FILES) {
    it(`T15: ${f} has no string literal of four or more words`, () => {
      const hit = code(read(f)).split("\n").find((l) => SENTENCE_LITERAL.test(l));
      expect(hit, `${f} holds a sentence literal: ${hit}`).toBeUndefined();
    });
  }

  it("T15: app/RoadmapReportView.tsx has no JSX text of four or more words, no <form, and keys its lines by an index", () => {
    const src = code(read("app/RoadmapReportView.tsx"));
    expect(jsxSentences(src), "the view holds a sentence as JSX text").toEqual([]);
    expect(src).not.toContain("<form");
    const keyLines = src.split("\n").filter((l) => l.includes("key="));
    expect(keyLines.length, "the view must key its list items").toBeGreaterThanOrEqual(1);
    for (const l of keyLines) expect(l, `key without an index: ${l}`).toMatch(/\b(i|index|idx)\b/);
    expect(src).not.toContain("key={line}");
  });
});

describe("T16: the box's own view still has no button", () => {
  it("T16: app/RoadmapView.tsx has no onClick (the report's button is in its own file)", () => {
    expect(code(read("app/RoadmapView.tsx"))).not.toContain("onClick");
  });
});

describe("T24: the clipboard is written in one place, in a click handler, and nothing else leaves the page", () => {
  it("T24: navigator.clipboard.writeText appears once, inside the function onCopy of RoadmapReportView.tsx, which an onClick calls", () => {
    const view = code(read("app/RoadmapReportView.tsx"));
    expect((view.match(/navigator\.clipboard\.writeText/g) ?? []).length, "exactly one clipboard write in the view").toBe(1);
    expect(view).toMatch(/(async\s+function\s+onCopy|const\s+onCopy\s*=)[\s\S]*?navigator\.clipboard\.writeText/);
    expect(view).toMatch(/onClick=\{onCopy\}/);
  });

  it("T24: no clipboard write in app/roadmapReport.ts, and no file, Blob, object URL, download attribute or execCommand in either new file", () => {
    expect(code(read("app/roadmapReport.ts"))).not.toContain("clipboard");
    for (const f of REPORT_FILES) {
      for (const w of ["Blob", "createObjectURL", "download=", "download:", "execCommand", "FileReader", "showSaveFilePicker"]) {
        expect(code(read(f)), `${f} must not contain "${w}"`).not.toContain(w);
      }
    }
  });
});

// ---- Step 8.2 (docs/PLAN-8.2.md section 8, T19 to T22): source guards for the analytics. Appended; no existing case is touched. The new files were
// stubs when these were written: the "must not contain" guards are green on a stub by nature; the "must contain" ones (a key, one onClick, one
// composition call) were red.

const ANALYTICS_APP_FILES = ["app/analytics.ts", "app/AnalyticsView.tsx"] as const;
const ANALYTICS_FILES = [...ANALYTICS_APP_FILES, "lib/engine/analytics.ts"] as const;

describe("T19: the analytics only read, make no call, use no clock, no AI, no clipboard, no file", () => {
  for (const f of ANALYTICS_FILES) {
    it(`T19: ${f} has no fetch, storage, save or delete call, no effect, no clipboard, no Blob, no @/lib/ai import, no clock`, () => {
      const src = read(f);
      for (const w of ["fetch(", "localStorage", "sessionStorage", "indexedDB", "saveJob", "saveProfile", "deleteJob", "deleteProfile", "deleteAll", "useEffect", "clipboard", "Blob", "createObjectURL", "@/lib/ai", "Date.now", "new Date", "performance.now"]) {
        expect(code(src), `${f} must not contain "${w}"`).not.toContain(w);
      }
      expect(src, `${f} must not import @/lib/ai`).not.toMatch(/from\s+["']@\/lib\/ai/);
    });
  }

  it("T19: lib/engine/analytics.ts imports nothing from app/", () => {
    expect(read("lib/engine/analytics.ts")).not.toMatch(/from\s+["'](?:@\/app|\.\.\/\.\.\/app|\.\.\/app|app\/)/);
  });
});

describe("T20: no sentence in the new app files; the view keys each line by position and has one button", () => {
  for (const f of ANALYTICS_APP_FILES) {
    it(`T20: ${f} has no string literal of four or more words`, () => {
      const hit = code(read(f)).split("\n").find((l) => SENTENCE_LITERAL.test(l));
      expect(hit, `${f} holds a sentence literal: ${hit}`).toBeUndefined();
    });
  }

  it("T20: app/AnalyticsView.tsx has no JSX text of four or more words, no <form, exactly one onClick, and keys its lines by an index", () => {
    const src = code(read("app/AnalyticsView.tsx"));
    expect(jsxSentences(src), "the view holds a sentence as JSX text").toEqual([]);
    expect(src).not.toContain("<form");
    expect((src.match(/onClick=/g) ?? []).length, "exactly one onClick (the open/hide button)").toBe(1);
    const keyLines = src.split("\n").filter((l) => l.includes("key="));
    expect(keyLines.length, "the view must key its list items").toBeGreaterThanOrEqual(1);
    for (const l of keyLines) expect(l, `key without an index: ${l}`).toMatch(/\b(i|index|idx)\b/);
  });
});

describe("T21: the other views are unchanged", () => {
  it("T21: app/RoadmapView.tsx still has no onClick; app/RoadmapReportView.tsx still writes the clipboard once, in onCopy", () => {
    expect(code(read("app/RoadmapView.tsx"))).not.toContain("onClick");
    expect((code(read("app/RoadmapReportView.tsx")).match(/navigator\.clipboard\.writeText/g) ?? []).length).toBe(1);
  });
});

describe("T22: the page works the inputs out ONCE, through the composition", () => {
  it("T22: app/page.tsx calls screenOutcomes once and none of roadmapInputs, roadmapBoxSafe, roadmapReportSafe, roadmapBoxFrom, roadmapReportFrom", () => {
    const page = code(read("app/page.tsx"));
    expect((page.match(/screenOutcomes\(/g) ?? []).length, "exactly one screenOutcomes call").toBe(1);
    for (const w of ["roadmapInputs(", "roadmapBoxSafe(", "roadmapReportSafe(", "roadmapBoxFrom(", "roadmapReportFrom("]) {
      expect(page, `app/page.tsx must not call ${w}`).not.toContain(w);
    }
  });
});

// ---- Step 8.3 stage 4 (docs/PLAN-8.3.md v2, 0.26; tests T30, T32 and T36): source guards for the bullets block. Appended; no existing case is touched. The new files did
// not exist when these were written, so every guard that reads one failed (a missing file).

const BULLET_APP_FILES = ["app/bullets.ts", "app/BulletsView.tsx", "app/timedFetch.ts"] as const;

describe("T30: the block's client files make no call of their own, store nothing, use no clock, import nothing server-only", () => {
  for (const f of BULLET_APP_FILES) {
    it(`T30: ${f} has no fetch(, no storage, no save or delete call, no effect, no clock, no @/lib/ai import`, () => {
      const src = read(f);
      for (const w of ["fetch(", "localStorage", "sessionStorage", "indexedDB", "saveJob", "saveProfile", "deleteJob", "deleteProfile", "deleteAll", "useEffect", "Date.now", "new Date", "performance.now", "@/lib/ai"]) {
        expect(code(src), `${f} must not contain "${w}"`).not.toContain(w);
      }
    });
  }
  it("T30: the only sender is postJson: app/bullets.ts calls postJson, and gives it the signal through fetchWithSignal of app/timedFetch.ts", () => {
    const src = code(read("app/bullets.ts"));
    expect(src).toContain("postJson(");
    expect(src).toContain("fetchWithSignal");
    expect(code(read("app/timedFetch.ts"))).toContain("signal");
  });
  it("T30: the clipboard is written once, in the view's click handler, and never in app/bullets.ts; no Blob, no download", () => {
    expect(code(read("app/bullets.ts"))).not.toContain("clipboard");
    const view = code(read("app/BulletsView.tsx"));
    expect((view.match(/navigator\.clipboard\.writeText/g) ?? []).length).toBe(1);
    for (const f of BULLET_APP_FILES) for (const w of ["Blob", "createObjectURL", "download=", "execCommand"]) expect(code(read(f)), `${f}: ${w}`).not.toContain(w);
  });
});

describe("T32: no sentence in the block's app files; the view keys its lines by position", () => {
  for (const f of BULLET_APP_FILES) {
    it(`T32: ${f} has no string literal of four or more words`, () => {
      const hit = code(read(f)).split("\n").find((l) => SENTENCE_LITERAL.test(l));
      expect(hit, `${f} holds a sentence literal: ${hit}`).toBeUndefined();
    });
  }
  it("T32: app/BulletsView.tsx has no JSX text of four or more words, no <form, and keys its list items by an index", () => {
    const src = code(read("app/BulletsView.tsx"));
    expect(jsxSentences(src), "the view holds a sentence as JSX text").toEqual([]);
    expect(src).not.toContain("<form");
    const keyLines = src.split("\n").filter((l) => l.includes("key="));
    expect(keyLines.length).toBeGreaterThanOrEqual(1);
    for (const l of keyLines) expect(l, `key without an index: ${l}`).toMatch(/\b(i|index|idx)\b/);
  });
});

describe("T36: the words of the block avoid the words the owner ruled out", () => {
  const FORBIDDEN = /\b(ready|tailored|improve|boost|optimi[sz]e)\b/i;
  for (const f of BULLET_APP_FILES) {
    it(`T36: ${f} contains none of: ready, tailored, improve, boost, optimise, optimize (the whole file text, comments included)`, () => {
      const hit = read(f).split("\n").find((l) => FORBIDDEN.test(l));
      expect(hit, `${f}: ${hit}`).toBeUndefined();
    });
  }
  it("T36: the new message constants of lib/saved/messages.ts (from the 8.3 bullets block to the end) contain none of them", () => {
    const all = read("lib/saved/messages.ts");
    const at = all.indexOf("// ---- Step 8.3 (docs/PLAN-8.3.md v2): the words of the bullets block");
    expect(at, "the 8.3 block marker was not found").toBeGreaterThan(-1);
    const hit = all.slice(at).split("\n").find((l) => FORBIDDEN.test(l));
    expect(hit, `messages.ts: ${hit}`).toBeUndefined();
  });
  it("T36: the guard itself catches the words (a pinned example)", () => {
    for (const w of ["ready", "Tailored", "improve", "boost", "optimise", "optimize"]) expect(FORBIDDEN.test(`a ${w} bullet`)).toBe(true);
    expect(FORBIDDEN.test("already improved")).toBe(false); // whole words only
  });
});
