import { describe, expect, it } from "vitest";
import { jobs } from "@/fixtures/jobs";
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
} from "@/lib/engine/explain";
import { match } from "@/lib/engine/match";
import {
  classifyJobs,
  jobsBroughtCloser,
  rankMissingSkills,
  unlockTimeline,
} from "@/lib/engine/unlock";
import {
  BRIGHTWATER,
  FJORDLIGHT,
  J,
  NORTHWIND,
  P,
  berlinJob,
  jobWithMusts,
  learning,
  mayaWithComm,
  nameOf,
  withConstraints,
  withSkills,
} from "./helpers";

// Every expected sentence below was written by hand from the wording rules in
// the 2.4 plan. None of them was copied from the code's output.

const north = J(NORTHWIND);
const bright = J(BRIGHTWATER);
const fjord = J(FJORDLIGHT);
const maya = P("maya");
const fit = (profile: Parameters<typeof match>[0], job: Parameters<typeof match>[1]) =>
  explainFit(match(profile, job), nameOf);

describe("levelName", () => {
  it("uses the names from the sprint plan", () => {
    expect(levelName("strong")).toBe("Strong");
    expect(levelName("good")).toBe("Good");
    expect(levelName("stretch")).toBe("Stretch");
    expect(levelName("longShot")).toBe("Long shot");
  });
});

describe("explainFit: one sentence for each way a level is decided", () => {
  it("all must-haves met", () => {
    expect(fit(P("sam"), north)).toBe(
      "You meet all 3 must-haves and no conflict stands in the way.",
    );
  });

  it("an ad with no must-haves", () => {
    expect(fit(maya, { ...berlinJob(), requirements: [] })).toBe(
      "The ad lists no must-haves, and no conflict stands in the way.",
    );
  });

  it("one must-have missing", () => {
    expect(fit(P("ravi"), bright)).toBe(
      "One must-have is missing (Power BI). Nothing else stands in the way.",
    );
  });

  it("a missing must-have with alternatives names them all", () => {
    const job = jobWithMusts(berlinJob(), [["power-bi", "tableau"]]);
    expect(fit(maya, job)).toBe(
      "One must-have is missing (Power BI or Tableau). Nothing else stands in the way.",
    );
  });

  it("two must-haves missing", () => {
    expect(fit(P("sam"), bright)).toBe(
      "Two must-haves are missing (Financial planning and analysis, Financial modelling). Nothing else stands in the way.",
    );
  });

  it("skills fine, one closable conflict decides", () => {
    expect(fit(mayaWithComm(), withConstraints(berlinJob(), { minYears: 6 }))).toBe(
      "Your skills fit: you meet all 3 must-haves. One thing stands in the way, and it could be closed: the ad asks for 6 years and your profile has 5.",
    );
  });

  it("one must-have missing plus one closable conflict", () => {
    const job = withConstraints(berlinJob(), { languages: [{ code: "en", level: "C2" }] });
    expect(fit(maya, job)).toBe(
      "One must-have is missing (Communication) and one conflict could be closed: the ad asks for English at C2 and your profile has C1.",
    );
  });

  it("skills fine, two closable conflicts", () => {
    const job = withConstraints(berlinJob(), {
      languages: [{ code: "en", level: "C2" }],
      minYears: 6,
    });
    expect(fit(mayaWithComm(), job)).toBe(
      "Your skills fit: you meet all 3 must-haves. Two things stand in the way, and both could be closed: the ad asks for English at C2 and your profile has C1; the ad asks for 6 years and your profile has 5.",
    );
  });

  it("three or more gaps", () => {
    const job = withConstraints(
      jobWithMusts(berlinJob(), [["sql"], ["communication"], ["python"]]),
      { languages: [{ code: "en", level: "C2" }] },
    );
    expect(fit(maya, job)).toBe(
      "Three or more gaps: 2 must-haves are missing (Communication, Python) and 1 conflict could be closed: the ad asks for English at C2 and your profile has C1.",
    );
  });
});

describe("explainFit: when a conflict that can't be closed decides", () => {
  it("skills fine: says the skills are not the reason", () => {
    expect(fit(P("ana"), fjord)).toBe(
      "Your skills fit: you meet all 3 must-haves. What decides this is years of experience: the ad asks for 4 years and your profile has 1, and that can't be closed soon.",
    );
  });

  it("skills missing too: names the conflict, then the missing count", () => {
    expect(fit(maya, north)).toBe(
      "What decides this is location: the job is in Manchester and the cities on your profile are Berlin, and that can't be closed soon. Also, 1 of 3 must-haves is missing (Communication).",
    );
  });

  it("a language the person doesn't list", () => {
    const job = withConstraints(berlinJob(), { languages: [{ code: "fr", level: "B1" }] });
    expect(fit(maya, job)).toBe(
      "What decides this is language level: the ad asks for French at B1 and your profile does not list French, and that can't be closed soon. Also, 1 of 3 must-haves is missing (Communication).",
    );
  });

  it("a start date too early", () => {
    const job = withConstraints(berlinJob(), { startDate: "2026-10-01" });
    expect(fit(mayaWithComm(), job)).toBe(
      "Your skills fit: you meet all 3 must-haves. What decides this is start date: the ad wants a start by 2026-10-01 and you are available from 2026-12-01, and that can't be closed soon.",
    );
  });

  it("a work mode the person doesn't accept", () => {
    expect(fit(P("sam"), fjord)).toBe(
      "What decides this is work mode: the job is remote and your profile accepts on-site, hybrid, and that can't be closed soon. Also, 3 of 3 must-haves are missing (TypeScript, React, Git).",
    );
  });
});

