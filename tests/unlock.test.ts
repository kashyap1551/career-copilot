import { describe, expect, it } from "vitest";
import { jobs as fixtureJobs } from "@/fixtures/jobs";
import { profiles } from "@/fixtures/profiles";
import {
  classifyJobs,
  rankMissingSkills,
  rolesUnlockedBy,
  unlockTimeline,
} from "@/lib/engine/unlock";
import type { Job, JobConstraints, Profile, ProfileSkill } from "@/lib/engine/types";

// Every expected value in this file comes from the hand-worked tables agreed
// before the code was written (step 2.3 plan). None comes from running the
// code. The test jobs are built here, not in fixtures/.

// ---- Small made-up jobs and people -----------------------------------------

const BASE: JobConstraints = {
  languages: [],
  location: "Berlin",
  remote: "hybrid",
  minYears: null,
  startDate: null,
  otherConditions: [],
};

// musts: one list per must-have; a list with two skills means "either one".
function mk(
  id: string,
  musts: string[][],
  opts: { nices?: string[][]; constraints?: Partial<JobConstraints> } = {},
): Job {
  return {
    id,
    title: id,
    company: null,
    source: null,
    constraints: { ...BASE, ...opts.constraints },
    requirements: [
      ...musts.map((skillIds) => ({ skillIds, importance: "must" as const, quote: `needs ${skillIds.join(" or ")}` })),
      ...(opts.nices ?? []).map((skillIds) => ({ skillIds, importance: "nice" as const, quote: `nice: ${skillIds.join(" or ")}` })),
    ],
  };
}

function person(id: string, skills: ProfileSkill[], cvLines: string[] = []): Profile {
  return {
    id,
    name: id,
    cvLines,
    skills,
    constraints: {
      languages: [{ code: "en", level: "C1" }],
      locations: ["Berlin"],
      workModes: ["hybrid"],
      years: 5,
      availableFrom: "2026-12-01",
    },
  };
}

const learning = (skillId: string, expectedDate: string): ProfileSkill => ({
  kind: "inProgress",
  skillId,
  expectedDate,
});

// ---- Set 1: Tess ------------------------------------------------------------

const tess = person(
  "tess",
  [
    { kind: "have", skillId: "excel", evidence: { line: 2, text: "Built weekly Excel reports" } },
    learning("sql", "2026-12-20"),
    learning("tableau", "2026-12-20"),
    learning("python", "2027-02-01"),
  ],
  ["Tess Test, analyst, Berlin", "Built weekly Excel reports"],
);

const set1: Job[] = [
  mk("A", [["excel"]], { nices: [["docker"]] }), // already Strong
  mk("B", [["excel"], ["sql"]]),
  mk("C", [["sql"]]),
  mk("D", [["excel"], ["power-bi", "tableau"]]), // "or"
  mk("E", [["sql"], ["python"]]), // needs two
  mk("F", [["python"]]),
  mk("G", [["docker"]]),
  mk("H", [["sql"]], { constraints: { minYears: 6 } }), // Tess has 5: closable conflict
  mk("I", [["excel"]], { constraints: { location: "Munich" } }), // can't be closed
  mk("K", [["sql"]], { nices: [["kubernetes"]] }),
];

describe("Set 1: classifyJobs", () => {
  const groups = classifyJobs(tess, set1);

  it("A is already Strong", () => {
    expect(groups.alreadyStrong).toEqual(["A"]);
  });

  it("H and I are blocked, with the reason", () => {
    expect(groups.blocked.map((b) => ({ id: b.jobId, by: b.by, onlyClosable: b.onlyClosable }))).toEqual([
      { id: "H", by: ["years"], onlyClosable: true },
      { id: "I", by: ["city"], onlyClosable: false },
    ]);
    expect(groups.blocked[0].conflicts[0].message).toContain("1 year short");
  });

  it("B, C, D, E, F, G and K are reachable", () => {
    expect(groups.reachable.map((r) => r.job.id)).toEqual(["B", "C", "D", "E", "F", "G", "K"]);
  });
});

describe("Set 1: rolesUnlockedBy", () => {
  const cases: [string, string[], string[]][] = [
    ["nothing", [], []],
    ["Excel (already held; A was already Strong)", ["excel"], []],
    ["SQL (E also needs Python; H and I stay blocked)", ["sql"], ["B", "C", "K"]],
    ["Python", ["python"], ["F"]],
    ["SQL + Python", ["sql", "python"], ["B", "C", "E", "F", "K"]],
    ["Power BI (the 'or')", ["power-bi"], ["D"]],
    ["Tableau (the 'or')", ["tableau"], ["D"]],
    ["Power BI + Tableau (D counted once)", ["power-bi", "tableau"], ["D"]],
    ["Docker", ["docker"], ["G"]],
    ["Kubernetes (a nice-to-have only)", ["kubernetes"], []],
    ["SQL + Python + Tableau + Docker", ["sql", "python", "tableau", "docker"], ["B", "C", "D", "E", "F", "G", "K"]],
  ];
  it.each(cases)("%s", (_name, gained, expected) => {
    expect(rolesUnlockedBy(tess, set1, gained)).toEqual(expected);
  });
});

