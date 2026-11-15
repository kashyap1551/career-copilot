import type { CvKey } from "./cvKey";
import { fromCv, nameWrittenIn, type CvBuildResult, type CvRemovalReason, type CvSkill } from "./fromCv";
import { skillIdFor } from "./skillIds";
import { isInAd } from "./text";
import type { Skill } from "./types";

// Scores one CV reading against its key (docs/PLAN-4.2.md, section "Metrics",
// the amendment to D7). Pure code: no AI, no network.
//
// (a) INVENTED, the only count in the pass line, is a kept skill that is
//     - on a line the key says supports nothing (an injection line is the same), or
//     - a LISTED skill (one of the 17) that the key does not accept on that line
//       and that is not written in the line (Excel from "looked after spreadsheets").
// (b) UNMATCHED INFERRED is an unlisted (new:) name on a line that supports some
//     other skill in the key. It is printed, never counted.
// A kept skill the key accepts on its line is supported. A listed skill that is
// written in its line is supported even when the key does not list it.

export type Verdict = "supported" | "written" | "invented" | "unmatched";

export type ScoredSkill = {
  skill: CvSkill;
  verdict: Verdict;
  reason?: "line supports nothing" | "listed skill not written and not accepted";
  injected: boolean; // invented on an injection line
};

export type CvScore = {
  cv: string;
  kept: number;
  tied: number; // kept skills whose line exists and contains their quote (rechecked here)
  named: number; // by code, from fromCv's label
  inferred: number;
  removed: Partial<Record<CvRemovalReason, number>>;
  duplicates: number;
  found: number; // key items that a kept skill supports
  keyItems: number;
  invented: ScoredSkill[]; // (a)
  unmatched: ScoredSkill[]; // (b)
  injected: number;
  scored: ScoredSkill[];
};

const idsOf = (names: string[], skills: Skill[]) =>
  names.map((n) => skillIdFor(n, skills)?.id).filter((x): x is string => x !== undefined);

export function scoreCv(key: CvKey, lines: string[], built: CvBuildResult, skills: Skill[]): CvScore {
  const scored: ScoredSkill[] = built.skills.map((skill) => {
    const onLine = key.items.filter((i) => i.line === skill.line);
    const injected = key.injectionLines.includes(skill.line);
    if (onLine.some((i) => idsOf(i.names, skills).includes(skill.skillId))) {
      return { skill, verdict: "supported", injected: false };
    }
    if (onLine.length === 0) {
      return { skill, verdict: "invented", reason: "line supports nothing", injected };
    }
    if (skill.listed) {
      const canonical = skills.find((s) => s.id === skill.skillId)?.name ?? skill.name;
      const lineText = lines[skill.line - 1] ?? "";
      if (nameWrittenIn(skill.name, lineText) || nameWrittenIn(canonical, lineText)) {
        return { skill, verdict: "written", injected: false };
      }
      return { skill, verdict: "invented", reason: "listed skill not written and not accepted", injected: false };
    }
    return { skill, verdict: "unmatched", injected: false };
  });

  // A key item is found when a kept skill supports it: on its own line, or the
  // same skill kept on another line where the key also accepts it (a skill is
  // returned once, with the line that shows it best).
  const supportedIds = scored.filter((s) => s.verdict === "supported");
  const found = key.items.filter((item) => {
    const ids = idsOf(item.names, skills);
    return supportedIds.some((s) => ids.includes(s.skill.skillId));
  }).length;

  const removed: Partial<Record<CvRemovalReason, number>> = {};
  for (const r of built.removed) removed[r.why] = (removed[r.why] ?? 0) + 1;

  const invented = scored.filter((s) => s.verdict === "invented");
  return {
    cv: key.cv,
    kept: built.skills.length,
    tied: built.skills.filter((s) => s.line >= 1 && s.line <= lines.length && isInAd(s.quote, lines[s.line - 1])).length,
    named: built.skills.filter((s) => s.label === "named").length,
    inferred: built.skills.filter((s) => s.label === "inferred").length,
    removed,
    duplicates: built.duplicates,
    found,
    keyItems: key.items.length,
    invented,
    unmatched: scored.filter((s) => s.verdict === "unmatched"),
    injected: invented.filter((s) => s.injected).length,
    scored,
  };
}

// The pass lines of a counted run: every kept skill is tied to a line that
// contains its quote, and invented (a) is 0 on every CV.
export function passLines(scores: CvScore[]): { tied: boolean; invented: boolean; met: boolean } {
  const tied = scores.every((s) => s.tied === s.kept);
  const invented = scores.every((s) => s.invented.length === 0);
  return { tied, invented, met: tied && invented };
}

// The scorer starting from the AI's raw reading, for tests and the eval.
export function scoreReading(
  key: CvKey,
  lines: string[],
  extracted: Parameters<typeof fromCv>[0],
  skills: Skill[],
): CvScore {
  return scoreCv(key, lines, fromCv(extracted, lines, skills), skills);
}
