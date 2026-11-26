import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { requestHash } from "@/lib/engine/evalFingerprint";
import { waitForTokens } from "@/lib/engine/evalCvRun";
import { callEstimate } from "@/lib/engine/evalEveryCvRun";
import { loadSavedReading, savedReadingText } from "@/lib/engine/evalEveryCvSave";
import type { AdReading } from "@/lib/engine/evalEveryCvCompare";
import type { CvBuildResult } from "@/lib/engine/fromCv";
import type { Requirement } from "@/lib/engine/types";
import { baselineMain, type BaselineDeps, type RealReaders } from "../scripts/everyCvBaselineMain";

// EC-0b part 5 (docs/PLAN-EVERY-CV.md sections 8 to 10): the baseline runner, with FAKE dependencies. No real reader is ever imported by
// this file, no network, no disk (the files live in a Map), no environment variable of the real run.

const ROOT = "/virtual/repo";
const OUT = "/virtual/out/every-cv";
const FIX = `${ROOT}/fixtures/every-cv`;
const PAIRS = Array.from({ length: 10 }, (_, i) => `pair-${String(i + 1).padStart(2, "0")}`);

// ---- invented material, the same small shape for every pair ----------------------------------------------------------------------------
const CV_TEXT = "Alex Example\njane.sample@example.com | +49 30 0000000\nWrote SQL queries for sales reports.\nSkills: SQL, welding";
const AD_TEXT = "Strong SQL skills required.\nExperience with welding is a plus.\nYou are a reliable person.";
const KEY = (filled: boolean) =>
  [
    `R1 [must] "Strong SQL skills required."\nverdict:${filled ? " met" : ""}\ncv line(s):${filled ? " 3" : ""}\nunsure:\nwhy:`,
    `R2 [nice] "Experience with welding is a plus."\nverdict:${filled ? " none" : ""}\ncv line(s):\nunsure:\nwhy:`,
    `T1 [trait, not counted] "You are a reliable person."`,
  ].join("\n\n");

const CV_READING: CvBuildResult = {
  skills: [{ name: "SQL", skillId: "sql", listed: true, line: 3, quote: "Wrote SQL queries", label: "named" }],
  removed: [],
  duplicates: 0,
  unlisted: [],
};
const req = (quote: string, importance: "must" | "nice", ...skillIds: string[]): Requirement => ({ quote, importance, skillIds });
const AD_READING: AdReading = {
  job: {
    id: "ad", title: "Invented role", company: null, source: null,
    constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
    requirements: [req("Strong SQL skills required.", "must", "sql"), req("Experience with welding is a plus.", "nice", "new:welding")],
  },
  removed: [], moved: [], unlisted: [{ id: "new:welding", name: "Welding" }], notCounted: [],
};

// ---- the fake world ------------------------------------------------------------------------------------------------------------------------
type World = {
  files: Map<string, string>;
  written: string[];
  out: string[];
  err: string[];
  sleeps: number[];
  calls: string[]; // "cv:<n lines>" and "ad:<n chars>" in order
  loadRealCalls: number;
  dirty: boolean;
};
const CV_BODY = { kind: "cv request" };
const AD_BODY = { kind: "ad request" };
const GUARD_ENV = {
  EXPECT_REQUEST_HASH: requestHash(CV_BODY).slice(0, 10),
  EXPECT_INSTRUCTIONS_LEN: "1496",
  EXPECT_AD_REQUEST_HASH: requestHash(AD_BODY).slice(0, 10),
  EXPECT_AD_INSTRUCTIONS_LEN: "3347",
};

function world(opts: { filled?: boolean[]; cvText?: (id: string) => string } = {}): World {
  const files = new Map<string, string>();
  PAIRS.forEach((id, i) => {
    files.set(`${FIX}/${id}/cv.txt`, opts.cvText ? opts.cvText(id) : CV_TEXT);
    files.set(`${FIX}/${id}/ad.txt`, AD_TEXT);
    files.set(`${FIX}/${id}/key.txt`, KEY(opts.filled ? opts.filled[i] : true));
  });
  files.set(`${FIX}/example/cv.txt`, CV_TEXT);
  files.set(`${FIX}/example/ad.txt`, AD_TEXT);
  files.set(`${FIX}/example/key.txt`, KEY(true));
  return { files, written: [], out: [], err: [], sleeps: [], calls: [], loadRealCalls: 0, dirty: false };
}

