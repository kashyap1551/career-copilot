import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { skills } from "../fixtures/skills";
import { checkMain } from "./everyCvCheckMain";

// npm run eval-check (docs/PLAN-EVERY-CV.md, the check eval): the real check on the ten accuracy pairs, scored against the owner's keys.
//
//   npm run eval-check -- --dry           the example pair, a fake model, the whole real chain; no settings, no network, nothing written
//   npm run eval-check -- --fingerprint   no network: the check hashes, the baseline match, each pair's prompt hash and plan size
//   npm run eval-check                    a REAL run (about ten calls): refuses unless every condition holds (see everyCvCheckMain.ts)
//   npm run eval-check -- --calibration   the same, marked "not counted"          (also: --pairs=a,b  --confirm=named|all  --baseline=<folder>)
//
// This is the ONLY file that loads the settings file (by a Node built-in; its contents are never printed) and it does so only for a real run or a
// fingerprint, inside loadChain, which the logic calls only after every refusal that files alone can decide. The logic and its tests live in
// scripts/everyCvCheckMain.ts; the chain that makes the call in scripts/everyCvCheckChain.ts.

const root = process.cwd();
const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

checkMain({
  args: process.argv.slice(2),
  env: process.env,
  root,
  baselineRoot: path.join(root, "eval-runs", "every-cv"),
  outRoot: path.join(root, "eval-runs", "every-cv-check"),
  io: {
    readFile: (p) => fs.readFileSync(p, "utf8"),
    writeFile: (p, t) => fs.writeFileSync(p, t),
    mkdirp: (p) => void fs.mkdirSync(p, { recursive: true }),
    listDirs: (p) => {
      try {
        return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
      } catch {
        return [];
      }
    },
    exists: (p) => fs.existsSync(p),
  },
  skills,
  git: {
    dirtyUnder: (rel) => git(["status", "--porcelain", "--", rel]).trim() !== "",
    keyCommit: () => git(["log", "-1", "--format=%h", "--", "fixtures/every-cv"]).trim() || "none",
    head: () => git(["rev-parse", "--short", "HEAD"]).trim(),
  },
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  out: (t) => void process.stdout.write(t),
  err: (t) => void process.stderr.write(t),
  loadChain: async ({ dry }) => {
    if (dry === null) {
      try {
        process.loadEnvFile(path.join(root, ".env.local"));
      } catch {
        // No file: the variables may be set another way.
      }
    }
    const { makeChain } = await import("./everyCvCheckChain");
    return makeChain({ dry });
  },
})
  .then((r) => process.exit(r.exitCode))
  .catch(() => {
    // Never print an error's own message: it could carry text from a CV.
    console.error("The check eval stopped on an unexpected error.");
    process.exit(1);
  });
