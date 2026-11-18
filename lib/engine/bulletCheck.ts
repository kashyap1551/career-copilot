import { nameWrittenIn } from "./fromCv";
import { foldText } from "./text";
import type { Skill } from "./types";

// Step 8.3 (docs/PLAN-8.3.md v2, section 3): the verifier of a CV bullet. Pure code: no AI, no network, no clock, nothing from app/ or lib/ai.
// `checkBullet(bullet, cited, ctx)` says whether a bullet may be shown: every word of it must stand in the cited CV line(s), numbers by value,
// and the limiting words and the order of the line must be kept. The FIRST failing rule (R1 to R10, in this order) gives the reason. It never
// throws and never changes its input. A failing bullet is dropped by the caller, never repaired here.

export type BulletReason =
  | "bad-citation" // R1
  | "bad-length" // R2
  | "new-date" // R3
  | "new-number" // R4
  | "new-skill" // R5
  | "new-name" // R6
  | "new-claim" // R7
  | "lost-qualifier" // R8
  | "new-word" // R9
  | "reordered" // R10
  | "check-failed"; // not a rule: the check itself crashed (the bullet is not shown)

export type BulletVerdict = { ok: true } | { ok: false; reason: BulletReason };

// `lines[n - 1]` is CV line n (the lines the call was built from); `vocabulary` is the skill list (names, German names, aliases).
export type BulletContext = { lines: string[]; vocabulary: Skill[] };

// ---- the word lists of the plan, all in FOLDED form (foldText: lower case, no accents, ü is u, ß is ss) -------------------------------------------
const set = (s: string) => new Set(s.split(/\s+/).filter(Boolean));

// R9 (c): the function words that may always stand in a bullet.
const ALLOWED = set(
  "a an the and or of in on at to for with by from as using while " + // English
    "der die das und oder von in im mit fur fuer zu zur zum auf an bei durch", // German (fur is the folded form of für)
);

// R7: words that claim a role or a result; each must stand in a cited line in exactly this form.
const CLAIMS = set(
  "manager director head lead leader senior principal chief officer supervisor coordinator specialist engineer analyst consultant intern trainee founder owner " +
    "led managed directed headed supervised owned founded launched spearheaded drove pioneered mentored " +
    "improved increased reduced saved grew doubled tripled halved boosted accelerated optimised optimized won awarded award best top first record expert " +
    "leitete verantwortete fuhrte verbesserte steigerte senkte grundete leiter leiterin teamleiter",
);

// R8: words that LIMIT a claim or a role; each that stands in a cited line must stand in the bullet in exactly this form.
const QUALIFIERS = set(
  "helped help helping assisted assist assisting supported supporting contributed contributing participated participating basic basics beginner learning studying " +
    "familiar exposure shadowed attended about around approximately roughly nearly almost over under some several only mostly mainly partly partially " +
    "occasionally sometimes rarely junior assistant deputy associate acting interim vice " +
    "not no never without " + // negations
    "nicht kein keine ohne half mithilfe mitarbeit unterstutzte assistierte grundkenntnisse grundlagen etwa circa rund ungefahr fast uber ueber einige mehrere nur " +
    "meist hauptsachlich teilweise gelegentlich manchmal selten stellvertretend stellvertretender stellvertretende assistent assistentin junior praktikum",
);

// R4: number words, by value. "one", "a" and "ein" are NOT numbers.
const NUMBER_WORDS = new Map<string, number>(
  Object.entries({
    two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, hundred: 100, thousand: 1000, million: 1_000_000,
    zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwolf: 12, zwoelf: 12, dutzend: 12, hundert: 100, tausend: 1000,
    millionen: 1_000_000,
  }),
);

// R3: month names ("may" and "march" are ordinary words and are left to R8/R9; the German "marz" is not an English word and is kept).
const MONTHS = set(
  "january february april june july august september october november december januar februar marz mai juni juli oktober dezember",
);
// Dotted abbreviations (Jan. Feb. ...), only when the dot is there.
const MONTH_ABBREVIATIONS = set("jan feb mar apr jun jul aug sep sept oct nov dec dez okt");

