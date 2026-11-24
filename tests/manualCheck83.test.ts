import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { APICallError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bulletEvalCvFixtures, bulletEvalJobs } from "@/fixtures/bullet-eval";
import * as access from "@/lib/ai/accessMessages";
import { toReadError } from "@/lib/ai/errors";
import { chooseBulletPairs, MAX_PAIRS } from "@/lib/engine/bulletPairs";
import { evalCvs, profileFromKey } from "@/lib/engine/evalBulletsProfile";
import { skills } from "@/lib/vocab";
import * as messages from "@/lib/saved/messages";

// Step 8.3, stage 7, tests first (docs/PLAN-8.3.md section 12): docs/MANUAL-CHECK-8.3.md, the manual check of the CV-bullets block in a real browser. Invented material only; no AI, no network.
// What the doc must keep true (the doc is read as text; nothing here runs the page):
//  (i)   every on-screen text the doc quotes, marked "Text:" followed by backticks, equals a constant of lib/saved/messages.ts or lib/ai/accessMessages.ts (or the
//        function's output, or the route's busy message): compared against the constant, never retyped; and the texts the check needs are all quoted;
//  (ii)  the D2 sentence stands in the first 12 lines;
//  (iii) no access code, key or token, and no "x-access-code" with a value;
//  (iv)  the pairs the doc lists equal chooseBulletPairs on the profile built from the key of the invented CV (cv-6-product) for the job kestrel-product-owner;
//  and the material the doc carries is the fixture's: the CV word for word, the requirement sentences of AD A word for word, AD B meeting nothing of the CV.

afterEach(() => vi.restoreAllMocks());

const doc = readFileSync(join(process.cwd(), "docs/MANUAL-CHECK-8.3.md"), "utf8");
const docLines = doc.split("\n");

// A fenced block that follows the first line starting with `marker` (the block's own text, without its fences).
function fencedAfter(marker: string): string {
  const at = docLines.findIndex((l) => l.startsWith(marker));
  expect(at, `the doc has a line starting "${marker}"`).toBeGreaterThanOrEqual(0);
  const open = docLines.findIndex((l, i) => i > at && l.startsWith("```"));
  const close = docLines.findIndex((l, i) => i > open && l.startsWith("```"));
  expect(open, `a fenced block opens after "${marker}"`).toBeGreaterThan(at);
  expect(close, `the fenced block after "${marker}" closes`).toBeGreaterThan(open);
  return docLines.slice(open + 1, close).join("\n");
}

