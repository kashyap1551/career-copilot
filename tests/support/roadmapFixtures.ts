import { skills } from "@/fixtures/skills";
import { buildProfile, type BuiltProfile, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job, Requirement } from "@/lib/engine/types";

// Invented material for the 7.1 tests (docs/PLAN-7.1.md section 1, the four-ad example). Not a test file. People, ads and
// companies are all made up; the same person and ads as tests/gaps.test.ts.

export const LINES = [
  "Robin Sample, Reporting Analyst", // 1
  "Wrote SQL queries to reconcile order data", // 2 (SQL)
  "Built monthly dashboards in Tableau", // 3 (Tableau, only ticked when a test says so)
  "Skills: Excel", // 4 (Excel)
  "Wrote Python scripts for monthly checks", // 5 (Python, only ticked when a test says so)
];
const proposal = (name: string, skillId: string, line: number, quote: string): CvSkill => ({
  name, skillId, listed: true, line, quote, label: "named",
});
export const PROPOSALS = [
  proposal("SQL", "sql", 2, "Wrote SQL queries"),
  proposal("Tableau", "tableau", 3, "dashboards in Tableau"),
  proposal("Excel", "excel", 4, "Skills: Excel"),
  proposal("Python", "python", 5, "Wrote Python scripts"),
];

// Section 1: SQL (CV line 2) and Excel (CV line 4) are had; Tableau is in progress, expected 2027-03-01; the person set
// only a city, Berlin (so only the location kind is set; the work modes default to all three).
export const person = (over: Partial<ConfirmState> = {}): BuiltProfile =>
  buildProfile(
    LINES,
    PROPOSALS,
    {
      keptIds: ["sql", "excel"],
      added: [],
      inProgress: [{ name: "Tableau", date: "2027-03-01" }],
      languages: [],
      cities: "Berlin",
      workModes: [],
      years: "",
      availableFrom: "",
      ...over,
    },
    skills,
  );

export const must = (...skillIds: string[]): Requirement => ({ skillIds, importance: "must", quote: `must ${skillIds.join(" or ")}` });
export const nice = (...skillIds: string[]): Requirement => ({ skillIds, importance: "nice", quote: `nice ${skillIds.join(" or ")}` });

export type Over = {
  remote?: Job["constraints"]["remote"];
  location?: string | null;
  minYears?: number | null;
  languages?: Job["constraints"]["languages"];
};
export const ad = (id: string, title: string, company: string, requirements: Requirement[], over: Over = {}): Job => ({
  id,
  title,
  company,
  source: null,
  requirements,
  constraints: {
    languages: over.languages ?? [],
    location: over.location === undefined ? "Berlin" : over.location,
    remote: over.remote === undefined ? "hybrid" : over.remote,
    minYears: over.minYears === undefined ? null : over.minYears,
    startDate: null,
    otherConditions: [],
  },
});

export const UNLISTED = "new:kombucha-brewing";
export const ad1 = (o: Over = {}) => ad("a1", "Reporting Analyst", "Northlake Foods Ltd", [must("sql"), must("tableau"), nice("excel")], o);
export const ad2 = (o: Over = {}) => ad("a2", "BI Developer", "Harbor Light Stationery", [must("sql"), must("python"), nice("tableau")], o);
export const ad3 = (o: Over = {}) => ad("a3", "Data Clerk", "Example Wharf Ltd", [must("excel"), nice("python"), nice("power-bi")], o);
export const ad4 = (o: Over = {}) => ad("a4", "Analytics Lead", "Imaginary Pages Ltd", [must("sql"), must("python"), must(UNLISTED), nice("tableau")], o);
export const FOUR = () => [ad1(), ad2(), ad3(), ad4()];
export const asSaved = (jobs: Job[]) => jobs.map((job) => ({ id: job.id, job }));
export { skills };
