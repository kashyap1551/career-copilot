import { numberLines } from "../lib/cv/numberLines";
import { removeContactDetails } from "../lib/cv/redact";
import { cannedExampleReadings } from "../lib/engine/evalEveryCvCanned";
import { compareBaseline, summarizeBaseline, type AdReading, type PairBaseline } from "../lib/engine/evalEveryCvCompare";
import { firstRefusal, hashRefusal } from "../lib/engine/evalEveryCvGuard";
import { checkEveryCvKey } from "../lib/engine/evalEveryCvKey";
import { baselineJson, baselineMarkdown, summaryTable, type ReportInput } from "../lib/engine/evalEveryCvReport";
import { flaggedCalls, OVER_TOKENS, readAllPairs, type AdOutcome, type CvOutcome, type PairInput } from "../lib/engine/evalEveryCvRun";
import { savedReadingText } from "../lib/engine/evalEveryCvSave";
import { evalFingerprint, requestHash } from "../lib/engine/evalFingerprint";
import { loadPairKeys } from "../lib/engine/evalEveryCvStatus";
import type { Skill } from "../lib/engine/types";

// The logic of `npm run every-cv:baseline` (docs/PLAN-EVERY-CV.md section 10, EC-0): today's product on the ten accuracy pairs, read once
// and compared with the owner's keys. EVERYTHING that touches the world is passed in (the files, git, the clock, the sleeper, the screen,
// the two real readers), so the tests run it with fakes and no AI is called. This file imports no AI code and no environment: the real
// readers arrive through `loadReal`, which the entry script (scripts/everyCvBaseline.ts) supplies and which is called ONLY after every
// refusal that can be decided from files and settings alone.
//
//   --dry           canned readings for the EXAMPLE pair only, to print the report layout; needs nothing; writes nothing.
//   --fingerprint   prints what the guard variables must be (loads the readers, makes NO call); needs no guard variables.
//   (nothing)       a REAL run: refuses unless all five conditions of lib/engine/evalEveryCvGuard.ts hold.
//   --pairs=a,b     a shorter run list (never the example).

export type RealReaders = {
  readCv: (lines: string[]) => Promise<CvOutcome>;
  readAd: (text: string) => Promise<AdOutcome>;
  cvRequest: { body: unknown; instructionsLength: number };
  adRequest: { body: unknown; instructionsLength: number };
  vocabulary: string;
};

export type BaselineDeps = {
  args: string[];
  env: Record<string, string | undefined>;
  root: string; // the project folder
  outRoot: string; // where a run's folder is made (eval-runs/every-cv)
  io: {
    readFile: (path: string) => string;
    writeFile: (path: string, text: string) => void;
    mkdirp: (path: string) => void;
    listDirs: (path: string) => string[];
  };
  skills: Skill[];
  git: { dirtyUnder: (relPath: string) => boolean; keyCommit: () => string };
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  out: (text: string) => void;
  err: (text: string) => void;
  loadReal: () => Promise<RealReaders | { refusal: string }>;
};

const CROSS_LANGUAGE = new Set(["pair-06", "pair-10"]);
const PAIR_DIR = /^pair-\d\d$/;
const MIN_GAP_MS = 3000; // the same gap the other evals keep between two calls (20 calls a minute at most; the limit is 30)

// EC-8c: the reads estimated over 7,000 tokens, said before any call (a flag, not a stop: the pacing already waits for what such a call needs).
function flaggedLine(pairs: PairInput[], cvInstructionsLength: number, adInstructionsLength: number): string {
  const flagged = flaggedCalls(pairs, cvInstructionsLength, adInstructionsLength);
  return flagged.length === 0
    ? `Reads estimated over ${OVER_TOKENS.toLocaleString("en-US")} tokens: none.`
    : `Reads estimated over ${OVER_TOKENS.toLocaleString("en-US")} tokens: ${flagged.map((f) => `${f.pair} ${f.kind === "cv" ? "CV" : "ad"} read (${f.estimate.toLocaleString("en-US")})`).join(", ")}.`;
}

const pageLines = (cv: string) => numberLines(removeContactDetails(cv)); // exactly what the page sends (app/CvBox.tsx)

