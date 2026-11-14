import { jobs } from "@/fixtures/jobs";
import { profiles } from "@/fixtures/profiles";
import { skills } from "@/fixtures/skills";
import type {
  Job,
  JobConstraints,
  Profile,
  ProfileSkill,
} from "@/lib/engine/types";

// Shared by the explain, report and unlock tests. Not a test file.

export const P = (id: string): Profile => {
  const p = profiles.find((x) => x.id === id);
  if (!p) throw new Error(`no profile ${id}`);
  return p;
};

export const J = (id: string): Job => {
  const j = jobs.find((x) => x.id === id);
  if (!j) throw new Error(`no job ${id}`);
  return j;
};

export const NORTHWIND = "northwind-operations-analyst";
export const BRIGHTWATER = "brightwater-financial-planning-analyst";
export const FJORDLIGHT = "fjordlight-frontend-developer";

export const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;

export const withConstraints = (job: Job, patch: Partial<JobConstraints>): Job => ({
  ...job,
  constraints: { ...job.constraints, ...patch },
});

export const withSkills = (
  p: Profile,
  more: ProfileSkill[],
  cvLines: string[] = [],
): Profile => ({
  ...p,
  cvLines: [...p.cvLines, ...cvLines],
  skills: [...p.skills, ...more],
});

export const learning = (skillId: string, expectedDate: string): ProfileSkill => ({
  kind: "inProgress",
  skillId,
  expectedDate,
});

// Northwind moved to Berlin, so Maya's city is no longer a conflict.
export const berlinJob = (): Job =>
  withConstraints(J(NORTHWIND), { location: "Berlin" });

// Maya's CV has 7 lines, so a line added here is line 8.
export const COMM_LINE = "Presented findings to non-technical managers at each depot review";
export const mayaWithComm = (): Profile =>
  withSkills(
    P("maya"),
    [{ kind: "have", skillId: "communication", evidence: { line: 8, text: COMM_LINE } }],
    [COMM_LINE],
  );

// A job whose must-haves are given as lists of acceptable skills.
export function jobWithMusts(base: Job, musts: string[][]): Job {
  return {
    ...base,
    requirements: musts.map((skillIds) => ({
      skillIds,
      importance: "must" as const,
      quote: `needs ${skillIds.join(" or ")}`,
    })),
  };
}
