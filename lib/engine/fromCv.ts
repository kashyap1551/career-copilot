import type { ExtractedCv } from "../schemas/cv";
import { isNotASkill } from "../vocab";
import { hasRealWord } from "./quoteMatch";
import { readNameId } from "./readName";
import { foldText, isInAd } from "./text";
import type { Skill } from "./types";

// Turns the AI's reading of a numbered CV into checked skills, each tied to a
// line and a quote that is really in that line. Pure code: no AI, no network.
// The AI reads; this decides (docs/PLAN-4.2.md, section a, table C).

export const MAX_SKILLS = 60;
export const MAX_NAME_CHARS = 60;

export type CvSkill = {
  name: string;
  skillId: string;
  listed: boolean; // is the skill in our skill list?
  line: number; // 1-based, in the numbered lines the AI was sent
  quote: string;
  // named: the skill's name is written in the cited line as a whole word.
  // inferred: the line shows the skill without writing that name.
  label: "named" | "inferred";
  // Only when stage 2 (close spelling) matched the name: the vocabulary term it matched. `name` stays the CV's own
  // wording and `skillId` is the skill it was read as. Absent for an exact match.
  closeMatch?: { via: string };
};

export type CvRemovalReason =
  | "no-name"
  | "name-too-long"
  | "not-a-skill" // a personal trait or similar: not a skill a CV can show
  | "line-out-of-range"
  | "quote-too-short"
  | "quote-not-in-line"
  | "too-many";

export type CvRemoval = { name: string; line: number; quote: string; why: CvRemovalReason };

export type CvBuildResult = {
  skills: CvSkill[];
  removed: CvRemoval[];
  duplicates: number; // a skill returned again (first use wins)
  unlisted: Skill[]; // kept skills that are not in the skill list
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Is this name written in this text as a whole word (or words)? "Excel" is not
// in "Excellent"; "SQL" is in "SQL-Abfragen".
export function nameWrittenIn(name: string, text: string): boolean {
  const n = foldText(name);
  if (n === "") return false;
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(n)}(?![a-z0-9])`).test(foldText(text));
}

export function fromCv(extracted: ExtractedCv, lines: string[], skills: Skill[]): CvBuildResult {
  const kept: CvSkill[] = [];
  const removed: CvRemoval[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const item of extracted.skills) {
    const name = item.name.trim();
    const drop = (why: CvRemovalReason) =>
      removed.push({ name, line: item.line, quote: item.quote, why });

    if (name === "") {
      drop("no-name");
      continue;
    }
    if (name.length > MAX_NAME_CHARS) {
      drop("name-too-long");
      continue;
    }
    if (isNotASkill(name)) {
      drop("not-a-skill");
      continue;
    }
    // The not-a-skill flag came first (above); then stage 1, then stage 2, in one shared path (readNameId).
    const id = readNameId(name, skills);
    if (id === null) {
      drop("no-name");
      continue;
    }
    if (!Number.isInteger(item.line) || item.line < 1 || item.line > lines.length) {
      drop("line-out-of-range");
      continue;
    }
    const lineText = lines[item.line - 1];
    if (!hasRealWord(item.quote)) {
      drop("quote-too-short");
      continue;
    }
    // Only the cited line counts: a quote found on another line is not rescued.
    if (!isInAd(item.quote, lineText)) {
      drop("quote-not-in-line");
      continue;
    }
    if (seen.has(id.id)) {
      duplicates++;
      continue;
    }
    if (kept.length >= MAX_SKILLS) {
      drop("too-many");
      continue;
    }
    seen.add(id.id);
    kept.push({
      name,
      skillId: id.id,
      listed: id.listed,
      line: item.line,
      quote: item.quote,
      label: nameWrittenIn(name, lineText) ? "named" : "inferred",
      ...(id.close ? { closeMatch: { via: id.close.via } } : {}),
    });
  }

  const unlisted: Skill[] = [];
  for (const s of kept) {
    if (!s.listed && !unlisted.some((u) => u.id === s.skillId)) {
      unlisted.push({ id: s.skillId, name: s.name });
    }
  }
  return { skills: kept, removed, duplicates, unlisted };
}
