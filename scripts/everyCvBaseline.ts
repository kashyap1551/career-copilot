import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { skills } from "../fixtures/skills";
import { vocabHash } from "../lib/engine/vocabHash";
import { baselineMain, type RealReaders } from "./everyCvBaselineMain";

// npm run every-cv:baseline (docs/PLAN-EVERY-CV.md section 10, EC-0): today's product on the ten accuracy pairs.
//
//   npm run every-cv:baseline -- --dry           prints the report layout from canned readings of the example pair (no AI, no settings)
//   npm run every-cv:baseline -- --fingerprint   prints the guard values (loads the readers, makes no call)
//   npm run every-cv:baseline                    a REAL run (20 calls): refuses unless every condition holds (see everyCvBaselineMain.ts)
//
// This is the ONLY file that wires the real readers, and it loads them by a dynamic import inside `loadReal`, which the logic calls only
// after every refusal that can be decided without them. The logic and its tests live in scripts/everyCvBaselineMain.ts.

const root = process.cwd();
const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

async function loadReal(): Promise<RealReaders | { refusal: string }> {
  // The settings come from .env.local into this process (a Node built-in); the file's contents are never printed.
  try {
    process.loadEnvFile(path.join(root, ".env.local"));
  } catch {
    // No file: the variables may be set another way.
  }
  if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
    return { refusal: "GROQ_API_KEY and GROQ_MODEL must be set (in .env.local). Nothing was run." };
  }
  const { readCvLines, INSTRUCTIONS_CV } = await import("../lib/ai/readCv");
  const { readJobAd, INSTRUCTIONS } = await import("../lib/ai/readJob");
  const { captureCvRequestBody } = await import("../lib/ai/cvRequestBody");
  const { captureRequestBody } = await import("../lib/ai/requestBody");
  return {
    readCv: (lines) => readCvLines(lines),
    readAd: (text) => readJobAd(text),
    cvRequest: { body: await captureCvRequestBody(), instructionsLength: INSTRUCTIONS_CV.length },
    adRequest: { body: await captureRequestBody(), instructionsLength: INSTRUCTIONS.length },
    vocabulary: vocabHash(),
  };
}

baselineMain({
  args: process.argv.slice(2),
  env: process.env,
  root,
  outRoot: path.join(root, "eval-runs", "every-cv"),
  io: {
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeFile: (p, t) => fs.writeFileSync(p, t),
    mkdirp: (p) => void fs.mkdirSync(p, { recursive: true }),
    listDirs: (p) => fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name),
  },
  skills,
  git: {
    dirtyUnder: (rel) => git(["status", "--porcelain", "--", rel]).trim() !== "",
    keyCommit: () => git(["log", "-1", "--format=%h", "--", "fixtures/every-cv"]).trim() || "none",
  },
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  out: (t) => void process.stdout.write(t),
  err: (t) => void process.stderr.write(t),
  loadReal,
})
  .then((r) => process.exit(r.exitCode))
  .catch(() => {
    // Never print an error's own message: it could carry text from a CV.
    console.error("The baseline stopped on an unexpected error.");
    process.exit(1);
  });