type Over = Partial<BaselineDeps> & { readers?: Partial<RealReaders>; env?: Record<string, string>; cvError?: (n: number) => unknown };
function deps(w: World, args: string[], over: Over = {}): BaselineDeps {
  let cvCalls = 0;
  const readers: RealReaders = {
    readCv: async (lines) => {
      cvCalls++;
      w.calls.push(`cv:${lines.length}`);
      const err = over.cvError?.(cvCalls);
      if (err) throw err;
      return { ...CV_READING, usage: { inputTokens: 2000, outputTokens: 1500 }, limits: { "x-ratelimit-remaining-tokens": "1000", "x-ratelimit-limit-tokens": "8000" } };
    },
    readAd: async (text) => {
      w.calls.push(`ad:${text.length}`);
      return { ...AD_READING, usage: { inputTokens: 1800, outputTokens: 1200 }, limits: { "x-ratelimit-remaining-tokens": "5000", "x-ratelimit-limit-tokens": "8000" } };
    },
    cvRequest: { body: CV_BODY, instructionsLength: 1496 },
    adRequest: { body: AD_BODY, instructionsLength: 3347 },
    vocabulary: "v".repeat(64),
    ...over.readers,
  };
  return {
    args,
    env: over.env ?? {},
    root: ROOT,
    outRoot: OUT,
    io: {
      readFile: (p) => {
        const t = w.files.get(p);
        if (t === undefined) throw new Error("no such file");
        return t;
      },
      writeFile: (p, t) => {
        w.written.push(p);
        w.files.set(p, t);
      },
      mkdirp: () => undefined,
      listDirs: (p) => {
        const prefix = p.endsWith("/") ? p : p + "/";
        return [...new Set([...w.files.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length).split("/")[0]))];
      },
    },
    skills,
    git: { dirtyUnder: () => w.dirty, keyCommit: () => "abc1234" },
    now: () => new Date("2026-11-26T10:00:00.000Z"),
    sleep: async (ms) => void w.sleeps.push(ms),
    out: (t) => void w.out.push(t),
    err: (t) => void w.err.push(t),
    loadReal: async () => {
      w.loadRealCalls++;
      return readers;
    },
    ...(over.git ? { git: over.git } : {}),
  };
}
const REAL = (extra: Record<string, string> = {}) => ({ ...GUARD_ENV, EVERY_CV_GO: "yes", ...extra });

// ---- the five refusals --------------------------------------------------------------------------------------------------------------------

