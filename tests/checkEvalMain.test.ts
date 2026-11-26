import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { skills } from "@/fixtures/skills";
import { toViewAnswers } from "@/lib/cv/checkBridge";
import { requestHash } from "@/lib/engine/evalFingerprint";
import { baselineFingerprintOf, checkFingerprintOf } from "@/lib/engine/evalEveryCvCheckGuard";
import { savedReadingText } from "@/lib/engine/evalEveryCvSave";
import type { AdReading } from "@/lib/engine/evalEveryCvCompare";
import type { CvBuildResult } from "@/lib/engine/fromCv";
import type { Requirement } from "@/lib/engine/types";
import type { CheckPlan } from "@/lib/cv/checkPlan";
import type { CheckOutcome } from "@/app/runCheck";
import { checkMain, type CheckChain, type CheckDeps } from "../scripts/everyCvCheckMain";
import { makeChain } from "../scripts/everyCvCheckChain";

// EC-5b (docs/PLAN-EVERY-CV.md, the check eval; tests EM1 to EM11): the runner of `npm run eval-check`, with FAKE dependencies: the files live in a Map,
// git, the clock, the sleeper and the screen are fakes, and the chain that makes the call is a script, so no real AI is called and nothing touches the
// network. EM5 runs the REAL chain (the page's runCheck, the real route, the real checkEvidence) on a FAKE Groq fetch, in the dry mode.
// Every pair of the invented world is the same small shape: the CV has SQL on line 3 (listed) and welding on line 4 (not in our list); the ad asks for SQL
// (judged by the list, met on line 3) and for welding work (open: sent to the check; its id is not the CV skill's id, so the same-name match does not settle it); the key says met on lines 3 and 4. The scripted reply says met on line 4
// for the welding row: every pair is then equal to its key and the bar is met: 10 sent, 10 answered, 20 key rows met and found, 0 false met.

const ROOT = "/virtual/repo";
const FIX = `${ROOT}/fixtures/every-cv`;
const BASE = `${ROOT}/eval-runs/every-cv`;
const OUT = `${ROOT}/eval-runs/every-cv-check`;
const RUN = "2026-11-26T08-00-00-000Z";
const PAIRS = Array.from({ length: 10 }, (_, i) => `pair-${String(i + 1).padStart(2, "0")}`);

const CV_TEXT = "Alex Example\njane.sample@example.com | +49 30 0000000\nWrote SQL queries for sales reports.\nWelded steel frames daily.";
const AD_TEXT = "Strong SQL skills required.\nWelding experience is required.";
const KEY_TEXT = 'R1 [must] "Strong SQL skills required."\nverdict: met\ncv line(s): 3\nunsure:\nwhy:\n\nR2 [must] "Welding experience is required."\nverdict: met\ncv line(s): 4\nunsure:\nwhy:';
const req = (quote: string, ...skillIds: string[]): Requirement => ({ quote, importance: "must", skillIds });
const CV_READING: CvBuildResult = {
  skills: [
    { name: "SQL", skillId: "sql", listed: true, line: 3, quote: "Wrote SQL queries", label: "named" },
    { name: "Welding", skillId: "new:welding", listed: false, line: 4, quote: "Welded steel frames", label: "named" },
  ],
  removed: [], duplicates: 0, unlisted: [{ id: "new:welding", name: "Welding" }],
};
const AD_READING = (withWelding = true): AdReading => ({
  job: {
    id: "ad", title: "Invented role", company: null, source: null,
    constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
    requirements: withWelding ? [req("Strong SQL skills required.", "sql"), req("Welding experience is required.", "new:welding-work")] : [req("Strong SQL skills required.", "sql")],
  },
  removed: [], moved: [], unlisted: [{ id: "new:welding-work", name: "Welding work" }], notCounted: [],
});
// EC-8a: the entries are the 4 CV lines (as the page numbers them), so the welding line is entry 4.
const REPLY = { answers: [{ requirement: 1, verdict: "met", entry: 4, quote: "Welded steel frames" }], thrownAway: 0 };
const OK_CALL = { attempts: 1, statuses: [200], real429: 0, ms: 3000, inputTokens: 3000, outputTokens: 1500 };
const LIMITS = { "x-ratelimit-remaining-tokens": "6000", "x-ratelimit-limit-tokens": "8000" };
const CV_BODY = { kind: "cv request" };
const AD_BODY = { kind: "ad request" };
const VOCAB = "v".repeat(64);
const PROBE = { kind: "probe" };
const FP = baselineFingerprintOf({ cvRequest: CV_BODY, adRequest: AD_BODY, vocabulary: VOCAB, pairs: PAIRS.map((id) => ({ id, cvText: CV_TEXT, adText: AD_TEXT, keyText: KEY_TEXT })) });
const GUARD_ENV = { EXPECT_CHECK_REQUEST_HASH: requestHash(PROBE).slice(0, 10), EXPECT_CHECK_INSTRUCTIONS_LEN: "2665", EVERY_CV_GO: "yes" };

