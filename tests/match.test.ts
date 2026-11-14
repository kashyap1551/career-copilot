import { describe, expect, it } from "vitest";
import { jobs } from "@/fixtures/jobs";
import { profiles } from "@/fixtures/profiles";
import { match } from "@/lib/engine/match";
import type {
  DecidedBy,
  FitLevel,
  Job,
  JobConstraints,
  Profile,
  ProfileSkill,
} from "@/lib/engine/types";

// Every expected value in this file was worked out by hand from the rules in
// docs/SPRINT.md and docs/DECISIONS.md (the hand-worked table agreed before
// the code was written). None of them comes from running the code.

const P = (id: string): Profile => {
  const p = profiles.find((x) => x.id === id);
  if (!p) throw new Error(`no profile ${id}`);
  return p;
};
const J = (id: string): Job => {
  const j = jobs.find((x) => x.id === id);
  if (!j) throw new Error(`no job ${id}`);
  return j;
};

const northwind = J("northwind-operations-analyst");
const brightwater = J("brightwater-financial-planning-analyst");
const fjordlight = J("fjordlight-frontend-developer");
const JOBS = { northwind, brightwater, fjordlight };

// "kind:c" = a conflict that can be closed, "kind:X" = one that can't be.
const conflictsOf = (r: ReturnType<typeof match>) =>
  r.conflicts.map((c) => `${c.kind}:${c.closable ? "c" : "X"}`);

// ---- The 18 real pairings --------------------------------------------------

type Pairing = {
  profile: string;
  job: keyof typeof JOBS;
  level: FitLevel;
  decidedBy: DecidedBy;
  missing: number; // missing must-haves (each job has 3)
  conflicts: string[];
};

const pairings: Pairing[] = [
  { profile: "maya", job: "northwind", level: "longShot", decidedBy: "unclosable-conflict:city", missing: 1, conflicts: ["city:X"] },
  { profile: "maya", job: "brightwater", level: "longShot", decidedBy: "unclosable-conflict:city", missing: 3, conflicts: ["city:X"] },
  { profile: "maya", job: "fjordlight", level: "longShot", decidedBy: "unclosable-conflict:workMode", missing: 3, conflicts: ["workMode:X"] },
  { profile: "jonas", job: "northwind", level: "longShot", decidedBy: "unclosable-conflict:years", missing: 2, conflicts: ["language:c", "years:X", "city:X"] },
  { profile: "jonas", job: "brightwater", level: "longShot", decidedBy: "unclosable-conflict:city", missing: 3, conflicts: ["years:c", "city:X"] },
  { profile: "jonas", job: "fjordlight", level: "longShot", decidedBy: "unclosable-conflict:years", missing: 3, conflicts: ["language:c", "years:X"] },
  { profile: "ana", job: "northwind", level: "longShot", decidedBy: "unclosable-conflict:years", missing: 3, conflicts: ["years:X", "city:X"] },
  { profile: "ana", job: "brightwater", level: "longShot", decidedBy: "unclosable-conflict:city", missing: 3, conflicts: ["years:c", "city:X", "workMode:X"] },
  { profile: "ana", job: "fjordlight", level: "longShot", decidedBy: "unclosable-conflict:years", missing: 0, conflicts: ["years:X"] },
  { profile: "sam", job: "northwind", level: "strong", decidedBy: "all-musts-met", missing: 0, conflicts: [] },
  { profile: "sam", job: "brightwater", level: "stretch", decidedBy: "two-gaps", missing: 2, conflicts: [] },
  { profile: "sam", job: "fjordlight", level: "longShot", decidedBy: "unclosable-conflict:workMode", missing: 3, conflicts: ["workMode:X"] },
  { profile: "ravi", job: "northwind", level: "longShot", decidedBy: "unclosable-conflict:city", missing: 2, conflicts: ["language:c", "city:X"] },
  { profile: "ravi", job: "brightwater", level: "good", decidedBy: "one-must-missing", missing: 1, conflicts: [] },
  { profile: "ravi", job: "fjordlight", level: "longShot", decidedBy: "unclosable-conflict:workMode", missing: 3, conflicts: ["language:c", "years:c", "workMode:X"] },
  { profile: "lena", job: "northwind", level: "longShot", decidedBy: "unclosable-conflict:city", missing: 3, conflicts: ["city:X", "workMode:X"] },
  { profile: "lena", job: "brightwater", level: "longShot", decidedBy: "unclosable-conflict:city", missing: 3, conflicts: ["city:X", "workMode:X"] },
  { profile: "lena", job: "fjordlight", level: "strong", decidedBy: "all-musts-met", missing: 0, conflicts: [] },
];

