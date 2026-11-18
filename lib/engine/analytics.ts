import type { NameOf } from "./explain";
import type { FitLevel, Job, Profile, SkillId } from "./types";

// Step 8.2 stage 1: STUB (docs/PLAN-8.2.md D3). Pure counting over values it is given: no AI, no network, no clock, nothing from app/.
// The bodies return empty values and never throw; stage 3 writes them.

export type LevelTally = { strong: number; good: number; stretch: number; longShot: number; none: number };
export type Standing = "have" | "no-cv-line" | "none" | `learning:${string}`;
export type AskedRow = { skillId: SkillId; mustAds: number; niceAds: number; standing: Standing };

export function tallyLevels(levels: (FitLevel | null)[]): LevelTally {
  void levels;
  return { strong: 0, good: 0, stretch: 0, longShot: 0, none: 0 };
}

export function askedSkills(profile: Profile, jobs: Job[], nameOf: NameOf): AskedRow[] {
  void profile;
  void jobs;
  void nameOf;
  return [];
}
