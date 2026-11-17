import { CONFLICT_KIND, KINDS, type Kind } from "../cv/profile";
import type { NameOf } from "./explain";
import { match } from "./match";
import type { Job, Profile, SkillId } from "./types";

// Step 7.1d (docs/PLAN-7.1.md section 6 and Amendments 2 and 3): the gap list across saved ads. Pure code: no AI, no
// network, no store. The profile and the ads are given AFTER `engineView` (lib/cv/engineView.ts: only skills we list,
// the kinds the person never set blanked), exactly what the page passes. Which ads COUNT is decided before this
// function (`roadmapBasis`); `of` is the number of ads handed in.

export type GapRow = {
  skillId: SkillId;
  mustAds: number; // counted ads with an unmet must-have that names this skill (each ad once)
  niceAds: number; // the same for nice-to-haves, counted apart
  learning: string | null; // the expected date when the person is learning the skill, else null
  noCvLine: boolean; // the skill is on the profile with no CV line, so it does not count
};

export type HeldBack = {
  ads: number; // N: counted ads with at least one conflict that can't be closed soon (an ad counts once)
  of: number; // M: the ads counted in the gap list
  kinds: Kind[]; // the kinds of those unclosable conflicts only, each once, in the order of KINDS
};

export type GapList = { rows: GapRow[]; heldBack: HeldBack };

export function gapList(profile: Profile, jobs: Job[], nameOf: NameOf): GapList {
  const counts = new Map<SkillId, { must: number; nice: number }>();
  const kinds = new Set<Kind>();
  let heldAds = 0;

  for (const job of jobs) {
    const result = match(profile, job); // once per ad

    // Each unmet requirement counts for EACH skill it accepts; an ad counts once per skill and importance.
    const must = new Set<SkillId>();
    const nice = new Set<SkillId>();
    for (const r of [...result.musts, ...result.nices]) {
      if (r.met) continue;
      const into = r.requirement.importance === "must" ? must : nice;
      for (const id of r.requirement.skillIds) into.add(id);
    }
    for (const id of must) counts.set(id, { must: (counts.get(id)?.must ?? 0) + 1, nice: counts.get(id)?.nice ?? 0 });
    for (const id of nice) counts.set(id, { must: counts.get(id)?.must ?? 0, nice: (counts.get(id)?.nice ?? 0) + 1 });

    // Held back: a conflict that can't be closed soon. Closable ones say nothing (the code does not know the person
    // cannot close them).
    const unclosable = result.conflicts.filter((c) => !c.closable);
    if (unclosable.length > 0) heldAds++;
    for (const c of unclosable) kinds.add(CONFLICT_KIND[c.kind]);
  }

  const rows: GapRow[] = [...counts.entries()].map(([skillId, c]) => {
    const learning = profile.skills.find((s) => s.kind === "inProgress" && s.skillId === skillId);
    return {
      skillId,
      mustAds: c.must,
      niceAds: c.nice,
      learning: learning && learning.kind === "inProgress" ? learning.expectedDate : null,
      // A skill the person has WITH a CV line meets every requirement that names it, so a gap row for a skill that is on
      // the profile as "have" can only mean it has no usable CV line.
      noCvLine: profile.skills.some((s) => s.kind === "have" && s.skillId === skillId),
    };
  });

  // Most must-have asks first, then most nice-to-have asks, then the display name (lower case), then the id.
  rows.sort((a, b) => {
    if (a.mustAds !== b.mustAds) return b.mustAds - a.mustAds;
    if (a.niceAds !== b.niceAds) return b.niceAds - a.niceAds;
    const na = nameOf(a.skillId).toLowerCase();
    const nb = nameOf(b.skillId).toLowerCase();
    if (na !== nb) return na < nb ? -1 : 1;
    return a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0;
  });

  return { rows, heldBack: { ads: heldAds, of: jobs.length, kinds: KINDS.filter((k) => kinds.has(k)) } };
}
