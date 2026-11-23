import { numberLines } from "../cv/numberLines";
import { removeContactDetails } from "../cv/redact";
import { chooseBulletPairs, hasLearningMarker, type BulletPair } from "./bulletPairs";
import type { CvKey } from "./cvKey";
import { skillIdFor } from "./skillIds";
import type { Job, Profile, ProfileSkill, Skill } from "./types";

// Step 8.3, stage 5 (docs/PLAN-8.3.md v2, section 4, "The eval"): the profiles of the bullets eval are built from the KEYS of the five invented CVs, whose line numbers
// were fixed by hand, so the eval measures only the bullet writer and the checker, with no CV-reading call. Pure code: no AI, no network, nothing from lib/ai or app/.
//
// The rule: walk the key's items in order. Of each item take the FIRST name that is a skill of the vocabulary; the first item that gives a skill decides its line (a
// later item for the same skill is a repeat). A line with a learning marker (the repo's own list, lib/engine/bulletPairs.ts) is never an evidence line.

export type EvalLang = "en" | "de";
export type EvalCv = { id: string; key: CvKey; lines: string[]; lang: EvalLang };
export type BulletsEvalItem = { cv: string; job: string; lang: EvalLang; pairs: BulletPair[] };

export function profileFromKey(key: CvKey, lines: string[], vocabulary: Skill[]): Profile {
  const skills: ProfileSkill[] = [];
  const seen = new Set<string>();
  for (const item of key.items) {
    if (!Number.isInteger(item.line) || item.line < 1 || item.line > lines.length) continue;
    const text = lines[item.line - 1];
    if (text.trim() === "" || hasLearningMarker(text)) continue;
    for (const name of item.names) {
      const hit = skillIdFor(name, vocabulary);
      if (hit === null || !hit.listed) continue;
      if (!seen.has(hit.id)) {
        seen.add(hit.id);
        skills.push({ kind: "have", skillId: hit.id, evidence: { line: item.line, text } });
      }
      break;
    }
  }
  return {
    id: key.cv,
    name: key.cv,
    cvLines: lines,
    skills,
    constraints: { languages: [], locations: [], workModes: [], years: null, availableFrom: null },
  };
}

// The five invented CVs as the page numbers them (contact details removed, then numbered), with their language. cv-2-german is the German one.
const GERMAN_CVS = new Set(["cv-2-german"]);
export function evalCvs(fixtures: { id: string; text: string; key: CvKey }[]): EvalCv[] {
  return fixtures.map((c) => ({
    id: c.id,
    key: c.key,
    lines: numberLines(removeContactDetails(c.text)),
    lang: GERMAN_CVS.has(c.id) ? "de" : "en",
  }));
}

// Every CV against every job, CVs first, jobs in their order: the runs of the eval, each with the pairs the page would send (chooseBulletPairs).
export function buildEvalItems(cvs: EvalCv[], jobs: Job[], vocabulary: Skill[]): BulletsEvalItem[] {
  const items: BulletsEvalItem[] = [];
  for (const c of cvs) {
    const profile = profileFromKey(c.key, c.lines, vocabulary);
    for (const job of jobs) items.push({ cv: c.id, job: job.id, lang: c.lang, pairs: chooseBulletPairs(profile, job) });
  }
  return items;
}
