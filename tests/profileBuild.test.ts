import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";

// Hand-worked cases B1 to B17 (docs/PLAN-4.3.md). The lines are cv-4-skills-line
// after the removal of contact details (docs/PLAN-4.2-cvs.md). The expectations
// were written from the plan, not from the code.

const LINES = [
  "Taylor Placeholder, Software Developer, Sampleburg",
  "[email removed] | [phone removed]",
  "Skills: TypeScript, React, Git, Jest, accessibility",
  "2022-2025 Frontend Developer, Fictional Apps Ltd",
  "Built the checkout screens in React for a shop used by 10,000 customers",
  "Reviewed pull requests and wrote unit tests with Jest",
  "Languages: English (fluent), Irish (B2)",
];
const named = (name: string, skillId: string): CvSkill => ({ name, skillId, listed: true, line: 3, quote: name, label: "named" });
const PROPOSALS: CvSkill[] = [
  named("TypeScript", "typescript"),
  named("React", "react"),
  named("Git", "git"),
  named("Jest", "jest"),
  named("Accessibility", "accessibility"),
  { name: "Frontend development", skillId: "new:frontend-development", listed: false, line: 5, quote: "Built the checkout screens in React", label: "inferred" },
  { name: "Unit testing", skillId: "new:unit-testing", listed: false, line: 6, quote: "wrote unit tests", label: "inferred" },
];
const base = (): ConfirmState => initialConfirm(PROPOSALS);
const build = (over: Partial<ConfirmState> = {}) => buildProfile(LINES, PROPOSALS, { ...base(), ...over }, skills);

describe("initialConfirm", () => {
  it("B1: named skills are ticked, inferred ones are not; nothing else is set", () => {
    expect(base()).toEqual({
      keptIds: ["typescript", "react", "git", "jest", "accessibility"],
      added: [],
      inProgress: [],
      languages: [],
      cities: "",
      workModes: [],
      years: "",
      availableFrom: "",
    });
  });
});

describe("buildProfile: skills", () => {
  it("B2: the defaults give 5 skills, each citing line 3 with that line's exact text, and nothing set", () => {
    const b = build();
    expect(b.profile.skills).toEqual(
      ["typescript", "react", "git", "jest", "accessibility"].map((skillId) => ({
        kind: "have",
        skillId,
        evidence: { line: 3, text: LINES[2] },
      })),
    );
    expect(b.profile.cvLines).toEqual(LINES);
    expect(b.profile.constraints).toEqual({ languages: [], locations: [], workModes: [], years: null, availableFrom: null });
    expect(b.set).toEqual({ location: false, language: false, workMode: false, years: false, startDate: false });
    expect(b.problems).toEqual([]);
    expect(b.notes).toEqual([]);
    expect(b.handAdded).toEqual([]);
    expect(b.unmatchable).toEqual([]);
  });

  it("B3: ticking an unlisted inferred skill does not give it to the engine; it is reported", () => {
    const b = build({ keptIds: [...base().keptIds, "new:frontend-development"] });
    expect(b.profile.skills.length).toBe(5);
    expect(b.unmatchable).toEqual([{ name: "Frontend development", where: "cv" }]);
  });

  it("B4: unticking React leaves 4", () => {
    const b = build({ keptIds: base().keptIds.filter((id) => id !== "react") });
    expect(b.profile.skills.map((s) => s.skillId)).toEqual(["typescript", "git", "jest", "accessibility"]);
  });

  it("B5: a listed skill added by hand has no CV line; an unlisted one is left out and reported", () => {
    const b = build({ added: ["SQL", "Docker"] });
    expect(b.profile.skills).toContainEqual({ kind: "have", skillId: "sql", evidence: null });
    expect(b.profile.skills.some((s) => s.skillId === "new:docker")).toBe(false);
    expect(b.handAdded).toEqual([
      { name: "SQL", skillId: "sql", listed: true },
      { name: "Docker", skillId: "new:docker", listed: false },
    ]);
    expect(b.unmatchable).toEqual([{ name: "Docker", where: "hand" }]);
  });

  it("B6: adding by hand what the CV already gave is ignored, with a note", () => {
    const b = build({ added: ["typescript"] });
    expect(b.profile.skills.filter((s) => s.skillId === "typescript").length).toBe(1);
    expect(b.handAdded).toEqual([]);
    expect(b.notes).toEqual(["typescript is already on your profile from your CV, so adding it by hand is ignored."]);
  });

  it("B7: a name that cannot be made into a skill is a problem; blanks are skipped quietly", () => {
    const b = build({ added: ["???", "  "] });
    expect(b.problems).toEqual(['Could not use "???" as a skill name.']);
    expect(b.handAdded).toEqual([]);
  });

  it("B8: in progress with a valid date; an unlisted one is left out and reported", () => {
    const b = build({ inProgress: [{ name: "Python", date: "2026-12-20" }, { name: "Rust", date: "2027-01-31" }] });
    expect(b.profile.skills).toContainEqual({ kind: "inProgress", skillId: "python", expectedDate: "2026-12-20" });
    expect(b.profile.skills.some((s) => s.skillId === "new:rust")).toBe(false);
    expect(b.unmatchable).toEqual([{ name: "Rust", where: "progress" }]);
  });

  it("B9: in progress without a valid date is a problem and is left out", () => {
    for (const date of ["", "2026-13-45", "2027-02-30", "20.12.2026", "tomorrow"]) {
      const b = build({ inProgress: [{ name: "Python", date }] });
      expect(b.problems).toEqual(["Add a valid expected date for Python."]);
      expect(b.profile.skills.some((s) => s.kind === "inProgress")).toBe(false);
    }
  });

  it("B10: in progress for a skill the CV already gave is ignored, with a note", () => {
    const b = build({ inProgress: [{ name: "React", date: "2026-12-20" }] });
    expect(b.profile.skills.some((s) => s.kind === "inProgress")).toBe(false);
    expect(b.notes).toEqual(['React is already on your profile from your CV, so "in progress" is ignored.']);
  });
});

