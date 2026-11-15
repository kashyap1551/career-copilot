import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { skills } from "../fixtures/skills";
import { INSTRUCTIONS, readJobAd } from "../lib/ai/readJob";
import { GENERATION_SETTINGS } from "../lib/ai/settings";
import { checkKey, type AnswerKey } from "../lib/engine/answerKey";
import { evalFingerprint } from "../lib/engine/evalFingerprint";
import { formatReport, summarize } from "../lib/engine/evalReport";
import { formatShow, showRefusal } from "../lib/engine/evalShow";
import { runEval, twoInARow, type EvalAd, type RunState } from "../lib/engine/evalRun";

// npm run eval                      every ad that has a reviewed key
// npm run eval -- --only <ad id>    one ad (a wiring check; no totals, no target)
// npm run eval -- --reveal          also print the holdout ads' per-ad lines
//                                   (only once the owner says tuning is done)
// npm run eval -- --show <ad id>    one tuning ad: the AI's reading next to the key.
//                                   Refuses the holdout before any AI call.
//
// This script only reads files, calls the AI and prints. The matching, the
// scoring and the wording of the report live in lib/engine and are unit-tested.
// It makes real Groq calls, one at a time (docs/PLAN-3.2.md, section 5).

const HOLDOUT = new Set(["ad-09", "ad-10"]);
const root = process.cwd();
const args = process.argv.slice(2);
const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] ?? "") : null;
const reveal = args.includes("--reveal");
const show = args.includes("--show") ? (args[args.indexOf("--show") + 1] ?? "") : null;

// --show never works on the holdout, whatever else is on the command line.
// This runs before anything is loaded or any AI call is made.
if (show !== null) {
  const refusal = showRefusal(show, HOLDOUT);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
}

// Load the settings from .env.local into this process (a Node built-in). The
// file's contents are never printed.
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  // No file: the variables may be set another way.
}
if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
  console.error("GROQ_API_KEY and GROQ_MODEL must be set (in .env.local). Nothing was run.");
  process.exit(1);
}

async function loadKey(file: string): Promise<AnswerKey | null> {
  if (!fs.existsSync(file)) return null;
  const mod = (await import(pathToFileURL(file).href)) as { key?: AnswerKey };
  return mod.key ?? null;
}

async function loadAds(): Promise<{ ads: EvalAd[]; skipped: { id: string; reason: string }[] }> {
  const ads: EvalAd[] = [];
  const skipped: { id: string; reason: string }[] = [];

  const realDir = path.join(root, "fixtures/real-ads");
  const realFiles = fs.existsSync(realDir)
    ? fs.readdirSync(realDir).filter((f) => /^ad-\d+\.txt$/.test(f)).sort()
    : [];
  for (const file of realFiles) {
    const id = file.replace(/\.txt$/, "");
    const text = fs.readFileSync(path.join(realDir, file), "utf8");
    const key = await loadKey(path.join(root, "fixtures/answer-keys", `${id}.ts`));
    if (key === null) {
      skipped.push({ id, reason: "no answer key file" });
      continue;
    }
    // Problems name the place in the key, never the text.
    const problems = checkKey(key, text);
    if (problems.length > 0) {
      skipped.push({ id, reason: `key problems at: ${problems.map((p) => p.where).join(", ")}` });
      continue;
    }
    ads.push({ id, text, key, holdout: HOLDOUT.has(id), known: false });
  }

  const knownDir = path.join(root, "fixtures/known-cases");
  const knownFiles = fs.existsSync(knownDir) ? fs.readdirSync(knownDir).filter((f) => f.endsWith(".txt")).sort() : [];
  for (const file of knownFiles) {
    const id = file.replace(/\.txt$/, "");
    const text = fs.readFileSync(path.join(knownDir, file), "utf8");
    const key = await loadKey(path.join(knownDir, `${id}.key.ts`));
    if (key === null) {
      skipped.push({ id, reason: "no answer key file" });
      continue;
    }
    const problems = checkKey(key, text);
    if (problems.length > 0) {
      skipped.push({ id, reason: `key problems at: ${problems.map((p) => p.where).join(", ")}` });
      continue;
    }
    ads.push({ id, text, key, holdout: false, known: true });
  }
  return { ads, skipped };
}

async function main() {
  const loaded = await loadAds();

  if (show !== null) {
    const wanted = loaded.ads.find((a) => a.id === show.trim().toLowerCase());
    if (!wanted) {
      console.error(`No ad "${show}" with a reviewed key. Available: ${loaded.ads.filter((a) => !a.holdout).map((a) => a.id).join(", ") || "none"}`);
      process.exit(1);
    }
    const result = await readJobAd(wanted.text);
    process.stdout.write(formatShow(wanted, result, skills));
    if (result.usage) console.log(`\nTOKENS (this one call): in ${result.usage.inputTokens.toLocaleString("en-US")}, out ${result.usage.outputTokens.toLocaleString("en-US")}`);
    if (result.limits && Object.keys(result.limits).length > 0) {
      console.log(`RATE LIMITS (Groq's answer): ${Object.entries(result.limits).map(([k, v]) => `${k}=${v}`).join(", ")}`);
    }
    return;
  }

  let ads = loaded.ads;
  let early = loaded.skipped;

  if (only !== null) {
    ads = ads.filter((a) => a.id === only);
    early = early.filter((s) => s.id === only);
    if (ads.length === 0 && early.length === 0) {
      console.error(`No ad "${only}". Available: ${loaded.ads.map((a) => a.id).join(", ") || "none"}`);
      process.exit(1);
    }
  } else if (loaded.ads.length === 0 && loaded.skipped.length === 0) {
    console.error("No ads found in fixtures/real-ads/ or fixtures/known-cases/.");
    process.exit(1);
  }

  const run = await runEval(
    ads,
    {
      read: (text) => readJobAd(text),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      delayMs: Number(process.env.EVAL_DELAY_MS ?? 3000),
      backoffsMs: [5000, 15000, 45000],
    },
    skills,
  );

  const input = {
    scored: run.scored,
    failed: run.failed,
    skipped: [...early, ...run.skipped],
    reveal,
    partial: only !== null,
    usage: run.usage,
    limits: run.limits,
  };
  let text = formatReport(input);

  // "Two runs in a row" only counts for full runs with the same prompt, model and keys.
  if (only === null) {
    const { met, complete } = summarize(input);
    const fingerprint = evalFingerprint({
      instructions: INSTRUCTIONS,
      model: process.env.GROQ_MODEL ?? "",
      settings: GENERATION_SETTINGS,
      ads,
    });
    const current: RunState = { fingerprint, met, complete };
    const stateFile = path.join(root, "eval-runs/state.json");
    const previous: RunState | null = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
    text += `TWO IN A ROW: ${twoInARow(previous, current) ? "yes" : "no"} (previous run ${previous === null ? "none" : previous.fingerprint === fingerprint ? (previous.met ? "met the target" : "did not meet it") : "used a different prompt, model, settings or keys"})\n`;
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(current));
  }

  // Keep a copy of the report (the folder is gitignored; the holdout is still hidden in it).
  const outDir = path.join(root, "eval-runs");
  fs.mkdirSync(outDir, { recursive: true });
  const saved = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
  fs.writeFileSync(saved, text);

  process.stdout.write(text);
  console.log(`(saved to ${path.relative(root, saved)})`);
}

main().catch(() => {
  // Never print an error's own message: it could carry text from an ad.
  console.error("The eval stopped on an unexpected error.");
  process.exit(1);
});
