import { describe, expect, it } from "vitest";
import { jobs } from "@/fixtures/jobs";
import { profiles } from "@/fixtures/profiles";
import { skills } from "@/fixtures/skills";
import { LANGUAGE_LEVELS } from "@/lib/engine/types";

// Step 2.1 check: the fixtures load and hold together.

const skillIds = new Set(skills.map((s) => s.id));
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

describe("skills", () => {
  it("have unique ids", () => {
    expect(skillIds.size).toBe(skills.length);
  });
});

describe("profiles", () => {
  it("there are 3 with different ids", () => {
    expect(profiles).toHaveLength(3);
    expect(new Set(profiles.map((p) => p.id)).size).toBe(3);
  });

  it.each(profiles.map((p) => [p.id, p] as const))(
    "%s only uses known skills, once each",
    (_id, profile) => {
      const ids = profile.skills.map((s) => s.skillId);
      for (const id of ids) expect(skillIds.has(id)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    },
  );

  it.each(profiles.map((p) => [p.id, p] as const))(
    "%s cites CV lines word for word",
    (_id, profile) => {
      for (const skill of profile.skills) {
        if (skill.kind === "have" && skill.evidence) {
          expect(profile.cvLines[skill.evidence.line - 1]).toBe(
            skill.evidence.text,
          );
        }
      }
    },
  );

  it.each(profiles.map((p) => [p.id, p] as const))(
    "%s uses valid dates and language levels",
    (_id, profile) => {
      const { availableFrom, languages } = profile.constraints;
      if (availableFrom !== null) expect(availableFrom).toMatch(isoDate);
      for (const l of languages) expect(LANGUAGE_LEVELS).toContain(l.level);
      for (const s of profile.skills) {
        if (s.kind === "inProgress") expect(s.expectedDate).toMatch(isoDate);
      }
    },
  );

  it("the fixtures include a skill with no CV line", () => {
    const unproven = profiles.flatMap((p) => p.skills).filter(
      (s) => s.kind === "have" && s.evidence === null,
    );
    expect(unproven.length).toBeGreaterThan(0);
  });
});

describe("jobs", () => {
  it("only use known skills, valid levels and valid dates", () => {
    expect(new Set(jobs.map((j) => j.id)).size).toBe(jobs.length);
    for (const job of jobs) {
      for (const r of job.requirements) {
        expect(r.skillIds.length).toBeGreaterThan(0);
        expect(new Set(r.skillIds).size).toBe(r.skillIds.length);
        for (const id of r.skillIds) expect(skillIds.has(id)).toBe(true);
        expect(r.quote.trim()).not.toBe("");
      }
      for (const l of job.constraints.languages) {
        if (l.level !== null) expect(LANGUAGE_LEVELS).toContain(l.level);
      }
      if (job.constraints.startDate !== null) {
        expect(job.constraints.startDate).toMatch(isoDate);
      }
    }
  });
});
