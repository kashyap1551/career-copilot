import { engineView, type EngineView } from "@/lib/cv/engineView";
import { KIND_WORDS, type BuiltProfile } from "@/lib/cv/profile";
import { blockedHeader, conflictLine, explainRankedSkill, explainTimelineEntry, jobLabel, YEARS_NOTE } from "@/lib/engine/explain";
import { gapList, type GapList, type HeldBack } from "@/lib/engine/gaps";
import { match } from "@/lib/engine/match";
import { listedAlternatives, ROADMAP_FROM_JOBS, roadmapBasis } from "@/lib/engine/roadmapJobs";
import type { Job, Profile, Skill } from "@/lib/engine/types";
import { classifyJobs, jobsBroughtCloser, rankMissingSkills, unlockTimeline, type JobGroups } from "@/lib/engine/unlock";
import {
  alreadyStrongLine,
  ALTERNATIVES_NOTE,
  BLOCKED_NONE,
  blockedCountLine,
  couldNotJudgeLine,
  GAP_SUBTITLE,
  gapRowText,
  gapTitle,
  HELD_BACK_AD,
  HELD_BACK_COUNTED,
  HELD_BACK_IS,
  HELD_BACK_OF,
  HELD_BACK_REASON,
  HELD_BACK_TAIL,
  learningNote,
  meetEveryLine,
  NO_CV_LINE_NOTE,
  NO_PROFILE_NOTE,
  ROADMAP_FAILED_LINE,
  notCountedLine,
  RANKING_HEADER,
  rankingNoneLine,
  thresholdLine,
  TIMELINE_FRAMING,
  TIMELINE_HEADER,
  TIMELINE_NONE,
  unjudgedCaveat,
} from "@/lib/saved/messages";
import type { OpenedAd } from "./savedAdRows";

// Step 7.1 (docs/PLAN-7.1.md): the "What to learn" box, assembled by pure code. No AI, no store, no network. The words are
// constants in lib/saved/messages.ts (the 6.2 pattern); this file only chooses and joins them. The numbers come from the
// engine (`gapList`, `classifyJobs`, `rankMissingSkills`); nothing is counted here.

// The line under the gap list when some counted ads are held back by something other than skills (Amendments 1 and 2).
// The noun follows M (the ads counted), the verb and the pronoun follow N (the ads held back). With no gap row there are
// no skills "above", so the closing words are left out. Null when no ad is held back.
export function heldBackLine(heldBack: HeldBack, hasRows: boolean): string | null {
  if (heldBack.ads === 0) return null;
  const noun = heldBack.of === 1 ? HELD_BACK_AD.one : HELD_BACK_AD.many;
  const one = heldBack.ads === 1;
  const verb = one ? HELD_BACK_IS.one : HELD_BACK_IS.many;
  const words = heldBack.kinds.map((k) => KIND_WORDS[k]).join(", ");
  const head = [heldBack.ads, HELD_BACK_OF, heldBack.of, HELD_BACK_COUNTED, noun, verb, HELD_BACK_REASON].join(" ");
  const tail = hasRows ? `, ${one ? HELD_BACK_TAIL.one : HELD_BACK_TAIL.many}` : "";
  return `${head} (${words})${tail}.`;
}

export type RoadmapBox = {
  noProfile: string | null; // the note when no profile is in use (then both parts are empty)
  partA: string[]; // the gap list, one text line each (the view indents)
  partB: string[]; // the roadmap, or the one threshold line
  counted: number; // M: the saved ads the gap list and the roadmap use
  alreadyStrongIds: string[]; // ids of counted ads classed Already Strong ([] while the roadmap is not shown)
  timeline: string[]; // step 7.3: the timeline from skills in progress, with the roadmap only; [] otherwise (the view draws it as a third list)
};

const EMPTY: RoadmapBox = { noProfile: null, partA: [], partB: [], counted: 0, alreadyStrongIds: [], timeline: [] };

// ---- The inputs and the line builders the box and the report share (step 8.1, docs/PLAN-8.1.md D7) ------------------------------
// Pure code, no AI, no store, no network. `roadmapInputs` does the counting of which ads count and the engine's view of each; the
// builders write the engine's own sentences. The box and the roadmap report both call them, so they cannot disagree and the P0
// defect (ads sharing one job id) cannot be fixed in one place and forgotten in the other.

type CountedAd = { ad: { id: string; job: Job }; unjudgedMusts: number };

