import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { jobs } from "@/fixtures/jobs";
import { engineView } from "@/lib/cv/engineView";
import { buildProfile, initialConfirm, type BuiltProfile, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import { splitJudgeable } from "@/lib/engine/judgeable";
import type { Job } from "@/lib/engine/types";

// Step 7.1a (docs/PLAN-7.1.md section 6, Question 7): `engineView` is the construction that profileReport used to do
// inline before it calls match(). The refactor must change no output, so this file keeps a COPY of the old
// construction (as it stood at 5a52739, app/fitReport.ts lines 94 to 114) and compares it with `engineView` over the
// same 2,048-input grid as R14 in tests/profileReport.test.ts (64 ads x 32 settings).

const northwind = jobs.find((j) => j.id === "northwind-operations-analyst") as Job;
const LINES = ["Alex Example", "Used SQL daily", "Excel pivot tables and lookups", "Explained findings to managers"];
const P: CvSkill[] = [
  { name: "SQL", skillId: "sql", listed: true, line: 2, quote: "Used SQL daily", label: "named" },
  { name: "Excel", skillId: "excel", listed: true, line: 3, quote: "Excel pivot tables", label: "named" },
  { name: "Communication", skillId: "communication", listed: true, line: 4, quote: "Explained findings to managers", label: "inferred" },
];
const confirm = (over: Partial<ConfirmState> = {}): ConfirmState => ({ ...initialConfirm(P), keptIds: ["sql", "excel"], ...over });
const built = (over: Partial<ConfirmState> = {}): BuiltProfile => buildProfile(LINES, P, confirm(over), skills);

// THE OLD CONSTRUCTION, copied (not imported): what profileReport did before engineView existed.
function oldConstruction(job: Job, b: BuiltProfile) {
  const { profile, set } = b;
  const { judged: judgedJob, couldNotJudge } = splitJudgeable(job);
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
    constraints: {
      ...profile.constraints,
      workModes: set.workMode ? profile.constraints.workModes : (["onsite", "hybrid", "remote"] as const).slice(),
    },
  };
  return { engineJob, engineProfile, couldNotJudge };
}

describe("E1: engineView equals the old construction over the whole R14 grid", () => {
  const modes = [null, "onsite", "hybrid", "remote"] as const;
  const cities = [null, "Manchester"] as const;
  const years = [null, 3] as const;
  const starts = [null, "2027-01-15"] as const;
  const langs = [[], [{ code: "en", level: "C1" as const }]] as const;
  const settings: Partial<ConfirmState>[] = Array.from({ length: 32 }, (_, bits) => ({
    ...(bits & 1 ? { cities: "Berlin" } : {}),
    ...(bits & 2 ? { languages: [{ code: "de", level: "B2" as const }] } : {}),
    ...(bits & 4 ? { workModes: ["onsite" as const] } : {}),
    ...(bits & 8 ? { years: "1" } : {}),
    ...(bits & 16 ? { availableFrom: "2027-06-01" } : {}),
  }));

  it("64 ads x 32 settings = 2,048 inputs: job, profile and could-not-judge list are deeply equal", () => {
    let checked = 0;
    for (const remote of modes)
      for (const location of cities)
        for (const minYears of years)
          for (const startDate of starts)
            for (const languages of langs) {
              const job: Job = {
                ...northwind,
                constraints: { ...northwind.constraints, remote, location, minYears, startDate, languages: languages.map((l) => ({ ...l })) },
              };
              for (const over of settings) {
                const b = built(over);
                expect(engineView(job, b)).toEqual(oldConstruction(job, b));
                checked++;
              }
            }
    expect(checked).toBe(2048);
  });
});

describe("E2: what the view does, worked by hand", () => {
  const withUnlisted: Job = {
    ...northwind,
    requirements: [
      ...northwind.requirements,
      // hand count: one extra must-have whose only skill id is not in our list
      { skillIds: ["new:kombucha-brewing"], importance: "must", quote: "Kombucha brewing" },
    ],
  };

  it("E2a: an unlisted requirement leaves the engine job and is returned as could-not-judge (hand count: 1)", () => {
    const v = engineView(withUnlisted, built());
    expect(v.couldNotJudge.map((r) => r.skillIds)).toEqual([["new:kombucha-brewing"]]);
    expect(v.engineJob.requirements.length).toBe(northwind.requirements.length);
  });

  it("E2b: nothing set: the languages and the city are blanked, the work modes are all three", () => {
    const v = engineView(northwind, built());
    expect(v.engineJob.constraints.languages).toEqual([]);
    expect(v.engineJob.constraints.location).toBeNull();
    expect([...v.engineProfile.constraints.workModes].sort()).toEqual(["hybrid", "onsite", "remote"]);
  });

  it("E2c: everything set: the ad's languages and city are kept, the person's work modes are kept", () => {
    const b = built({ cities: "Berlin", languages: [{ code: "de", level: "B2" }], workModes: ["onsite"] });
    const v = engineView(northwind, b);
    expect(v.engineJob.constraints.languages).toEqual(northwind.constraints.languages);
    expect(v.engineJob.constraints.location).toBe(northwind.constraints.location);
    expect(v.engineProfile.constraints.workModes).toEqual(["onsite"]);
  });

  it("E2d: the inputs are not changed", () => {
    const j = structuredClone(northwind);
    const b = built({ cities: "Berlin" });
    const bCopy = structuredClone(b);
    engineView(j, b);
    expect(j).toEqual(northwind);
    expect(b).toEqual(bCopy);
  });
});
