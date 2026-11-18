import { match } from "./match";
import { foldText } from "./text";
import type { Job, Profile, SkillId } from "./types";

// Step 8.3 (docs/PLAN-8.3.md v2, sections 4 and 10): which CV lines are sent to the AI, and for which requirement. Pure code: no AI, no network, no
// clock, nothing from app/ or lib/ai. The engine decides (rule 1): a pair exists only for a requirement the engine says is MET, with the evidence line the
// engine itself found (a hand-added skill with no CV line, a skill in progress and an unmet requirement never give a pair). The AI only words it.

export const MAX_PAIRS = 5;

// D3: a line that shows something the person is only learning or planning is never used (folded whole words; "learned" is not a marker).
export const LEARNING_MARKERS: ReadonlySet<string> = new Set(["learning", "studying", "planning", "currently", "lerne", "lernen", "lernend", "studiere", "geplant"]);

export type BulletPair = {
  id: number; // 1, 2, 3 ... in the order of the pairs
  requirement: string; // the ad's own quote of the requirement
  skillId: SkillId; // the skill that meets it
  line: number; // the CV line that shows it (1-based, as the page numbers the CV)
  text: string; // that line, as the profile holds it
};

function hasLearningMarker(text: string): boolean {
  return foldText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .some((w) => LEARNING_MARKERS.has(w));
}

// `profile` and `job` are the ENGINE's (the page's `engineProfile` and `engineJobs[i]` of roadmapInputs). Musts first, then nice-to-haves, each in the ad's
// order; one pair per distinct CV line (the first met requirement that uses the line); at most `max` pairs.
export function chooseBulletPairs(profile: Profile, job: Job, max: number = MAX_PAIRS): BulletPair[] {
  const result = match(profile, job);
  const pairs: BulletPair[] = [];
  const usedLines = new Set<number>();
  for (const r of [...result.musts, ...result.nices]) {
    if (pairs.length >= max) break;
    if (!r.met || r.metBy === null) continue;
    const { line, text } = r.metBy.evidence;
    if (usedLines.has(line) || text.trim() === "" || hasLearningMarker(text)) continue;
    usedLines.add(line);
    pairs.push({ id: pairs.length + 1, requirement: r.requirement.quote, skillId: r.metBy.skillId, line, text });
  }
  return pairs;
}