const ORDINAL_SUFFIXES = new Set(["st", "nd", "rd", "th"]);
const SYMBOL_WORDS = new Set(["eur", "gbp"]); // left out of the order check (R10) like the symbols

// ---- tokens ----------------------------------------------------------------------------------------------------------------------------------
type Token =
  | { k: "word"; raw: string; f: string; dotted: boolean }
  | { k: "num"; key: string; yearShaped: boolean } // a number by value ("n:2000"), or a token with a letter suffix as a string ("s:10k")
  | { k: "date"; key: string } // an ISO date, a dotted date or a quarter token, as a folded string
  | { k: "sym"; ch: string };

// Alternatives, in order: ISO date, dotted date, quarter, a number (with an optional letter suffix), a word, a symbol.
const TOKEN = /(\d{4}-\d{2}-\d{2})|(\d{1,2}\.\d{1,2}\.\d{2,4})|([Qq][1-4])(?![\p{L}\d])|(\d+(?:[.,]\d+)*)(\p{L}*)|(\p{L}+(?:['’]\p{L}+)*)|([%€$£])/gu;

// The value of a digit group: separators are thousands only in the shape 1 to 3 digits then groups of exactly three digits; else one separator is
// a decimal point. Leading zeros and trailing decimal zeros do not matter.
function valueOf(digits: string): number {
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(digits)) return Number(digits.replace(/[.,]/g, ""));
  const seps = digits.match(/[.,]/g);
  if (!seps) return Number(digits);
  if (seps.length === 1) return Number(digits.replace(",", "."));
  const last = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
  return Number(digits.slice(0, last).replace(/[.,]/g, "") + "." + digits.slice(last + 1));
}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN)) {
    if (m[1]) out.push({ k: "date", key: m[1] });
    else if (m[2]) out.push({ k: "date", key: m[2] });
    else if (m[3]) out.push({ k: "date", key: m[3].toLowerCase() });
    else if (m[4] !== undefined) {
      const suffix = foldText(m[5] ?? "");
      if (suffix === "" || ORDINAL_SUFFIXES.has(suffix)) {
        const v = valueOf(m[4]);
        out.push({ k: "num", key: `n:${Number.isFinite(v) ? v : m[4]}`, yearShaped: suffix === "" && /^\d{4}$/.test(m[4]) && v >= 1900 && v <= 2099 });
      } else {
        out.push({ k: "num", key: `s:${foldText(m[4] + (m[5] ?? ""))}`, yearShaped: false });
      }
    } else if (m[6]) {
      const end = (m.index ?? 0) + m[0].length;
      out.push({ k: "word", raw: m[6], f: foldText(m[6]), dotted: text[end] === "." });
    } else if (m[7]) out.push({ k: "sym", ch: m[7] });
  }
  return out;
}

// What the lines hold, from their tokens.
type LineFacts = { words: Set<string>; wordList: string[]; nums: Set<string>; dates: Set<string>; text: string; tokenLists: Token[][] };
function factsOf(lineTexts: string[]): LineFacts {
  const facts: LineFacts = { words: new Set(), wordList: [], nums: new Set(), dates: new Set(), text: lineTexts.join("\n"), tokenLists: [] };
  for (const t of lineTexts) {
    const tokens = tokenize(t);
    facts.tokenLists.push(tokens);
    for (const tok of tokens) {
      if (tok.k === "word") {
        facts.words.add(tok.f);
        facts.wordList.push(tok.f);
        const nw = NUMBER_WORDS.get(tok.f);
        if (nw !== undefined) facts.nums.add(`n:${nw}`);
      } else if (tok.k === "num") facts.nums.add(tok.key);
      else if (tok.k === "date") facts.dates.add(tok.key);
    }
  }
  return facts;
}

const SUFFIXES = ["s", "es", "ed", "d", "ing"];
// R9 (b): the same word plus or minus one suffix, when both words have at least 4 letters.
function sameWordForm(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  return SUFFIXES.some((s) => a === b + s || b === a + s);
}

