import fs from "node:fs";
import path from "node:path";
import { skills } from "../fixtures/skills";
import { cvFixtures } from "../fixtures/synthetic-cvs";
import { captureCvRequestBody } from "../lib/ai/cvRequestBody";
import { INSTRUCTIONS_CV, readCvLines } from "../lib/ai/readCv";
import { numberLines } from "../lib/cv/numberLines";
import { removeContactDetails } from "../lib/cv/redact";
import { checkCvKey } from "../lib/engine/cvKey";
import { formatCvReport } from "../lib/engine/evalCvReport";
import { passLines } from "../lib/engine/evalCvScore";
import { missingGuard, mismatchGuard } from "../lib/engine/evalCvGuard";
import { runCvEval } from "../lib/engine/evalCvRun";
import { evalFingerprint, fingerprintLine, requestHash } from "../lib/engine/evalFingerprint";
import { vocabHash } from "../lib/engine/vocabHash";
import { twoInARow, type RunState } from "../lib/engine/evalRun";

// npm run eval-cv -- --fingerprint   prints the fingerprint and stops. No AI call: the request is captured on a
//                                    fake fetch. Needs no EXPECT_ variables.
// npm run eval-cv                    a real run of the five made-up CVs (5 Groq calls). REFUSES to start unless
//                                    EXPECT_REQUEST_HASH and EXPECT_INSTRUCTIONS_LEN are set and match.
// npm run eval-cv -- --calibration   the same, marked "not counted" (the first run of PLAN-4.2).
// npm run eval-cv -- --only <cv id>  one CV (no state kept, no two-in-a-row).
//
// This script only reads files, calls the AI and prints. The checking, the scoring, the pacing and the wording of
// the report live in lib/ and are unit-tested (docs/PLAN-4.2.md).

const root = process.cwd();
const args = process.argv.slice(2);
const printFingerprint = args.includes("--fingerprint");
const calibration = args.includes("--calibration");
const only = args.includes("--only") ? (args[args.indexOf("--only") + 1] ?? "") : null;

// A real run needs both guard variables. This is the first thing that happens: nothing is loaded and no key is
// read before it.
if (!printFingerprint) {
  const refusal = missingGuard(process.env);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }
}

// Load the settings from .env.local into this process (a Node built-in). The file's contents are never printed.
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  // No file: the variables may be set another way.
}
if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
  console.error("GROQ_API_KEY and GROQ_MODEL must be set (in .env.local). Nothing was run.");
  process.exit(1);
}

// What the page does before sending: remove contact details, then number the lines.
const cvs = cvFixtures.map((c) => ({ id: c.id, key: c.key, lines: numberLines(removeContactDetails(c.text)) }));

async function main() {
  for (const c of cvs) {
    const problems = checkCvKey(c.key, c.lines);
    if (problems.length > 0) {
      console.error(`Key problems in ${c.id} at: ${problems.map((p) => p.where).join(", ")}. Nothing was run.`);
      process.exit(1);
    }
  }

  // The scores depend on the vocabulary (the key matcher uses its ids), so it is part of the fingerprint (format 3).
  const vocabulary = vocabHash();
  const request = await captureCvRequestBody();
  const fingerprint = evalFingerprint({
    request,
    ads: cvs.map((c) => ({ id: c.id, text: c.lines.join("\n"), key: c.key })),
    vocabulary,
  });
  const line = fingerprintLine(request, INSTRUCTIONS_CV.length, fingerprint, vocabulary);

  if (printFingerprint) {
    process.stdout.write(line);
    return;
  }

  const refusal = mismatchGuard(process.env, requestHash(request).slice(0, 10), INSTRUCTIONS_CV.length);
  if (refusal) {
    console.error(refusal);
    process.exit(1);
  }

  let chosen = cvs;
  if (only !== null) {
    chosen = cvs.filter((c) => c.id === only);
    if (chosen.length === 0) {
      console.error(`No CV "${only}". Available: ${cvs.map((c) => c.id).join(", ")}`);
      process.exit(1);
    }
  }
  const counted = !calibration && only === null;

  const run = await runCvEval(
    chosen,
    {
      read: (lines) => readCvLines(lines),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      minGapMs: 3000,
      backoffsMs: [15000, 45000],
    },
    skills,
  );

  let text = formatCvReport(run, counted);
  text += line;
  if (only === null) {
    const { met } = passLines(run.rows.map((r) => r.score));
    const current: RunState = { fingerprint, met, complete: run.complete && counted };
    const stateFile = path.join(root, "eval-runs/cv-state.json");
    const previous: RunState | null = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
    text += counted
      ? `TWO IN A ROW: ${twoInARow(previous, current) ? "yes" : "no"} (previous counted run ${previous === null ? "none" : previous.fingerprint !== fingerprint ? "used a different prompt, schema, model, settings, CVs or keys" : previous.complete && previous.met ? "met the pass lines" : "did not meet them or was not a counted run"})\n`
      : "TWO IN A ROW: not applicable (calibration run)\n";
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(current));
  }

  // Keep a copy of the report (the folder is gitignored).
  const outDir = path.join(root, "eval-runs");
  fs.mkdirSync(outDir, { recursive: true });
  const saved = path.join(outDir, `cv-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
  fs.writeFileSync(saved, text);
  process.stdout.write(text);
  console.log(`(saved to ${path.relative(root, saved)})`);
}

main().catch(() => {
  // Never print an error's own message: it could carry text from a CV.
  console.error("The CV eval stopped on an unexpected error.");
  process.exit(1);
});
