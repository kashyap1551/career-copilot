import { describe, expect, it } from "vitest";
import { readSkillList, skillsOnlyReport } from "@/app/skillsOnly";
import { jobs } from "@/fixtures/jobs";
import { skills } from "@/fixtures/skills";
import type { Job } from "@/lib/engine/types";

// Docker was the unlisted example until Day 5, when it entered the vocabulary; Welding is not in it.
// Worked out by hand from the Northwind fixture job (docs/PLAN-3.1.md, A1):
//   musts: SQL, Excel, communication; nices: Power BI or Tableau, Python.
//   constraints: English C1, Manchester, hybrid, 3 years; no start date.
//   otherConditions: the right-to-work sentence and the start-within-two-months one.

const NOT_JUDGED = " Location, language, work mode, years and start date are not judged here.";

const northwind = jobs.find((j) => j.id === "northwind-operations-analyst") as Job;

function report(listText: string, job: Job = northwind, unlisted: { id: string; name: string }[] = []) {
  const { cvLines, lines } = readSkillList(listText, skills);
  return skillsOnlyReport(job, cvLines, lines, skills, unlisted);
}

describe("readSkillList", () => {
  it("S1: one skill per line, empty lines skipped and not numbered", () => {
    const { cvLines, lines } = readSkillList("SQL\n\n   \r\n Excel \nWelding", skills);
    expect(cvLines).toEqual(["SQL", "Excel", "Welding"]);
    expect(lines.map((l) => [l.line, l.skillId, l.listed])).toEqual([
      [1, "sql", true],
      [2, "excel", true],
      [3, "new:welding", false],
    ]);
  });

  it("S2: a line with nothing to make an id from is not listed", () => {
    const { lines } = readSkillList("???", skills);
    expect(lines).toEqual([{ line: 1, text: "???", skillId: null, listed: false }]);
  });
});

describe("skillsOnlyReport", () => {
  const six = "SQL\nExcel\nPython\nTableau\nWelding\nGit";

  it("S3: six lines on Northwind: 2 of 3 musts, 2 of 2 nices, Good, skills only", () => {
    const r = report(six);
    expect(r.fitLabel).toBe("Good (skills only)");
    expect(r.counts).toEqual({ mustsMet: 2, mustsTotal: 3, nicesMet: 2, nicesTotal: 2 });
    expect(r.explanation).toBe(
      "One must-have is missing: Communication." + NOT_JUDGED,
    );
    expect(r.unlistedRequirements).toBe(0);
    expect(r.rows.map((x) => [x.status, x.detail])).toEqual([
      ["met", 'SQL: from your list, line 1: "SQL"'],
      ["met", 'Excel: from your list, line 2: "Excel"'],
      ["missing", "Communication: not on your list"],
      ["met", 'Tableau: from your list, line 4: "Tableau"'],
      ["met", 'Python: from your list, line 3: "Python"'],
    ]);
    expect(r.rows[0].quote).toBe("Strong SQL for querying large data sets.");
  });

  it("S4: the job's constraints are listed as not judged and never decide the level", () => {
    const r = report(six);
    expect(r.notJudged).toEqual([
      "Language: English at C1: not judged",
      "Location: Manchester: not judged",
      "Work mode: hybrid: not judged",
      "Years of experience: 3: not judged",
    ]);
    expect(r.checkYourself).toEqual([
      "You must have the right to work in the UK.",
      "We would like you to start within two months.",
    ]);
  });

  it("S5: an empty list meets nothing: 3 musts missing is Long shot", () => {
    const r = report("");
    expect(r.fitLabel).toBe("Long shot (skills only)");
    expect(r.explanation).toBe(
      "3 of 3 must-haves are missing: SQL, Excel, Communication." + NOT_JUDGED,
    );
    expect(r.counts.mustsMet).toBe(0);
    expect(r.rows.every((x) => x.status === "missing")).toBe(true);
  });

  it("S6: the full list on the three musts is Strong", () => {
    const r = report("SQL\nExcel\nCommunication");
    expect(r.fitLabel).toBe("Strong (skills only)");
    expect(r.explanation).toBe("You meet all 3 must-haves on your list." + NOT_JUDGED);
    expect(r.counts).toEqual({ mustsMet: 3, mustsTotal: 3, nicesMet: 0, nicesTotal: 2 });
  });

  it("S7: a skill written twice cites its first line", () => {
    const r = report("sql\nSQL\nExcel\nCommunication");
    expect(r.rows[0].detail).toBe('SQL: from your list, line 1: "sql"');
  });

  it("S8: a requirement whose skills are all unlisted is not met, even if the same unlisted skill is on the list", () => {
    const docker: Job = {
      ...northwind,
      requirements: [{ skillIds: ["new:welding"], importance: "must", quote: "Welding experience." }],
    };
    const r = report("Welding", docker, [{ id: "new:welding", name: "Welding" }]);
    expect(r.rows).toEqual([
      {
        quote: "Welding experience.",
        importance: "must",
        label: "Welding",
        status: "unlisted",
        detail: "Welding: not in our skill list yet, so it can't be matched with your CV",
      },
    ]);
    expect(r.unlistedRequirements).toBe(1);
    expect(r.explanation).toBe("One must-have is missing: Welding." + NOT_JUDGED);
    expect(r.counts.mustsMet).toBe(0);
    expect(r.fitLabel).toBe("Good (skills only)");
  });

  it("S9: alternatives with one listed skill are not counted as unlisted", () => {
    const alt: Job = {
      ...northwind,
      requirements: [
        { skillIds: ["power-bi", "new:looker"], importance: "must", quote: "Power BI or Looker." },
      ],
    };
    const r = report("", alt, [{ id: "new:looker", name: "Looker" }]);
    expect(r.rows[0].status).toBe("missing");
    expect(r.rows[0].detail).toBe("Power BI or Looker: not on your list");
    expect(r.unlistedRequirements).toBe(0);
  });

  it("S10: a job with no constraints has nothing to list as not judged", () => {
    const bare: Job = {
      ...northwind,
      constraints: { ...northwind.constraints, languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
    };
    const r = report(six, bare);
    expect(r.notJudged).toEqual([]);
    expect(r.checkYourself).toEqual([]);
  });

  it("S11: no must-haves in the ad", () => {
    const none: Job = {
      ...northwind,
      requirements: [{ skillIds: ["python"], importance: "nice", quote: "Python for data cleaning." }],
    };
    expect(report(six, none).explanation).toBe("The ad lists no must-haves." + NOT_JUDGED);
  });

  it("S12: two of three missing, in the ad's order", () => {
    expect(report("SQL").explanation).toBe(
      "2 of 3 must-haves are missing: Excel, Communication." + NOT_JUDGED,
    );
  });

  it("S13: exactly one must-have, met", () => {
    const one: Job = {
      ...northwind,
      requirements: [{ skillIds: ["sql"], importance: "must", quote: "Strong SQL for querying large data sets." }],
    };
    expect(report("SQL", one).explanation).toBe("You meet the only must-have on your list." + NOT_JUDGED);
  });

  it("S14: the explanation never claims anything about what stands in the way", () => {
    for (const list of ["", "SQL", six, "SQL\nExcel\nCommunication"]) {
      expect(report(list).explanation).not.toMatch(/stands? in the way|conflict/i);
    }
  });
});