export async function baselineMain(deps: BaselineDeps): Promise<{ exitCode: number; runFolder: string | null }> {
  const { args, env, io } = deps;
  const fixtures = `${deps.root}/fixtures/every-cv`;
  const stop = (text: string) => {
    deps.err(text.endsWith("\n") ? text : text + "\n");
    return { exitCode: 1, runFolder: null };
  };
  const read = (pair: string, file: string) => io.readFile(`${fixtures}/${pair}/${file}`);

  // ---- --dry: the layout, from canned readings of the example pair --------------------------------------------------------------------
  if (args.includes("--dry")) {
    const cvText = read("example", "cv.txt");
    const adText = read("example", "ad.txt").trim();
    const lines = pageLines(cvText);
    const key = checkEveryCvKey(read("example", "key.txt"), adText, lines.length);
    const { cv, ad } = cannedExampleReadings(lines, adText, deps.skills);
    const base = { pair: "example", crossLanguage: false, key, cvLines: lines, cv, ad, skills: deps.skills };
    const before = compareBaseline({ ...base, withKept: false });
    const after = compareBaseline({ ...base, withKept: true });
    deps.out("DRY RUN: canned readings of the EXAMPLE pair only, to show the layout. Nothing was read, nothing was saved.\n\n");
    deps.out(summaryTable([before], [after]));
    return { exitCode: 0, runFolder: null };
  }

  // ---- the run list and the ten keys -----------------------------------------------------------------------------------------------------
  const dirs = io.listDirs(fixtures);
  const tenDirs = dirs.filter((d) => PAIR_DIR.test(d)).sort();
  const listArg = args.find((a) => a.startsWith("--pairs="));
  const runList = listArg ? listArg.slice("--pairs=".length).split(",").map((s) => s.trim()).filter((s) => s !== "") : tenDirs;
  const wantsFingerprint = args.includes("--fingerprint");

  if (!wantsFingerprint) {
    const tenKeys = loadPairKeys(io.readFile, fixtures, tenDirs).pairs;
    const refusal = firstRefusal({ env, tenKeys, gitDirty: () => deps.git.dirtyUnder("fixtures/every-cv"), runList });
    if (refusal) return stop(refusal);
  }

  // ---- only now the real readers are loaded (the entry script imports them here, by a dynamic import) ------------------------------------
  const real = await deps.loadReal();
  if ("refusal" in real) return stop(real.refusal);
  const cvHash10 = requestHash(real.cvRequest.body).slice(0, 10);
  const adHash10 = requestHash(real.adRequest.body).slice(0, 10);

  if (wantsFingerprint) {
    deps.out(
      [
        `CV reader: request ${cvHash10} | INSTRUCTIONS ${real.cvRequest.instructionsLength.toLocaleString("en-US")} characters`,
        `ad reader: request ${adHash10} | INSTRUCTIONS ${real.adRequest.instructionsLength.toLocaleString("en-US")} characters`,
        `vocab ${real.vocabulary.slice(0, 10)}`,
        "For a real run set: EXPECT_REQUEST_HASH, EXPECT_INSTRUCTIONS_LEN (the CV reader) and EXPECT_AD_REQUEST_HASH, EXPECT_AD_INSTRUCTIONS_LEN (the ad reader) to the values above, and EVERY_CV_GO=yes.",
        `EXPECT_REQUEST_HASH=${cvHash10} EXPECT_INSTRUCTIONS_LEN=${real.cvRequest.instructionsLength} EXPECT_AD_REQUEST_HASH=${adHash10} EXPECT_AD_INSTRUCTIONS_LEN=${real.adRequest.instructionsLength}`,
        flaggedLine(tenDirs.map((id) => ({ id, cvLines: pageLines(read(id, "cv.txt")), adText: read(id, "ad.txt").trim() })), real.cvRequest.instructionsLength, real.adRequest.instructionsLength),
        "",
      ].join("\n"),
    );
    return { exitCode: 0, runFolder: null };
  }

  const mismatch = hashRefusal(
    env,
    { hash10: cvHash10, instructionsLength: real.cvRequest.instructionsLength },
    { hash10: adHash10, instructionsLength: real.adRequest.instructionsLength },
  );
  if (mismatch) return stop(mismatch);

  // ---- the material --------------------------------------------------------------------------------------------------------------------
  const keys = loadPairKeys(io.readFile, fixtures, runList).pairs;
  const inputs: PairInput[] = runList.map((id) => ({ id, cvLines: pageLines(read(id, "cv.txt")), adText: read(id, "ad.txt").trim() }));
  const fingerprint = evalFingerprint({
    request: { cv: real.cvRequest.body, ad: real.adRequest.body },
    ads: runList.map((id) => ({ id, text: `${read(id, "cv.txt")}\n---\n${read(id, "ad.txt")}`, key: read(id, "key.txt") })),
    vocabulary: real.vocabulary,
  });
  deps.out(`${flaggedLine(inputs, real.cvRequest.instructionsLength, real.adRequest.instructionsLength)}\n`);
  const keyCommit = deps.git.keyCommit();
  const runId = deps.now().toISOString().replace(/[:.]/g, "-");
  const folder = `${deps.outRoot}/${runId}`;

  // ---- the reads, one by one, each saved at once -----------------------------------------------------------------------------------------
  const save = (pair: string, kind: "cv" | "ad", o: CvOutcome | AdOutcome) => {
    const { usage, limits: _limits, ...reading } = o as (CvOutcome | AdOutcome) & { limits?: unknown };
    void _limits;
    io.mkdirp(`${folder}/${pair}`);
    io.writeFile(
      `${folder}/${pair}/${kind}-reading.json`,
      savedReadingText({ pair, kind, fingerprint, keyCommit, tokens: { input: usage?.inputTokens ?? 0, output: usage?.outputTokens ?? 0 } }, reading),
    );
  };
  const run = await readAllPairs(inputs, {
    readCv: real.readCv,
    readAd: real.readAd,
    sleep: deps.sleep,
    minGapMs: MIN_GAP_MS,
    cvInstructionsLength: real.cvRequest.instructionsLength,
    adInstructionsLength: real.adRequest.instructionsLength,
    onRead: save,
  });

  // ---- compare the pairs that were read completely -----------------------------------------------------------------------------------------
  const pairs: PairBaseline[] = []; // the headline set: before the kept skills
  const pairsAfter: PairBaseline[] = []; // after the same-name match
  for (const input of inputs) {
    const cv = run.cv[input.id];
    const ad = run.ad[input.id];
    const key = keys.find((k) => k.id === input.id)?.check;
    if (!cv || !ad || !key) continue;
    const base = { pair: input.id, crossLanguage: CROSS_LANGUAGE.has(input.id), key, cvLines: input.cvLines, cv, ad: ad as AdReading, skills: deps.skills };
    pairs.push(compareBaseline({ ...base, withKept: false }));
    pairsAfter.push(compareBaseline({ ...base, withKept: true }));
  }

  const report: ReportInput = {
    info: { runId, fingerprint, keyCommit, vocabulary: real.vocabulary, dry: false },
    pairs,
    pairsAfter,
    calls: run.calls,
    stopped: run.stopped,
    failed: run.failed,
  };
  io.mkdirp(folder);
  io.writeFile(`${folder}/baseline.md`, baselineMarkdown(report));
  io.writeFile(`${folder}/baseline.json`, JSON.stringify(baselineJson(report), null, 2) + "\n");

  deps.out(summaryTable(pairs, pairsAfter));
  const s = summarizeBaseline(pairs);
  deps.out(`Answered today: ${s.all.answered} of ${s.all.total}. Tokens: ${run.calls.reduce((n, c) => n + c.input + c.output, 0)} in ${run.calls.length} calls. Saved in ${folder}\n`);

  if (run.stopped) {
    deps.err(`Stopped: the AI service answered 429 (busy) at ${run.stopped.pair} (${run.stopped.kind === "cv" ? "CV read" : "ad read"}). Nothing was retried. What was read before it is saved in ${folder}.\n`);
    return { exitCode: 1, runFolder: folder };
  }
  for (const f of run.failed) deps.err(`${f.pair}: the ${f.kind === "cv" ? "CV" : "ad"} read failed (${f.reason}). It was not retried.\n`);
  return { exitCode: run.failed.length > 0 ? 1 : 0, runFolder: folder };
}
