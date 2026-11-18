import type { NameOf } from "./explain";
import type { FitLevel, Job, Profile, SkillId } from "./types";

// Step 8.2 (docs/PLAN-8.2.md D3): the two counts the analytics need that no other engine function produces. Pure counting over values it is given:
// no AI, no network, no clock, nothing from app/. The level of each ad is worked out elsewhere (app/fitReport.ts) and handed in as a plain value.

export type LevelTally = { strong: number; good: number; stretch: number; longShot: number; none: number };
export type Standing = "have" | "no-cv-line" | "none" | `learning:${string}`;
export type AskedRow = { skillId: SkillId; mustAds: number; niceAds: number; standing: Standing };

// How many ads have each level; `null` (no level could be shown) is counted as `none`.
export function tallyLevels(levels: (FitLevel | null)[]): LevelTally {
  const t: LevelTally = { strong: 0, good: 0, stretch: 0, longShot: 0, none: 0 };
  for (const l of levels) {
    if (l === null) t.none++;
    else t[l]++;
  }
  return t;
}

// Every skill the ads ask for, met or not: how many ads ask for it as a must-have and as a nice-to-have (each ad once per skill and importance;
// a requirement that accepts several skills counts for each of them; blocked ads count), and where the profile stands on it. Sorted as the gap
// rows are: most must-have asks first, then most nice-to-have asks, then the lower-case display name, then the id.
export function askedSkills(profile: Profile, jobs: Job[], nameOf: NameOf): AskedRow[] {
  const asked = new Map<SkillId, { must: Set<number>; nice: Set<number> }>();
  jobs.forEach((job, i) => {
    for (const r of job.requirements) {
      for (const id of r.skillIds) {
        const e = asked.get(id) ?? { must: new Set<number>(), nice: new Set<number>() };
        (r.importance === "must" ? e.must : e.nice).add(i);
        asked.set(id, e);
      }
    }
  });
  const rows: AskedRow[] = [...asked.entries()].map(([skillId, e]) => {
    const own = profile.skills.find((s) => s.skillId === skillId);
    const standing: Standing = !own ? "none" : own.kind === "inProgress" ? `learning:${own.expectedDate}` : own.evidence ? "have" : "no-cv-line";
    return { skillId, mustAds: e.must.size, niceAds: e.nice.size, standing };
  });
  rows.sort((a, b) => {
    if (a.mustAds !== b.mustAds) return b.mustAds - a.mustAds;
    if (a.niceAds !== b.niceAds) return b.niceAds - a.niceAds;
    const na = nameOf(a.skillId).toLowerCase();
    const nb = nameOf(b.skillId).toLowerCase();
    if (na !== nb) return na < nb ? -1 : 1;
    return a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0;
  });
  return rows;
}
