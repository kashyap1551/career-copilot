import type { ExtractedCv } from "@/lib/schemas/cv";
import type { ExtractedAd } from "@/lib/schemas/job";

// The invented material of the demo (docs/PLAN-9.1.md sections 2.2 and 3, amendment A4). Everything here is made up: the
// person, the CV, the ten companies and the ten ads. What is bundled is what the AI would return for them, in the shape the
// AI returns (`ExtractedCv`, `ExtractedAd`): lib/demo/start.ts runs it through the same two builders the live routes use.

// The CV (the one of docs/MANUAL-CHECK-6.2.md), eight lines, no contact line. Line 3 is SQL, 4 Tableau, 5 Excel.
export const DEMO_CV_LINES: string[] = [
  "Alex Example, Reporting Analyst, Exampleville",
  "2022-2025 Reporting Analyst, Imaginary Logistics Ltd",
  "Wrote SQL queries to reconcile order data",
  "Built monthly dashboards in Tableau",
  "Kept the weekly sales sheet in Excel",
  "2020-2022 Junior Assistant, Pretend Bakery Ltd",
  "Answered customer questions and kept the stock list up to date",
  "Languages: English (native), German (B2)",
];

export const DEMO_EXTRACTED_CV: ExtractedCv = {
  skills: [
    { name: "SQL", line: 3, quote: "Wrote SQL queries" },
    { name: "Tableau", line: 4, quote: "dashboards in Tableau" },
    { name: "Excel", line: 5, quote: "weekly sales sheet in Excel" },
  ],
};

export type DemoAd = { title: string; company: string; text: string; extraction: ExtractedAd };

// The ten ads, in the order of amendment A4. `musts` and `nices` are the skill names as the ad writes them. Each ad names its
// requirements in its own words ("SQL is required.", "Excel is a plus."), and each reading quotes exactly those words.
const SPECS: { title: string; company: string; city: string; musts: string[]; nices: string[]; duty: string }[] = [
  { title: "Insight Analyst", company: "Quillon Foods Ltd", city: "Berlin", musts: ["SQL", "Tableau"], nices: ["Excel"],
    duty: "You turn the weekly sales figures into a short report for the management team." },
  { title: "Records Clerk", company: "Marrowby Freight Ltd", city: "Berlin", musts: ["Excel"], nices: ["Python", "Power BI"],
    duty: "You keep the order records tidy and answer questions from the sales team." },
  { title: "Revenue Analyst", company: "Tarnbridge Mills Ltd", city: "Berlin", musts: ["SQL", "Excel"], nices: [],
    duty: "You study the monthly revenue and explain what changed and why." },
  { title: "BI Engineer", company: "Pellwick Print Ltd", city: "Berlin", musts: ["SQL", "Python"], nices: ["Tableau"],
    duty: "You build and maintain the reports the planning team uses every day." },
  { title: "Budget Analyst", company: "Ostrander Glass Ltd", city: "Berlin", musts: ["Excel", "Python"], nices: [],
    duty: "You prepare the budget sheets and follow the spending of each team." },
  { title: "Data Platform Engineer", company: "Fenwick Quarry Ltd", city: "Berlin", musts: ["SQL", "Python", "Power BI"], nices: [],
    duty: "You build the pipelines that bring our machine data into one place." },
  { title: "Dashboard Specialist", company: "Corvane Tools Ltd", city: "Berlin", musts: ["Power BI", "Tableau"], nices: ["SQL"],
    duty: "You design the dashboards the production managers look at each morning." },
  { title: "Management Reporting Lead", company: "Haldane Paper Ltd", city: "Berlin", musts: ["Power BI", "Excel"], nices: [],
    duty: "You lead the monthly reporting for the management board." },
  { title: "Site Coordinator", company: "Wexcombe Textiles Ltd", city: "Exampleville", musts: ["SQL", "Tableau"], nices: [],
    duty: "You coordinate the weekly output reports at our site and keep the schedule." },
  { title: "Campaign Analyst", company: "Yarrowdale Games Ltd", city: "Berlin", musts: ["Python", "Power BI"], nices: [],
    duty: "You measure how each campaign performs and report the results to the team." },
];

const WORK_MODE_QUOTE = "Hybrid, two days in the office";

function makeAd(s: (typeof SPECS)[number]): DemoAd {
  const required = (name: string) => `${name} is required.`;
  const plus = (name: string) => `${name} is a plus.`;
  const text = [
    s.title,
    `${s.company}, ${s.city}. ${WORK_MODE_QUOTE}.`,
    "",
    "About the role",
    s.duty,
    "",
    "What you bring",
    ...s.musts.map(required),
    ...s.nices.map(plus),
    "",
    "What we offer",
    "A friendly team, flexible hours and a quiet desk.",
  ].join("\n");
  const extraction: ExtractedAd = {
    title: s.title,
    company: s.company,
    location: s.city,
    workMode: { value: "hybrid", quote: WORK_MODE_QUOTE },
    minYears: null,
    startDate: null,
    languages: [],
    otherConditions: [],
    requirements: [
      ...s.musts.map((name) => ({ quote: required(name), importance: "must" as const, skills: [{ name }] })),
      ...s.nices.map((name) => ({ quote: plus(name), importance: "nice" as const, skills: [{ name }] })),
    ],
  };
  return { title: s.title, company: s.company, text, extraction };
}

export const DEMO_ADS: DemoAd[] = SPECS.map(makeAd);
