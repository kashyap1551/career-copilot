import { engineView } from "@/lib/cv/engineView";
import { KIND_WORDS, type BuiltProfile } from "@/lib/cv/profile";
import { blockedHeader, conflictLine, explainRankedSkill, jobLabel, YEARS_NOTE } from "@/lib/engine/explain";
import { gapList, type HeldBack } from "@/lib/engine/gaps";
import { match } from "@/lib/engine/match";
import { ROADMAP_FROM_JOBS, roadmapBasis } from "@/lib/engine/roadmapJobs";
import type { Job, Skill } from "@/lib/engine/types";
import { classifyJobs, jobsBroughtCloser, rankMissingSkills } from "@/lib/engine/unlock";
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
  notCountedLine,
  RANKING_HEADER,
  rankingNoneLine,
  thresholdLine,
  unjudgedCaveat,
} from "@/lib/saved/messages";

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
};

const EMPTY: RoadmapBox = { noProfile: null, partA: [], partB: [], counted: 0, alreadyStrongIds: [] };

// `built` is the profile in use (null = none). `ads` are the saved ads as opened by 6.2 (the same readings the fit levels use).
export function roadmapBox(
  built: BuiltProfile | null,
  ads: { id: string; job: Job }[],
  skills: Skill[],
  fromJobs: number = ROADMAP_FROM_JOBS,
): RoadmapBox {
  if (ads.length === 0) return EMPTY; // nothing saved: the page does not show the box
  if (built === null) return { ...EMPTY, noProfile: NO_PROFILE_NOTE };

  const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;

  // Which ads count (before and independent of the profile), then the engine's view of each.
  const basis = ads.map((a) => ({ ad: a, ...roadmapBasis(a.job) }));
  const counted = basis.filter((b) => b.excluded === null);
  const noRequirements = basis.filter((b) => b.excluded === "no-requirements").length;
  const noMustHave = basis.filter((b) => b.excluded === "no-must-have-judgeable").length;
  const notCounted = notCountedLine(noRequirements, noMustHave);
  const M = counted.length;

  if (M === 0) {
    return { ...EMPTY, partA: notCounted ? [notCounted] : [], partB: [thresholdLine(0, fromJobs)] };
  }

  const views = counted.map((c) => engineView(c.ad.job, built));
  const engineProfile = views[0].engineProfile;
  const engineJobs = views.map((v) => v.engineJob);

  // ---- Part A: the gap list ----
  const gaps = gapList(engineProfile, engineJobs, nameOf);
  const partA: string[] = [];
  if (gaps.rows.length > 0) {
    partA.push(gapTitle(M), GAP_SUBTITLE);
    for (const r of gaps.rows) {
      const note = r.learning ? learningNote(r.learning) : r.noCvLine ? NO_CV_LINE_NOTE : "";
      partA.push(gapRowText(nameOf(r.skillId), note, r.mustAds, r.niceAds));
    }
    const alternatives = engineJobs.some((job) =>
      [...match(engineProfile, job).musts, ...match(engineProfile, job).nices].some((q) => !q.met && q.requirement.skillIds.length > 1),
    );
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
  if (M < fromJobs) return { noProfile: null, partA, partB: [thresholdLine(M, fromJobs)], counted: M, alreadyStrongIds: [] };

  const labelOf = (jobId: string) => {
    const i = engineJobs.findIndex((j) => j.id === jobId);
    if (i < 0) return jobId;
    const n = counted[i].unjudgedMusts;
    return jobLabel(engineJobs[i]) + (n > 0 ? unjudgedCaveat(n) : "");
  };
  const groups = classifyJobs(engineProfile, engineJobs);
  const ranking = rankMissingSkills(engineProfile, engineJobs);
  const partB: string[] = [alreadyStrongLine(groups.alreadyStrong.map(labelOf))];
  if (ranking.length === 0) {
    partB.push(rankingNoneLine(groups.alreadyStrong.length > 0));
  } else {
    partB.push(RANKING_HEADER);
    ranking.forEach((entry, i) => {
      const closer =
        entry.newlyUnlocked.length === 0
          ? jobsBroughtCloser(engineProfile, engineJobs, ranking.slice(0, i).map((r) => r.skillId), entry.skillId)
          : [];
      partB.push(`${i + 1}. ${explainRankedSkill(entry, closer, nameOf, labelOf)}`);
    });
  }
  if (groups.blocked.length === 0) {
    partB.push(BLOCKED_NONE);
  } else {
    partB.push(blockedCountLine(groups.blocked.length));
    for (const b of groups.blocked) {
      partB.push(`- ${labelOf(b.jobId)}: ${blockedHeader(b)}`);
      for (const c of b.conflicts) partB.push(conflictLine(c));
      if (b.conflicts.some((c) => c.kind === "years")) partB.push(YEARS_NOTE);
    }
  }
  const strongIds = new Set(groups.alreadyStrong);
  return {
    noProfile: null,
    partA,
    partB,
    counted: M,
    alreadyStrongIds: counted.filter((_, i) => strongIds.has(engineJobs[i].id)).map((c) => c.ad.id),
  };
}