type World = { files: Map<string, string>; written: string[]; out: string[]; err: string[]; sleeps: number[]; chainLoads: number; calls: number[]; dirty: boolean; head: string };

function world(opts: { adFor?: (id: string) => AdReading; cvFp?: (id: string) => string; cvFor?: (id: string) => CvBuildResult } = {}): World {
  const files = new Map<string, string>();
  PAIRS.forEach((id) => {
    files.set(`${FIX}/${id}/cv.txt`, CV_TEXT);
    files.set(`${FIX}/${id}/ad.txt`, AD_TEXT);
    files.set(`${FIX}/${id}/key.txt`, KEY_TEXT);
    const meta = (kind: "cv" | "ad") => ({ pair: id, kind, fingerprint: kind === "cv" && opts.cvFp ? opts.cvFp(id) : FP, keyCommit: "k1", tokens: { input: 1, output: 1 } });
    files.set(`${BASE}/${RUN}/${id}/cv-reading.json`, savedReadingText(meta("cv"), (opts.cvFor ?? (() => CV_READING))(id)));
    files.set(`${BASE}/${RUN}/${id}/ad-reading.json`, savedReadingText(meta("ad"), (opts.adFor ?? (() => AD_READING()))(id)));
  });
  return { files, written: [], out: [], err: [], sleeps: [], chainLoads: 0, calls: [], dirty: false, head: "h1" };
}

type Script = (index: number, plan: CheckPlan) => { outcome: CheckOutcome; call?: typeof OK_CALL; limits?: Record<string, string> } | null;
function chainFor(w: World, script: Script = () => null, over: Partial<CheckChain> = {}): CheckChain {
  let n = 0;
  return {
    cvRequest: CV_BODY, adRequest: AD_BODY, vocabulary: VOCAB,
    probe: { body: PROBE, instructionsLength: 2665 },
    model: "model-x", settings: { temperature: 0 }, readingVersion: "3",
    buildPrompt: () => "p".repeat(2000),
    callCheck: async (plan) => {
      const index = n++;
      w.calls.push(index);
      const scripted = script(index, plan);
      if (scripted) return { outcome: scripted.outcome, call: scripted.call ?? OK_CALL, limits: scripted.limits ?? LIMITS };
      const bridged = toViewAnswers({ requirements: plan.requirements, entries: plan.entries }, REPLY);
      if (!bridged.ok) throw new Error("the invented reply is not readable");
      return { outcome: { kind: "done", checked: { key: plan.key, answers: bridged.answers, thrownAway: 0, sent: plan.requirements.length } }, call: OK_CALL, limits: LIMITS };
    },
    close: () => {},
    ...over,
  };
}

function deps(w: World, args: string[], chain: () => CheckChain | { refusal: string }, over: Partial<CheckDeps> = {}): CheckDeps {
  return {
    args,
    env: GUARD_ENV,
    root: ROOT,
    baselineRoot: BASE,
    outRoot: OUT,
    io: {
      readFile: (p) => {
        const t = w.files.get(p);
        if (t === undefined) throw new Error("no such file");
        return t;
      },
      writeFile: (p, t) => {
        w.files.set(p, t);
        w.written.push(p);
      },
      mkdirp: () => {},
      listDirs: (p) => {
        const prefix = p.endsWith("/") ? p : `${p}/`;
        return [...new Set([...w.files.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length).split("/")[0]))].filter((d) => [...w.files.keys()].some((k) => k.startsWith(`${prefix}${d}/`)));
      },
      exists: (p) => w.files.has(p) || [...w.files.keys()].some((k) => k.startsWith(`${p}/`)),
    },
    skills,
    git: { dirtyUnder: () => w.dirty, keyCommit: () => "k1", head: () => w.head },
    now: () => new Date("2026-11-26T09:00:00.000Z"),
    sleep: async (ms) => void w.sleeps.push(ms),
    out: (t) => void w.out.push(t),
    err: (t) => void w.err.push(t),
    loadChain: async () => {
      w.chainLoads++;
      return chain();
    },
    ...over,
  };
}
const said = (w: World) => w.out.join("") + w.err.join("");

