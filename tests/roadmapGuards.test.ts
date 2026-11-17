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

describe("no sentence literal: the words are constants in lib/saved/messages.ts", () => {
  // A string or template literal of four or more words is a sentence. Short labels (a heading, a one-word kind) are allowed.
  const SENTENCE = /(["'`])(?:(?!\1).)*?[A-Za-z]+(?: [A-Za-z'.,:;()-]+){3,}(?:(?!\1).)*?\1/;
  for (const f of FILES) {
    it(`${f} has no string literal of four or more words`, () => {
      const hit = code(read(f)).split("\n").find((l) => SENTENCE.test(l));
      expect(hit, `${f} holds a sentence literal: ${hit}`).toBeUndefined();
    });
  }
});
