import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { jobs } from "@/fixtures/jobs";
import { profileReport } from "@/app/fitReport";
import { buildProfile, initialConfirm, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job } from "@/lib/engine/types";

// Hand-worked cases R1 to R11 (docs/PLAN-4.3.md) on the Northwind ad: musts SQL,
// Excel, Communication; nices Power BI or Tableau, Python; English C1, Manchester,
// hybrid, 3 years, no start date. CV lines: 1 "Alex Example", 2 "Used SQL daily",
// 3 "Excel pivot tables and lookups". SQL and Excel are ticked.

const northwind = jobs.find((j) => j.id === "northwind-operations-analyst") as Job;
const LINES = ["Alex Example", "Used SQL daily", "Excel pivot tables and lookups", "Explained findings to managers"];
const P: CvSkill[] = [
  { name: "SQL", skillId: "sql", listed: true, line: 2, quote: "Used SQL daily", label: "named" },
  { name: "Excel", skillId: "excel", listed: true, line: 3, quote: "Excel pivot tables", label: "named" },
  { name: "Communication", skillId: "communication", listed: true, line: 4, quote: "Explained findings to managers", label: "inferred" },
];
const confirm = (over: Partial<ConfirmState> = {}): ConfirmState => ({ ...initialConfirm(P), keptIds: ["sql", "excel"], ...over });
const report = (over: Partial<ConfirmState> = {}, job: Job = northwind) =>
  profileReport(job, buildProfile(LINES, P, confirm(over), skills), skills, []);

const NOT_SET = "not judged because you did not set yours.";
const TAIL_ALL = "Location, language, work mode, years and start date are not judged here.";