describe("Set 1: ranking and timeline", () => {
  it("ranks SQL, Python, Tableau, Docker, with Power BI dropped", () => {
    expect(rankMissingSkills(tess, set1)).toEqual([
      { skillId: "sql", newlyUnlocked: ["B", "C", "K"], totalUnlocked: 3, closer: 1, inProgress: "2026-12-20" },
      { skillId: "python", newlyUnlocked: ["E", "F"], totalUnlocked: 5, closer: 0, inProgress: "2027-02-01" },
      { skillId: "tableau", newlyUnlocked: ["D"], totalUnlocked: 6, closer: 0, inProgress: "2026-12-20" },
      { skillId: "docker", newlyUnlocked: ["G"], totalUnlocked: 7, closer: 0, inProgress: null },
    ]);
  });

  it("the timeline is cumulative by date", () => {
    expect(unlockTimeline(tess, set1)).toEqual([
      { date: "2026-12-20", skills: ["sql", "tableau"], moreStrong: 4, newlyUnlocked: ["B", "C", "D", "K"], jobs: ["B", "C", "D", "K"] },
      { date: "2027-02-01", skills: ["python"], moreStrong: 6, newlyUnlocked: ["E", "F"], jobs: ["B", "C", "D", "E", "F", "K"] },
    ]);
  });
});

// ---- Set 2: one step closer beats the id ------------------------------------

describe("Set 2: 'one step closer' decides before the skill id does", () => {
  const nobody = person("nobody", []);
  const set2 = [mk("X", [["alpha"], ["zulu"]]), mk("Y", [["zulu"], ["beta"]])];

  it("ranks zulu first (closer 2), then alpha, then beta", () => {
    expect(rankMissingSkills(nobody, set2)).toEqual([
      { skillId: "zulu", newlyUnlocked: [], totalUnlocked: 0, closer: 2, inProgress: null },
      { skillId: "alpha", newlyUnlocked: ["X"], totalUnlocked: 1, closer: 0, inProgress: null },
      { skillId: "beta", newlyUnlocked: ["Y"], totalUnlocked: 2, closer: 0, inProgress: null },
    ]);
  });

  it("a job needing two skills is never unlocked by one", () => {
    expect(rolesUnlockedBy(nobody, set2, ["zulu"])).toEqual([]);
    expect(rolesUnlockedBy(nobody, set2, ["alpha"])).toEqual([]);
    expect(rolesUnlockedBy(nobody, set2, ["alpha", "zulu"])).toEqual(["X"]);
    expect(rolesUnlockedBy(nobody, set2, ["alpha", "beta", "zulu"])).toEqual(["X", "Y"]);
  });
});

// ---- Set 3: dates ------------------------------------------------------------

describe("Set 3: skills on different dates and on the same date", () => {
  const W = mk("W", [["sql"], ["python"]]);

  const differentDates = person("q1", [learning("sql", "2026-12-20"), learning("python", "2027-02-01")]);
  const sameDate = person("q2", [learning("sql", "2026-12-20"), learning("python", "2026-12-20")]);

  it("different dates: W appears only at the later date", () => {
    expect(unlockTimeline(differentDates, [W])).toEqual([
      { date: "2026-12-20", skills: ["sql"], moreStrong: 0, newlyUnlocked: [], jobs: [] },
      { date: "2027-02-01", skills: ["python"], moreStrong: 1, newlyUnlocked: ["W"], jobs: ["W"] },
    ]);
  });

  it("the same date: one entry, both skills together, W counted once", () => {
    expect(unlockTimeline(sameDate, [W])).toEqual([
      { date: "2026-12-20", skills: ["python", "sql"], moreStrong: 1, newlyUnlocked: ["W"], jobs: ["W"] },
    ]);
  });

  it("different dates: the earlier date is ranked first", () => {
    expect(rankMissingSkills(differentDates, [W])).toEqual([
      { skillId: "sql", newlyUnlocked: [], totalUnlocked: 0, closer: 1, inProgress: "2026-12-20" },
      { skillId: "python", newlyUnlocked: ["W"], totalUnlocked: 1, closer: 0, inProgress: "2027-02-01" },
    ]);
  });

  it("the same date: the skill id breaks the tie", () => {
    expect(rankMissingSkills(sameDate, [W]).map((r) => r.skillId)).toEqual(["python", "sql"]);
  });

  it("no skills in progress: an empty timeline", () => {
    expect(unlockTimeline(person("none", []), [W])).toEqual([]);
  });
});