describe("M1: the on-screen texts the doc quotes are the constants of the code", () => {
  const busy = () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    return toReadError(new APICallError({ message: "x", url: "https://example.invalid", requestBodyValues: {}, statusCode: 429 }), "bullets").message;
  };
  const stringExports = (m: Record<string, unknown>) => Object.values(m).filter((v): v is string => typeof v === "string");
  const quoted = [...doc.matchAll(/Text:\s*`([^`\n]+)`/g)].map((m) => m[1]);

  it("M1a: every `Text:` quote equals a string constant of messages.ts or accessMessages.ts, a function's output for the counts the doc uses, or the route's busy message", () => {
    const allowed = new Set<string>([
      ...stringExports(messages),
      ...stringExports(access),
      messages.bulletsNotice(MAX_PAIRS),
      messages.droppedLine(1),
      messages.droppedLine(2),
      busy(),
    ]);
    expect(quoted.length).toBeGreaterThanOrEqual(20);
    for (const q of quoted) expect(allowed.has(q), `not a constant of the code: ${q}`).toBe(true);
  });

  it("M1b: the texts the check needs are all quoted (the notice, the waiting button, the six states, the dropped sentence for 1 and for N, the copy and failure lines, the access texts)", () => {
    const needed = [
      messages.BULLETS_BUTTON_OPEN, // W1
      messages.BULLETS_BUTTON_WAITING, // W2
      messages.BULLETS_BUTTON_CLOSE, // W3
      messages.bulletsNotice(MAX_PAIRS), // W4
      messages.BULLETS_TITLE, // W5
      messages.BULLETS_INTRO, // W6
      messages.droppedLine(1), // W8, one
      messages.droppedLine(2), // W8, many
      messages.BULLETS_NONE_PASSED, // W9
      messages.BULLETS_NOTHING_TO_WRITE, // W10
      messages.BULLETS_COPY, // W11
      messages.REPORT_COPIED, // W12
      messages.BULLETS_TIMEOUT_LINE, // W14
      messages.COULD_NOT_REACH_LINE,
      busy(),
      access.ACCESS_LABEL,
      access.USE_CODE_LABEL,
      access.FORGET_CODE_LABEL,
      access.NEED_CODE_MESSAGE,
      access.WRONG_CODE_MESSAGE,
      access.CODE_KEPT_MESSAGE,
      access.CODE_FORGOTTEN_MESSAGE,
    ];
    for (const n of needed) expect(quoted, `the doc must quote: ${n}`).toContain(n);
  });
});

describe("M2: the D2 sentence stands in the first 12 lines", () => {
  const D2 =
    "Use invented text only: no real CV and no real ad goes into this check (rule D2), and the access code is never pasted anywhere except the app's own code box.";
  const head = docLines.slice(0, 12).join("\n");
  it("M2a: the D2 sentence, word for word", () => {
    expect(head).toContain(D2);
  });
  it("M2b: the two never-open warnings stand in the same first lines: the Request headers section and Session storage", () => {
    expect(head).toMatch(/Request headers/);
    expect(head).toMatch(/Session storage/);
  });
});

describe("M3: no secret in the doc", () => {
  it("M3a: no Groq key, no bearer token, no header name with a value, no long token-like string", () => {
    expect(doc).not.toMatch(/gsk_/i);
    expect(doc).not.toMatch(/bearer\s+\S/i);
    expect(doc).not.toMatch(/x-access-code/i); // not even the header's name: nothing to paste there
    expect(doc).not.toMatch(/access[ -]?code\s*(is|=|:)\s*\S{8,}/i);
    expect(doc).not.toMatch(/[A-Za-z0-9_-]{32,}/);
  });
});

// ---- the hand-worked pairs (written BEFORE the engine was asked): the invented CV cv-6-product, as the page numbers it (contact line becomes "[email removed] | [phone removed]"),
// and the job kestrel-product-owner (musts first, then nice-to-haves, each in the ad's order; one pair per CV line; at most 5).
// CV lines: 1 name line, 2 contact, 3 "2019-2024 Product Owner, Fabricated Apps Ltd", 4 user stories, 5 customer interviews, 6 prototypes in Figma, 7 backlog in Jira,
// 8 A/B tests, 9 roadmap and stakeholders, 10 metrics and Looker, 11 "Currently studying ..." (a learning marker: never a pair line), 12 languages.
// Musts: user stories -> line 4; user research -> line 5 (interviews); backlog -> line 7; stakeholders -> line 9. Nice: A/B tests -> line 8 (the fifth pair); Figma (line 6) is cut by the cap of 5.
const HAND: { id: number; line: number; requirement: string }[] = [
  { id: 1, line: 4, requirement: "Write clear user stories and acceptance criteria for the engineering team." },
  { id: 2, line: 5, requirement: "Talk to customers every month and turn what you learn into product decisions." },
  { id: 3, line: 7, requirement: "Own the product backlog and decide the order of work." },
  { id: 4, line: 9, requirement: "Keep senior stakeholders informed about plans and results." },
  { id: 5, line: 8, requirement: "Experience running A/B tests." },
];

describe("M4: the pairs the doc lists are the engine's", () => {
  const cvs = evalCvs(bulletEvalCvFixtures);
  const cv = cvs.find((c) => c.id === "cv-6-product")!;
  const job = bulletEvalJobs.find((j) => j.id === "kestrel-product-owner")!;
  const engine = chooseBulletPairs(profileFromKey(cv.key, cv.lines, skills), job);

  // the doc's rows: "| id | line | requirement | the line's text |", under the heading "What the block should ask for"
  const start = docLines.findIndex((l) => /^#+ .*What the block should ask for/.test(l));
  const rest = start < 0 ? [] : docLines.slice(start + 1);
  const end = rest.findIndex((l) => /^#+ /.test(l));
  const section = end < 0 ? rest : rest.slice(0, end);
  const rows = section
    .filter((l) => /^\|\s*\d+\s*\|/.test(l))
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));

  it("M4a: the hand table equals the engine (a disagreement here means STOP: the hand work or the engine is wrong)", () => {
    expect(engine.map((p) => ({ id: p.id, line: p.line, requirement: p.requirement }))).toEqual(HAND);
    for (const p of engine) expect(p.text).toBe(cv.lines[p.line - 1]);
  });

  it("M4b: the doc's section exists and lists exactly the five pairs: id, CV line number, the ad's requirement and the CV line's text, each as the engine has it", () => {
    expect(start, 'a heading "What the block should ask for"').toBeGreaterThanOrEqual(0);
    expect(rows).toEqual(engine.map((p) => [String(p.id), String(p.line), p.requirement, p.text]));
  });

  it("M4c: the contact line becomes the redacted line, and line 11 (a learning line) is in no pair", () => {
    expect(cv.lines[1]).toBe("[email removed] | [phone removed]");
    expect(doc).toContain("[email removed] | [phone removed]");
    expect(engine.map((p) => p.line)).not.toContain(11);
    expect(cv.lines).toHaveLength(12);
  });
});

describe("M5: the material the doc carries", () => {
  const fixture = bulletEvalCvFixtures.find((c) => c.id === "cv-6-product")!;
  const job = bulletEvalJobs.find((j) => j.id === "kestrel-product-owner")!;
  const GUARD_WORDS = /\b(ready|tailored|improve|boost|optimi[sz]e)\b/i;

  it("M5a: the CV block is the invented CV of fixtures/bullet-eval, word for word", () => {
    expect(fencedAfter("CV text:").trimEnd()).toBe(fixture.text.trimEnd());
  });

  it("M5b: AD A has 10 to 16 lines, and every requirement sentence of kestrel-product-owner stands in it word for word, as a line of its own", () => {
    const ad = fencedAfter("AD A:");
    const lines = ad.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    expect(lines.length).toBeGreaterThanOrEqual(10);
    expect(lines.length).toBeLessThanOrEqual(16);
    const bare = lines.map((l) => l.replace(/^[-*]\s+/, ""));
    for (const r of job.requirements) expect(bare, r.quote).toContain(r.quote);
  });

  it("M5c: AD B is short and names nothing the CV holds: no skill name of the CV's key appears in it", () => {
    const ad = fencedAfter("AD B:");
    const lines = ad.split("\n").filter((l) => l.trim() !== "");
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines.length).toBeLessThanOrEqual(16);
    const low = ad.toLowerCase();
    for (const item of fixture.key.items) for (const n of item.names) expect(low.includes(n.toLowerCase()), `AD B must not hold "${n}"`).toBe(false);
  });

  it("M5d: neither the CV nor an ad holds one of the guard words (ready, tailored, improve, boost, optimise, optimize)", () => {
    for (const t of [fencedAfter("CV text:"), fencedAfter("AD A:"), fencedAfter("AD B:")]) expect(t).not.toMatch(GUARD_WORDS);
  });
});

describe("M6: the shape of the doc", () => {
  const stepStarts = docLines.filter((l) => /^\d+\. \*\*/.test(l));

  it("M6a: at least 16 numbered steps, each with Do, Expect and Send back", () => {
    expect(stepStarts.length).toBeGreaterThanOrEqual(16);
    const steps = doc.split(/\n(?=\d+\. \*\*)/).filter((s) => /^\d+\. \*\*/.test(s));
    for (const s of steps) {
      expect(s, s.slice(0, 40)).toMatch(/\*\*Do:\*\*/);
      expect(s, s.slice(0, 40)).toMatch(/\*\*Expect:\*\*/);
      expect(s, s.slice(0, 40)).toMatch(/\*\*Send back:\*\*/);
    }
  });

  it("M6b: it says how many AI reads the check needs (5) and the pace, and has the sections: what you might see, what to send back, the result box", () => {
    expect(doc).toMatch(/AI calls this check needs: \*\*5\*\*/);
    expect(doc).toMatch(/wait about a minute/i);
    expect(doc).toMatch(/^## What you might see/m);
    expect(doc).toMatch(/^## What to send back/m);
    expect(doc).toMatch(/^## What NOT to send back/m);
    expect(doc).toMatch(/^## Result/m);
    expect(doc).toMatch(/- \[ \] /);
  });

  it("M6c: the questions per bullet and the guard words are in the steps", () => {
    for (const q of ["every word from the line", "line's order", "limiting word", "new fact"]) expect(doc).toContain(q);
    expect(doc).toMatch(/ready, tailored, improve, boost, optimise/);
  });
});

// ---- Stage 7b (two defects found in review): the request names the owner counts at step 17, and the step that must not clear the list.
// HAND TABLE (worked out before any edit; the page's `postJson` sends even with no code kept, so a first press gets a 401):
//   cv      : 2 lines: 401 (step 3, first press, no code kept yet), 200 (step 3, second press)
//   read    : 2 lines: 200 (step 4), 200 (step 16)
//   bullets : 5 lines: 200 twice (steps 6 and 13), 401 twice (step 11: the press after "Forget the code", the press after the wrong words), one failed line (step 12, offline)
//   no line for Hide, Copy, the narrow window or the words search.
// The names are the folders under app/api (the Network list names a request by the last part of its path).
function stepText(n: number): string {
  const steps = doc.split(/\n(?=\d+\. \*\*)/).filter((s) => /^\d+\. \*\*/.test(s));
  const step = steps.find((s) => s.startsWith(`${n}. **`));
  expect(step, `step ${n} exists`).toBeDefined();
  return step as string;
}

describe("M7: the request names and the Network list (stage 7b)", () => {
  const folders = readdirSync(join(process.cwd(), "app/api"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  it("M7a: the names step 17 counts are exactly the folders under app/api (bullets, cv, read); `ad` is not offered as a request name", () => {
    expect(folders).toEqual(["bullets", "cv", "read"]);
    const s17 = stepText(17);
    const offered = [...s17.matchAll(/\(`([a-z]+)` in the name\)|requests? to `([a-z]+)`|\*\*`([a-z]+)`\*\*/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    for (const f of folders) expect(s17, `step 17 names ${f}`).toContain(`\`${f}\``);
    expect(s17).not.toMatch(/`ad`/);
    expect(s17).not.toMatch(/\(`ad` in the name\)/);
    for (const o of offered) expect(folders).toContain(o);
  });

  it("M7b: step 1 tells the owner to clear the list, and step 5 does not (and no other step clears it before step 17)", () => {
    expect(stepText(1)).toMatch(/press the clear button so the list is empty/);
    expect(stepText(5)).not.toMatch(/clear/i);
    for (let n = 2; n <= 16; n++) expect(stepText(n), `step ${n}`).not.toMatch(/(?<!not )clear (the )?(Network )?list|press the clear button/i);
  });

  it("M7c: step 17 holds the hand-worked counts: cv 401 and 200, read 200 twice, bullets 200 twice, bullets 401 twice, one failed offline line; nothing for Hide, Copy, the narrow window, the words search", () => {
    const s17 = stepText(17).replace(/\s+/g, " ");
    expect(s17).toMatch(/`cv`[^.]*: \*\*2\*\* lines?[^.]*\b401\b[^.]*\b200\b/);
    expect(s17).toMatch(/`read`[^.]*: \*\*2\*\* lines?[^.]*both\s+(\*\*)?200/i);
    expect(s17).toMatch(/`bullets`[^.]*: \*\*5\*\* lines?/);
    expect(s17).toMatch(/200 twice/);
    expect(s17).toMatch(/401 twice/);
    expect(s17).toMatch(/one failed line/);
    expect(s17).toMatch(/No line for Hide, Copy, the narrow window or the words search/);
    // the send-back line asks for the counts of cv, read and bullets by status
    expect(s17).toMatch(/Send back:\*\* the counts of `cv`, `read` and `bullets` by status/);
  });

  it("M7d: \"Before you start\" explains `Text:`: before words in backticks it means those exact words appear on the page", () => {
    const start = docLines.findIndex((l) => /^## Before you start/.test(l));
    const end = docLines.findIndex((l, i) => i > start && /^## /.test(l));
    const section = docLines.slice(start, end).join("\n");
    expect(section).toMatch(/In an Expect line, `Text:` before words in backticks means those exact words appear on the page\./);
  });
});