// ---- the vocabulary (R5) ---------------------------------------------------------------------------------------------------------------------
type VocabKeys = { skill: Skill; keys: { raw: string; folded: string }[] };
const vocabCache = new WeakMap<Skill[], VocabKeys[]>();
function vocabKeys(vocabulary: Skill[]): VocabKeys[] {
  let cached = vocabCache.get(vocabulary);
  if (!cached) {
    cached = vocabulary.map((skill) => ({
      skill,
      keys: [skill.name, skill.de, ...(skill.aliases ?? [])]
        .filter((k): k is string => typeof k === "string" && k.trim() !== "")
        .map((raw) => ({ raw, folded: foldText(raw) })),
    }));
    vocabCache.set(vocabulary, cached);
  }
  return cached;
}

// Is one of the skill's written forms in this text? An exactOnly skill ("R", "Go") counts only when a word of the text is exactly that form.
function skillWrittenIn(entry: VocabKeys, text: string, foldedText: string, words: string[]): boolean {
  for (const key of entry.keys) {
    if (entry.skill.exactOnly) {
      if (words.includes(key.raw)) return true;
    } else if (foldedText.includes(key.folded) && nameWrittenIn(key.raw, text)) return true;
  }
  return false;
}

// ---- the order check (R10) -------------------------------------------------------------------------------------------------------------------
type Item = { t: "w"; f: string } | { t: "n"; key: string };
function itemsOf(tokens: Token[]): Item[] {
  const items: Item[] = [];
  for (const tok of tokens) {
    if (tok.k === "word") {
      const nw = NUMBER_WORDS.get(tok.f);
      if (nw !== undefined) items.push({ t: "n", key: `n:${nw}` });
      else if (!ALLOWED.has(tok.f) && !SYMBOL_WORDS.has(tok.f)) items.push({ t: "w", f: tok.f });
    } else if (tok.k === "num" || tok.k === "date") items.push({ t: "n", key: tok.k === "num" ? tok.key : `d:${tok.key}` });
  }
  return items;
}
// Greedy earliest matching: each item of the bullet matches a LATER item of the line than the one before.
function inOrder(bullet: Item[], line: Item[]): boolean {
  let pos = 0;
  for (const b of bullet) {
    let found = -1;
    for (let j = pos; j < line.length; j++) {
      const l = line[j];
      if (b.t === "n" ? l.t === "n" && l.key === b.key : l.t === "w" && sameWordForm(b.f, l.f)) {
        found = j;
        break;
      }
    }
    if (found < 0) return false;
    pos = found + 1;
  }
  return true;
}

// ---- the check -------------------------------------------------------------------------------------------------------------------------------
const reject = (reason: BulletReason): BulletVerdict => ({ ok: false, reason });
const OK: BulletVerdict = { ok: true };

export function checkBullet(bullet: string, cited: readonly number[], ctx: BulletContext): BulletVerdict {
  try {
    return check(bullet, cited, ctx);
  } catch {
    // Never throws. Nothing in the rules should reach here; if it does, the bullet is not shown, and a crash is never called a length problem.
    return reject("check-failed");
  }
}

