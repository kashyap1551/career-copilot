import fs from "node:fs";
import path from "node:path";
import { formatKeysStatus, loadPairKeys } from "../lib/engine/evalEveryCvStatus";

// npm run every-cv:keys: the state of the ten answer keys of the accuracy test (docs/EVERY-CV-KEY-GUIDE.md). It reads
// fixtures/every-cv/*/{cv,ad,key}.txt, prints one row for each pair and writes nothing. No AI, no network, no environment variables.
// Exit code 1 only when a COMPLETE key has a problem.

const root = path.join(process.cwd(), "fixtures", "every-cv");
const dirs = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const { pairs, example } = loadPairKeys((p) => fs.readFileSync(p, "utf8"), root, dirs);
const { text, exitCode } = formatKeysStatus(pairs, example);
process.stdout.write(text);
process.exit(exitCode);