describe("the 18 pairings", () => {
  it.each(pairings)(
    "$profile x $job is $level ($decidedBy)",
    ({ profile, job, level, decidedBy, missing, conflicts }) => {
      const r = match(P(profile), JOBS[job]);
      expect(r.level).toBe(level);
      expect(r.decidedBy).toBe(decidedBy);
      expect(r.counts.mustsTotal).toBe(3);
      expect(r.counts.mustsMet).toBe(3 - missing);
      expect(conflictsOf(r)).toEqual(conflicts);
    },
  );

  it.each(pairings)(
    "$profile x $job lists the ad's otherConditions and only the start date as not judged",
    ({ profile, job }) => {
      const r = match(P(profile), JOBS[job]);
      expect(r.checkYourself).toEqual(
        JOBS[job].constraints.otherConditions.map((c) => c.quote),
      );
      // No ad gives a start date, and no other fact is missing. A remote job
      // needs no city, so Fjordlight's missing city is not "not judged".
      expect(r.notJudged.map((n) => n.kind)).toEqual(["startDate"]);
    },
  );

  it("tally: 2 strong, 1 good, 1 stretch, 14 long shot", () => {
    const tally = (l: FitLevel) =>
      profiles.flatMap((p) => jobs.map((j) => match(p, j))).filter((r) => r.level === l).length;
    expect(tally("strong")).toBe(2);
    expect(tally("good")).toBe(1);
    expect(tally("stretch")).toBe(1);
    expect(tally("longShot")).toBe(14);
  });
});

// ---- The three that must say what decided them ------------------------------

describe("decidedBy", () => {
  it("Ana x Fjordlight: all must-haves met, decided by the years conflict, not by skills", () => {
    const r = match(P("ana"), fjordlight);
    expect(r.counts.mustsMet).toBe(3);
    expect(r.level).toBe("longShot");
    expect(r.decidedBy).toBe("unclosable-conflict:years");
  });

  it("Ravi x Brightwater: one must-have missing", () => {
    const r = match(P("ravi"), brightwater);
    expect(r.level).toBe("good");
    expect(r.decidedBy).toBe("one-must-missing");
  });

  it("Sam x Brightwater: two gaps", () => {
    const r = match(P("sam"), brightwater);
    expect(r.level).toBe("stretch");
    expect(r.decidedBy).toBe("two-gaps");
  });
});

// ---- Requirement details on the real pairings -------------------------------

describe("requirement results", () => {
  it("Maya x Northwind: SQL and Excel cite their CV lines, communication is not on the profile", () => {
    const r = match(P("maya"), northwind);
    const [sql, excel, communication] = r.musts;
    expect(sql.metBy).toEqual({
      skillId: "sql",
      evidence: { line: 4, text: "Wrote SQL queries to pull order data for the finance team" },
    });
    expect(excel.metBy?.evidence.line).toBe(3);
    expect(communication.met).toBe(false);
    expect(communication.reason).toBe("not-on-profile");
  });

  it("Ana x Northwind: SQL is in progress with its date, Excel is not on the profile", () => {
    const r = match(P("ana"), northwind);
    expect(r.musts[0].met).toBe(false);
    expect(r.musts[0].reason).toBe("in-progress");
    expect(r.musts[0].expectedDate).toBe("2027-01-31");
    expect(r.musts[1].reason).toBe("not-on-profile");
  });

  it("Ana x Brightwater: the nice-to-have SQL is in progress", () => {
    const r = match(P("ana"), brightwater);
    expect(r.nices).toHaveLength(1);
    expect(r.nices[0].reason).toBe("in-progress");
    expect(r.nices[0].expectedDate).toBe("2027-01-31");
  });

  it("Sam x Northwind: 'Power BI or Tableau' is met by Power BI on line 5, Python is not met", () => {
    const r = match(P("sam"), northwind);
    expect(r.counts).toEqual({ mustsMet: 3, mustsTotal: 3, nicesMet: 1, nicesTotal: 2 });
    expect(r.nices[0].metBy?.skillId).toBe("power-bi");
    expect(r.nices[0].metBy?.evidence.line).toBe(5);
    expect(r.nices[1].met).toBe(false);
    expect(r.nices[1].reason).toBe("not-on-profile");
  });

  it("Ravi x Brightwater: SQL (nice) is missing; Hindi or Kannada is listed, never scored", () => {
    const r = match(P("ravi"), brightwater);
    expect(r.nices[0].met).toBe(false);
    expect(r.checkYourself).toEqual([
      "Bachelor's degree in finance, commerce or a related field.",
      "Knowledge of Hindi or Kannada.",
      "Immediate joiners are preferred.",
    ]);
  });

  it("Lena x Fjordlight: 'Vitest or Jest' is met by Vitest on line 5, accessibility is not", () => {
    const r = match(P("lena"), fjordlight);
    expect(r.nices[0].metBy?.skillId).toBe("vitest");
    expect(r.nices[0].metBy?.evidence.line).toBe(5);
    expect(r.nices[1].met).toBe(false);
    expect(r.level).toBe("strong");
  });
});

