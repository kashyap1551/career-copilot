import { fitLevel } from "./fit";
import { isInAd } from "./text";
import type { FitLevel } from "./types";

// The answer key of one accuracy-test pair (docs/PLAN-EVERY-CV.md section 9, docs/EVERY-CV-KEY-GUIDE.md): a text file the owner fills
// in by hand, one block for each requirement sentence of the ad. Pure code: no AI, no network, no files. A problem names the block and
// says what is wrong in plain words; it never prints the CV.
//
//   R1 [must] "<the ad's sentence>"        a requirement block (the tag is must or nice, as the ad words it)
//   verdict: met | partly | none
//   cv line(s): 4, 7-9                     numbers from the numbered CV; empty for none
//   unsure: yes                            empty, or yes
//   why: ...                               optional
//   T1 [trait, not counted] "<sentence>"   a personal-trait block: nothing to fill
//
// The state of a key comes from its R blocks only: blank (no R block has a verdict), incomplete (some, not all) or complete (every one).

export type KeyBlock = {
  kind: "R" | "T";
  n: number;
  id: string; // "R3" or "T1"
  tag: string; // must, nice, or the trait tag
  quote: string;
  fields: Record<string, string | undefined>; // the raw text after each field name; undefined when the field line is missing
  verdict: string; // trimmed and lower-case; "" when not given
  lines: number[] | null; // the cited lines with ranges expanded; null when the text is not line numbers
  unsure: string; // trimmed and lower-case
};

export type KeyProblem = { block: string; sentence: string }; // block is "R3", "T1" or "key"
export type KeyState = "blank" | "incomplete" | "complete";
export type KeyCheck = {
  state: KeyState;
  answered: number; // R blocks with a verdict (any word)
  total: number; // R blocks
  unsureCount: number; // R blocks with unsure: yes
  problems: KeyProblem[];
  blocks: KeyBlock[];
};

export const VERDICTS = ["met", "partly", "none"] as const;
export const FIELD_NAMES = ["verdict", "cv line(s)", "unsure", "why"] as const;
const HEAD = /^([RT])(\d+) \[([^\]]*)\] "(.*)"$/;

// "3, 7-9" -> [3, 7, 8, 9]; null when something in it is not a line number or a range.
export function parseLineList(text: string): number[] | null {
  const out: number[] = [];
  for (const token of text.split(/[,\s]+/).filter((t) => t !== "")) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (b < a || b - a > 400) return null;
    for (let k = a; k <= b; k++) out.push(k);
  }
  return out;
}

export function parseEveryCvKey(text: string): { blocks: KeyBlock[]; problems: KeyProblem[] } {
  const blocks: KeyBlock[] = [];
  const problems: KeyProblem[] = [];
  let current: KeyBlock | null = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const head = HEAD.exec(line);
    if (head) {
      current = {
        kind: head[1] as "R" | "T",
        n: Number(head[2]),
        id: `${head[1]}${head[2]}`,
        tag: head[3],
        quote: head[4],
        fields: {},
        verdict: "",
        lines: [],
        unsure: "",
      };
      blocks.push(current);
      return;
    }
    const field = /^(verdict|cv line\(s\)|unsure|why):(.*)$/.exec(line);
    if (field && current) {
      if (current.fields[field[1]] !== undefined) problems.push({ block: current.id, sentence: `"${field[1]}" appears twice in one block` });
      current.fields[field[1]] = field[2].trim();
      return;
    }
    problems.push({ block: "key", sentence: `line ${i + 1} of the file is not a block head or a field` });
  });
  for (const b of blocks) {
    b.verdict = (b.fields["verdict"] ?? "").trim().toLowerCase();
    b.lines = parseLineList(b.fields["cv line(s)"] ?? "");
    b.unsure = (b.fields["unsure"] ?? "").trim().toLowerCase();
  }
  return { blocks, problems };
}

// Checks a key against its ad and the number of lines of its numbered CV.
export function checkEveryCvKey(keyText: string, adText: string, cvLineCount: number): KeyCheck {
  const { blocks, problems } = parseEveryCvKey(keyText);
  const add = (block: string, sentence: string) => problems.push({ block, sentence });
  const reqs = blocks.filter((b) => b.kind === "R");
  if (reqs.length === 0) add("key", "the key has no requirement block");

  for (const b of blocks) {
    if (!isInAd(b.quote, adText)) add(b.id, "the quoted sentence is not in the ad");
    if (b.kind === "T") {
      if (!/^trait/i.test(b.tag)) add(b.id, "a trait block must be tagged [trait, not counted]");
      if (Object.keys(b.fields).length > 0) add(b.id, "a trait block has nothing to fill");
      continue;
    }
    if (b.tag !== "must" && b.tag !== "nice") add(b.id, "the tag must be [must] or [nice]");
    for (const f of FIELD_NAMES) if (b.fields[f] === undefined) add(b.id, `the field "${f}:" is missing`);
  }

  const withVerdict = reqs.filter((b) => b.verdict !== "");
  for (const b of reqs) {
    const cited = (b.fields["cv line(s)"] ?? "").trim();
    if (b.verdict === "") {
      if (cited !== "") add(b.id, "lines are cited but there is no verdict");
      if (b.unsure !== "") add(b.id, "unsure is filled in but there is no verdict");
      if (withVerdict.length > 0) add(b.id, "no verdict yet");
      continue;
    }
    if (!(VERDICTS as readonly string[]).includes(b.verdict)) add(b.id, "the verdict must be met, partly or none");
    if (b.lines === null) {
      add(b.id, "the cited lines are not line numbers");
    } else {
      if (b.verdict === "none" && b.lines.length > 0) add(b.id, "a verdict of none cites no line");
      if ((b.verdict === "met" || b.verdict === "partly") && b.lines.length === 0) add(b.id, `${b.verdict} needs at least one cited line`);
      for (const n of b.lines) if (n < 1 || n > cvLineCount) add(b.id, `line ${n} does not exist (the CV has ${cvLineCount} lines)`);
    }
    if (b.unsure !== "" && b.unsure !== "yes") add(b.id, 'unsure must be empty or "yes"');
  }

  const state: KeyState = withVerdict.length === 0 ? "blank" : withVerdict.length === reqs.length ? "complete" : "incomplete";
  return {
    state,
    answered: withVerdict.length,
    total: reqs.length,
    unsureCount: reqs.filter((b) => b.unsure === "yes").length,
    problems,
    blocks,
  };
}

// The level a complete key gives. It uses the product's OWN fit rules (lib/engine/fit.ts), fed with the count of missing must-haves
// and no conflicts (the key judges skills only). Only [must] blocks count; partly and none both count as missing; nice-to-haves and
// traits never count. A key with no must block gives "no-level". A key that is not complete, or has a problem, gives null.
export function everyCvKeyLevel(check: KeyCheck): FitLevel | "no-level" | null {
  if (check.state !== "complete" || check.problems.length > 0) return null;
  const musts = check.blocks.filter((b) => b.kind === "R" && b.tag === "must");
  if (musts.length === 0) return "no-level";
  const missingMusts = musts.filter((b) => b.verdict !== "met").length;
  return fitLevel({ missingMusts, conflicts: [] }).level;
}
