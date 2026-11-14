import {
  blockedHeader,
  conflictLine,
  describeRequirement,
  explainFit,
  explainRankedSkill,
  explainTimelineEntry,
  heldBackBy,
  jobLabel,
  levelName,
  YEARS_NOTE,
} from "./explain";
import { match } from "./match";
import type { Job, Profile, RequirementResult, Skill } from "./types";
import {
  classifyJobs,
  jobsBroughtCloser,
  rankMissingSkills,
  unlockTimeline,
} from "./unlock";

// The whole printout for one person as text: every saved job, then the
// roadmap. Pure: the command-line script only prints what this returns.

// From this many saved jobs the roadmap is shown as a real feature; below
// it, the printout labels it a test view.
const ROADMAP_FROM_JOBS = 10;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function renderProfileReport(
  profile: Profile,
  jobs: Job[],
  skills: Skill[],
): string {
  const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;
  const labelOf = (id: string) => {
    const job = jobs.find((j) => j.id === id);
    return job ? jobLabel(job) : id;
  };
  const results = jobs.map((job) => ({ job, result: match(profile, job) }));

  const lines: string[] = [];

  // One line per job.
  lines.push(
    `${profile.name.toUpperCase()} (${profile.id}): ${jobs.length} saved ${plural(jobs.length, "job", "jobs")}`,
  );
  for (const { job, result } of results) {
    const held = heldBackBy(result);
    lines.push(
      `  ${jobLabel(job)}: ${levelName(result.level)} (${result.counts.mustsMet} of ${result.counts.mustsTotal} must-haves met${held ? `; held back by ${held}` : ""})`,
    );
  }
  lines.push("");

  // Each job in full.
  for (const { job, result } of results) {
    lines.push(`--- ${jobLabel(job)} ---`);
    lines.push(`FIT: ${levelName(result.level)}`);
    lines.push(`WHY: ${explainFit(result, nameOf)}`);
    lines.push("");

    lines.push(`MUST-HAVES: ${result.counts.mustsMet} of ${result.counts.mustsTotal} met`);
    lines.push(...requirementLines(result.musts, profile, nameOf));
    lines.push("");

    if (result.conflicts.length === 0) {
      lines.push("CONFLICTS: none");
    } else {
      lines.push(`CONFLICTS: ${result.conflicts.length}`);
      for (const c of result.conflicts) lines.push(`  - ${conflictLine(c)}`);
      if (result.conflicts.some((c) => c.kind === "years")) lines.push(`  ${YEARS_NOTE}`);
    }
    lines.push("");

    if (result.notJudged.length === 0) {
      lines.push("NOT CHECKED (not stated): none");
    } else {
      lines.push("NOT CHECKED (not stated):");
      for (const n of result.notJudged) lines.push(`  - ${n.reason}`);
    }
    lines.push("");

    if (result.checkYourself.length === 0) {
      lines.push("CHECK THIS YOURSELF (never scored): none");
    } else {
      lines.push("CHECK THIS YOURSELF (never scored):");
      for (const quote of result.checkYourself) lines.push(`  - "${quote}"`);
    }
    lines.push("");

    if (result.counts.nicesTotal === 0) {
      lines.push("NICE-TO-HAVES: none");
    } else {
      lines.push(`NICE-TO-HAVES: ${result.counts.nicesMet} of ${result.counts.nicesTotal} met`);
      lines.push(...requirementLines(result.nices, profile, nameOf));
    }
    lines.push("");
  }

  // The roadmap, across all saved jobs.
  const groups = classifyJobs(profile, jobs);
  const ranking = rankMissingSkills(profile, jobs);
  const timeline = unlockTimeline(profile, jobs);

  lines.push(
    jobs.length >= ROADMAP_FROM_JOBS
      ? `=== ROADMAP for ${profile.name} ===`
      : `=== ROADMAP for ${profile.name} (test view: ${jobs.length} saved ${plural(jobs.length, "job", "jobs")}; the app shows this from ${ROADMAP_FROM_JOBS}) ===`,
  );

  const strong = groups.alreadyStrong;
  lines.push(
    strong.length === 0
      ? "Already Strong: none"
      : `Already Strong: ${strong.length} ${plural(strong.length, "job", "jobs")} (${strong.map(labelOf).join("; ")})`,
  );
  lines.push("");

  if (ranking.length === 0) {
    lines.push(
      `Skills to build, in order: none. No ${strong.length > 0 ? "other " : ""}saved job can become a Strong match by skills alone.`,
    );
  } else {
    lines.push("Skills to build, in order:");
    ranking.forEach((entry, i) => {
      const closer =
        entry.newlyUnlocked.length === 0
          ? jobsBroughtCloser(profile, jobs, ranking.slice(0, i).map((r) => r.skillId), entry.skillId)
          : [];
      lines.push(`  ${i + 1}. ${explainRankedSkill(entry, closer, nameOf, labelOf)}`);
    });
  }
  lines.push("");

  if (groups.blocked.length === 0) {
    lines.push("Blocked jobs: none");
  } else {
    lines.push(`Blocked jobs (skills alone can't make these Strong): ${groups.blocked.length}`);
    for (const b of groups.blocked) {
      lines.push(`  - ${labelOf(b.jobId)}: ${blockedHeader(b)}`);
      for (const c of b.conflicts) lines.push(`      ${conflictLine(c)}`);
      if (b.conflicts.some((c) => c.kind === "years")) lines.push(`      ${YEARS_NOTE}`);
    }
  }
  lines.push("");

  if (timeline.length === 0) {
    lines.push("Timeline from skills in progress: none.");
  } else {
    lines.push("Timeline from skills in progress:");
    for (const entry of timeline) {
      lines.push(`  ${explainTimelineEntry(entry, nameOf, labelOf)}`);
    }
  }

  return lines.join("\n") + "\n";
}

// Rows that share the ad's quote are shown under it once.
function requirementLines(
  results: RequirementResult[],
  profile: Profile,
  nameOf: (id: string) => string,
): string[] {
  const byQuote = new Map<string, RequirementResult[]>();
  for (const r of results) {
    const group = byQuote.get(r.requirement.quote) ?? [];
    group.push(r);
    byQuote.set(r.requirement.quote, group);
  }
  const out: string[] = [];
  for (const [quote, group] of byQuote) {
    out.push(`  "${quote}"`);
    for (const r of group) {
      const { status, text } = describeRequirement(r, profile, nameOf);
      out.push(`    ${status.padEnd(9)}${text}`);
    }
  }
  return out;
}