describe("conflict sentences", () => {
  it("Jonas x Fjordlight: English one level short", () => {
    const r = match(P("jonas"), fjordlight);
    expect(r.conflicts[0]).toMatchObject({
      kind: "language",
      closable: true,
      code: "en",
      required: "C1",
      has: "B2",
      levelsShort: 1,
    });
    expect(r.conflicts[0].message).toBe(
      "The ad asks for English at C1; your profile has B2 (one level short).",
    );
  });

  it("Jonas x Northwind: years short by two", () => {
    // The "compared with total years" note is no longer part of the sentence;
    // the report prints it once per job (see tests/report.test.ts).
    const r = match(P("jonas"), northwind);
    expect(r.conflicts[1]).toMatchObject({ kind: "years", closable: false, required: 3, has: 1, yearsShort: 2 });
    expect(r.conflicts[1].message).toBe(
      "The ad asks for 3 years of experience; your profile has 1 (2 years short).",
    );
  });
});

// ---- Variants: one fact changed at a time -----------------------------------
// Northwind moved to Berlin, so Maya's city is no longer a conflict.

const withConstraints = (job: Job, patch: Partial<JobConstraints>): Job => ({
  ...job,
  constraints: { ...job.constraints, ...patch },
});
const withSkills = (p: Profile, skills: ProfileSkill[], cvLines: string[] = []): Profile => ({
  ...p,
  cvLines: [...p.cvLines, ...cvLines],
  skills: [...p.skills, ...skills],
});

const maya = P("maya");
const berlinJob = withConstraints(northwind, { location: "Berlin" });
// Maya's CV has 7 lines, so a line added here is line 8.
const COMM_LINE = "Presented findings to non-technical managers at each depot review";
const mayaWithComm = withSkills(
  maya,
  [{ kind: "have", skillId: "communication", evidence: { line: 8, text: COMM_LINE } }],
  [COMM_LINE],
);