// ---- The real fixtures --------------------------------------------------------

const P = (id: string) => profiles.find((p) => p.id === id)!;
const N = "northwind-operations-analyst";
const B = "brightwater-financial-planning-analyst";
const F = "fjordlight-frontend-developer";

describe("real fixtures: how each job is sorted", () => {
  type Row = {
    profile: string;
    strong: string[];
    blocked: { id: string; by: string[] }[];
    reachable: string[];
  };
  const rows: Row[] = [
    { profile: "sam", strong: [N], blocked: [{ id: F, by: ["workMode"] }], reachable: [B] },
    { profile: "ravi", strong: [], blocked: [{ id: N, by: ["language", "city"] }, { id: F, by: ["language", "years", "workMode"] }], reachable: [B] },
    { profile: "lena", strong: [F], blocked: [{ id: N, by: ["city", "workMode"] }, { id: B, by: ["city", "workMode"] }], reachable: [] },
    { profile: "maya", strong: [], blocked: [{ id: N, by: ["city"] }, { id: B, by: ["city"] }, { id: F, by: ["workMode"] }], reachable: [] },
    { profile: "jonas", strong: [], blocked: [{ id: N, by: ["language", "years", "city"] }, { id: B, by: ["years", "city"] }, { id: F, by: ["language", "years"] }], reachable: [] },
    { profile: "ana", strong: [], blocked: [{ id: N, by: ["years", "city"] }, { id: B, by: ["years", "city", "workMode"] }, { id: F, by: ["years"] }], reachable: [] },
  ];

  it.each(rows)("$profile", ({ profile, strong, blocked, reachable }) => {
    const g = classifyJobs(P(profile), fixtureJobs);
    expect(g.alreadyStrong).toEqual(strong);
    expect(g.blocked.map((b) => ({ id: b.jobId, by: b.by }))).toEqual(blocked);
    expect(g.reachable.map((r) => r.job.id)).toEqual(reachable);
    // Every one of these people has an unclosable conflict on each blocked job.
    expect(g.blocked.every((b) => !b.onlyClosable)).toBe(true);
  });
});

describe("real fixtures: ranking, unlocks and timeline", () => {
  it("Sam: financial modelling and planning together unlock Brightwater, neither alone", () => {
    expect(rolesUnlockedBy(P("sam"), fixtureJobs, ["financial-planning"])).toEqual([]);
    expect(rolesUnlockedBy(P("sam"), fixtureJobs, ["financial-modelling"])).toEqual([]);
    expect(rolesUnlockedBy(P("sam"), fixtureJobs, ["financial-planning", "financial-modelling"])).toEqual([B]);
    expect(rankMissingSkills(P("sam"), fixtureJobs)).toEqual([
      { skillId: "financial-modelling", newlyUnlocked: [], totalUnlocked: 0, closer: 1, inProgress: null },
      { skillId: "financial-planning", newlyUnlocked: [B], totalUnlocked: 1, closer: 0, inProgress: null },
    ]);
  });

  it("Ravi: Power BI unlocks Brightwater", () => {
    expect(rolesUnlockedBy(P("ravi"), fixtureJobs, ["power-bi"])).toEqual([B]);
    expect(rankMissingSkills(P("ravi"), fixtureJobs)).toEqual([
      { skillId: "power-bi", newlyUnlocked: [B], totalUnlocked: 1, closer: 0, inProgress: null },
    ]);
  });

  it("a blocked job is never unlocked, however many skills are gained", () => {
    // Fjordlight is blocked for Maya by work mode, not by skills.
    expect(rolesUnlockedBy(P("maya"), fixtureJobs, ["typescript", "react", "git"])).toEqual([]);
  });

  it("people with nothing reachable have an empty ranking", () => {
    for (const id of ["lena", "maya", "jonas", "ana"]) {
      expect(rankMissingSkills(P(id), fixtureJobs)).toEqual([]);
    }
  });

  it("Maya's Python and Ana's SQL unlock nothing yet, and the timeline says so with its date", () => {
    expect(unlockTimeline(P("maya"), fixtureJobs)).toEqual([
      { date: "2026-12-20", skills: ["python"], moreStrong: 0, newlyUnlocked: [], jobs: [] },
    ]);
    expect(unlockTimeline(P("ana"), fixtureJobs)).toEqual([
      { date: "2027-01-31", skills: ["sql"], moreStrong: 0, newlyUnlocked: [], jobs: [] },
    ]);
  });

  it("people with nothing in progress have an empty timeline", () => {
    for (const id of ["sam", "ravi", "lena", "jonas"]) {
      expect(unlockTimeline(P(id), fixtureJobs)).toEqual([]);
    }
  });
});
