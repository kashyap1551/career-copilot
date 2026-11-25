import { numberLines } from "../cv/numberLines";
import { removeContactDetails } from "../cv/redact";
import { levelName } from "./explain";
import { checkEveryCvKey, everyCvKeyLevel, type KeyCheck } from "./evalEveryCvKey";
import type { FitLevel } from "./types";

// What `npm run every-cv:keys` prints (docs/EVERY-CV-KEY-GUIDE.md): the state of each pair's key, the level its verdicts give, how many
// rows are unsure, and the first 3 problems in plain words. Pure code: it reads text it is handed and writes nothing.

export type PairKey = { id: string; check: KeyCheck };

const PAIR_ID = /^pair-\d\d$/;
const LEVELS: FitLevel[] = ["strong", "good", "stretch", "longShot"];

// Reads cv.txt, ad.txt and key.txt of every pair-NN folder (sorted) and of the example. `read` is handed a path and returns its text.
export function loadPairKeys(read: (path: string) => string, root: string, dirs: string[]): { pairs: PairKey[]; example: PairKey | null } {
  const load = (id: string): PairKey => {
    const cvLines = numberLines(removeContactDetails(read(`${root}/${id}/cv.txt`))).length; // what the page numbers
    return { id, check: checkEveryCvKey(read(`${root}/${id}/key.txt`), read(`${root}/${id}/ad.txt`), cvLines) };
  };
  const pairs = dirs.filter((d) => PAIR_ID.test(d)).sort().map(load);
  return { pairs, example: dirs.includes("example") ? load("example") : null };
}

// "met" and "no verdict yet" are not mistakes while a key is being written; they are the state itself.
const problemsToShow = (c: KeyCheck) => c.problems.filter((p) => p.sentence !== "no verdict yet");

const levelText = (l: FitLevel | "no-level" | null) => (l === null ? "-" : l === "no-level" ? "No level" : levelName(l));

function problemTail(c: KeyCheck): string {
  const list = problemsToShow(c);
  if (list.length === 0) return "";
  const shown = list.slice(0, 3).map((p) => `${p.block}: ${p.sentence}`);
  return `  problems: ${shown.join("; ")}${list.length > 3 ? ` (+${list.length - 3} more)` : ""}`;
}

export function formatKeysStatus(pairs: PairKey[], example: PairKey | null): { text: string; exitCode: number } {
  const out: string[] = [];
  let exitCode = 0;
  const spread: Record<FitLevel, number> = { strong: 0, good: 0, stretch: 0, longShot: 0 };
  let noLevel = 0;

  for (const p of pairs) {
    const c = p.check;
    if (c.state === "blank") {
      out.push(`${p.id}  blank${problemTail(c)}`);
    } else if (c.state === "incomplete") {
      out.push(`${p.id}  ${c.answered} of ${c.total} answered${problemTail(c)}`);
    } else {
      const level = everyCvKeyLevel(c);
      if (level === "no-level") noLevel++;
      else if (level !== null) spread[level]++;
      if (problemsToShow(c).length > 0) exitCode = 1;
      out.push(`${p.id}  complete  level ${levelText(level)}  unsure ${c.unsureCount}${problemTail(c)}`);
    }
  }

  out.push(
    `Level spread over complete keys: Strong ${spread.strong}, Good ${spread.good}, Stretch ${spread.stretch}, Long shot ${spread.longShot}${noLevel > 0 ? ` (and ${noLevel} with no must-have: No level)` : ""}`,
  );
  const allTenComplete = pairs.length === 10 && pairs.every((p) => p.check.state === "complete");
  if (allTenComplete && LEVELS.filter((l) => spread[l] > 0).length < 3) {
    out.push("The level measure would be weak: fewer than three different levels.");
  }

  if (example) {
    const c = example.check;
    const bad = problemsToShow(c);
    if (c.state === "complete" && bad.length > 0) exitCode = 1;
    out.push(
      `Example (format check, outside the ten): ${c.state === "complete" ? "complete" : c.state}, level ${levelText(everyCvKeyLevel(c))}, ${bad.length === 0 ? "no problems" : `problems: ${bad.slice(0, 3).map((p) => `${p.block}: ${p.sentence}`).join("; ")}`}.`,
    );
  }
  return { text: out.join("\n") + "\n", exitCode };
}
