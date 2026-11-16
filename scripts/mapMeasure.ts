import fs from "node:fs";
import path from "node:path";
import { detailRows, formatSetLines, judge, measureSet, outcomeFor, repeatNote, type DetailRow, type Item } from "../lib/engine/mapMeasure";
import { MUST_NOT_MERGE, MUST_NOT_MERGE_NAMES } from "../lib/vocab/mustNotMerge";
import { vocabHash } from "../lib/engine/vocabHash";
import { isNotASkill, skills } from "../lib/vocab";

// npm run map-measure -- <labels.json> [more labels files]
// Maps every labelled name (flagged first, then stage 1, then stage 2) and prints COUNTS ONLY: never a name.
// A labels file (kept in fixtures/real-ads/, gitignored) is {"set":"fresh","names":{"<name as the AI wrote it>":"<skill id | none | not-a-skill>"}}.
// Only the set called "fresh" is judged (the 5.2 pass lines use the fresh set only); every other set, such as the
// holdout, is printed next to it as information, not pooled. Names of wrong and not-mapped items go to
// <dir>/map-measure-detail.json (gitignored), and each run is logged in <dir>/map-measure-log.txt (one-shot log).
// No AI call. <dir> is eval-runs, or MAP_MEASURE_DIR (used by the test).

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dir = process.env.MAP_MEASURE_DIR ?? path.join(process.cwd(), "eval-runs");
const hash = vocabHash().slice(0, 10);

if (files.length === 0) {
  console.error("Usage: npm run map-measure -- <labels.json> [more labels files]");
  process.exit(1);
}

const ids = new Set(skills.map((s) => s.id));
const bySet = new Map<string, Item[]>();
const perFile: { file: string; set: string; items: Item[] }[] = [];

for (const file of files) {
  let parsed: { set?: unknown; names?: unknown };
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    console.error(`Could not read ${path.basename(file)} as JSON. Nothing was run.`);
    process.exit(1);
  }
  if (typeof parsed.set !== "string" || parsed.set.trim() === "" || typeof parsed.names !== "object" || parsed.names === null) {
    console.error(`${path.basename(file)} must look like {"set":"fresh","names":{"<name>":"<skill id | none | not-a-skill>"}}. Nothing was run.`);
    process.exit(1);
  }
  const names = Object.entries(parsed.names as Record<string, unknown>);
  const todo = names.filter(([, l]) => l === "TODO").length;
  if (todo > 0) {
    console.error(`${path.basename(file)}: ${todo} name(s) are still labelled TODO. Label every name first (npm run skill-ids lists the labels). Nothing was run.`);
    process.exit(1);
  }
  const badLabels = names.filter(([, l]) => typeof l !== "string" || (l !== "none" && l !== "not-a-skill" && !ids.has(l))).length;
  if (badLabels > 0) {
    console.error(`${path.basename(file)}: ${badLabels} label(s) are not a skill id, "none" or "not-a-skill". Nothing was run.`);
    process.exit(1);
  }
  const items: Item[] = names.map(([name, label]) => ({
    name,
    label: label as string,
    outcome: outcomeFor(name, skills, isNotASkill),
  }));
  perFile.push({ file, set: parsed.set, items });
  bySet.set(parsed.set, [...(bySet.get(parsed.set) ?? []), ...items]);
}

const logFile = path.join(dir, "map-measure-log.txt");
const logLines = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split("\n") : [];
const date = new Date().toISOString().slice(0, 10);

const out: string[] = [];
out.push(`MAP MEASURE (no AI call; counts only) | stage 1 + stage 2 | vocab ${hash} | files ${files.length}, sets ${[...bySet.keys()].join(", ")}`);
for (const set of bySet.keys()) for (const note of repeatNote(logLines, set, hash)) out.push(`${set}: ${note}`);
if (!bySet.has("fresh")) out.push("No set called \"fresh\" was given: nothing is judged. (The 5.2 pass lines use the fresh set only.)");

for (const [set, items] of bySet) {
  const r = measureSet(items, MUST_NOT_MERGE, MUST_NOT_MERGE_NAMES);
  out.push(...formatSetLines(set, r, judge(r), set === "fresh"));
}
if (perFile.length > 1 || [...bySet.values()].length !== perFile.length) {
  out.push("PER FILE (information only)");
  for (const f of perFile) {
    const r = measureSet(f.items, MUST_NOT_MERGE, MUST_NOT_MERGE_NAMES);
    out.push(...formatSetLines(`${path.basename(f.file)} [set ${f.set}]`, r, judge(r), false));
  }
}

// Names go to the gitignored detail file, never to the terminal.
fs.mkdirSync(dir, { recursive: true });
const rows: DetailRow[] = perFile.flatMap((f) => detailRows(path.basename(f.file), f.set, f.items));
fs.writeFileSync(path.join(dir, "map-measure-detail.json"), JSON.stringify({ date, vocab: hash, rows }, null, 1));
fs.appendFileSync(logFile, [...bySet.keys()].map((s) => `${s} | ${date} | ${hash}\n`).join(""));

out.push(`(details with names: ${path.relative(process.cwd(), path.join(dir, "map-measure-detail.json"))}, gitignored; logged in map-measure-log.txt)`);
console.log(out.join("\n"));