describe("EC-0b part 5: real mode refuses unless every condition holds, and says which one first", () => {
  it("B1: nothing set: refuses on the guard variables, before the real readers are loaded; nothing is written", async () => {
    const w = world();
    const r = await baselineMain(deps(w, []));
    expect(r.exitCode).toBe(1);
    expect(w.err.join("")).toContain("EXPECT_REQUEST_HASH");
    expect(w.err.join("")).toContain("No AI call was made");
    expect([w.loadRealCalls, w.calls.length, w.written.length]).toEqual([0, 0, 0]);
  });

  it("B2: guard variables set, EVERY_CV_GO not: refuses on EVERY_CV_GO", async () => {
    const w = world();
    const r = await baselineMain(deps(w, [], { env: GUARD_ENV }));
    expect(r.exitCode).toBe(1);
    expect(w.err.join("")).toContain("EVERY_CV_GO=yes");
    expect(w.loadRealCalls).toBe(0);
  });

  it("B3: a key that is not complete: refuses and names the first pair that is not (here pair-04 is blank, pair-07 half-filled)", async () => {
    const filled = PAIRS.map((id) => id !== "pair-04");
    const w = world({ filled });
    w.files.set(`${FIX}/pair-07/key.txt`, KEY(true).replace("verdict: none", "verdict:").replace("cv line(s): 3", "cv line(s): 3"));
    const r = await baselineMain(deps(w, [], { env: REAL() }));
    expect(r.exitCode).toBe(1);
    expect(w.err.join("")).toMatch(/keys are complete.*pair-04/);
    expect(w.loadRealCalls).toBe(0);
  });

  it("B4: ten complete keys but an uncommitted change under fixtures/every-cv: refuses", async () => {
    const w = world();
    w.dirty = true;
    const r = await baselineMain(deps(w, [], { env: REAL() }));
    expect(r.exitCode).toBe(1);
    expect(w.err.join("")).toContain("uncommitted");
    expect(w.err.join("")).toContain("fixtures/every-cv");
    expect(w.loadRealCalls).toBe(0);
  });

  it("B5: the example pair in the run list: refuses", async () => {
    const w = world();
    const r = await baselineMain(deps(w, ["--pairs=pair-01,example"], { env: REAL() }));
    expect(r.exitCode).toBe(1);
    expect(w.err.join("")).toContain("example");
    expect(w.loadRealCalls).toBe(0);
  });

  it("B6: the order of the conditions: with several failing, the FIRST in the order guard variables, go, keys, git, example is the one named", async () => {
    const w = world({ filled: PAIRS.map(() => false) });
    w.dirty = true;
    await baselineMain(deps(w, ["--pairs=example"], { env: { ...GUARD_ENV } })); // go missing, keys blank, git dirty, example listed
    expect(w.err.join("")).toContain("EVERY_CV_GO=yes");
    expect(w.err.join("")).not.toContain("complete");
  });

  it("B7: a hash that is not the expected one is refused right after the readers are loaded and before any call", async () => {
    const w = world();
    const r = await baselineMain(deps(w, [], { env: REAL({ EXPECT_AD_REQUEST_HASH: "0000000000" }) }));
    expect(r.exitCode).toBe(1);
    expect(w.err.join("")).toContain("ad reader");
    expect(w.err.join("")).toContain("0000000000");
    expect([w.loadRealCalls, w.calls.length]).toEqual([1, 0]);
  });

  it("B8: if the readers cannot be set up (settings missing), the run stops with their sentence and makes no call", async () => {
    const w = world();
    const d = deps(w, [], { env: REAL() });
    d.loadReal = async () => ({ refusal: "GROQ_API_KEY and GROQ_MODEL must be set. Nothing was run." });
    const r = await baselineMain(d);
    expect(r.exitCode).toBe(1);
    expect(w.err.join("")).toContain("GROQ_API_KEY and GROQ_MODEL must be set");
    expect(w.calls).toEqual([]);
  });
});

// ---- a run that is allowed (fakes only) ---------------------------------------------------------------------------------------------------