function check(bullet: string, cited: readonly number[], ctx: BulletContext): BulletVerdict {
  // R1. Citation: 1 or 2 distinct integers, each a real, non-empty line.
  const lines = Array.isArray(ctx?.lines) ? ctx.lines : [];
  if (!Array.isArray(cited) || cited.length < 1 || cited.length > 2) return reject("bad-citation");
  if (cited.length === 2 && cited[0] === cited[1]) return reject("bad-citation");
  const lineTexts: string[] = [];
  for (const n of cited) {
    if (!Number.isInteger(n) || n < 1 || n > lines.length) return reject("bad-citation");
    const text = lines[n - 1];
    if (typeof text !== "string" || text.trim() === "") return reject("bad-citation");
    lineTexts.push(text);
  }

  // R2. Length: 3 to 25 words or numbers, one line, no list marker, no quotation marks around it.
  if (typeof bullet !== "string") return reject("bad-length");
  const text = bullet.trim();
  if (/[\r\n]/.test(text)) return reject("bad-length");
  if (/^(?:[-*•–—]|\d+[.)])\s/.test(text)) return reject("bad-length");
  if (/^["'“‘„]/.test(text) && /["'”’“]$/.test(text)) return reject("bad-length");
  const tokens = tokenize(text);
  const countable = tokens.filter((t) => t.k === "word" || t.k === "num" || t.k === "date").length;
  if (countable < 3 || countable > 25) return reject("bad-length");

  const facts = factsOf(lineTexts);

  // R3. Dates: an ISO or dotted date, a quarter, a year (by value), a month name must stand in a cited line.
  for (const t of tokens) {
    if (t.k === "date" && !facts.dates.has(t.key)) return reject("new-date");
    if (t.k === "num" && t.yearShaped && !facts.nums.has(t.key)) return reject("new-date");
    if (t.k === "word" && (MONTHS.has(t.f) || (t.dotted && MONTH_ABBREVIATIONS.has(t.f))) && !facts.words.has(t.f)) return reject("new-date");
  }

  // R4. Numbers, by value; number words are numbers; a symbol must stand in a cited line.
  for (const t of tokens) {
    if (t.k === "num" && !facts.nums.has(t.key)) return reject("new-number");
    if (t.k === "word") {
      const nw = NUMBER_WORDS.get(t.f);
      if (nw !== undefined && !facts.nums.has(`n:${nw}`)) return reject("new-number");
    }
    if (t.k === "sym" && !facts.text.includes(t.ch)) return reject("new-number");
  }

  // R5. A vocabulary skill written in the bullet must be written (in one of its forms) in a cited line.
  const foldedBullet = foldText(text);
  const bulletWords = tokens.filter((t): t is Extract<Token, { k: "word" }> => t.k === "word").map((t) => t.raw);
  const lineWordsRaw = facts.tokenLists.flat().filter((t): t is Extract<Token, { k: "word" }> => t.k === "word").map((t) => t.raw);
  const foldedLines = foldText(facts.text);
  for (const entry of vocabKeys(Array.isArray(ctx?.vocabulary) ? ctx.vocabulary : [])) {
    if (skillWrittenIn(entry, text, foldedBullet, bulletWords) && !skillWrittenIn(entry, facts.text, foldedLines, lineWordsRaw)) return reject("new-skill");
  }

  // R6. A word that starts with a capital (not the first token) or has a capital after its first letter must stand in a cited line.
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.k !== "word") continue;
    const startsUpper = /^\p{Lu}/u.test(t.raw);
    const innerUpper = /\p{Lu}/u.test(t.raw.slice(1));
    if (((startsUpper && i > 0) || innerUpper) && !facts.words.has(t.f)) return reject("new-name");
  }

  const words = tokens.filter((t): t is Extract<Token, { k: "word" }> => t.k === "word");

  // R7. Claim words must stand in a cited line in exactly that folded form.
  for (const w of words) if (CLAIMS.has(w.f) && !facts.words.has(w.f)) return reject("new-claim");

  // R8. A limiting word of a cited line must stay in the bullet, in exactly that folded form.
  const inBullet = new Set(words.map((w) => w.f));
  for (const q of facts.words) if (QUALIFIERS.has(q) && !inBullet.has(q)) return reject("lost-qualifier");

  // R9. Closed world: every other word is a word of a cited line, a form of one, a function word, or a number word (checked in R4).
  for (const w of words) {
    if (ALLOWED.has(w.f) || NUMBER_WORDS.has(w.f) || facts.words.has(w.f)) continue;
    if (facts.wordList.some((u) => sameWordForm(w.f, u))) continue;
    return reject("new-word");
  }

  // R10. Order: the words and numbers of the bullet keep the order of the cited line (two lines: either order may work).
  const bulletItems = itemsOf(tokens);
  const lineItems = facts.tokenLists.map(itemsOf);
  const orders = lineItems.length === 2 ? [[...lineItems[0], ...lineItems[1]], [...lineItems[1], ...lineItems[0]]] : [lineItems[0]];
  if (!orders.some((line) => inOrder(bulletItems, line))) return reject("reordered");

  return OK;
}
