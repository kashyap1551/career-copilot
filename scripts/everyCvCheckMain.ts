import { numberLines } from "../lib/cv/numberLines";
import { removeContactDetails } from "../lib/cv/redact";
import { PLAN_MAX_ENTRIES, PLAN_MAX_REQUIREMENTS, type CheckPlan } from "../lib/cv/checkPlan";
import type { CheckOutcome } from "../app/runCheck";
import { cannedExampleReadings } from "../lib/engine/evalEveryCvCanned";
import { answersFromKey } from "../lib/engine/evalEveryCvCheckCanned";
import type { CallSummary } from "../lib/engine/evalEveryCvCheckFetch";
import { baselineFingerprintOf, checkFingerprintOf, checkHashRefusal, firstCheckRefusal } from "../lib/engine/evalEveryCvCheckGuard";
import { checkJson, checkMarkdown, type CheckInfo } from "../lib/engine/evalEveryCvCheckReport";
import { bar, BIG_CALL_TOKENS, estimateTokens, numbersOf, pacingWaitMs, planFor, scorePair, type ConfirmMode, type PairResult } from "../lib/engine/evalEveryCvCheckScore";
import { requestHash } from "../lib/engine/evalFingerprint";
import { paceBeforeCall, TokenWindow } from "../lib/engine/evalPacing";
import { checkEveryCvKey } from "../lib/engine/evalEveryCvKey";
import { loadSavedReading } from "../lib/engine/evalEveryCvSave";
import { loadPairKeys } from "../lib/engine/evalEveryCvStatus";
import { twoInARow, type RunState } from "../lib/engine/evalRun";
import type { AdReading } from "../lib/engine/evalEveryCvCompare";
import type { CvBuildResult } from "../lib/engine/fromCv";
import type { Skill } from "../lib/engine/types";

// The logic of `npm run eval-check` (docs/PLAN-EVERY-CV.md, the check eval): the real check on the ten accuracy pairs, scored against the owner's keys.
// EVERYTHING that touches the world is passed in (files, git, the clock, the sleeper, the screen and the chain that makes the call), so the tests run it
// with fakes and no AI is called. The call itself is the PAGE'S OWN click (runCheck) into the real route, built in scripts/everyCvCheckChain.ts. This
// file holds no copy of the proof, the plan or the page's rules: it asks lib for them.
//
//   --dry           the EXAMPLE pair only, with a fake model that answers from its key; the whole real chain runs; writes nothing; needs no settings.
//   --fingerprint   no network: prints the check hashes, the baseline match, and for each pair its prompt hash, plan size and estimated tokens.
//   (nothing)       a REAL run: refuses unless every condition of lib/engine/evalEveryCvCheckGuard.ts holds. A counted run uses all ten pairs.
//   --calibration   a real run marked "not counted";  --pairs=a,b  a shorter list (calibration only);  --confirm=named|all  which skills are ticked
//   --baseline=<folder name under eval-runs/every-cv>  (default: the newest)

export type CheckChain = {
  cvRequest: unknown;
  adRequest: unknown;
  vocabulary: string;
  probe: { body: unknown; instructionsLength: number };
  model: string;
  settings: unknown;
  readingVersion: string;
  buildPrompt: (plan: CheckPlan) => string;
  callCheck: (plan: CheckPlan) => Promise<{ outcome: CheckOutcome; call: CallSummary; limits: Record<string, string> | undefined }>;
  close: () => void;
};

export type CheckDeps = {
  args: string[];
  env: Record<string, string | undefined>;
  root: string;
  baselineRoot: string; // eval-runs/every-cv
  outRoot: string; // eval-runs/every-cv-check
  io: {
    readFile: (path: string) => string;
    writeFile: (path: string, text: string) => void;
    mkdirp: (path: string) => void;
    listDirs: (path: string) => string[];
    exists: (path: string) => boolean;
  };
  skills: Skill[];
  git: { dirtyUnder: (relPath: string) => boolean; keyCommit: () => string; head: () => string };
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  out: (text: string) => void;
  err: (text: string) => void;
  loadChain: (opts: { dry: ((prompt: string) => ReturnType<typeof answersFromKey>) | null }) => Promise<CheckChain | { refusal: string }>;
};

