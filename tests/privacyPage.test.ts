import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FACTS } from "@/lib/privacy/facts";
import * as messages from "@/lib/privacy/messages";

// Step 9.3, stage 2.3 (docs/PLAN-9.3.md sections 6 and 9, amendments A8, A10, A13): the /privacy page, app/privacy/page.tsx. Source guards, in the
// style of tests/demoView.test.ts: vitest has no browser here and no new package is allowed. Written BEFORE the page exists (red first, then green).
//
// HAND-WORKED EXPECTATIONS
//  The page, in source order (what a visitor reads, top to bottom):
//    h1 {PRIVACY_TITLE}
//    h2 {HEADING_LEAVES}          claims C1, C2, C3A, C15
//    h2 {HEADING_STORED}          claims C3B, C4, C5, C10
//    h2 {HEADING_LOGGED}          claim  C6
//    h2 {HEADING_PROCESSORS}      the CONFIRMED facts (U2a, U2b, U4a, U9), each with {LABEL_SOURCE} and {LABEL_CHECKED_ON}; a quoted fact (U2a) inside <q>
//    h2 {HEADING_COOKIES}         claim  C7
//    h2 {HEADING_CONTROLS}        claim  C9
//    h2 {HEADING_DEMO}            claim  C8
//    h2 {HEADING_NOT_CONFIRMED}   the NOT-CONFIRMED facts (U1, U3, U4b, U5, U6), their fixed sentence only
//    two links: href="/" with {LABEL_BACK_TO_APP}, href="/demo" with {LABEL_TO_DEMO}
//  Each fact is shown ONCE: confirmed facts under their topic heading, not-confirmed facts only under "Not confirmed yet" (section 6 puts U1 to U5
//  under "Who processes your text" and also lists the not-confirmed ones at the end; showing both would print five sentences twice).
//  Claim C14 (the rate limit) is rendered from fact U9 and has no constant of its own (A13).
//
//  M1  the headings appear in the order above; each section holds exactly its claims (set equality), the facts sections use CONFIRMED.map and
//      OPEN.map, and only those; every exported string constant of messages.ts is rendered as {NAME}, except FIVE: CV_INFO_LINE, AD_INFO_LINE and
//      CV_TICK (the notices at the buttons, built at stage 2.4), LINK_PRIVACY (the footer link on the first screen) and PRIVACY_DESCRIPTION (used in
//      the metadata, checked below). The metadata is `title: PRIVACY_TITLE` and `description: PRIVACY_DESCRIPTION`.
//      Count: 30 string constants - 5 exempt = 25 rendered as {NAME} = 12 claims + 8 headings + 5 labels (PRIVACY_TITLE, LABEL_SOURCE,
//      LABEL_CHECKED_ON, LABEL_BACK_TO_APP, LABEL_TO_DEMO).
//  M2  the page is static: no "use client", no `fetch(`, `cookies(`, `headers(`, `useEffect`, `useState`, `new Date`, `Date.now`, `Math.random`,
//      `process.env`, `sessionStorage`, `localStorage`, `indexedDB`; its `from "..."` imports are exactly "next", "next/link",
//      "@/lib/privacy/facts" and "@/lib/privacy/messages" (so no new dependency).
//  M4  no sentence of a fact is typed in the page: no 30-character window of any fact's `words` is in the page source, and the page imports FACTS.
//  M7  (A10) the page has the line `export const ensureStatic = "navigation";`.
//  M8  (new, proposed at stage 2.3 because the plan had no test for "no free text in the component") the page has no text of its own: (1) no JSX
//      text node holds a letter; (2) every string literal outside the import lines and className values is one of "/", "/demo", "confirmed",
//      "not-confirmed", "quoted", "navigation".
//
// COUNTS: this file has 5 tests (M1, M2, M4, M7, M8).

const root = process.cwd();
const PAGE = "app/privacy/page.tsx";
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
// The page source without comments.
const code = (): string =>
  read(PAGE)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const EXEMPT = ["CV_INFO_LINE", "AD_INFO_LINE", "CV_TICK", "LINK_PRIVACY", "PRIVACY_DESCRIPTION"];
const HEADINGS = ["HEADING_LEAVES", "HEADING_STORED", "HEADING_LOGGED", "HEADING_PROCESSORS", "HEADING_COOKIES", "HEADING_CONTROLS", "HEADING_DEMO", "HEADING_NOT_CONFIRMED"];
const CLAIMS_UNDER: Record<string, string[]> = {
  HEADING_LEAVES: ["CLAIM_C1", "CLAIM_C2", "CLAIM_C3A", "CLAIM_C15"],
  HEADING_STORED: ["CLAIM_C3B", "CLAIM_C4", "CLAIM_C5", "CLAIM_C10"],
  HEADING_LOGGED: ["CLAIM_C6"],
  HEADING_PROCESSORS: [],
  HEADING_COOKIES: ["CLAIM_C7"],
  HEADING_CONTROLS: ["CLAIM_C9"],
  HEADING_DEMO: ["CLAIM_C8"],
  HEADING_NOT_CONFIRMED: [],
};