describe("EC-0b part 5: an allowed run with fake readers", () => {
  it("B9: 10 CV reads and 10 ad reads, CV then ad for each pair in order; files only under the output folder; both reports written", async () => {
    const w = world();
    const r = await baselineMain(deps(w, [], { env: REAL() }));
    expect(r.exitCode).toBe(0);
    expect(w.calls).toHaveLength(20);
    expect(w.calls.filter((c) => c.startsWith("cv:"))).toHaveLength(10);
    expect(w.calls.slice(0, 4)).toEqual(["cv:4", `ad:${AD_TEXT.length}`, "cv:4", `ad:${AD_TEXT.length}`]);
    expect(w.written.every((p) => p.startsWith(OUT + "/"))).toBe(true);
    const folder = r.runFolder as string;
    expect(folder).toBe(`${OUT}/2026-11-26T10-00-00-000Z`);
    for (const id of PAIRS) {
      expect(w.files.has(`${folder}/${id}/cv-reading.json`)).toBe(true);
      expect(w.files.has(`${folder}/${id}/ad-reading.json`)).toBe(true);
    }
    expect(w.files.has(`${folder}/baseline.md`)).toBe(true);
    expect(w.files.has(`${folder}/baseline.json`)).toBe(true);
  });

  it("B10: the CV is read from the page's numbered lines (4 lines, the contact line redacted) and the ad as the trimmed text", async () => {
    const w = world();
    let seenLines: string[] = [];
    const d = deps(w, [], { env: REAL() });
    const real = await d.loadReal();
    if ("refusal" in real) throw new Error("unexpected");
    const orig = real.readCv;
    d.loadReal = async () => ({ ...real, readCv: async (lines) => ((seenLines = lines), orig(lines)) });
    await baselineMain(d);
    expect(seenLines).toEqual(["Alex Example", "[email removed] | [phone removed]", "Wrote SQL queries for sales reports.", "Skills: SQL, welding"]);
  });

  it("B11: the screen shows the summary table and no CV text, no requirement sentence, no environment value", async () => {
    const w = world();
    await baselineMain(deps(w, [], { env: REAL({ GROQ_API_KEY: "gsk_FAKE_VALUE_FOR_THE_TEST" }) }));
    const screen = w.out.join("");
    expect(screen).toContain("| Pair |");
    expect(screen).toContain("pair-01");
    expect(screen).not.toContain("Wrote SQL");
    expect(screen).not.toContain("Strong SQL skills required");
    expect(screen).not.toContain("gsk_");
  });

  it("B12: baseline.md has the sections of the plan and a plain 'How to read this'; neither report nor reading holds the CV text, an access code or the key value", async () => {
    const w = world();
    const r = await baselineMain(deps(w, [], { env: REAL({ GROQ_API_KEY: "gsk_FAKE_VALUE_FOR_THE_TEST", ACCESS_CODE: "not-a-real-access-code" }) }));
    const md = w.files.get(`${r.runFolder}/baseline.md`) as string;
    for (const h of ["## Per pair", "## Per requirement", "## Recall ceiling", "## Cross-language pairs", "## Tokens", "## How to read this"]) expect(md, h).toContain(h);
    const all = [...w.files.entries()].filter(([p]) => p.startsWith(OUT)).map(([, t]) => t).join("\n");
    expect(all).not.toContain("gsk_");
    expect(all).not.toContain("not-a-real-access-code");
    expect(md).not.toContain("Wrote SQL queries");
    expect(all).toContain("abc1234"); // the commit of the key files
  });

  it("B13: tokens are recorded for every call and added up; 20 calls of 3,500 and 3,000 tokens: 10 x 3,500 + 10 x 3,000 = 65,000", async () => {
    const w = world();
    const r = await baselineMain(deps(w, [], { env: REAL() }));
    const json = JSON.parse(w.files.get(`${r.runFolder}/baseline.json`) as string);
    expect(json.tokens.total).toBe(65_000);
    expect(json.tokens.calls).toHaveLength(20);
    expect(json.tokens.calls[0]).toMatchObject({ pair: "pair-01", kind: "cv", input: 2000, output: 1500 });
    expect(json.rate429).toBeNull();
  });

  it("B14: the per-pair and per-requirement results are in the data (R1 agree, R2 could not judge in each pair)", async () => {
    const w = world();
    const r = await baselineMain(deps(w, [], { env: REAL() }));
    const json = JSON.parse(w.files.get(`${r.runFolder}/baseline.json`) as string);
    expect(json.pairs).toHaveLength(10);
    expect(json.pairs[0].counted).toMatchObject({ agree: 1, "could-not-judge": 1 });
    expect(json.summary.crossLanguage.pairs).toEqual(["pair-06", "pair-10"]);
  });
});