describe("heldBackBy: the cause shown in the one-line summary", () => {
  it("names the conflict when every must-have is met", () => {
    expect(heldBackBy(match(P("ana"), fjord))).toBe("years of experience");
  });

  it("joins several causes", () => {
    const job = withConstraints(berlinJob(), {
      languages: [{ code: "en", level: "C2" }],
      minYears: 6,
    });
    expect(heldBackBy(match(mayaWithComm(), job))).toBe("language level and years of experience");
  });

  it("is null when a must-have is missing, or when the job is Strong", () => {
    expect(heldBackBy(match(maya, north))).toBeNull();
    expect(heldBackBy(match(P("sam"), north))).toBeNull();
  });
});

describe("describeRequirement", () => {
  it("met: the skill and its CV line", () => {
    const r = match(maya, north).musts[0];
    expect(describeRequirement(r, maya, nameOf)).toEqual({
      status: "met",
      text: 'SQL, CV line 4: "Wrote SQL queries to pull order data for the finance team"',
    });
  });

  it("met by one of several alternatives names that one", () => {
    const r = match(P("sam"), north).nices[0];
    expect(describeRequirement(r, P("sam"), nameOf).text).toBe(
      'Power BI, CV line 5: "Built Power BI dashboards for the operations managers"',
    );
  });

  it("not on the profile", () => {
    const r = match(maya, north).musts[2];
    expect(describeRequirement(r, maya, nameOf)).toEqual({
      status: "missing",
      text: "Communication: not on your profile",
    });
  });

  it("not on the profile, with alternatives", () => {
    const r = match(P("ana"), north).nices[0];
    expect(describeRequirement(r, P("ana"), nameOf).text).toBe(
      "Power BI or Tableau: not on your profile",
    );
  });

  it("in progress, with its date", () => {
    const r = match(P("ana"), north).musts[0];
    expect(describeRequirement(r, P("ana"), nameOf).text).toBe(
      "SQL: in progress, expected 2027-01-31",
    );
  });

  it("in progress names the alternative being learned", () => {
    const p = withSkills(maya, [learning("tableau", "2026-12-20")]);
    const job = jobWithMusts(berlinJob(), [["power-bi", "tableau"]]);
    const r = match(p, job).musts[0];
    expect(describeRequirement(r, p, nameOf).text).toBe(
      "Tableau: in progress, expected 2026-12-20",
    );
  });

  it("on the profile but tied to no CV line", () => {
    const p = withSkills(maya, [{ kind: "have", skillId: "communication", evidence: null }]);
    const r = match(p, berlinJob()).musts[2];
    expect(describeRequirement(r, p, nameOf).text).toBe(
      "Communication: on your profile but tied to no CV line, so it isn't counted",
    );
  });
});

describe("conflictLine: each conflict is labelled on its own", () => {
  it("can't be closed soon", () => {
    expect(conflictLine(match(P("ana"), fjord).conflicts[0])).toBe(
      "(can't be closed soon) The ad asks for 4 years of experience; your profile has 1 (3 years short).",
    );
  });

  it("could be closed: years", () => {
    expect(conflictLine(match(P("jonas"), bright).conflicts[0])).toBe(
      "(could be closed) The ad asks for 2 years of experience; your profile has 1 (1 year short).",
    );
  });

  it("could be closed: language", () => {
    expect(conflictLine(match(P("jonas"), fjord).conflicts[0])).toBe(
      "(could be closed) The ad asks for English at C1; your profile has B2 (one level short).",
    );
  });
});

describe("blockedHeader", () => {
  const blockedOf = (profile: Parameters<typeof classifyJobs>[0], job: Parameters<typeof match>[1]) =>
    classifyJobs(profile, [job]).blocked[0];

  it("one thing that can't be closed", () => {
    expect(blockedHeader(blockedOf(maya, north))).toBe("blocked by 1 thing; it can't be closed soon");
  });

  it("one thing that could be closed", () => {
    const job = withConstraints(berlinJob(), { minYears: 6 });
    expect(blockedHeader(blockedOf(mayaWithComm(), job))).toBe("blocked by 1 thing; it could be closed");
  });

  it("several things, at least one that can't be closed", () => {
    expect(blockedHeader(blockedOf(P("ana"), bright))).toBe(
      "blocked by 3 things; at least one can't be closed soon",
    );
  });

  it("several things, all of which could be closed", () => {
    const job = withConstraints(berlinJob(), { languages: [{ code: "en", level: "C2" }], minYears: 6 });
    expect(blockedHeader(blockedOf(mayaWithComm(), job))).toBe(
      "blocked by 2 things; all of them could be closed",
    );
  });
});

