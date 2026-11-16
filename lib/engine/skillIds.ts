import { foldText } from "./text";
import type { Skill } from "./types";

// Skill names to skill ids. Pure code. A name that matches a skill in the
// current list (by id, name, German name or alias) gets that skill's id. Any
// other name gets a provisional id made from its own text, "new:docker", so the
// same unlisted skill gets the same id wherever it is written (in an ad, or in
// a list of skills a person pastes). Matching is EXACT: no close-spelling step
// yet (docs/PLAN-5.1.md, step 5.2).

// "Node.js" -> "node-js", "C++" -> "c-plus-plus", "Führerschein" -> "fuhrerschein"
export function slugOf(name: string): string {
  return foldText(name)
    .replace(/\+/g, " plus ")
    .replace(/#/g, " sharp ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/ /g, "-");
}

// Words that say how well or how long, not which skill: dropped on the second
// try ("Advanced Excel", "SQL-Kenntnisse", "Erfahrung mit Power BI"). Skill
// levels are not compared (docs/DECISIONS.md, 2026-11-14).
const FILLER = new Set(
  [
    // English
    "advanced", "basic", "intermediate", "expert", "expertise", "proficient", "proficiency", "strong", "solid", "good",
    "excellent", "very", "skills", "skill", "knowledge", "experience", "experienced", "familiarity",
    "of", "in", "with", "using", "for", "the", "a", "an",
    // German (accents already folded: für -> fur)
    "kenntnisse", "kenntnis", "erfahrung", "erfahrungen", "grundkenntnisse", "fortgeschrittene", "fortgeschrittenen",
    "fortgeschritten", "sehr", "gute", "guter", "gutes", "guten", "gut", "umfassende", "mit", "von", "fur", "der", "die", "das",
    "ein", "eine",
  ],
);

// The spaced form of a name: folded, hyphens and punctuation turned into spaces.
function spaced(name: string): string {
  return slugOf(name).replace(/-/g, " ");
}

function stripFillers(key: string): string {
  return key.split(" ").filter((t) => t !== "" && !FILLER.has(t)).join(" ");
}

// A trailing version: 1 to 3 digits ("3", "11", "365") or a year ("2019"). A
// longer number is part of the name ("ISO 9001"). At least one word stays.
function stripVersion(key: string): string {
  const tokens = key.split(" ");
  while (tokens.length > 1 && /^(v?\d{1,3}|(19|20)\d{2})$/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ");
}

// The keys a name is tried under, in order: exactly as written, then without
// level and filler words, then also without a trailing version number.
export function nameKeys(name: string): { exact: string; stripped: string; plain: string } {
  const exact = spaced(name);
  const stripped = stripFillers(exact);
  const plain = stripVersion(stripped);
  return { exact, stripped, plain };
}

// The one shared normal form: folded, filler and level words dropped, trailing
// version dropped. "SQL-Kenntnisse" and "Strong SQL skills" are both "sql".
export function normalizeSkillName(name: string): string {
  return nameKeys(name).plain;
}

type Entry = { id: string; exactOnly: boolean };
const indexes = new WeakMap<Skill[], Map<string, Entry>>();

// key -> skill, from every skill's id, name, German name and aliases. The first
// skill to claim a key keeps it (the vocabulary tests make sure no key is claimed twice).
function indexOf(skills: Skill[]): Map<string, Entry> {
  let index = indexes.get(skills);
  if (index) return index;
  index = new Map();
  for (const s of skills) {
    for (const term of [s.id, s.name, s.de, ...(s.aliases ?? [])]) {
      if (term === undefined) continue;
      const key = spaced(term);
      if (key !== "" && !index.has(key)) index.set(key, { id: s.id, exactOnly: s.exactOnly === true });
    }
  }
  indexes.set(skills, index);
  return index;
}

// Stage 1 of the mapping: the exact lookup, in three tries. Returns the skill id and which try found it, or null.
// 1. exactly as written; 2. without level and filler words; 3. also without a trailing version. A single letter or a
// very common word ("R", "C", "Go") is found only in try 1, so "Advanced R" is not R.
export function lookupExact(name: string, skills: Skill[]): { id: string; try: 1 | 2 | 3 } | null {
  const index = indexOf(skills);
  const { exact, stripped, plain } = nameKeys(name);
  if (exact === "") return null;
  const hit = index.get(exact);
  if (hit) return { id: hit.id, try: 1 };
  const tries: [string, 2 | 3][] = [[stripped, 2], [plain, 3]];
  for (const [key, n] of tries) {
    if (key === "" || key === exact || key.length === 1) continue;
    const found = index.get(key);
    if (found && !found.exactOnly) return { id: found.id, try: n };
  }
  return null;
}

// null when the name has nothing to make an id from ("???").
export function skillIdFor(
  name: string,
  skills: Skill[],
): { id: string; listed: boolean } | null {
  const slug = slugOf(name);
  if (slug === "") return null;
  const hit = lookupExact(name, skills);
  return hit ? { id: hit.id, listed: true } : { id: `new:${slug}`, listed: false };
}