describe("EC-0c: the real flow computes both sets, and the headline is the one before the kept skills", () => {
  it("B21: with a CV reading that holds a named unlisted skill (Welding, line 4): headline R2 'could not judge', second set R2 met by line 4, and the key says none: 10 same-name mistakes", async () => {
    const w = world();
    const kept: CvBuildResult = {
      ...CV_READING,
      skills: [...CV_READING.skills, { name: "Welding", skillId: "new:welding", listed: false, line: 4, quote: "welding", label: "named" }],
      unlisted: [{ id: "new:welding", name: "Welding" }],
    };
    const base = deps(w, [], { env: REAL() });
    const real = await base.loadReal();
    if ("refusal" in real) throw new Error("unexpected");
    base.loadReal = async () => ({ ...real, readCv: async () => ({ ...kept, usage: { inputTokens: 1, outputTokens: 1 } }) });
    const r = await baselineMain(base);
    expect(r.exitCode).toBe(0);
    const json = JSON.parse(w.files.get(`${r.runFolder}/baseline.json`) as string);
    expect(json.pairs[0].rows.find((x: { id: string }) => x.id === "R2").today).toEqual({ kind: "unjudged" });
    expect(json.afterSameName.pairs[0].rows.find((x: { id: string }) => x.id === "R2").today).toEqual({ kind: "met", line: 4 });
    expect(json.afterSameName.effect.toMet).toBe(10);
    expect(json.afterSameName.effect.mistakes).toHaveLength(10); // the key says none for R2 in every pair
    const md = w.files.get(`${r.runFolder}/baseline.md`) as string;
    expect(md).toContain("Same-name mistakes (the match says met, the key says partly or none): 10");
    expect(w.out.join("")).toContain("| pair-01 | after the same-name match |");
  });
});

// ---- the pacing and the stop on a 429 ------------------------------------------------------------------------------------------------------

