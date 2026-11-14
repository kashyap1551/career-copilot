import type { Job } from "@/lib/engine/types";

// Job ads typed in by hand with the ad's own words in each quote, one at a
// time (step 2.1, part B). These three are synthetic samples, not real
// postings (see docs/DECISIONS.md); real public ads replace them before the
// reading test in step 3.2.

const northwindOperationsAnalyst: Job = {
  id: "northwind-operations-analyst",
  title: "Operations Analyst",
  company: "Northwind Logistics",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "C1" }], // "Fluent English, written and spoken."
    location: "Manchester",
    remote: "hybrid",
    minYears: 3, // "At least 3 years of experience in an analyst role."
    startDate: null, // "within two months" is not a date; see otherConditions
    otherConditions: [
      { quote: "You must have the right to work in the UK." },
      { quote: "We would like you to start within two months." },
    ],
  },
  requirements: [
    {
      skillIds: ["sql"],
      importance: "must",
      quote: "Strong SQL for querying large data sets.",
    },
    {
      skillIds: ["excel"],
      importance: "must",
      quote: "Advanced Excel, including pivot tables and lookups.",
    },
    {
      skillIds: ["communication"],
      importance: "must",
      quote: "Able to explain findings clearly to non-technical managers.",
    },
    {
      skillIds: ["power-bi", "tableau"], // "or": any one counts as met
      importance: "nice",
      quote: "Power BI or Tableau dashboard experience.",
    },
    {
      skillIds: ["python"],
      importance: "nice",
      quote: "Python for data cleaning.",
    },
  ],
};

const brightwaterFinancialPlanningAnalyst: Job = {
  id: "brightwater-financial-planning-analyst",
  title: "Financial Planning Analyst",
  company: "Brightwater Finserv",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "B2" }], // "Good English for working with our global team."
    location: "Bengaluru",
    remote: "onsite", // "five days a week" in the office
    minYears: 2, // "2 to 4 years ...": only the lower bound is stored
    startDate: null,
    otherConditions: [
      { quote: "Bachelor's degree in finance, commerce or a related field." },
      // A preferred language: JobLanguage can't say "optional" or "any of
      // these" yet, so it is listed, not scored (see docs/SPRINT.md, 3.1).
      { quote: "Knowledge of Hindi or Kannada." },
      { quote: "Immediate joiners are preferred." },
    ],
  },
  requirements: [
    {
      skillIds: ["financial-planning"],
      importance: "must",
      quote: "2 to 4 years of experience in financial planning and analysis.",
    },
    {
      skillIds: ["financial-modelling"],
      importance: "must",
      quote: "Advanced Excel financial modelling.",
    },
    {
      skillIds: ["power-bi"],
      importance: "must",
      quote: "Power BI for monthly reporting.",
    },
    {
      skillIds: ["sql"],
      importance: "nice",
      quote: "Basic SQL.",
    },
  ],
};

const fjordlightFrontendDeveloper: Job = {
  id: "fjordlight-frontend-developer",
  title: "Frontend Developer",
  company: "Fjordlight Software",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "C1" }], // "Fluent English (C1 or better)."
    location: null, // not stated: fully remote, Europe time zones
    remote: "remote",
    minYears: 4, // "4 or more years of experience building web applications."
    startDate: null,
    otherConditions: [
      {
        quote:
          "We are not able to sponsor visas, so you must already be able to work in Europe.",
      },
    ],
  },
  requirements: [
    {
      skillIds: ["typescript"],
      importance: "must",
      quote: "Strong TypeScript and React.",
    },
    {
      skillIds: ["react"],
      importance: "must",
      quote: "Strong TypeScript and React.",
    },
    {
      skillIds: ["git"],
      importance: "must",
      quote: "Daily use of Git and pull-request reviews.",
    },
    {
      skillIds: ["vitest", "jest"], // "or": any one counts as met
      importance: "nice",
      quote: "Testing with Vitest or Jest.",
    },
    {
      skillIds: ["accessibility"],
      importance: "nice",
      quote: "Experience with accessibility standards.",
    },
  ],
};

export const jobs: Job[] = [
  northwindOperationsAnalyst,
  brightwaterFinancialPlanningAnalyst,
  fjordlightFrontendDeveloper,
];