afterEach(() => vi.restoreAllMocks());

describe("EC-5b the runner: failures and refusals (EM)", () => {
  it("EM0: a good counted run: ten calls, the bar is met, the report and the data are written under the output folder, nothing else", async () => {
    const w = world();
    const r = await checkMain(deps(w, [], () => chainFor(w)));
    expect(r.exitCode).toBe(0);
    expect(w.calls).toHaveLength(10);
    expect(said(w)).toContain("BAR MET");
    const folder = `${OUT}/2026-11-26T09-00-00-000Z`;
    expect(w.written.sort()).toEqual([`${folder}/check.json`, `${folder}/check.md`, ...PAIRS.map((p) => `${folder}/${p}/check.json`), `${OUT}/state.json`].sort());
    expect(w.files.get(`${folder}/check.md`)).toContain("COUNTED run.");
    expect(w.files.get(`${folder}/check.md`)).toContain("git HEAD h1");
  });

  it("EM1: a 429 stops the run: nothing after it is called, what came before is saved, exit code 1", async () => {
    const w = world();
    const script: Script = (i) => (i === 2 ? { outcome: { kind: "failed", message: "The AI service is busy right now. Please try again in a minute." }, call: { ...OK_CALL, attempts: 3, statuses: [429, 429, 429], real429: 1, inputTokens: 0, outputTokens: 0 } } : null);
    const r = await checkMain(deps(w, [], () => chainFor(w, script)));
    expect(r.exitCode).toBe(1);
    expect(w.calls).toEqual([0, 1, 2]);
    const md = w.files.get(`${OUT}/2026-11-26T09-00-00-000Z/check.md`)!;
    expect(md).toContain("STOPPED: the AI service answered 429");
    expect(md).toContain("pair-03");
    expect(w.files.has(`${OUT}/2026-11-26T09-00-00-000Z/pair-01/check.json`)).toBe(true);
    expect(w.files.has(`${OUT}/2026-11-26T09-00-00-000Z/pair-04/check.json`)).toBe(false);
    expect(JSON.parse(w.files.get(`${OUT}/state.json`)!)).toMatchObject({ complete: false, met: false }); // an incomplete counted run is remembered as incomplete: it can never make "two in a row"
  });

  it("EM2: a 500 on one pair is written down, the next pair still runs, and the call is not repeated", async () => {
    const w = world();
    const script: Script = (i) => (i === 1 ? { outcome: { kind: "failed", message: "The AI service had a problem (status 500). Please try again." }, call: { ...OK_CALL, statuses: [500], inputTokens: 0, outputTokens: 0 } } : null);
    const r = await checkMain(deps(w, [], () => chainFor(w, script)));
    expect(r.exitCode).toBe(1);
    expect(w.calls).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); // 10 calls: pair-02 once, no second try
    const md = w.files.get(`${OUT}/2026-11-26T09-00-00-000Z/check.md`)!;
    expect(md).toContain("pair-02: the call failed");
    expect(md).not.toContain("STOPPED");
  });

  it("EM3: a saved reading made under another fingerprint is refused before any call", async () => {
    const w = world({ cvFp: (id) => (id === "pair-05" ? "f".repeat(64) : FP) });
    const r = await checkMain(deps(w, [], () => chainFor(w)));
    expect(r.exitCode).toBe(1);
    expect(w.calls).toEqual([]);
    expect(said(w)).toMatch(/baseline/i);
    expect(said(w)).toContain("No AI call was made");
    expect(w.written).toEqual([]);
  });

  it("EM3b: the baseline's fingerprint recipe in the check eval is the same text as in the baseline runner (source guard)", () => {
    const base = readFileSync(join(process.cwd(), "scripts/everyCvBaselineMain.ts"), "utf8");
    const mine = readFileSync(join(process.cwd(), "lib/engine/evalEveryCvCheckGuard.ts"), "utf8");
    for (const piece of ["request: { cv: real.cvRequest.body, ad: real.adRequest.body }", 'text: `${read(id, "cv.txt")}\\n---\\n${read(id, "ad.txt")}`, key: read(id, "key.txt")']) expect(base, piece).toContain(piece);
    for (const piece of ["request: { cv: x.cvRequest, ad: x.adRequest }", "text: `${p.cvText}\\n---\\n${p.adText}`, key: p.keyText", "vocabulary: x.vocabulary"]) expect(mine, piece).toContain(piece);
  });

  it("EM4: a pair with no open requirement gets no call, the row says so, and the answered number is not hurt", async () => {
    const w = world({ adFor: (id) => (id === "pair-04" ? AD_READING(false) : AD_READING()) });
    const r = await checkMain(deps(w, [], () => chainFor(w)));
    expect(w.calls).toHaveLength(9);
    const md = w.files.get(`${OUT}/2026-11-26T09-00-00-000Z/check.md`)!;
    expect(md).toContain("pair-04: no call was made (no open requirement).");
    expect(md).toContain("3. Answered: 9 of 9 pass");
    expect(r.exitCode).toBe(0);
  });

  it("EM4b: a pair with open requirements but no CV line to send gets no call either, and its requirements are not counted as unanswered (EC-8a: the entries are the CV's lines, so this is a CV with no line at all)", async () => {
    // pair-04 has an empty CV and a key that says none for both rows (a key cannot cite a line of a CV that has none); the baseline stamp is made again for
    // the changed files, so the run is not refused for a stale baseline.
    const KEY_NONE = 'R1 [must] "Strong SQL skills required."\nverdict: none\ncv line(s):\nunsure:\nwhy:\n\nR2 [must] "Welding experience is required."\nverdict: none\ncv line(s):\nunsure:\nwhy:';
    const fp = baselineFingerprintOf({
      cvRequest: CV_BODY, adRequest: AD_BODY, vocabulary: VOCAB,
      pairs: PAIRS.map((id) => ({ id, cvText: id === "pair-04" ? "" : CV_TEXT, adText: AD_TEXT, keyText: id === "pair-04" ? KEY_NONE : KEY_TEXT })),
    });
    const w = world();
    w.files.set(`${FIX}/pair-04/cv.txt`, "");
    w.files.set(`${FIX}/pair-04/key.txt`, KEY_NONE);
    for (const id of PAIRS) {
      for (const kind of ["cv", "ad"] as const) {
        const meta = { pair: id, kind, fingerprint: fp, keyCommit: "k1", tokens: { input: 1, output: 1 } };
        w.files.set(`${BASE}/${RUN}/${id}/${kind}-reading.json`, savedReadingText(meta, kind === "cv" ? CV_READING : AD_READING()));
      }
    }
    const r = await checkMain(deps(w, [], () => chainFor(w)));
    expect(w.calls).toHaveLength(9);
    const md = w.files.get(`${OUT}/2026-11-26T09-00-00-000Z/check.md`)!;
    expect(md).toContain("pair-04: no call was made (no CV line to send).");
    expect(md).toContain("3. Answered: 9 of 9 pass");
    expect(r.exitCode).toBe(0);
  });

  it("EM8: the fingerprint: the same inputs give the same stamp; the confirm mode, a pair's prompt, the reading version and the baseline each change it; the git HEAD does not", () => {
    const base = { probeBody: PROBE, model: "m", settings: { t: 0 }, readingVersion: "3", vocabulary: VOCAB, confirm: "named", caps: { requirements: 30, entries: 60 }, baselineFingerprint: FP, keyCommit: "k1", baselineRun: RUN, prompts: PAIRS.map((id) => ({ id, text: `prompt of ${id}` })) };
    const a = checkFingerprintOf(base);
    expect(checkFingerprintOf({ ...base })).toBe(a);
    expect(checkFingerprintOf({ ...base, confirm: "all" })).not.toBe(a);
    expect(checkFingerprintOf({ ...base, readingVersion: "4" })).not.toBe(a);
    expect(checkFingerprintOf({ ...base, baselineFingerprint: "x" })).not.toBe(a);
    expect(checkFingerprintOf({ ...base, prompts: base.prompts.map((p, i) => (i === 3 ? { ...p, text: p.text + "!" } : p)) })).not.toBe(a);
    expect(Object.keys(base)).not.toContain("head");
  });

  it("EM9: two counted runs with the same fingerprint, both complete and both met: TWO IN A ROW yes; a calibration run leaves the state alone", async () => {
    const w = world();
    await checkMain(deps(w, [], () => chainFor(w)));
    expect(said(w)).toContain("TWO IN A ROW: no (no earlier counted run)");
    w.out.length = 0;
    await checkMain(deps(w, [], () => chainFor(w)));
    expect(said(w)).toContain("TWO IN A ROW: yes");
    const state = w.files.get(`${OUT}/state.json`)!;
    w.out.length = 0;
    await checkMain(deps(w, ["--calibration"], () => chainFor(w)));
    expect(said(w)).toContain("NOT COUNTED");
    expect(said(w)).toContain("TWO IN A ROW: not applicable");
    expect(w.files.get(`${OUT}/state.json`)).toBe(state);
    w.out.length = 0;
    await checkMain(deps(w, ["--confirm=all"], () => chainFor(w)));
    expect(said(w)).toContain("TWO IN A ROW: no (the earlier counted run used a different fingerprint)");
  });

  it("EM10: the real-run guards stop the script before the chain is even loaded: no variables, a counted run with --pairs, no baseline folder; a wrong hash stops it before any call", async () => {
    let w = world();
    expect((await checkMain(deps(w, [], () => chainFor(w), { env: {} }))).exitCode).toBe(1);
    expect([w.chainLoads, said(w)]).toEqual([0, expect.stringContaining("EXPECT_CHECK_REQUEST_HASH")]);
    w = world();
    expect((await checkMain(deps(w, ["--pairs=pair-01"], () => chainFor(w)))).exitCode).toBe(1);
    expect(said(w)).toContain("counted run needs all ten pairs");
    expect(w.chainLoads).toBe(0 + 1); // the baseline question loads the chain (it needs the requests to recompute the fingerprint), nothing was called
    expect(w.calls).toEqual([]);
    w = world();
    w.files.clear();
    PAIRS.forEach((id) => {
      w.files.set(`${FIX}/${id}/cv.txt`, CV_TEXT);
      w.files.set(`${FIX}/${id}/ad.txt`, AD_TEXT);
      w.files.set(`${FIX}/${id}/key.txt`, KEY_TEXT);
    });
    expect((await checkMain(deps(w, [], () => chainFor(w)))).exitCode).toBe(1);
    expect(said(w)).toMatch(/no baseline run/i);
    expect(w.chainLoads).toBe(0);
    w = world();
    expect((await checkMain(deps(w, [], () => chainFor(w), { env: { ...GUARD_ENV, EXPECT_CHECK_REQUEST_HASH: "0000000000" } }))).exitCode).toBe(1);
    expect(said(w)).toContain("No AI call was made");
    expect(w.calls).toEqual([]);
    w = world();
    w.dirty = true;
    expect((await checkMain(deps(w, [], () => chainFor(w)))).exitCode).toBe(1);
    expect(said(w)).toContain("uncommitted");
    expect(w.chainLoads).toBe(0);
  });

  it("EM11: pacing: before every call but the first the script waits at least 3 s, and longer when the minute's allowance is low", async () => {
    const w = world();
    const low = { "x-ratelimit-remaining-tokens": "1000", "x-ratelimit-limit-tokens": "8000" };
    await checkMain(deps(w, [], () => chainFor(w, (i) => (i === 0 ? { outcome: { kind: "failed", message: "x" }, limits: low } : null), { buildPrompt: () => "p".repeat(10000) })));
    expect(w.sleeps).toHaveLength(9);
    // estimate for a 10,000-character prompt: ceil((2665 + 10000 + 600) / 4) + 2500 = 3317 + 2500 = 5817; wait after the low-allowance answer: ceil((5817 - 1000) / (8000 / 60) * 1000) + 500 = 36,628 (4817 / 133.33 = 36.1275 s)
    expect(w.sleeps[0]).toBeGreaterThanOrEqual(36000);
    expect(w.sleeps.slice(1).every((s) => s === 3000 || s < 3001)).toBe(true);
  });
});