describe("EC-0b part 5: pacing for the near-cap CV, and a 429 stops the run", () => {
  it("B15: the existing waitForTokens handles a call of about 7,000 tokens: with 1,000 of 8,000 left it waits for the missing 6,000 at 8,000 a minute", () => {
    // hand: 6,000 missing tokens x 7.5 ms (8,000 a minute = 133.33 a second) = 45,000 ms, plus the 500 ms margin: 45,500 ms
    expect(waitForTokens({ "x-ratelimit-remaining-tokens": "1000", "x-ratelimit-limit-tokens": "8000" }, 7000)).toBe(45_500);
    expect(waitForTokens({ "x-ratelimit-remaining-tokens": "7500", "x-ratelimit-limit-tokens": "8000" }, 7000)).toBe(0);
  });

  it("B16: the per-call estimate: a CV of 11,000 characters is (1,496 + 1,000 + 11,000) / 4 = 3,374 input + 3,000 output = 6,374; never above 7,800", () => {
    expect(callEstimate("cv", { instructionsLength: 1496, textChars: 11_000 })).toBe(6374);
    expect(callEstimate("cv", { instructionsLength: 1496, textChars: 400 })).toBe(Math.ceil((1496 + 1000 + 400) / 4) + 3000); // 3,724
    expect(callEstimate("cv", { instructionsLength: 1496, textChars: 60_000 })).toBe(7800);
    // an ad: (3,347 + 1,500 + 1,000) / 4 = 1,462 (rounded up) + 2,500 = 3,962
    expect(callEstimate("ad", { instructionsLength: 3347, textChars: 1000 })).toBe(3962);
  });

  it("B17: before the near-cap CV the runner waits for what that call needs, not just the 3,000 ms gap", async () => {
    // pair-02 gets a CV of 10,991 characters as the page counts them: the four usual lines (12 + 33 + 36 + 20 = 101 after the redaction)
    // and one long line of 10,890. The ad is 89 characters (27 + 34 + 26 + 2 line breaks).
    const w = world({ cvText: (id) => (id === "pair-02" ? `${CV_TEXT}\n${"b".repeat(10_890)}` : CV_TEXT) });
    await baselineMain(deps(w, ["--pairs=pair-01,pair-02"], { env: REAL() }));
    // Calls: cv(pair-01), ad(pair-01), cv(pair-02), ad(pair-02). A wait comes before the 2nd, 3rd and 4th call: sleeps[0], [1], [2].
    // The allowance refills 8,000 a minute = 133.33 a second = 7.5 ms for each missing token (waitForTokens rounds up to the millisecond and adds 500 ms).
    // Before ad(pair-01): the CV read left 1,000 of 8,000. The ad estimate is ceil((3,347 + 1,500 + 89) / 4) = 1,234 plus 2,500 = 3,734.
    //   hand: (3,734 - 1,000) = 2,734 missing tokens x 7.5 ms = 20,505 ms, plus 500 = 21,005 ms.
    expect(w.sleeps[0]).toBe(21_005);
    // Before cv(pair-02): the ad read left 5,000. The CV estimate is ceil((1,496 + 1,000 + 10,991) / 4) = 3,372 plus 3,000 = 6,372.
    //   hand: (6,372 - 5,000) = 1,372 x 7.5 ms = 10,290 ms, plus 500 = 10,790 ms.
    expect(w.sleeps[1]).toBe(10_790);
  });

  it("B17b (EC-8c 3.2): a 96-line CV is flagged before any call, in --fingerprint (no call) and at the start of a real run; with only short CVs the line says none", async () => {
    // pair-02: 96 lines of 100 characters (the page's count: no contact detail, no blank line): CV estimate min(7,800, ceil((1,496 + 1,000 + 9,600) / 4) + 9,600) = 7,800.
    const long = (id: string) => (id === "pair-02" ? Array.from({ length: 96 }, () => "a".repeat(100)).join("\n") : CV_TEXT);
    const wf = world({ cvText: long });
    const f = await baselineMain(deps(wf, ["--fingerprint"]));
    expect(f.exitCode).toBe(0);
    expect(wf.calls).toEqual([]);
    expect(wf.out.join("")).toContain("Reads estimated over 7,000 tokens: pair-02 CV read (7,800).");
    const wr = world({ cvText: long });
    await baselineMain(deps(wr, ["--pairs=pair-01,pair-02"], { env: REAL() }));
    expect(wr.out.join("")).toContain("Reads estimated over 7,000 tokens: pair-02 CV read (7,800).");
    const wn = world();
    await baselineMain(deps(wn, ["--fingerprint"]));
    expect(wn.out.join("")).toContain("Reads estimated over 7,000 tokens: none.");
  });

  it("B18: a 429 stops at once: no retry, no later pair is read, what exists is saved, the stop names the pair and the kind of read, exit 1", async () => {
    const w = world();
    const err429 = Object.assign(new Error("The AI service is busy right now. Please try again in a minute."), { status: 429 });
    const r = await baselineMain(deps(w, [], { env: REAL(), cvError: (n) => (n === 3 ? err429 : null) }));
    expect(r.exitCode).toBe(1);
    expect(w.calls).toEqual(["cv:4", `ad:${AD_TEXT.length}`, "cv:4", `ad:${AD_TEXT.length}`, "cv:4"]); // the third CV call is the last call, made once
    expect(w.err.join("")).toContain("pair-03");
    expect(w.err.join("")).toContain("429");
    const folder = r.runFolder as string;
    expect(w.files.has(`${folder}/pair-02/ad-reading.json`)).toBe(true);
    expect(w.files.has(`${folder}/pair-03/cv-reading.json`)).toBe(false);
    const json = JSON.parse(w.files.get(`${folder}/baseline.json`) as string);
    expect(json.rate429).toEqual({ pair: "pair-03", kind: "cv" });
    expect(json.pairs).toHaveLength(2); // only the pairs that were read completely
  });

  it("B19: another failure (not 429) is recorded for that pair, no retry, and the run goes on with the next pair", async () => {
    const w = world();
    const err500 = Object.assign(new Error("The AI service had a problem (status 500). Please try again."), { status: 502 });
    const r = await baselineMain(deps(w, [], { env: REAL(), cvError: (n) => (n === 2 ? err500 : null) }));
    expect(r.exitCode).toBe(1);
    expect(w.calls.filter((c) => c.startsWith("cv:"))).toHaveLength(10); // each CV called once; pair-02 not repeated
    const json = JSON.parse(w.files.get(`${r.runFolder}/baseline.json`) as string);
    expect(json.failed).toEqual([{ pair: "pair-02", kind: "cv", reason: "AI service error (status 502)" }]);
    expect(json.pairs).toHaveLength(9);
  });
});