export type ReadyInputs = {
  kind: "ready";
  M: number; // the saved ads that count
  counted: CountedAd[];
  notCounted: string | null; // the line naming the ads left out, or null when none is
  nameOf: (skillId: string) => string;
  views: EngineView[]; // the engine's view of each counted ad
  engineProfile: Profile;
  // Amendment 6 (2): an unlisted alternative is dropped from each requirement before anything is counted or ranked. The numbers of
  // requirements not judged and the caveats still come from `views` and `counted`, not from these jobs.
  // Amendment 7: every opened reading carries the job id "pasted-ad", and the engine keys on job id. Each counted ad's job takes the
  // SAVED-AD id (the store key, unique), so two ads can never collapse into one.
  engineJobs: Job[];
  labelOf: (jobId: string) => string; // the name of a counted job, with the page's caveat "(n must-haves not judged)"
  gaps: GapList;
};

export type RoadmapInputs =
  | { kind: "no-ads" } // nothing saved: the page shows no box
  | { kind: "no-profile" } // no profile in use
  | { kind: "none-counted"; notCounted: string | null } // saved ads, but none of them counts
  | ReadyInputs;

export function roadmapInputs(built: BuiltProfile | null, ads: { id: string; job: Job }[], skills: Skill[]): RoadmapInputs {
  if (ads.length === 0) return { kind: "no-ads" };
  if (built === null) return { kind: "no-profile" };

  const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;

  // Which ads count (before and independent of the profile), then the engine's view of each.
  const basis = ads.map((a) => ({ ad: a, ...roadmapBasis(a.job) }));
  const counted = basis.filter((b) => b.excluded === null);
  const noRequirements = basis.filter((b) => b.excluded === "no-requirements").length;
  const noMustHave = basis.filter((b) => b.excluded === "no-must-have-judgeable").length;
  const notCounted = notCountedLine(noRequirements, noMustHave);
  const M = counted.length;
  if (M === 0) return { kind: "none-counted", notCounted };

  const views = counted.map((c) => engineView(c.ad.job, built));
  const engineProfile = views[0].engineProfile;
  const engineJobs = views.map((v, i) => ({ ...listedAlternatives(v.engineJob), id: counted[i].ad.id }));
  const labelOf = (jobId: string) => {
    const i = engineJobs.findIndex((j) => j.id === jobId);
    if (i < 0) return jobId;
    const n = counted[i].unjudgedMusts;
    return jobLabel(engineJobs[i]) + (n > 0 ? unjudgedCaveat(n) : "");
  };
  const gaps = gapList(engineProfile, engineJobs, nameOf);
  return { kind: "ready", M, counted, notCounted, nameOf, views, engineProfile, engineJobs, labelOf, gaps };
}

export type RoadmapParts = {
  groups: JobGroups;
  alreadyStrong: string; // the "Already Strong: ..." line
  ranking: { skillId: string; text: string }[]; // the engine's sentence for each ranked skill, in order, WITHOUT the "1. " marker
  blocked: string[]; // the blocked-jobs lines (the count line and, per job, its header and conflict lines), or the "none" line
  timeline: string[]; // the timeline lines (header, framing, one per date), or the "none" line
};

// The roadmap's lines, from the engine's own functions. The ranking and the timeline get the very same two values (T14 of step 7.3).
export function roadmapParts(r: ReadyInputs): RoadmapParts {
  const { engineProfile, engineJobs, nameOf, labelOf } = r;
  const groups = classifyJobs(engineProfile, engineJobs);
  const ranked = rankMissingSkills(engineProfile, engineJobs);
  const ranking = ranked.map((entry, i) => {
    const closer =
      entry.newlyUnlocked.length === 0
        ? jobsBroughtCloser(engineProfile, engineJobs, ranked.slice(0, i).map((x) => x.skillId), entry.skillId)
        : [];
    return { skillId: entry.skillId, text: explainRankedSkill(entry, closer, nameOf, labelOf) };
  });
  const blocked: string[] = [];
  if (groups.blocked.length === 0) {
    blocked.push(BLOCKED_NONE);
  } else {
    blocked.push(blockedCountLine(groups.blocked.length));
    for (const b of groups.blocked) {
      blocked.push(`- ${labelOf(b.jobId)}: ${blockedHeader(b)}`);
      for (const c of b.conflicts) blocked.push(conflictLine(c));
      if (b.conflicts.some((c) => c.kind === "years")) blocked.push(YEARS_NOTE);
    }
  }
  // Step 7.3: the same two values as the ranking above, so the two cannot disagree. Each line is the engine's own sentence.
  const entries = unlockTimeline(engineProfile, engineJobs);
  const timeline =
    entries.length === 0
      ? [TIMELINE_NONE]
      : [TIMELINE_HEADER, TIMELINE_FRAMING, ...entries.map((e) => explainTimelineEntry(e, nameOf, labelOf))];
  return { groups, alreadyStrong: alreadyStrongLine(groups.alreadyStrong.map(labelOf)), ranking, blocked, timeline };
}

