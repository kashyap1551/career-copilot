import { match } from "./match";
import type {
  Conflict,
  ConflictKind,
  Job,
  Profile,
  Requirement,
  SkillId,
} from "./types";

// Which jobs a person can unlock by learning skills, in what order, and by
// when. Plain code: no AI, no network, no clock. The rules are in
// docs/DECISIONS.md.
//
// A job counts as unlocked only if it BECOMES Strong. Any conflict, closable
// or not, blocks it: under the gap-count rule a closable conflict is still a
// gap, so skills alone can never make that job Strong. Nice-to-haves play no
// part anywhere in this file.

// ---- Sorting the jobs ------------------------------------------------------

export type BlockedJob = {
  jobId: string;
  by: ConflictKind[]; // each kind once, in the order match() found them
  onlyClosable: boolean; // true if every conflict could be closed
  conflicts: Conflict[]; // the plain sentences, for the report
};

export type ReachableJob = {
  job: Job;
  // The must-haves still missing. Each lists acceptable skills: gaining any
  // one of them satisfies it.
  missing: Requirement[];
};

export type JobGroups = {
  alreadyStrong: string[];
  blocked: BlockedJob[];
  reachable: ReachableJob[];
};

export function classifyJobs(profile: Profile, jobs: Job[]): JobGroups {
  const groups: JobGroups = { alreadyStrong: [], blocked: [], reachable: [] };
  for (const job of jobs) {
    const result = match(profile, job);
    if (result.conflicts.length > 0) {
      groups.blocked.push({
        jobId: job.id,
        by: [...new Set(result.conflicts.map((c) => c.kind))],
        onlyClosable: result.conflicts.every((c) => c.closable),
        conflicts: result.conflicts,
      });
    } else if (result.level === "strong") {
      groups.alreadyStrong.push(job.id);
    } else {
      groups.reachable.push({
        job,
        missing: result.musts.filter((m) => !m.met).map((m) => m.requirement),
      });
    }
  }
  return groups;
}

// Every missing must-have has at least one acceptable skill among `gained`.
function covers(missing: Requirement[], gained: Set<SkillId>): boolean {
  return missing.every((r) => r.skillIds.some((id) => gained.has(id)));
}

function unlockedIds(groups: JobGroups, gained: Set<SkillId>): string[] {
  return groups.reachable
    .filter((r) => covers(r.missing, gained))
    .map((r) => r.job.id);
}

// ---- Jobs unlocked by a set of skills --------------------------------------

// The jobs (by id, in the order given) that would become Strong if the
// person gained these skills. Jobs already Strong and blocked jobs never
// appear.
export function rolesUnlockedBy(
  profile: Profile,
  jobs: Job[],
  skills: SkillId[],
): string[] {
  return unlockedIds(classifyJobs(profile, jobs), new Set(skills));
}

// ---- The ranking -----------------------------------------------------------

export type RankedSkill = {
  skillId: SkillId;
  newlyUnlocked: string[]; // jobs this skill unlocks on top of the ones before it
  totalUnlocked: number; // running total including this skill
  // Jobs this skill moves one step closer without unlocking them: it covers
  // one of their missing must-haves, but they still need more.
  closer: number;
  inProgress: string | null; // expected date if the person is already learning it
};

// Greedy and cumulative: take the skill that unlocks the most jobs, assume
// it is gained, and repeat. Greedy is not guaranteed to give the best
// possible order, only a clear and repeatable one.
//
// Tie-break, in order:
//   1. most newly unlocked jobs
//   2. most jobs brought one step closer
//   3. skills already in progress first, earliest expected date first
//   4. skill id, alphabetical
export function rankMissingSkills(profile: Profile, jobs: Job[]): RankedSkill[] {
  const { reachable } = classifyJobs(profile, jobs);

  const learning = new Map<SkillId, string>();
  for (const s of profile.skills) {
    if (s.kind === "inProgress") learning.set(s.skillId, s.expectedDate);
  }

  const candidates = new Set<SkillId>();
  for (const r of reachable) {
    for (const req of r.missing) req.skillIds.forEach((id) => candidates.add(id));
  }

  const chosen = new Set<SkillId>();
  const unlockedSoFar = new Set<string>();
  const ranking: RankedSkill[] = [];

  for (;;) {
    let best: RankedSkill | null = null;

    for (const skillId of [...candidates].filter((s) => !chosen.has(s))) {
      const withSkill = new Set(chosen).add(skillId);
      const newlyUnlocked = reachable
        .filter((r) => !unlockedSoFar.has(r.job.id) && covers(r.missing, withSkill))
        .map((r) => r.job.id);
      const closer = reachable.filter(
        (r) =>
          !covers(r.missing, withSkill) &&
          r.missing.some(
            (req) =>
              req.skillIds.includes(skillId) &&
              !req.skillIds.some((id) => chosen.has(id)),
          ),
      ).length;
      const entry: RankedSkill = {
        skillId,
        newlyUnlocked,
        totalUnlocked: unlockedSoFar.size + newlyUnlocked.length,
        closer,
        inProgress: learning.get(skillId) ?? null,
      };
      if (best === null || isBetter(entry, best)) best = entry;
    }

    // Nothing left that unlocks a job or brings one closer.
    if (best === null || (best.newlyUnlocked.length === 0 && best.closer === 0)) {
      break;
    }
    ranking.push(best);
    chosen.add(best.skillId);
    best.newlyUnlocked.forEach((id) => unlockedSoFar.add(id));
  }
  return ranking;
}

function isBetter(a: RankedSkill, b: RankedSkill): boolean {
  if (a.newlyUnlocked.length !== b.newlyUnlocked.length) {
    return a.newlyUnlocked.length > b.newlyUnlocked.length;
  }
  if (a.closer !== b.closer) return a.closer > b.closer;
  if ((a.inProgress === null) !== (b.inProgress === null)) {
    return a.inProgress !== null;
  }
  if (a.inProgress !== null && b.inProgress !== null && a.inProgress !== b.inProgress) {
    return a.inProgress < b.inProgress;
  }
  return a.skillId < b.skillId;
}

// ---- The dated timeline ----------------------------------------------------

export type TimelineEntry = {
  date: string; // "2026-12-20"
  skills: SkillId[]; // learned on this date, alphabetical
  moreStrong: number; // cumulative: Strong matches gained by this date
  newlyUnlocked: string[]; // the ones that appear at this date
  jobs: string[]; // all of them, cumulative
};

// "By 2026-12-20: N more Strong matches", from skills in progress. At each
// date the person is assumed to have every skill dated on or before it, so
// skills sharing a date are added together and the count never depends on
// their order. Dates where nothing unlocks stay in the list with 0. The
// engine does not know today's date, so past dates are not filtered out.
export function unlockTimeline(profile: Profile, jobs: Job[]): TimelineEntry[] {
  const groups = classifyJobs(profile, jobs);

  const learning = profile.skills.flatMap((s) =>
    s.kind === "inProgress" ? [{ skillId: s.skillId, date: s.expectedDate }] : [],
  );
  const dates = [...new Set(learning.map((l) => l.date))].sort();

  const entries: TimelineEntry[] = [];
  let before: string[] = [];
  for (const date of dates) {
    const gained = new Set(
      learning.filter((l) => l.date <= date).map((l) => l.skillId),
    );
    const now = unlockedIds(groups, gained);
    entries.push({
      date,
      skills: learning
        .filter((l) => l.date === date)
        .map((l) => l.skillId)
        .sort(),
      moreStrong: now.length,
      newlyUnlocked: now.filter((id) => !before.includes(id)),
      jobs: now,
    });
    before = now;
  }
  return entries;
}
