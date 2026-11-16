import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { checkYourselfRows, LEVELS_NOTE, notCountedSentence, reportNote } from "@/app/reportText";
import { buildJob } from "@/lib/engine/fromAd";
import { fromCv } from "@/lib/engine/fromCv";
import type { ExtractedAd } from "@/lib/schemas/job";

// Trait handling (docs/PLAN-5.1.md, Answers): a requirement whose every name is on the not-a-skill list is
// not counted; it stays visible, with its quote and importance. Expectations worked out by hand from the plan.

const empty: ExtractedAd = {
  title: null, company: null, location: null, workMode: null, minYears: null, startDate: null,
  languages: [], otherConditions: [], requirements: [],
};
const req = (quote: string, importance: "must" | "nice", ...names: string[]) => ({
  quote,
  importance,
  skills: names.map((name) => ({ name })),
});
const AD = [
  "You are a team player.",
  "SQL is required.",
  "Python or being a team player is a plus.",
  "Eigeninitiative und Zuverlässigkeit.",
  "Excellent communication skills.",
  "Teamwork across departments.",
  "A strong TEAM PLAYER.",
].join("\n");
const build = (requirements: ExtractedAd["requirements"]) =>
  buildJob({ ...empty, requirements }, AD, skills, { id: "t", source: null });

describe("fromAd: requirements that are not skills", () => {
  it("T1: all names on the not-a-skill list: the requirement leaves `requirements` and is in `notCounted`", () => {
    const r = build([req("You are a team player.", "must", "team player"), req("SQL is required.", "must", "SQL")]);
    expect(r.job.requirements.map((q) => q.skillIds)).toEqual([["sql"]]);
    expect(r.notCounted).toEqual([{ quote: "You are a team player.", importance: "must" }]);
    expect(r.unlisted).toEqual([]);
    expect(r.removed).toEqual([]);
  });

  it("T2: a trait mixed with a real skill: only the real skill stays, and nothing is not-counted", () => {
    const r = build([req("Python or being a team player is a plus.", "nice", "Python", "Team player")]);
    expect(r.job.requirements).toEqual([{ skillIds: ["python"], importance: "nice", quote: "Python or being a team player is a plus." }]);
    expect(r.notCounted).toEqual([]);
  });

  it("T3: several traits in one 'or' list, English and German: not counted, once", () => {
    const r = build([req("Eigeninitiative und Zuverlässigkeit.", "must", "Eigeninitiative", "Zuverlässigkeit")]);
    expect(r.job.requirements).toEqual([]);
    expect(r.notCounted).toEqual([{ quote: "Eigeninitiative und Zuverlässigkeit.", importance: "must" }]);
  });

  it("T4: the same trait in another case, with level words, or in German", () => {
    for (const name of ["TEAM PLAYER", "Team Player", "Teamplayer", "Strong team player", "Eigeninitiative"]) {
      const r = build([req("A strong TEAM PLAYER.", "nice", name)]);
      expect(r.notCounted).toEqual([{ quote: "A strong TEAM PLAYER.", importance: "nice" }]);
      expect(r.job.requirements).toEqual([]);
    }
  });

  it("T5: real soft skills stay skills: Communication and Teamwork", () => {
    const r = build([
      req("Excellent communication skills.", "must", "Communication"),
      req("Teamwork across departments.", "nice", "Teamwork"),
    ]);
    expect(r.job.requirements.map((q) => [q.skillIds, q.importance])).toEqual([[["communication"], "must"], [["teamwork"], "nice"]]);
    expect(r.notCounted).toEqual([]);
  });

  it("T6: a quote that is not in the ad is removed as before, not 'not counted'", () => {
    const r = build([req("You must be a rockstar.", "must", "team player")]);
    expect(r.notCounted).toEqual([]);
    expect(r.removed.map((x) => `${x.what}:${x.why}`)).toEqual(["requirement:not-in-ad"]);
  });

  it("T7: the same trait requirement twice: listed once, a must-have wins", () => {
    const r = build([req("You are a team player.", "nice", "team player"), req("You are a team player.", "must", "Teamplayer")]);
    expect(r.notCounted).toEqual([{ quote: "You are a team player.", importance: "must" }]);
  });

  it("T8: not-counted requirements keep the order of the ad's requirements", () => {
    const r = build([
      req("Eigeninitiative und Zuverlässigkeit.", "must", "Zuverlässigkeit"),
      req("SQL is required.", "must", "SQL"),
      req("You are a team player.", "nice", "team player"),
    ]);
    expect(r.notCounted.map((n) => n.quote)).toEqual(["Eigeninitiative und Zuverlässigkeit.", "You are a team player."]);
  });

  it("T9: with no traits `notCounted` is an empty list, never missing", () => {
    expect(build([req("SQL is required.", "must", "SQL")]).notCounted).toEqual([]);
    expect(build([]).notCounted).toEqual([]);
  });

  it("T10: a requirement with no skill names at all is still removed as 'no-skill', not 'not counted'", () => {
    const r = build([req("SQL is required.", "must")]);
    expect(r.notCounted).toEqual([]);
    expect(r.removed.map((x) => `${x.what}:${x.why}`)).toEqual(["requirement:no-skill"]);
  });
});

