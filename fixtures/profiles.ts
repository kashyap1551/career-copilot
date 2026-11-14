import type { Profile } from "@/lib/engine/types";

// Six made-up people. Every name, employer and CV line is invented.
// No real CVs in this repository.

// Career-changer into data: Excel and SQL from an operations job, Python on
// the way.
const maya: Profile = {
  id: "maya",
  name: "Maya Demo",
  cvLines: [
    "Maya Demo, Operations Coordinator, Berlin",
    "2019-2024 Operations Coordinator, Sample Logistics GmbH",
    "Built weekly stock reports in Excel with pivot tables and lookups",
    "Wrote SQL queries to pull order data for the finance team",
    "Learning Python through an online course, expected to finish in December 2026",
    "Languages: English (fluent), German (B1)",
    "BSc Business Administration, 2018",
  ],
  skills: [
    {
      kind: "have",
      skillId: "excel",
      evidence: {
        line: 3,
        text: "Built weekly stock reports in Excel with pivot tables and lookups",
      },
    },
    {
      kind: "have",
      skillId: "sql",
      evidence: {
        line: 4,
        text: "Wrote SQL queries to pull order data for the finance team",
      },
    },
    { kind: "inProgress", skillId: "python", expectedDate: "2026-12-20" },
  ],
  constraints: {
    languages: [
      { code: "en", level: "C1" },
      { code: "de", level: "B1" },
    ],
    locations: ["Berlin"],
    workModes: ["onsite", "hybrid"],
    years: 5,
    availableFrom: "2026-12-01",
  },
};

// Marketing graduate. Canva was added by hand and ties to no CV line, so the
// engine must never count it as met.
const jonas: Profile = {
  id: "jonas",
  name: "Jonas Sample",
  cvLines: [
    "Jonas Sample, Marketing graduate, Hamburg",
    "BA Communication and Media, 2025",
    "Marketing intern, Example Studio, 2024: ran the studio's Instagram and LinkedIn accounts",
    "Improved blog pages for search with keyword research (SEO) and tracked results in a spreadsheet",
    "Used Excel to compare campaign results",
    "Languages: German (native), English (B2)",
  ],
  skills: [
    {
      kind: "have",
      skillId: "social-media",
      evidence: {
        line: 3,
        text: "Marketing intern, Example Studio, 2024: ran the studio's Instagram and LinkedIn accounts",
      },
    },
    {
      kind: "have",
      skillId: "seo",
      evidence: {
        line: 4,
        text: "Improved blog pages for search with keyword research (SEO) and tracked results in a spreadsheet",
      },
    },
    {
      kind: "have",
      skillId: "excel",
      evidence: { line: 5, text: "Used Excel to compare campaign results" },
    },
    { kind: "have", skillId: "canva", evidence: null },
  ],
  constraints: {
    languages: [
      { code: "de", level: "C2" },
      { code: "en", level: "B2" },
    ],
    locations: ["Hamburg", "Berlin"],
    workModes: ["onsite", "hybrid", "remote"],
    years: 1,
    availableFrom: "2026-09-01",
  },
};

// Junior developer: TypeScript, React and Git from a degree, SQL on the way.
const ana: Profile = {
  id: "ana",
  name: "Ana Placeholder",
  cvLines: [
    "Ana Placeholder, Junior developer, Leipzig",
    "BSc Computer Science, 2024",
    "Built a booking web app with React and TypeScript for a university project",
    "Used Git and GitHub for all team work, including pull requests and code review",
    "Learning SQL databases through a course, exam planned for January 2027",
    "Languages: English (C1), German (A2)",
  ],
  skills: [
    {
      kind: "have",
      skillId: "react",
      evidence: {
        line: 3,
        text: "Built a booking web app with React and TypeScript for a university project",
      },
    },
    {
      kind: "have",
      skillId: "typescript",
      evidence: {
        line: 3,
        text: "Built a booking web app with React and TypeScript for a university project",
      },
    },
    {
      kind: "have",
      skillId: "git",
      evidence: {
        line: 4,
        text: "Used Git and GitHub for all team work, including pull requests and code review",
      },
    },
    { kind: "inProgress", skillId: "sql", expectedDate: "2027-01-31" },
  ],
  constraints: {
    languages: [
      { code: "en", level: "C1" },
      { code: "de", level: "A2" },
    ],
    locations: ["Leipzig", "Berlin"],
    workModes: ["remote", "hybrid"],
    years: 1,
    availableFrom: "2026-12-15",
  },
};