// `built` is the profile in use (null = none). `ads` are the saved ads as opened by 6.2 (the same readings the fit levels use).
export function roadmapBox(
  built: BuiltProfile | null,
  ads: { id: string; job: Job }[],
  skills: Skill[],
  fromJobs: number = ROADMAP_FROM_JOBS,
): RoadmapBox {
  return roadmapBoxFrom(roadmapInputs(built, ads, skills), fromJobs);
}

// Step 8.2 (docs/PLAN-8.2.md D9): the box from inputs that are already worked out, so the page works them out ONCE for the box, the report
// and the analytics. `roadmapBox` is the old way in and calls this; nothing in the lines or the fields changed.
export function roadmapBoxFrom(r: RoadmapInputs, fromJobs: number = ROADMAP_FROM_JOBS): RoadmapBox {
  if (r.kind === "no-ads") return EMPTY; // nothing saved: the page does not show the box
  if (r.kind === "no-profile") return { ...EMPTY, noProfile: NO_PROFILE_NOTE };
  if (r.kind === "none-counted") {
    return { ...EMPTY, partA: r.notCounted ? [r.notCounted] : [], partB: [thresholdLine(0, fromJobs)] };
  }
  const { M, counted, notCounted, views, engineProfile, engineJobs, nameOf, gaps } = r;

  // ---- Part A: the gap list ----
  const partA: string[] = [];
  if (gaps.rows.length > 0) {
    partA.push(gapTitle(M), GAP_SUBTITLE);
    for (const row of gaps.rows) {
      const note = row.learning ? learningNote(row.learning) : row.noCvLine ? NO_CV_LINE_NOTE : "";
      partA.push(gapRowText(nameOf(row.skillId), note, row.mustAds, row.niceAds));
    }
    const alternatives = engineJobs.some((job) => {
      const result = match(engineProfile, job); // once per ad
      return [...result.musts, ...result.nices].some((q) => !q.met && q.requirement.skillIds.length > 1);
    });
    if (alternatives) partA.push(ALTERNATIVES_NOTE);
  } else {
    partA.push(meetEveryLine(M));
  }
  const unjudged = views.reduce((n, v) => n + v.couldNotJudge.length, 0);
  if (unjudged > 0) partA.push(couldNotJudgeLine(unjudged));
  if (notCounted) partA.push(notCounted);
  const held = heldBackLine(gaps.heldBack, gaps.rows.length > 0);
  if (held) partA.push(held);

  // ---- Part B: the roadmap, from the engine's own functions ----
  if (M < fromJobs) return { noProfile: null, partA, partB: [thresholdLine(M, fromJobs)], counted: M, alreadyStrongIds: [], timeline: [] };

  const parts = roadmapParts(r);
  const partB: string[] = [parts.alreadyStrong];
  if (parts.ranking.length === 0) {
    partB.push(rankingNoneLine(parts.groups.alreadyStrong.length > 0));
  } else {
    partB.push(RANKING_HEADER);
    parts.ranking.forEach((x, i) => partB.push(`${i + 1}. ${x.text}`));
  }
  partB.push(...parts.blocked);
  const strongIds = new Set(parts.groups.alreadyStrong);
  return {
    noProfile: null,
    partA,
    partB,
    counted: M,
    alreadyStrongIds: counted.filter((_, i) => strongIds.has(engineJobs[i].id)).map((c) => c.ad.id),
    timeline: parts.timeline,
  };
}

// The saved ads the box can read: the readings 6.2 already opens (as stored, or re-checked in the browser). A record that could
// not be opened, or that a newer app saved, is not an ad here (the saved-ads list names it in its own notice).
export function roadmapAds(opened: OpenedAd[]): { id: string; job: Job }[] {
  const ads: { id: string; job: Job }[] = [];
  for (const a of opened) {
    const o = a.opened;
    if (o.kind === "failed" || o.kind === "newer-version") continue;
    ads.push({ id: a.id, job: o.reading.job });
  }
  return ads;
}

// What the page calls (Amendment 6 (3)): a throw while working out the box (a damaged record, say) gives one line instead of an
// error page. The box stays text only; nothing is written.
export function roadmapBoxSafe(
  built: BuiltProfile | null,
  ads: { id: string; job: Job }[],
  skills: Skill[],
  fromJobs: number = ROADMAP_FROM_JOBS,
): RoadmapBox {
  try {
    return roadmapBox(built, ads, skills, fromJobs);
  } catch {
    return failedRoadmapBox();
  }
}

// The box the page shows when working it out threw: one line, nothing else (Amendment 6 (3)). Shared by `roadmapBoxSafe` and `screenOutcomes`.
export function failedRoadmapBox(): RoadmapBox {
  return { noProfile: null, partA: [ROADMAP_FAILED_LINE], partB: [], counted: 0, alreadyStrongIds: [], timeline: [] };
}