describe("explainRankedSkill", () => {
  const label = (id: string) => jobLabel(jobs.find((j) => j.id === id)!);

  it("a skill that unlocks nothing alone names what it needs together", () => {
    const sam = P("sam");
    const [first, second] = rankMissingSkills(sam, jobs);
    const closer = jobsBroughtCloser(sam, jobs, [], first.skillId);
    expect(explainRankedSkill(first, closer, nameOf, label)).toBe(
      "Financial modelling: together with Financial planning and analysis, unlocks Financial Planning Analyst, Brightwater Finserv.",
    );
    expect(explainRankedSkill(second, [], nameOf, label)).toBe(
      "Financial planning and analysis: unlocks 1 job (Financial Planning Analyst, Brightwater Finserv). Total so far: 1 job.",
    );
  });

  it("a skill already in progress says so, and counts are plural", () => {
    const learner = { ...P("maya"), skills: [learning("sql", "2026-12-20")] };
    const twoJobs = [
      jobWithMusts({ ...berlinJob(), id: "B", title: "B", company: null }, [["sql"]]),
      jobWithMusts({ ...berlinJob(), id: "C", title: "C", company: null }, [["sql"]]),
    ];
    const [entry] = rankMissingSkills(learner, twoJobs);
    expect(explainRankedSkill(entry, [], nameOf, (id) => id)).toBe(
      "SQL (in progress, expected 2026-12-20): unlocks 2 jobs (B; C). Total so far: 2 jobs.",
    );
  });

  it("several jobs it brings closer, and alternatives joined with 'or'", () => {
    const base = { ...berlinJob(), company: null };
    const set = [
      jobWithMusts({ ...base, id: "X", title: "X" }, [["alpha"], ["zulu"]]),
      jobWithMusts({ ...base, id: "Y", title: "Y" }, [["zulu"], ["beta", "gamma"]]),
    ];
    const nobody = { ...P("maya"), skills: [] };
    const [first] = rankMissingSkills(nobody, set);
    expect(first.skillId).toBe("zulu");
    const closer = jobsBroughtCloser(nobody, set, [], "zulu");
    expect(explainRankedSkill(first, closer, nameOf, (id) => id)).toBe(
      "zulu: together with alpha, unlocks X; together with beta or gamma, unlocks Y.",
    );
  });
});

describe("explainTimelineEntry", () => {
  const people = withSkills({ ...P("maya"), skills: [] }, [
    learning("sql", "2026-12-20"),
    learning("python", "2027-02-01"),
  ]);
  const base = { ...berlinJob(), company: null };
  const W = jobWithMusts({ ...base, id: "W", title: "W" }, [["sql"], ["python"]]);

  it("zero, one skill", () => {
    const [first] = unlockTimeline(people, [W]);
    expect(explainTimelineEntry(first, nameOf, (id) => id)).toBe(
      "By 2026-12-20 (SQL): 0 more Strong matches. SQL doesn't unlock a job yet.",
    );
  });

  it("one more match is singular", () => {
    const entries = unlockTimeline(people, [W]);
    expect(explainTimelineEntry(entries[1], nameOf, (id) => id)).toBe(
      "By 2027-02-01 (Python): 1 more Strong match (W).",
    );
  });

  it("zero with several skills", () => {
    const entry = { date: "2026-12-20", skills: ["python", "sql"], moreStrong: 0, newlyUnlocked: [], jobs: [] };
    expect(explainTimelineEntry(entry, nameOf, (id) => id)).toBe(
      "By 2026-12-20 (Python, SQL): 0 more Strong matches. These skills don't unlock a job yet.",
    );
  });

  it("several matches are listed with semicolons", () => {
    const entry = { date: "2026-12-20", skills: ["sql", "tableau"], moreStrong: 4, newlyUnlocked: [], jobs: ["B", "C", "D", "K"] };
    expect(explainTimelineEntry(entry, nameOf, (id) => id)).toBe(
      "By 2026-12-20 (SQL, Tableau): 4 more Strong matches (B; C; D; K).",
    );
  });
});

describe("jobLabel", () => {
  it("is the title and company, or just the title", () => {
    expect(jobLabel(north)).toBe("Operations Analyst, Northwind Logistics");
    expect(jobLabel({ ...north, company: null })).toBe("Operations Analyst");
  });
});