// Operations analyst in Manchester who fits Northwind well. She lists
// Bengaluru among the cities she can work in (open to relocating), so the
// Brightwater pairing is decided by skills alone and reaches Stretch.
const sam: Profile = {
  id: "sam",
  name: "Sam Example",
  cvLines: [
    "Sam Example, Operations Analyst, Manchester",
    "2020-2026 Operations Analyst, Sample Freight Ltd",
    "Wrote SQL queries on delivery and warehouse data for weekly performance reviews",
    "Built Excel models with pivot tables and lookups to track depot costs",
    "Built Power BI dashboards for the operations managers",
    "Presented weekly findings to non-technical depot managers",
    "Languages: English (native)",
    "BSc Logistics Management, 2019",
  ],
  skills: [
    {
      kind: "have",
      skillId: "sql",
      evidence: {
        line: 3,
        text: "Wrote SQL queries on delivery and warehouse data for weekly performance reviews",
      },
    },
    {
      kind: "have",
      skillId: "excel",
      evidence: {
        line: 4,
        text: "Built Excel models with pivot tables and lookups to track depot costs",
      },
    },
    {
      kind: "have",
      skillId: "power-bi",
      evidence: {
        line: 5,
        text: "Built Power BI dashboards for the operations managers",
      },
    },
    {
      kind: "have",
      skillId: "communication",
      evidence: {
        line: 6,
        text: "Presented weekly findings to non-technical depot managers",
      },
    },
  ],
  constraints: {
    languages: [{ code: "en", level: "C2" }],
    locations: ["Manchester", "Bengaluru"],
    workModes: ["onsite", "hybrid"],
    years: 6,
    availableFrom: "2026-12-01",
  },
};

// Finance analyst in Bengaluru: planning and modelling, but no Power BI.
const ravi: Profile = {
  id: "ravi",
  name: "Ravi Demo",
  cvLines: [
    "Ravi Demo, Finance Analyst, Bengaluru",
    "2023-2026 Finance Analyst, Sample Lending Pvt Ltd",
    "Prepared annual budgets and quarterly forecasts for three business units",
    "Built financial models in Excel for loan portfolio forecasting and scenario analysis",
    "Languages: English (good), Hindi (native), Kannada (native)",
    "B.Com Finance, 2022",
  ],
  skills: [
    {
      kind: "have",
      skillId: "financial-planning",
      evidence: {
        line: 3,
        text: "Prepared annual budgets and quarterly forecasts for three business units",
      },
    },
    {
      kind: "have",
      skillId: "financial-modelling",
      evidence: {
        line: 4,
        text: "Built financial models in Excel for loan portfolio forecasting and scenario analysis",
      },
    },
    {
      kind: "have",
      skillId: "excel",
      evidence: {
        line: 4,
        text: "Built financial models in Excel for loan portfolio forecasting and scenario analysis",
      },
    },
  ],
  constraints: {
    languages: [
      { code: "en", level: "B2" },
      { code: "hi", level: "C2" },
      { code: "kn", level: "C2" },
    ],
    locations: ["Bengaluru"],
    workModes: ["onsite", "hybrid"],
    years: 3,
    availableFrom: "2026-12-15",
  },
};

// Senior developer who works remotely and fits Fjordlight well.
const lena: Profile = {
  id: "lena",
  name: "Lena Mock",
  cvLines: [
    "Lena Mock, Senior Frontend Developer, Lisbon",
    "2018-2026 Frontend Developer, then Senior Frontend Developer, Sample Cloud Software",
    "Led development of a scheduling web app in React and TypeScript used by 40 clinics",
    "Reviewed pull requests daily and managed team work in Git",
    "Wrote unit tests for the app with Vitest",
    "Languages: English (C1), Portuguese (native)",
  ],
  skills: [
    {
      kind: "have",
      skillId: "react",
      evidence: {
        line: 3,
        text: "Led development of a scheduling web app in React and TypeScript used by 40 clinics",
      },
    },
    {
      kind: "have",
      skillId: "typescript",
      evidence: {
        line: 3,
        text: "Led development of a scheduling web app in React and TypeScript used by 40 clinics",
      },
    },
    {
      kind: "have",
      skillId: "git",
      evidence: {
        line: 4,
        text: "Reviewed pull requests daily and managed team work in Git",
      },
    },
    {
      kind: "have",
      skillId: "vitest",
      evidence: { line: 5, text: "Wrote unit tests for the app with Vitest" },
    },
  ],
  constraints: {
    languages: [
      { code: "en", level: "C1" },
      { code: "pt", level: "C2" },
    ],
    locations: ["Lisbon"],
    workModes: ["remote"],
    years: 8,
    availableFrom: "2026-12-01",
  },
};

export const profiles: Profile[] = [maya, jonas, ana, sam, ravi, lena];