const CROSS_LANGUAGE = new Set(["pair-06", "pair-10"]);
const PAIR_DIR = /^pair-\d\d$/;
const pageLines = (cv: string) => numberLines(removeContactDetails(cv)); // exactly what the page sends

type Prepared = { id: string; crossLanguage: boolean; key: ReturnType<typeof checkEveryCvKey>; cvLines: string[]; cv: CvBuildResult; ad: AdReading; plan: CheckPlan; prompt: string; estimate: number };

export async function checkMain(deps: CheckDeps): Promise<{ exitCode: number; runFolder: string | null }> {
  const { args, env, io } = deps;
  const fixtures = `${deps.root}/fixtures/every-cv`;
  const stop = (text: string) => {
    deps.err(text.endsWith("\n") ? text : text + "\n");
    return { exitCode: 1, runFolder: null };
  };
  const read = (pair: string, file: string) => io.readFile(`${fixtures}/${pair}/${file}`);
  const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const confirm: ConfirmMode = flag("confirm") === "all" ? "all" : "named";
  const calibration = args.includes("--calibration");
  const dry = args.includes("--dry");
  const wantsFingerprint = args.includes("--fingerprint");

  // ---- one pair, prepared: the saved readings, the plan the page would make, the prompt the AI would see ------------------------------------------------
  const prepare = (chain: CheckChain, id: string, cv: CvBuildResult, ad: AdReading, key: Prepared["key"], cvLines: string[]): Prepared => {
    const { plan } = planFor({ cvLines, cv, ad, skills: deps.skills, confirm });
    const prompt = plan.requirements.length > 0 && plan.entries.length > 0 ? chain.buildPrompt(plan) : "";
    return { id, crossLanguage: CROSS_LANGUAGE.has(id), key, cvLines, cv, ad, plan, prompt, estimate: estimateTokens(prompt.length, chain.probe.instructionsLength) };
  };

  // ---- --dry: the example pair, a fake model that answers from the key ---------------------------------------------------------------------------------
  if (dry) {
    const adText = read("example", "ad.txt").trim();
    const lines = pageLines(read("example", "cv.txt"));
    const key = checkEveryCvKey(read("example", "key.txt"), adText, lines.length);
    const { cv, ad } = cannedExampleReadings(lines, adText, deps.skills);
    const loaded = await deps.loadChain({ dry: (prompt) => answersFromKey(prompt, key, lines) });
    if ("refusal" in loaded) return stop(loaded.refusal);
    const chain = loaded;
    try {
      const p = prepare(chain, "example", cv, ad, key, lines);
      const results: PairResult[] = [];
      if (p.plan.requirements.length === 0 || p.plan.entries.length === 0) {
        results.push(scorePair({ pair: p.id, crossLanguage: false, key, cvLines: lines, cv, ad, skills: deps.skills, confirm, estimate: p.estimate, call: null, answered: null, failure: null }));
      } else {
        const done = await chain.callCheck(p.plan);
        results.push(scorePair({ pair: p.id, crossLanguage: false, key, cvLines: lines, cv, ad, skills: deps.skills, confirm, estimate: p.estimate, call: done.call, answered: done.outcome.kind === "done" ? done.outcome.checked : null, failure: done.outcome.kind === "done" ? null : "the dry call gave no answers" }));
      }
      const info: CheckInfo = { runId: "dry", fingerprint: "0".repeat(64), counted: false, confirm, dry: true, head: deps.git.head(), baselineRun: "-", keyCommit: "-", model: chain.model, requestHash: requestHash(chain.probe.body).slice(0, 10), instructionsLength: chain.probe.instructionsLength, readingVersion: chain.readingVersion, vocabulary: chain.vocabulary };
      deps.out("DRY RUN: the example pair only, a fake model that answers from its key. The real chain ran (the page's click, the route, the check, the proof), nothing was written and no network was used.\n\n");
      deps.out(checkMarkdown({ info, results, stopped: null, failed: [] }) + "\n");
      return { exitCode: 0, runFolder: null };
    } finally {
      chain.close();
    }
  }

  // ---- the run list, the keys, the baseline ----------------------------------------------------------------------------------------------------------------
  const tenDirs = io.listDirs(fixtures).filter((d) => PAIR_DIR.test(d)).sort();
  const listArg = flag("pairs");
  const runList = listArg ? listArg.split(",").map((s) => s.trim()).filter((s) => s !== "") : tenDirs;
  const counted = !calibration;

  // The baseline folder: --baseline=<name>, else the newest that holds readings. File checks only (nothing is loaded yet).
  const named = flag("baseline");
  const folders = io.listDirs(deps.baselineRoot).sort();
  const baselineRun = named ?? [...folders].reverse().find((d) => io.exists(`${deps.baselineRoot}/${d}/${tenDirs[0] ?? "pair-01"}/cv-reading.json`)) ?? null;
  const noBaseline = "Refused: no baseline run found under eval-runs/every-cv (run: npm run every-cv:baseline, with the owner's go). No AI call was made.";
  const baselineDir = baselineRun === null ? null : `${deps.baselineRoot}/${baselineRun}`;

  const st: { chain: CheckChain | null; baselineFp: string } = { chain: null, baselineFp: "" };
  // Is the baseline usable today? Loads the chain (it needs the two readers' requests to recompute the fingerprint). null = yes.
  const baselineQuestion = async (): Promise<string | null> => {
    if (baselineDir === null || !io.exists(baselineDir)) return noBaseline;
    const loaded = st.chain ?? (await deps.loadChain({ dry: null }));
    if ("refusal" in loaded) return loaded.refusal;
    st.chain = loaded;
    st.baselineFp = baselineFingerprintOf({ cvRequest: loaded.cvRequest, adRequest: loaded.adRequest, vocabulary: loaded.vocabulary, pairs: tenDirs.map((id) => ({ id, cvText: read(id, "cv.txt"), adText: read(id, "ad.txt"), keyText: read(id, "key.txt") })) });
    const keyCommit = deps.git.keyCommit();
    for (const id of runList) {
      for (const kind of ["cv", "ad"] as const) {
        const path = `${baselineDir}/${id}/${kind}-reading.json`;
        if (!io.exists(path)) return `Refused: the baseline run ${baselineRun} has no ${kind} reading for ${id}. No AI call was made.`;
        const loadedReading = loadSavedReading<unknown>(io.readFile(path), st.baselineFp);
        if (!loadedReading.ok) return `Refused: the baseline run ${baselineRun} does not match today's fingerprint at ${id} (${kind} reading): the saved reading was made under other prompts, vocabulary, keys or pair list than today's. Run the baseline again. No AI call was made.`;
        if (loadedReading.saved.keyCommit !== keyCommit) return `Refused: the baseline run ${baselineRun} was made on the keys of commit ${loadedReading.saved.keyCommit}, today's are ${keyCommit}. No AI call was made.`;
      }
    }
    return null;
  };

  try {
    if (wantsFingerprint) {
      // no guard variables needed: it prints what they must be. Only a missing or mismatching baseline stops it, before anything else is loaded.
      const refusal = await baselineQuestion();
      if (refusal) return stop(refusal);
    } else {
      const tenKeys = loadPairKeys(io.readFile, fixtures, tenDirs).pairs;
      const common = { env, tenKeys, gitDirty: () => deps.git.dirtyUnder("fixtures/every-cv"), runList, counted, pairsGiven: listArg !== undefined };
      // The guard asks the baseline question synchronously, and it is asynchronous here (it loads the chain). So: ask the guard once with a placeholder answer;
      // if every EARLIER condition holds it reaches the placeholder ("ASK"); only then is the real question asked, and the guard is asked again with its answer.
      const first = firstCheckRefusal({ ...common, runList: [], counted: false, pairsGiven: false, baseline: () => "ASK" });
      if (first !== null && first !== "ASK") return stop(first);
      const answer = await baselineQuestion();
      const refusal = firstCheckRefusal({ ...common, baseline: () => answer });
      if (refusal) return stop(refusal);
    }
    if (st.chain === null) return stop("The check chain was not loaded. No AI call was made.");
    const ch: CheckChain = st.chain;
    const baselineFp = st.baselineFp;

    // ---- prepare every pair (no call yet): the readings, the plans, the prompts ------------------------------------------------------------------------
    const keys = loadPairKeys(io.readFile, fixtures, runList).pairs;
    const prepared: Prepared[] = runList.map((id) => {
      const cvSaved = loadSavedReading<CvBuildResult>(io.readFile(`${baselineDir}/${id}/cv-reading.json`), baselineFp);
      const adSaved = loadSavedReading<AdReading>(io.readFile(`${baselineDir}/${id}/ad-reading.json`), baselineFp);
      if (!cvSaved.ok || !adSaved.ok) throw new Error("A saved reading was refused after the baseline question said it was fine.");
      const lines = pageLines(read(id, "cv.txt"));
      return prepare(ch, id, cvSaved.saved.reading, adSaved.saved.reading, keys.find((k) => k.id === id)!.check, lines);
    });
    const fingerprint = checkFingerprintOf({
      probeBody: ch.probe.body, model: ch.model, settings: ch.settings, readingVersion: ch.readingVersion, vocabulary: ch.vocabulary, confirm,
      caps: { requirements: PLAN_MAX_REQUIREMENTS, entries: PLAN_MAX_ENTRIES }, baselineFingerprint: baselineFp, keyCommit: deps.git.keyCommit(), baselineRun: baselineRun ?? "-",
      prompts: prepared.map((p) => ({ id: p.id, text: p.prompt })),
    });
    const hash10 = requestHash(ch.probe.body).slice(0, 10);

    if (wantsFingerprint) {
      deps.out(
        [
          `check request ${hash10} | INSTRUCTIONS ${ch.probe.instructionsLength} characters | model ${ch.model} | reading version ${ch.readingVersion} | vocab ${ch.vocabulary.slice(0, 10)} | confirm ${confirm}`,
          `baseline run ${baselineRun}: matches today's fingerprint (${baselineFp.slice(0, 10)}), key commit ${deps.git.keyCommit()}`,
          `check fingerprint ${fingerprint.slice(0, 10)}`,
          ...prepared.map(
            (p) =>
              `${p.id} | prompt ${requestHash(p.prompt).slice(0, 10)} | requirements ${p.plan.requirements.length} | entries available ${p.plan.entriesAvailable}, sent ${p.plan.entries.length}, dropped ${p.plan.entriesAvailable - p.plan.entries.length} | estimated tokens ${p.estimate}${p.estimate > BIG_CALL_TOKENS ? ` OVER ${BIG_CALL_TOKENS}` : ""}`,
          ),
          "For a real run set the two values below, and EVERY_CV_GO=yes (the owner's go, in its own prompt):",
          `EXPECT_CHECK_REQUEST_HASH=${hash10} EXPECT_CHECK_INSTRUCTIONS_LEN=${ch.probe.instructionsLength}`,
          "",
        ].join("\n"),
      );
      return { exitCode: 0, runFolder: null };
    }

    const mismatch = checkHashRefusal(env, hash10, ch.probe.instructionsLength);
    if (mismatch) return stop(mismatch);

    // ---- the calls, one by one, paced; a 429 stops the run, any other failure is written down and the run goes on; nothing is retried ---------------
    const results: PairResult[] = [];
    const failed: { pair: string; reason: string }[] = [];
    let stopped: { pair: string } | null = null;
    let lastLimits: Record<string, string> | undefined;
    let first = true;
    // EC-8e: our own rolling window (no 60 seconds hold more than 6,000 tokens; each call counts at the larger of its estimate and its real tokens), on top of
    // the provider-header wait below. `clock` is this loop's own time in ms: the waits and the calls' own durations add up; no real clock is read.
    const window = new TokenWindow();
    let clock = 0;
    for (const p of prepared) {
      const base = { pair: p.id, crossLanguage: p.crossLanguage, key: p.key, cvLines: p.cvLines, cv: p.cv, ad: p.ad, skills: deps.skills, confirm, estimate: p.estimate };
      if (p.plan.requirements.length === 0 || p.plan.entries.length === 0) {
        results.push(scorePair({ ...base, call: null, answered: null, failure: null }));
        continue;
      }
      if (!first) {
        const wait = paceBeforeCall(window, clock, pacingWaitMs(lastLimits, p.estimate), p.estimate);
        await deps.sleep(wait);
        clock += wait;
      }
      first = false;
      const startedAt = clock;
      const done = await ch.callCheck(p.plan);
      window.add(startedAt, p.estimate, done.call.inputTokens + done.call.outputTokens);
      clock += done.call.ms;
      if (done.limits) lastLimits = done.limits;
      const hit429 = done.call.real429 > 0;
      const failure = done.outcome.kind === "done" ? null : done.outcome.kind === "failed" ? done.outcome.message : done.outcome.kind === "tick" ? "the tick was missing" : "the access code was refused";
      results.push(scorePair({ ...base, call: done.call, answered: done.outcome.kind === "done" ? done.outcome.checked : null, failure }));
      if (hit429) {
        stopped = { pair: p.id };
        break;
      }
      if (failure !== null) failed.push({ pair: p.id, reason: failure });
    }

    // ---- the report, the data and the state ----------------------------------------------------------------------------------------------------------
    const runId = deps.now().toISOString().replace(/[:.]/g, "-");
    const folder = `${deps.outRoot}/${runId}`;
    const info: CheckInfo = { runId, fingerprint, counted, confirm, dry: false, head: deps.git.head(), baselineRun: baselineRun ?? "-", keyCommit: deps.git.keyCommit(), model: ch.model, requestHash: hash10, instructionsLength: ch.probe.instructionsLength, readingVersion: ch.readingVersion, vocabulary: ch.vocabulary };
    const report = { info, results, stopped, failed };
    const complete = stopped === null && failed.length === 0 && results.length === runList.length;
    let twoLine = "TWO IN A ROW: not applicable (not a counted run)";
    if (counted) {
      const stateFile = `${deps.outRoot}/state.json`;
      const previous: RunState | null = io.exists(stateFile) ? (JSON.parse(io.readFile(stateFile)) as RunState) : null;
      const current: RunState = { fingerprint, met: bar(numbersOf(results)).pass, complete };
      twoLine = twoInARow(previous, current)
        ? "TWO IN A ROW: yes"
        : `TWO IN A ROW: no (${previous === null ? "no earlier counted run" : previous.fingerprint !== fingerprint ? "the earlier counted run used a different fingerprint" : "the earlier or this run did not meet the bar completely"})`;
      io.mkdirp(deps.outRoot);
      io.writeFile(stateFile, JSON.stringify(current));
    }
    const md = checkMarkdown(report) + `\n${twoLine}\n`;
    io.mkdirp(folder);
    io.writeFile(`${folder}/check.md`, md);
    io.writeFile(`${folder}/check.json`, JSON.stringify({ ...checkJson(report), twoInARow: twoLine }, null, 2) + "\n");
    for (const p of prepared) {
      const r = results.find((x) => x.pair === p.id);
      if (!r) continue;
      io.mkdirp(`${folder}/${p.id}`);
      io.writeFile(`${folder}/${p.id}/check.json`, JSON.stringify({ pair: p.id, plan: { requirements: p.plan.requirements, entries: p.plan.entries.map((e) => ({ n: e.n, name: e.name, line: e.line, inferred: e.inferred })), notChecked: p.plan.notChecked, entriesAvailable: p.plan.entriesAvailable }, result: r }, null, 2) + "\n");
    }

    deps.out(md.split("## Per pair")[0] + `${twoLine}\nSaved in ${folder}\n`);
    if (stopped) deps.err(`Stopped: the AI service answered 429 (busy) at ${stopped.pair}. Nothing was retried. What was done before it is saved in ${folder}\n`);
    for (const f of failed) deps.err(`${f.pair}: the call failed (${f.reason}). It was not retried.\n`);
    return { exitCode: complete ? 0 : 1, runFolder: folder };
  } finally {
    st.chain?.close();
  }
}
