import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm } from "@/lib/cv/profile";
import { fromCv } from "@/lib/engine/fromCv";
import { readCvRequestSchema } from "@/lib/schemas/cv";
import { readRequestSchema } from "@/lib/schemas/job";
import { saveProfile } from "@/lib/saved/saved";
import { MemoryStore } from "@/lib/saved/store";

// Step 9.3, stage 2.1 (docs/PLAN-9.3.md section 9 with amendments A8 to A11): the data-flow inventory, as tests. They describe main as it is on
// 2026-11-25, so they must pass at once; each is proved by a deliberate break (B2 to B6, B11 to B13 of the plan). A later change that adds a route,
// a storage key, a console line, a network call or a dependency fails here until the list below AND the privacy page are changed together, by hand.
//
// HAND-WORKED EXPECTATIONS (worked out from the greps of stage 2.0, BEFORE this file was run). The counting unit is code LINES; comment-only lines
// (starting with //, *, /* or {/*) are skipped. "Scope S" = app/** and lib/** (.ts and .tsx) minus lib/ai, lib/engine/eval*, lib/vocab.
//
//  I1   files named route.ts under app/api: exactly app/api/cv/route.ts and app/api/read/route.ts (2).
//  I1b  code lines of lib/saved/** containing fetch, postJson, XMLHttpRequest or sendBeacon: 0.
//  I2   code lines containing `postJson(` in app/**: app/accessFetch.ts 1 (:94, the definition), app/CvBox.tsx 1 (:80), app/page.tsx 1 (:78), no other file;
//       app/CvBox.tsx and app/page.tsx contain no `useEffect` (they import only useMemo and useState), so nothing is sent from an effect.
//  I3   Scope S: `fetch(`, `globalThis.fetch`, `window.fetch`, `new Request(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `<form`, `<img`,
//       `<iframe`, `<script`, `next/script`, `next/image`: 0 lines each. The bare word `fetch`: app/accessFetch.ts 2 lines (:97 the type, :101
//       `opts.fetch ?? fetch`) and no other file. `doFetch(`: 1 line (app/accessFetch.ts:102). `https?://` in code lines: 0. `href=` literals in
//       app/: exactly "/" and "/demo" (app/demo/layout.tsx:15 and app/DemoEntry.tsx:13), no `href={`. STAGE 2.3 (hand-updated): the /privacy page
//       and the footer link add three: app/page.tsx "/privacy" (the footer link), and app/privacy/page.tsx "/" (back to the app) and "/demo"
//       (the demo). The rule is now a list PER FILE, which is stronger than the old flat list: {app/DemoEntry.tsx: ["/demo"], app/demo/layout.tsx:
//       ["/"], app/page.tsx: ["/privacy"], app/privacy/page.tsx: ["/", "/demo"]}. Any other href, anywhere, or any external address still fails. lib/cv/fileToText.ts holds `useWorkerFetch: false`
//       once and `useWasm: false` once.
//  I4   `console.` code lines in all of app/ and lib/: exactly 6:
//         app/api/cv/route.ts:48      console.error("cv: unexpected error in route");
//         app/api/read/route.ts:54    console.error("read: unexpected error in route");
//         lib/ai/errors.ts:37         console.error(`${tag}: missing setting`);
//         lib/ai/errors.ts:46         console.error(`${tag}: the model's answer did not match the schema`);
//         lib/ai/errors.ts:56         console.error(`${tag}: AI service error, status ${code ?? "unknown"}`);
//         lib/ai/errors.ts:85         console.error(`${tag}: unexpected error`);
//       (line numbers are for the reader; the test compares file and text, so a moved line does not fail it, an added or changed one does.)
//  I5   in all of app/ and lib/ code lines: `sessionStorage` 1 line in app/accessFetch.ts (:28) and nowhere else; `indexedDB` 1 line in
//       lib/saved/idbStore.ts (:52) and nowhere else; `localStorage`, `document.cookie`, `cookies(`, `Set-Cookie`, `set-cookie`: 0.
//  I6   package.json "dependencies" are exactly the 8 names @ai-sdk/groq, ai, mammoth, next, pdfjs-dist, react, react-dom, zod; no dependency or
//       devDependency name contains analytics, insights, posthog, plausible, gtag, mixpanel, amplitude, sentry, datadog, umami, hotjar, fullstory
//       or segment; code lines of app/: `next/script`, `<script`, `@vercel/`, `gtag(`: 0.
//  I7   code lines of app/** outside app/api that import from "@/lib/ai/": exactly 2, both accessMessages (app/AccessBox.tsx:12, app/accessFetch.ts:9);
//       code lines of app/** outside app/api matching @ai-sdk, `from "ai"`, groq.com or createGroq: 0.
//  I8   app/api/cv/route.ts has 0 code lines with readCache; code lines of app/api/** and lib/ai/**: 0 imports of fs, node:fs, fs/promises, child_process
//       or a database / storage client (prisma, mongoose, sqlite, redis, supabase, @vercel/kv, @vercel/blob, pg); the `node:` imports there are exactly
//       two, both node:crypto (lib/ai/accessCode.ts:1, lib/ai/readCache.ts:1).
//  I9   readRequestSchema.parse({ text: "  Contact jobs@example.org  " }).text is "Contact jobs@example.org" (trimmed, the address stays).
//  I9b  readCvRequestSchema.safeParse({ lines: ["Write to jane@example.org"] }) fails with exactly 1 issue, message
//       "Remove email addresses, phone numbers and links before sending."
//  S1b  a made-up 3-line CV; the reading names Excel on line 2 (quote "sales sheets in Excel"); fromCv gives 1 proposal (Excel, line 2, "named"); with
//       the default confirm and the real buildProfile and saveProfile into a MemoryStore, the one stored profile record, as JSON, contains the text
//       of line 2 and neither the text of line 1 nor of line 3.
//
//  I10  (A8, stage 2.3) app/page.tsx has exactly one `href="/privacy"`, inside one <footer>, on a <Link> with prefetch={false} whose text is
//       {LINK_PRIVACY}, imported from next/link; it is not inside a condition (the line before it does not end with && or ?).
//
// COUNTS: this file has 13 tests (I1, I1b, I2, I3, I4, I5, I6, I7, I8, I9, I9b, S1b, I10).

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const isSource = (f: string) => /\.(ts|tsx)$/.test(f);
const allSource = (): string[] => [...walk("app"), ...walk("lib")].filter(isSource);
const scopeS = (): string[] => allSource().filter((f) => !/^lib\/ai\//.test(f) && !/^lib\/engine\/eval/.test(f) && !/^lib\/vocab\//.test(f));

type Line = { file: string; no: number; text: string };
const isCommentOnly = (t: string) => t === "" || t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
function codeLines(files: string[]): Line[] {
  const out: Line[] = [];
  for (const file of files) {
    read(file)
      .split("\n")
      .forEach((raw, i) => {
        const text = raw.trim();
        if (!isCommentOnly(text)) out.push({ file, no: i + 1, text });
      });
  }
  return out;
}
const matching = (lines: Line[], re: RegExp) => lines.filter((l) => re.test(l.text));
const perFile = (lines: Line[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const l of lines) out[l.file] = (out[l.file] ?? 0) + 1;
  return out;
};
const where = (lines: Line[]) => lines.map((l) => `${l.file}:${l.no}: ${l.text}`);

describe("the data-flow inventory of main (PLAN-9.3 section 9, A8 to A11)", () => {
  it("I1: the API routes are exactly /api/cv and /api/read", () => {
    const routes = walk("app/api").filter((f) => f.endsWith("/route.ts") || f.endsWith("/route.tsx"));
    expect(routes.sort()).toEqual(["app/api/cv/route.ts", "app/api/read/route.ts"]);
  });

  it("I1b: nothing under lib/saved can send a request", () => {
    const files = walk("lib/saved").filter(isSource);
    expect(files.length).toBeGreaterThan(0);
    expect(where(matching(codeLines(files), /fetch|postJson|XMLHttpRequest|sendBeacon/))).toEqual([]);
  });

  it("I2: postJson( is defined in accessFetch.ts and called only by CvBox.tsx and page.tsx, and neither of those has an effect", () => {
    const lines = matching(codeLines(walk("app").filter(isSource)), /postJson\(/);
    expect(perFile(lines), where(lines).join("\n")).toEqual({ "app/CvBox.tsx": 1, "app/accessFetch.ts": 1, "app/page.tsx": 1 });
    for (const f of ["app/CvBox.tsx", "app/page.tsx"]) {
      expect(where(matching(codeLines([f]), /useEffect/)), `${f} must not contain useEffect`).toEqual([]);
    }
  });

  it("I3: no network entry in app/ or lib/ except the one helper in app/accessFetch.ts, and no external address or form", () => {
    const code = codeLines(scopeS());
    expect(code.length).toBeGreaterThan(1000); // the scope really was read
    const zero = [
      /fetch\(/, /globalThis\.fetch/, /window\.fetch/, /new Request\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/,
      /<form/, /<img/, /<iframe/, /<script/, /next\/script/, /next\/image/, /https?:\/\//,
    ];
    for (const re of zero) expect(where(matching(code, re)), `pattern ${re}`).toEqual([]);

    const bare = matching(code, /\bfetch\b/);
    expect(perFile(bare), where(bare).join("\n")).toEqual({ "app/accessFetch.ts": 2 });
    const doFetch = matching(code, /doFetch\(/);
    expect(perFile(doFetch), where(doFetch).join("\n")).toEqual({ "app/accessFetch.ts": 1 });

    const appCode = codeLines(walk("app").filter(isSource));
    expect(where(matching(appCode, /href=\{/))).toEqual([]);
    const hrefs: Record<string, string[]> = {};
    for (const l of appCode) for (const m of l.text.matchAll(/href="([^"]*)"/g)) (hrefs[l.file] ??= []).push(m[1]);
    for (const k of Object.keys(hrefs)) hrefs[k].sort();
    expect(hrefs).toEqual({
      "app/DemoEntry.tsx": ["/demo"],
      "app/demo/layout.tsx": ["/"],
      "app/page.tsx": ["/privacy"],
      "app/privacy/page.tsx": ["/", "/demo"],
    });

    const pdf = read("lib/cv/fileToText.ts");
    expect(pdf.split("useWorkerFetch: false").length - 1).toBe(1);
    expect(pdf.split("useWasm: false").length - 1).toBe(1);
  });

  it("I4: console is used in exactly 6 places, each with a fixed text", () => {
    const found = matching(codeLines(allSource()), /\bconsole\./)
      .map((l) => ({ file: l.file, text: l.text }))
      .sort((a, b) => (a.file + a.text).localeCompare(b.file + b.text));
    const expected = [
      { file: "app/api/cv/route.ts", text: 'console.error("cv: unexpected error in route");' },
      { file: "app/api/read/route.ts", text: 'console.error("read: unexpected error in route");' },
      { file: "lib/ai/errors.ts", text: "console.error(`${tag}: AI service error, status ${code ?? \"unknown\"}`);" },
      { file: "lib/ai/errors.ts", text: "console.error(`${tag}: missing setting`);" },
      { file: "lib/ai/errors.ts", text: "console.error(`${tag}: the model's answer did not match the schema`);" },
      { file: "lib/ai/errors.ts", text: "console.error(`${tag}: unexpected error`);" },
    ].sort((a, b) => (a.file + a.text).localeCompare(b.file + b.text));
    expect(found).toEqual(expected);
    expect(found.length).toBe(6);
  });

  it("I5: browser storage is touched in exactly two places, and there are no cookies and no localStorage", () => {
    const code = codeLines(allSource());
    const session = matching(code, /sessionStorage/);
    expect(perFile(session), where(session).join("\n")).toEqual({ "app/accessFetch.ts": 1 });
    const idb = matching(code, /indexedDB/);
    expect(perFile(idb), where(idb).join("\n")).toEqual({ "lib/saved/idbStore.ts": 1 });
    for (const re of [/localStorage/, /document\.cookie/, /cookies\(/, /Set-Cookie/, /set-cookie/]) {
      expect(where(matching(code, re)), `pattern ${re}`).toEqual([]);
    }
  });

  it("I6: the 8 dependencies are exactly the known ones, none looks like analytics, and the app has no script or tracking call", () => {
    const pkg = JSON.parse(read("package.json")) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["@ai-sdk/groq", "ai", "mammoth", "next", "pdfjs-dist", "react", "react-dom", "zod"]);
    const banned = /analytics|insights|posthog|plausible|gtag|mixpanel|amplitude|sentry|datadog|umami|hotjar|fullstory|segment/i;
    const names = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
    expect(names.filter((n) => banned.test(n))).toEqual([]);
    const appCode = codeLines(walk("app").filter(isSource));
    for (const re of [/next\/script/, /<script/, /@vercel\//, /gtag\(/]) expect(where(matching(appCode, re)), `pattern ${re}`).toEqual([]);
  });

  it("I7: outside app/api, the app imports only the access constants from lib/ai, and never the AI library or a Groq address", () => {
    const outside = codeLines(walk("app").filter((f) => isSource(f) && !f.startsWith("app/api/")));
    const imports = matching(outside, /from\s+"@\/lib\/ai\//);
    expect(where(imports).length).toBe(2);
    expect(imports.map((l) => l.file).sort()).toEqual(["app/AccessBox.tsx", "app/accessFetch.ts"]);
    for (const l of imports) expect(l.text, `${l.file}:${l.no}`).toContain("@/lib/ai/accessMessages");
    expect(where(matching(outside, /@ai-sdk|from\s+"ai"|groq\.com|createGroq/))).toEqual([]);
  });

  it("I8: the CV route has no cache, and the server code writes no file and uses no database", () => {
    expect(where(matching(codeLines(["app/api/cv/route.ts"]), /readCache/))).toEqual([]);
    const server = codeLines([...walk("app/api"), ...walk("lib/ai")].filter(isSource));
    const storage = /from\s+["'](node:)?(fs|fs\/promises|child_process)["']|from\s+["'](prisma|@prisma\/client|mongoose|better-sqlite3|sqlite3?|redis|ioredis|@supabase\/supabase-js|@vercel\/kv|@vercel\/blob|pg)["']|require\(/;
    expect(where(matching(server, storage))).toEqual([]);
    const nodeImports = matching(server, /from\s+["']node:/);
    expect(nodeImports.map((l) => l.file).sort()).toEqual(["lib/ai/accessCode.ts", "lib/ai/readCache.ts"]);
    for (const l of nodeImports) expect(l.text).toContain('"node:crypto"');
  });

  it("I9: an ad is sent as pasted: only the outer spaces go, an email address in it stays", () => {
    const parsed = readRequestSchema.parse({ text: "  Contact jobs@example.org  " });
    expect(parsed.text).toBe("Contact jobs@example.org");
  });

  it("I9b: a CV line that still holds an email address is refused with the one plain message", () => {
    const r = readCvRequestSchema.safeParse({ lines: ["Write to jane@example.org"] });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues.length).toBe(1);
    expect(r.error.issues[0].message).toBe("Remove email addresses, phone numbers and links before sending.");
  });

  it("S1b: a saved profile holds the line that shows a kept skill, not the other lines of the CV", async () => {
    const lines = ["Managed the stockroom for a bakery", "Built weekly sales sheets in Excel", "Greeted customers at the counter"];
    const result = fromCv({ skills: [{ name: "Excel", line: 2, quote: "sales sheets in Excel" }] }, lines, skills);
    expect(result.skills.length).toBe(1);
    expect(result.skills[0].line).toBe(2);
    expect(result.skills[0].label).toBe("named");
    expect(result.skills[0].listed).toBe(true);

    const built = buildProfile(lines, result.skills, initialConfirm(result.skills), skills);
    const store = new MemoryStore();
    const stamps = { vocabularyHash: "test-vocabulary", readingVersion: "test-reading", adRequestHash: "test-request" };
    const saved = await saveProfile({ store, stamps }, built);
    expect(saved).toEqual({ ok: true });

    const records = await store.list("profile");
    expect(records.length).toBe(1);
    const json = JSON.stringify(records[0].value);
    expect(json).toContain("Built weekly sales sheets in Excel");
    expect(json).not.toContain("Managed the stockroom for a bakery");
    expect(json).not.toContain("Greeted customers at the counter");
  });

  it("I10: the first screen has one footer link to /privacy, outside every condition", () => {
    const page = read("app/page.tsx");
    expect(page.split('href="/privacy"').length - 1).toBe(1);
    expect(page.split("<footer").length - 1).toBe(1);
    expect(page).toContain('import Link from "next/link"');
    expect(page).toContain("prefetch={false}");
    expect(page).toContain("{LINK_PRIVACY}");
    const lines = page.split("\n");
    const at = lines.findIndex((l) => l.includes('href="/privacy"'));
    expect(at).toBeGreaterThan(0);
    const before = lines[at].slice(0, lines[at].indexOf("<Link") >= 0 ? lines[at].indexOf("<Link") : 0);
    expect(before).not.toMatch(/&&|\?/);
    const footerAt = lines.findIndex((l) => l.includes("<footer"));
    expect(footerAt).toBeGreaterThan(0);
    expect(footerAt).toBeLessThan(at);
    const previous = lines.slice(0, footerAt).reverse().find((l) => l.trim() !== "") ?? "";
    expect(previous).not.toMatch(/&&\s*\(?\s*$|\?\s*\(?\s*$/);
  });
});