describe("EC-5b the modes (EM5, EM6, EM7)", () => {
  const exampleFiles = (w: World) => {
    for (const f of ["cv.txt", "ad.txt", "key.txt"]) w.files.set(`${FIX}/example/${f}`, readFileSync(join(process.cwd(), "fixtures/every-cv/example", f), "utf8"));
  };

  it("EM5: --dry runs the WHOLE real chain (the page's runCheck, the real route, the real checkEvidence) on a fake Groq: it writes no file, makes no network call, restores fetch and the environment", async () => {
    const w = world();
    exampleFiles(w);
    const realFetch = vi.fn(async () => { throw new Error("the network must not be touched"); });
    const keep = globalThis.fetch;
    globalThis.fetch = realFetch as unknown as typeof fetch;
    const envBefore = JSON.stringify([process.env.GROQ_API_KEY, process.env.ACCESS_CODE, process.env.GROQ_MODEL]);
    try {
      const r = await checkMain(deps(w, ["--dry"], () => ({ refusal: "unused" }), { env: {}, loadChain: async (o) => makeChain({ dry: o.dry }) }));
      expect(r.exitCode).toBe(0);
      expect(w.written).toEqual([]);
      expect(realFetch).not.toHaveBeenCalled();
      expect(globalThis.fetch).toBe(realFetch);
      expect(JSON.stringify([process.env.GROQ_API_KEY, process.env.ACCESS_CODE, process.env.GROQ_MODEL])).toBe(envBefore);
    } finally {
      globalThis.fetch = keep;
    }
    const text = said(w);
    expect(text).toContain("DRY");
    expect(text).toContain("## Against the bar");
    expect(text).toMatch(/\| example \| /);
    expect(text).not.toMatch(/gsk_|x-access-code/i);
  });

  it("EM6: --fingerprint prints the hashes, the baseline match, each pair's prompt hash and plan size with the estimate (flagging any over 7,000), calls nothing and writes nothing", async () => {
    const w = world();
    const r = await checkMain(deps(w, ["--fingerprint"], () => chainFor(w, () => null, { buildPrompt: (p) => "p".repeat(p.requirements.length * 16000) }), { env: {} }));
    expect(r.exitCode).toBe(0);
    expect(w.calls).toEqual([]);
    expect(w.written).toEqual([]);
    const t = said(w);
    expect(t).toContain(`EXPECT_CHECK_REQUEST_HASH=${GUARD_ENV.EXPECT_CHECK_REQUEST_HASH} EXPECT_CHECK_INSTRUCTIONS_LEN=2665`);
    expect(t).toContain("baseline run " + RUN + ": matches today's fingerprint");
    expect(t).toMatch(/pair-01 \| prompt [0-9a-f]{10} \| requirements 1 \| entries available 4, sent 4, dropped 0 \| estimated tokens 7317 OVER 7000/);
  });

  it("EM6b: --fingerprint with no baseline folder refuses cleanly: no chain loaded, nothing printed but the refusal", async () => {
    const w = world();
    w.files.clear();
    const r = await checkMain(deps(w, ["--fingerprint"], () => chainFor(w), { env: {} }));
    expect(r.exitCode).toBe(1);
    expect(w.chainLoads).toBe(0);
    expect(said(w)).toMatch(/no baseline run/i);
    expect(w.out).toEqual([]);
  });

  it("EM7: source guard: the chain imports the page's runCheck and the route's POST; neither script holds a copy of the proof or the plan", () => {
    const chain = readFileSync(join(process.cwd(), "scripts/everyCvCheckChain.ts"), "utf8");
    expect(chain).toMatch(/from "\.\.\/app\/runCheck"/);
    expect(chain).toMatch(/from "\.\.\/app\/api\/check\/route"/);
    expect(chain).toMatch(/runCheck\(/);
    const main = readFileSync(join(process.cwd(), "scripts/everyCvCheckMain.ts"), "utf8");
    expect(main).toMatch(/from "\.\.\/lib\/engine\/evalEveryCvCheckScore"/);
    for (const [name, src] of [["chain", chain], ["main", main]] as const) {
      expect(src, name).not.toMatch(/function proveAnswers|hasRealWord|foldText|function buildCheckPlan|function toViewAnswers/);
      expect(src, name).not.toMatch(/\.env\.local/); // the file name is never written in code; the entry loads the settings by a built-in
    }
  });
});