describe("variants (Maya x Northwind in Berlin)", () => {
  it("1. one must-have missing and nothing else: Good", () => {
    const r = match(maya, berlinJob);
    expect(r.level).toBe("good");
    expect(r.decidedBy).toBe("one-must-missing");
    expect(r.conflicts).toEqual([]);
    expect(r.musts[2].reason).toBe("not-on-profile");
  });

  it("2. communication with a CV line added: Strong", () => {
    const r = match(mayaWithComm, berlinJob);
    expect(r.level).toBe("strong");
    expect(r.decidedBy).toBe("all-musts-met");
    expect(r.musts[2].metBy?.evidence.line).toBe(8);
  });

  it("3. no evidence, never met: communication added by hand with no CV line is still Good", () => {
    const p = withSkills(maya, [{ kind: "have", skillId: "communication", evidence: null }]);
    const r = match(p, berlinJob);
    expect(r.musts[2].met).toBe(false);
    expect(r.musts[2].reason).toBe("no-cv-line");
    expect(r.level).toBe("good");
  });

  it("4. a citation that doesn't match its CV line word for word is not met", () => {
    const p = withSkills(
      maya,
      [{ kind: "have", skillId: "communication", evidence: { line: 8, text: "Great communicator" } }],
      [COMM_LINE],
    );
    const r = match(p, berlinJob);
    expect(r.musts[2].met).toBe(false);
    expect(r.musts[2].reason).toBe("no-cv-line");
    expect(r.level).toBe("good");
  });

  it("5. one missing + English one level short (C2 asked, C1 held): Stretch, two gaps", () => {
    const r = match(maya, withConstraints(berlinJob, { languages: [{ code: "en", level: "C2" }] }));
    expect(conflictsOf(r)).toEqual(["language:c"]);
    expect(r.level).toBe("stretch");
    expect(r.decidedBy).toBe("two-gaps");
  });

  it("6. German C1 asked, B1 held (two levels short): Long shot", () => {
    const r = match(maya, withConstraints(berlinJob, { languages: [{ code: "de", level: "C1" }] }));
    expect(r.conflicts[0]).toMatchObject({ kind: "language", closable: false, levelsShort: 2 });
    expect(r.level).toBe("longShot");
    expect(r.decidedBy).toBe("unclosable-conflict:language");
  });

  it("7. everything met but 6 years asked, 5 held (one short): Stretch, one closable conflict", () => {
    const r = match(mayaWithComm, withConstraints(berlinJob, { minYears: 6 }));
    expect(r.conflicts[0]).toMatchObject({ kind: "years", closable: true, yearsShort: 1 });
    expect(r.level).toBe("stretch");
    expect(r.decidedBy).toBe("one-closable-conflict");
  });

  it("8. start date 61 days before she is available: Long shot", () => {
    // 2026-10-01 to 2026-12-01 is 31 + 30 = 61 days.
    const r = match(mayaWithComm, withConstraints(berlinJob, { startDate: "2026-10-01" }));
    expect(r.conflicts[0]).toMatchObject({ kind: "startDate", closable: false, daysLate: 61 });
    expect(r.level).toBe("longShot");
    expect(r.decidedBy).toBe("unclosable-conflict:startDate");
  });

  it("8b. start date 16 days before she is available (within 30): Stretch", () => {
    // 2026-11-15 to 2026-12-01 is 15 + 1 = 16 days.
    const r = match(mayaWithComm, withConstraints(berlinJob, { startDate: "2026-11-15" }));
    expect(r.conflicts[0]).toMatchObject({ kind: "startDate", closable: true, daysLate: 16 });
    expect(r.level).toBe("stretch");
    expect(r.decidedBy).toBe("one-closable-conflict");
  });

  it("9. Tableau alone meets 'Power BI or Tableau' and cites its CV line", () => {
    const line = "Built Tableau dashboards for the finance team";
    const p = withSkills(
      maya,
      [{ kind: "have", skillId: "tableau", evidence: { line: 8, text: line } }],
      [line],
    );
    const r = match(p, berlinJob);
    expect(r.nices[0].met).toBe(true);
    expect(r.nices[0].metBy?.skillId).toBe("tableau");
    expect(r.nices[0].metBy?.evidence.line).toBe(8);
  });

  it("10. otherConditions are listed and never change the level", () => {
    const withConditions = match(maya, berlinJob);
    const without = match(maya, withConstraints(berlinJob, { otherConditions: [] }));
    expect(withConditions.checkYourself).toHaveLength(2);
    expect(without.checkYourself).toEqual([]);
    expect(withConditions.level).toBe(without.level);
    expect(withConditions.decidedBy).toBe(without.decidedBy);
  });

  it("11. a language with no level and years not given are 'not judged', not conflicts", () => {
    const p: Profile = { ...maya, constraints: { ...maya.constraints, years: null } };
    const r = match(p, withConstraints(berlinJob, { languages: [{ code: "de", level: null }] }));
    expect(r.conflicts).toEqual([]);
    expect(r.notJudged.map((n) => n.kind).sort()).toEqual(["language", "startDate", "years"]);
    expect(r.level).toBe("good");
  });

  it("12. a language the person doesn't list at all can't be closed", () => {
    const r = match(maya, withConstraints(berlinJob, { languages: [{ code: "fr", level: "B1" }] }));
    expect(r.conflicts[0]).toMatchObject({ kind: "language", closable: false, has: null, levelsShort: null });
    expect(r.level).toBe("longShot");
    expect(r.decidedBy).toBe("unclosable-conflict:language");
  });

  it("13. city names match ignoring case and spaces", () => {
    const r = match(maya, withConstraints(northwind, { location: "  berlin " }));
    expect(r.conflicts).toEqual([]);
  });
});