describe("fromCv: a trait proposed from a CV", () => {
  const LINES = ["Reliable team player, fast learner", "Wrote SQL queries", "Zuverlässigkeit und Teamarbeit"];
  const item = (name: string, line: number, quote: string) => ({ name, line, quote });
  const run = (...items: ReturnType<typeof item>[]) => fromCv({ skills: items }, LINES, skills);

  it("T11: dropped with the reason 'not-a-skill'; real skills stay", () => {
    const r = run(item("Team player", 1, "team player"), item("SQL", 2, "Wrote SQL queries"));
    expect(r.skills.map((s) => s.skillId)).toEqual(["sql"]);
    expect(r.removed).toEqual([{ name: "Team player", line: 1, quote: "team player", why: "not-a-skill" }]);
  });

  it("T12: in any case and in German; Teamwork (a skill) is kept", () => {
    const r = run(item("TEAM PLAYER", 1, "team player"), item("Zuverlässigkeit", 3, "Zuverlässigkeit"), item("Teamwork", 3, "Teamarbeit"));
    expect(r.removed.map((x) => x.why)).toEqual(["not-a-skill", "not-a-skill"]);
    expect(r.skills.map((s) => s.skillId)).toEqual(["teamwork"]);
  });
});

describe("the page text for requirements that were not counted", () => {
  it("T13: the counts sentence: none, one, many", () => {
    expect(notCountedSentence(0)).toBeNull();
    expect(notCountedSentence(1)).toBe(
      "1 requirement is not a skill a CV can show (for example a personal trait) and was not counted; it is listed below.",
    );
    expect(notCountedSentence(2)).toBe(
      "2 requirements are not skills a CV can show (for example personal traits) and were not counted; they are listed below.",
    );
    expect(notCountedSentence(11)).toContain("11 requirements are not skills");
  });

  it("T14: 'Check this yourself' lists the engine's quotes first, then the not-counted ones with their importance", () => {
    const rows = checkYourselfRows(["You must have the right to work in the UK."], [
      { quote: "You are a team player.", importance: "must" },
      { quote: "Curious mind.", importance: "nice" },
    ]);
    expect(rows).toEqual([
      { quote: "You must have the right to work in the UK.", note: null },
      { quote: "You are a team player.", note: "not counted: a must-have in the ad, but not a skill a CV can show" },
      { quote: "Curious mind.", note: "not counted: a nice-to-have in the ad, but not a skill a CV can show" },
    ]);
    expect(checkYourselfRows([], [])).toEqual([]);
  });

  it("T15: the report note, for a confirmed profile and for a typed list, says skill levels are not compared", () => {
    expect(LEVELS_NOTE).toBe("Skill levels (such as advanced) are not compared.");
    expect(reportNote("cv")).toBe(
      "Evidence for each skill is the CV line it came from. A kind you did not set is not judged. Skill levels (such as advanced) are not compared.",
    );
    expect(reportNote("list")).toBe(
      "Skills only: a skill counts because it is on your list (from your list, not a CV). Language, location, work mode, years and start date are not judged. Skill levels (such as advanced) are not compared.",
    );
  });
});