// ---- saved readings ------------------------------------------------------------------------------------------------------------------------

describe("EC-0b part 5: saved readings (EC-5 reuses them)", () => {
  const meta = { pair: "pair-01", kind: "cv" as const, fingerprint: "f".repeat(64), keyCommit: "abc1234", tokens: { input: 10, output: 5 } };

  it("V1: round trip: what is saved is what is loaded when the fingerprint is today's", () => {
    const text = savedReadingText(meta, CV_READING);
    const r = loadSavedReading<CvBuildResult>(text, "f".repeat(64));
    expect(r).toEqual({ ok: true, saved: { ...meta, reading: CV_READING } });
  });

  it("V2: a reading saved under a different fingerprint is refused, with a plain sentence", () => {
    const r = loadSavedReading<CvBuildResult>(savedReadingText(meta, CV_READING), "e".repeat(64));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain("different");
  });

  it("V3: text that is not a saved reading is refused, never trusted", () => {
    expect(loadSavedReading("not json", "f".repeat(64)).ok).toBe(false);
    expect(loadSavedReading(JSON.stringify({ fingerprint: "f".repeat(64) }), "f".repeat(64)).ok).toBe(false);
  });
});

// ---- the dry mode -----------------------------------------------------------------------------------------------------------------------

describe("EC-0b part 5: --dry", () => {
  it("D1: --dry prints the layout for the example pair from canned readings: no guard variables, no real reader loaded, nothing written", async () => {
    const w = world({ filled: PAIRS.map(() => false) });
    for (const f of ["cv.txt", "ad.txt", "key.txt"]) w.files.set(`${FIX}/example/${f}`, readFileSync(join(process.cwd(), "fixtures/every-cv/example", f), "utf8"));
    const r = await baselineMain(deps(w, ["--dry"], {}));
    expect(r.exitCode).toBe(0);
    expect(w.loadRealCalls).toBe(0);
    expect(w.written).toEqual([]);
    const screen = w.out.join("");
    expect(screen).toContain("DRY RUN");
    expect(screen).toContain("| Pair |");
    expect(screen).toContain("example");
  });

  it("D2: the dry path cannot reach the real readers: the entry script loads them only by a dynamic import, the other files never import lib/ai (source guards)", () => {
    const entry = readFileSync(join(process.cwd(), "scripts/everyCvBaseline.ts"), "utf8");
    expect(entry).not.toMatch(/^import .*lib\/ai\//m);
    expect(entry).not.toMatch(/^import .* from "(ai|@ai-sdk\/groq)"/m);
    expect(entry).toMatch(/await import\("\.\.\/lib\/ai\/readCv"\)/);
    for (const f of ["scripts/everyCvBaselineMain.ts", "lib/engine/evalEveryCvRun.ts", "lib/engine/evalEveryCvSave.ts", "lib/engine/evalEveryCvGuard.ts", "lib/engine/evalEveryCvReport.ts", "lib/engine/evalEveryCvCanned.ts", "lib/engine/evalEveryCvCompare.ts"]) {
      expect(readFileSync(join(process.cwd(), f), "utf8"), f).not.toMatch(/lib\/ai\/|from "ai"|@ai-sdk|process\.env|loadEnvFile/);
    }
  });

  it("D3: no test file imports the entry script or a real reader for this feature", () => {
    for (const f of readdirSync(join(process.cwd(), "tests")).filter((n) => /^everyCv.*\.test\.ts$/.test(n))) {
      const src = readFileSync(join(process.cwd(), "tests", f), "utf8");
      expect(src, f).not.toMatch(/scripts\/everyCvBaseline"/);
      expect(src, f).not.toMatch(/from "@\/lib\/ai\/|from "\.\.\/lib\/ai\//);
    }
  });

  it("D4: eval-runs/ stays ignored by git, also for this feature's folder", () => {
    expect(() => execFileSync("git", ["check-ignore", "-q", "eval-runs/every-cv/2026-11-26T10-00-00-000Z/baseline.md"], { cwd: process.cwd() })).not.toThrow();
  });
});