describe("the /privacy page (PLAN-9.3 sections 6 and 9; A8, A10, A13)", () => {
  it("M1: every claim, heading and label is rendered from messages.ts, in the planned sections and order", () => {
    const src = code();
    const at = HEADINGS.map((h) => src.indexOf(`{${h}}`));
    for (const [i, h] of HEADINGS.entries()) expect(at[i], `${h} is rendered`).toBeGreaterThan(0);
    expect(at, "the headings are in the planned order").toEqual([...at].sort((a, b) => a - b));

    for (const [i, h] of HEADINGS.entries()) {
      const segment = src.slice(at[i], i + 1 < HEADINGS.length ? at[i + 1] : src.length);
      const claims = [...segment.matchAll(/\{(CLAIM_[A-Z0-9]+)\}/g)].map((m) => m[1]).sort();
      expect(claims, `claims under ${h}`).toEqual([...CLAIMS_UNDER[h]].sort());
      expect(segment.includes("CONFIRMED.map("), `${h}: confirmed facts`).toBe(h === "HEADING_PROCESSORS");
      expect(segment.includes("OPEN.map("), `${h}: not-confirmed facts`).toBe(h === "HEADING_NOT_CONFIRMED");
    }
    expect(src).toContain('FACTS.filter((f) => f.status === "confirmed")');
    expect(src).toContain('FACTS.filter((f) => f.status === "not-confirmed")');
    expect(src).toContain("<q>");
    expect(src).toContain('f.kind === "quoted"');

    const strings = Object.entries(messages).filter(([, v]) => typeof v === "string").map(([k]) => k);
    expect(strings.length).toBe(30);
    expect(EXEMPT.every((n) => strings.includes(n))).toBe(true);
    const rendered = strings.filter((n) => !EXEMPT.includes(n));
    expect(rendered.length).toBe(25);
    for (const n of rendered) expect(src.includes(`{${n}}`), `${n} is rendered as {${n}}`).toBe(true);

    expect(src).toContain("title: PRIVACY_TITLE");
    expect(src).toContain("description: PRIVACY_DESCRIPTION");
    expect(src).toContain('href="/"');
    expect(src).toContain('href="/demo"');
  });

  it("M2: the page is static: no client code, no request, no clock, no storage, and only the four planned imports", () => {
    const src = code();
    for (const w of ['"use client"', "fetch(", "cookies(", "headers(", "useEffect", "useState", "new Date", "Date.now", "Math.random", "process.env", "sessionStorage", "localStorage", "indexedDB"]) {
      expect(src.includes(w), `the page must not contain ${w}`).toBe(false);
    }
    const from = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(from).toEqual(["@/lib/privacy/facts", "@/lib/privacy/messages", "next", "next/link"]);
  });

  it("M4: no sentence of a fact is typed in the page; the facts come from lib/privacy/facts", () => {
    const src = code();
    expect(src).toContain('from "@/lib/privacy/facts"');
    for (const f of FACTS) {
      for (let i = 0; i + 30 <= f.words.length; i++) expect(src.includes(f.words.slice(i, i + 30)), `fact ${f.id} is typed in the page`).toBe(false);
    }
  });

  it("M7: the page asks the build to keep it static (A10)", () => {
    expect(code()).toContain('export const ensureStatic = "navigation";');
  });

  it("M8: the component has no text of its own: every visible word comes from messages.ts or facts.ts", () => {
    const src = code();
    // (1) a JSX text node (between > and <, with no braces) must hold no letter.
    const texts = [...src.matchAll(/>([^<>{}]*)</g)].map((m) => m[1]).filter((t) => /[A-Za-z]/.test(t));
    expect(texts, "JSX text with letters in it").toEqual([]);
    // (2) string literals, apart from imports and className values.
    const noImports = src.replace(/^import[\s\S]*?from\s+"[^"]*";?$/gm, "").replace(/className="[^"]*"/g, "");
    const literals = [...noImports.matchAll(/"([^"\\]*)"|'([^'\\]*)'|`([^`\\]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const ALLOWED = ["/", "/demo", "confirmed", "not-confirmed", "quoted", "navigation"];
    expect(literals.filter((s) => !ALLOWED.includes(s)), "string literals that are text of the component").toEqual([]);
  });
});
