import fs from "node:fs";
import path from "node:path";
import { INSTRUCTIONS_BULLETS, writeBullets } from "../lib/ai/writeBullets";
import { captureBulletsRequestBody } from "../lib/ai/bulletsRequestBody";
import { evalFingerprint, fingerprintLine, requestHash } from "../lib/engine/evalFingerprint";
import { vocabHash } from "../lib/engine/vocabHash";
import { evalBulletsMain } from "./evalBulletsMain";

// The command-line entry of `npm run eval-bullets` (docs/PLAN-8.3.md v2, stage 5). It is the ONLY place the real writer (the AI call) is wired in; the logic is in
// scripts/evalBulletsMain.ts and the pure parts are in lib/engine/evalBullets*.ts, all unit-tested with a fake writer. No test imports this file.
//
//   npm run eval-bullets -- --fingerprint   prints the fingerprint and stops (no AI call).
//   npm run eval-bullets -- --calibration   a real run, "not counted"; needs EXPECT_REQUEST_HASH and EXPECT_INSTRUCTIONS_LEN (15 runs, at most 4 calls today).

const root = process.cwd();

evalBulletsMain({
  args: process.argv.slice(2),
  env: process.env,
  // Load the settings from .env.local into this process (a Node built-in). The file's contents are never printed.
  loadEnv: () => {
    try {
      process.loadEnvFile(path.join(root, ".env.local"));
    } catch {
      // No file: the variables may be set another way.
    }
  },
  fingerprint: async (items) => {
    const vocabulary = vocabHash();
    const request = await captureBulletsRequestBody(); // no network: a fake fetch records the body
    const full = evalFingerprint({
      request,
      ads: items.map((i) => ({
        id: `${i.cv} x ${i.job}`,
        text: i.pairs.map((p) => `${p.requirement}\n${p.text}`).join("\n\n"),
        key: i.pairs.map((p) => `${p.skillId}@${p.line}`),
      })),
      vocabulary,
    });
    return {
      hash10: requestHash(request).slice(0, 10),
      instructionsLength: INSTRUCTIONS_BULLETS.length,
      line: fingerprintLine(request, INSTRUCTIONS_BULLETS.length, full, vocabulary),
    };
  },
  write: (pairs, show) => writeBullets(pairs, show),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
  save: (name, text) => {
    const dir = path.join(root, "eval-runs"); // gitignored; never committed
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    fs.writeFileSync(file, text);
    return path.relative(root, file);
  },
  out: (text) => void process.stdout.write(text),
  err: (text) => void process.stderr.write(text),
}).then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    console.error("The bullets eval stopped on an unexpected error.");
    process.exitCode = 1;
  },
);