describe("profileReport", () => {
  it("R1: nothing set: Good (skills only), 2 of 3, evidence 'CV line n', all five not judged", () => {
    const r = report();
    expect(r.fitLabel).toBe("Good (skills only)");
    expect(r.counts).toEqual({ mustsMet: 2, mustsTotal: 3, nicesMet: 0, nicesTotal: 2 });
    expect(r.rows.map((x) => [x.status, x.detail])).toEqual([
      ["met", 'SQL: CV line 2: "Used SQL daily"'],
      ["met", 'Excel: CV line 3: "Excel pivot tables and lookups"'],
      ["missing", "Communication: not on your profile"],
      ["missing", "Power BI or Tableau: not on your profile"],
      ["missing", "Python: not on your profile"],
    ]);
    expect(r.judged).toEqual([]);
    expect(r.conflicts).toEqual([]);
    expect(r.explanation).toBe(`One must-have is missing: Communication. ${TAIL_ALL}`);
    expect(r.notJudged).toEqual([
      `Location: the ad says Manchester; ${NOT_SET}`,
      `Language: the ad says English at C1; ${NOT_SET}`,
      `Work mode: the ad says hybrid; ${NOT_SET}`,
      `Years: the ad says 3 years; ${NOT_SET}`,
      "Start date: not judged (you did not set yours, and the ad does not say).",
    ]);
    expect(r.checkYourself).toEqual(["You must have the right to work in the UK.", "We would like you to start within two months."]);
  });

  it("R2: years 2 is one closable conflict: 1 missing + 1 closable = 2 gaps = Stretch", () => {
    const r = report({ years: "2" });
    expect(r.fitLabel).toBe("Stretch (judged: skills, years)");
    expect(r.judged).toEqual(["years"]);
    expect(r.conflicts).toEqual(["(could be closed) The ad asks for 3 years of experience; your profile has 2 (1 year short)."]);
    expect(r.explanation).toBe(
      "One must-have is missing: Communication. 1 conflict was found in what you set (listed below). Not judged here: location, language, work mode, start date.",
    );
    expect(r.notJudged.length).toBe(4);
    expect(r.notJudged.some((l) => l.startsWith("Years"))).toBe(false);
  });

  it("R3: Berlin and hybrid for a hybrid Manchester job: the city can't be closed: Long shot", () => {
    const r = report({ cities: "Berlin", workModes: ["hybrid"] });
    expect(r.fitLabel).toBe("Long shot (judged: skills, location, work mode)");
    expect(r.conflicts).toEqual(["(can't be closed soon) The job is in Manchester; the cities on your profile are: Berlin."]);
    expect(r.explanation).toBe(
      "One must-have is missing: Communication. 1 conflict was found in what you set (listed below). Not judged here: language, years, start date.",
    );
  });

  it("R4: only 'manchester' set (case differs): no conflict; Good; work mode stays not judged", () => {
    const r = report({ cities: "manchester" });
    expect(r.fitLabel).toBe("Good (judged: skills, location)");
    expect(r.conflicts).toEqual([]);
    expect(r.explanation).toBe(
      "One must-have is missing: Communication. No conflict was found in what you set. Not judged here: language, work mode, years, start date.",
    );
    expect(r.notJudged).toContain(`Work mode: the ad says hybrid; ${NOT_SET}`);
  });

  it("R4b: only 'Berlin' set (no work mode): the city conflict is still found, and no work-mode conflict appears", () => {
    const r = report({ cities: "Berlin" });
    expect(r.fitLabel).toBe("Long shot (judged: skills, location)");
    expect(r.conflicts).toEqual(["(can't be closed soon) The job is in Manchester; the cities on your profile are: Berlin."]);
  });

  it("R5: only work mode remote set: a work-mode conflict, and no city conflict", () => {
    const r = report({ workModes: ["remote"] });
    expect(r.fitLabel).toBe("Long shot (judged: skills, work mode)");
    expect(r.conflicts).toEqual(["(can't be closed soon) The job is hybrid; your profile accepts: remote."]);
    expect(r.notJudged).toContain(`Location: the ad says Manchester; ${NOT_SET}`);
  });

  it("R6: languages: English C1 meets the ad; German B2 does not list English", () => {
    const ok = report({ languages: [{ code: "en", level: "C1" }] });
    expect(ok.fitLabel).toBe("Good (judged: skills, language)");
    expect(ok.conflicts).toEqual([]);
    const bad = report({ languages: [{ code: "de", level: "B2" }] });
    expect(bad.fitLabel).toBe("Long shot (judged: skills, language)");
    expect(bad.conflicts).toEqual(["(can't be closed soon) The ad asks for English at C1; your profile does not list English."]);
  });

  it("R7: available from is set but the ad gives no start date: not judged, label stays skills only", () => {
    const r = report({ availableFrom: "2027-01-01" });
    expect(r.judged).toEqual([]);
    expect(r.fitLabel).toBe("Good (skills only)");
    expect(r.notJudged).toContain("Start date: not judged (the ad does not say).");
    expect(r.explanation).toBe(`One must-have is missing: Communication. ${TAIL_ALL}`);
  });

  it("R8: a skill added by hand has no CV line: still missing, and the screen says why", () => {
    const r = report({ added: ["Communication"] });
    expect(r.counts.mustsMet).toBe(2);
    const row = r.rows.find((x) => x.label === "Communication")!;
    expect(row.status).toBe("missing");
    expect(row.detail).toBe(
      "Communication: added by hand with no CV line, so it does not count. Add a line about it to your CV text and read again.",
    );
  });

  it("R9: a skill in progress is not met, and the date is shown", () => {
    const r = report({ inProgress: [{ name: "Communication", date: "2026-12-20" }] });
    expect(r.counts.mustsMet).toBe(2);
    expect(r.rows.find((x) => x.label === "Communication")!.detail).toBe("Communication: in progress, expected 2026-12-20");
  });

  it("R10: a requirement whose skills are all unlisted is 'not in our skill list yet' and counted", () => {
    const docker: Job = { ...northwind, requirements: [{ skillIds: ["new:docker"], importance: "must", quote: "Docker experience." }] };
    const r = profileReport(docker, buildProfile(LINES, P, confirm(), skills), skills, [{ id: "new:docker", name: "Docker" }]);
    expect(r.rows[0].status).toBe("unlisted");
    expect(r.rows[0].detail).toBe("Docker: not in our skill list yet, so it can't be matched with your CV");
    expect(r.unlistedRequirements).toBe(1);
  });

  it("R11: everything set and met: Strong, only the start date not judged", () => {
    const r = report({
      keptIds: ["sql", "excel", "communication"],
      years: "3",
      cities: "Manchester",
      workModes: ["hybrid"],
      languages: [{ code: "en", level: "C1" }],
      availableFrom: "2027-01-01",
    });
    expect(r.fitLabel).toBe("Strong (judged: skills, location, language, work mode, years)");
    expect(r.conflicts).toEqual([]);
    expect(r.explanation).toBe(
      "You meet all 3 must-haves on your profile. No conflict was found in what you set. Not judged here: start date.",
    );
    expect(r.notJudged).toEqual(["Start date: not judged (the ad does not say)."]);
  });

  it("R12: the page never claims what code can't know: no 'stands in the way', no percent sign", () => {
    for (const over of [{}, { years: "2" }, { cities: "Berlin" }, { workModes: ["remote" as const] }]) {
      const r = report(over);
      expect(r.explanation).not.toMatch(/stands? in the way/i);
      expect(JSON.stringify(r)).not.toContain("%");
    }
  });
});