describe("buildProfile: constraints", () => {
  it("B11: cities are split on commas, trimmed, without empties or repeats ignoring case", () => {
    const b = build({ cities: " Berlin , munich,Berlin ,, BERLIN" });
    expect(b.profile.constraints.locations).toEqual(["Berlin", "munich"]);
    expect(b.set.location).toBe(true);
  });

  it("B12: years: a whole number 0 to 50 is set (0 too); empty is unset; anything else is a problem", () => {
    expect(build({ years: "3" }).profile.constraints.years).toBe(3);
    expect(build({ years: "0" }).profile.constraints.years).toBe(0);
    expect(build({ years: "0" }).set.years).toBe(true);
    expect(build({ years: "" }).set.years).toBe(false);
    expect(build({ years: " " }).problems).toEqual([]);
    for (const bad of ["3.5", "-1", "51", "abc", "1e1"]) {
      const b = build({ years: bad });
      expect(b.profile.constraints.years).toBeNull();
      expect(b.set.years).toBe(false);
      expect(b.problems).toEqual(["Years of experience must be a whole number from 0 to 50."]);
    }
  });

  it("B13: available from: a real date is set; empty is unset; anything else is a problem", () => {
    const ok = build({ availableFrom: "2027-03-01" });
    expect(ok.profile.constraints.availableFrom).toBe("2027-03-01");
    expect(ok.set.startDate).toBe(true);
    expect(build({ availableFrom: "" }).set.startDate).toBe(false);
    for (const bad of ["2027-02-30", "01.03.2027", "2027-13-01", "soon"]) {
      const b = build({ availableFrom: bad });
      expect(b.profile.constraints.availableFrom).toBeNull();
      expect(b.problems).toEqual(["Available from must be a date like 2027-03-01."]);
    }
  });

  it("B14: one entry per language, the first wins", () => {
    const b = build({ languages: [{ code: "de", level: "B2" }, { code: "de", level: "C1" }, { code: "en", level: "C1" }] });
    expect(b.profile.constraints.languages).toEqual([{ code: "de", level: "B2" }, { code: "en", level: "C1" }]);
    expect(b.set.language).toBe(true);
  });

  it("B15: work modes keep their order without repeats", () => {
    const b = build({ workModes: ["remote", "hybrid", "remote"] });
    expect(b.profile.constraints.workModes).toEqual(["remote", "hybrid"]);
    expect(b.set.workMode).toBe(true);
  });

  it("B16: each kind flips its own flag only", () => {
    expect(build({ cities: "Berlin" }).set).toEqual({ location: true, language: false, workMode: false, years: false, startDate: false });
    expect(build({ workModes: ["onsite"] }).set).toEqual({ location: false, language: false, workMode: true, years: false, startDate: false });
    expect(build({ languages: [{ code: "en", level: "B1" }] }).set).toEqual({ location: false, language: true, workMode: false, years: false, startDate: false });
  });

  it("B17: the profile is built from the lines it was given (no AI, no storage)", () => {
    const other = buildProfile(["a", "b"], [], initialConfirm([]), skills);
    expect(other.profile.cvLines).toEqual(["a", "b"]);
    expect(other.profile.skills).toEqual([]);
  });
});
