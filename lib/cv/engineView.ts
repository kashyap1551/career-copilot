import { isUnlistedId, splitJudgeable } from "../engine/judgeable";
import type { Evidence, Job, Profile, ProfileSkill, Requirement } from "../engine/types";

import type { BuiltProfile, KeptEntry } from "./profile";

export type { KeptEntry };

// Step 7.1a (docs/PLAN-7.1.md sections 5 and 6) and EC-1 (docs/PLAN-EVERY-CV.md 4.2 and 4.4): what the rules engine is handed for ONE ad and the
// profile in use. Pure code: no AI, no network. It is the construction that `profileReport` (app/fitReport.ts) does before it calls match(),
// kept in one place so the report and the roadmap cannot disagree:
// - the ad keeps only the requirements in our skill list (docs/PLAN-FIT-LEVEL.md (a)); the others come back as `couldNotJudge`;
// - the engine only sees the kinds the person set: the ad's languages and city are blanked when unset;
// - the work mode is always passed on: an unset work mode means "all three accepted", so it can cause no conflict, and the
//   city check still runs when only a city is set.
//
// EC-1 adds two ways a requirement that is "not in our skill list" can still be judged, both by rewriting its ids BEFORE the engine, which is
// not changed (match.ts, fit.ts and unlock.ts do not know about this file):
//  - the SAME-NAME match, by plain code, no click: every id of the requirement is unlisted and a KEPT unlisted skill of the person has exactly the
//    same id. The requirement gets the id "kept:<slug>" and the profile gets one `have` skill with that id and the entry's own CV line.
//  - the verified ANSWERS of a click (the proof, lib/engine/evidenceProof.ts): met gets "ev:<n>" and a `have` skill with the entry's CV line;
//    partly and none get "ev:<n>" and NO skill, so the engine counts them as missing. A requirement with no answer is left alone and is set aside
//    as "could not judge" exactly as before.
// The rewritten ids are for the engine only. The view says how to get back: `originalOf` (rewritten requirement -> the ad's own) and
// `originOfId` (rewritten id -> the original skill ids), and `displayNamer` writes names for them. With no answers and no kept entries the result
// is exactly what it was before EC-1, with no extra field.

export type EngineView = {
  engineJob: Job;
  engineProfile: Profile;
  couldNotJudge: Requirement[];
  // Present only when something was rewritten:
  originalOf?: Map<Requirement, Requirement>;
  originOfId?: Map<string, string[]>;
  aiJudged?: AiJudgedItem[]; // the requirements judged by an accepted answer, in the ad's order
  sameName?: { original: Requirement; entry: KeptEntry }[]; // the requirements met by the same-name match
};

// An accepted answer, tied to the requirement by its place in the ad's list. met needs an entry.
export type ViewAnswer = { index: number; verdict: "met" | "partly" | "none"; entry: KeptEntry | null; quote: string | null };
export type ViewExtras = { answers?: ViewAnswer[]; unlistedKept?: KeptEntry[] };
export type AiJudgedItem = { index: number; original: Requirement; verdict: ViewAnswer["verdict"]; entry: KeptEntry | null; quote: string | null };

const NO_MAP: Map<Requirement, Requirement> = new Map();

// The map back (empty when nothing was rewritten).
export const originalOf = (view: EngineView): Map<Requirement, Requirement> => view.originalOf ?? NO_MAP;

// A name for any id the engine saw, the original one for a rewritten id: "Wound care", never "ev:3".
export function displayNamer(view: EngineView, nameOf: (id: string) => string): (id: string) => string {
  return (id) => {
    const origin = view.originOfId?.get(id);
    return origin ? origin.map(nameOf).join(" or ") : nameOf(id);
  };
}

export function engineView(job: Job, built: BuiltProfile, extras?: ViewExtras): EngineView {
  const { profile, set } = built;
  // The kept entries come from the caller, or from the profile itself when it holds them (EC-2 puts them there).
  const kept = extras?.unlistedKept ?? built.unlistedKept ?? [];
  const answers = extras?.answers ?? [];

  // Rewrite what can be judged now.
  const rewritten = new Map<number, Requirement>();
  const originalOfMap = new Map<Requirement, Requirement>();
  const originOfId = new Map<string, string[]>();
  const added: ProfileSkill[] = [];
  const aiJudged: AiJudgedItem[] = [];
  const sameName: { original: Requirement; entry: KeptEntry }[] = [];

  const rewrite = (i: number, r: Requirement, id: string, skill: { evidence: Evidence } | null) => {
    const next: Requirement = { ...r, skillIds: [id] };
    rewritten.set(i, next);
    originalOfMap.set(next, r);
    originOfId.set(id, r.skillIds);
    if (skill && !added.some((s) => s.skillId === id)) added.push({ kind: "have", skillId: id, evidence: skill.evidence });
  };

  job.requirements.forEach((r, i) => {
    if (!r.skillIds.every(isUnlistedId)) return; // judged by the skill list: never touched
    // 1. the same-name match: the same id on both sides (never a near spelling)
    for (const id of r.skillIds) {
      const hit = kept.find((k) => k.skillId === id);
      if (hit) {
        rewrite(i, r, `kept:${hit.skillId.replace(/^new:/, "")}`, hit);
        sameName.push({ original: r, entry: hit });
        return;
      }
    }
    // 2. the verified answer of a click, if there is one (the first for this requirement)
    const a = answers.find((x) => x.index === i);
    if (!a) return;
    if (a.verdict === "met") {
      if (a.entry === null) return; // a met answer with no entry cannot be shown: left alone
      rewrite(i, r, `ev:${i + 1}`, a.entry);
    } else {
      rewrite(i, r, `ev:${i + 1}`, null);
    }
    aiJudged.push({ index: i, original: r, verdict: a.verdict, entry: a.entry, quote: a.quote });
  });

  const seen = rewritten.size > 0 ? { ...job, requirements: job.requirements.map((r, i) => rewritten.get(i) ?? r) } : job;
  const { judged: judgedJob, couldNotJudge } = splitJudgeable(seen);
  const engineJob: Job = {
    ...judgedJob,
    constraints: {
      ...job.constraints,
      languages: set.language ? job.constraints.languages : [],
      location: set.location ? job.constraints.location : null,
    },
  };
  const engineProfile = {
    ...profile,
    ...(added.length > 0 ? { skills: [...profile.skills, ...added] } : {}),
    constraints: {
      ...profile.constraints,
      workModes: set.workMode ? profile.constraints.workModes : (["onsite", "hybrid", "remote"] as const).slice(),
    },
  };
  if (rewritten.size === 0) return { engineJob, engineProfile, couldNotJudge };
  return { engineJob, engineProfile, couldNotJudge, originalOf: originalOfMap, originOfId, aiJudged, sameName };
}
