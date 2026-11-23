import type { CvKey } from "../../lib/engine/cvKey";

// Made-up CV for the bullets eval (docs/PLAN-8.3.md amendment 0.30): every name, employer, number, email and phone is invented. Raw text, with the contact line as
// written; the page removes the contact details and numbers the lines. Written without running any checker on it.
export const text = `Riley Fictional, Product Owner, Madeupton
riley.fictional@example.com | 0161 555 0142
2019-2024 Product Owner, Fabricated Apps Ltd
Wrote user stories and acceptance criteria for a team of 8 developers
Ran customer interviews every month and summarised what we heard
Helped the designers build clickable prototypes in Figma
Kept the backlog in Jira and agreed the order of work with the team each sprint
Ran A/B tests on sign-up pages
Presented the product roadmap and the release dates to senior stakeholders every quarter and answered their questions about priorities and risks
Defined the weekly product metrics and built a simple dashboard in Looker
Currently studying for a product analytics certificate in the evenings
Languages: English (native), Spanish (B1)
`;

export const key: CvKey = {
  cv: "cv-6-product",
  status: "reviewed",
  lineCount: 12,
  injectionLines: [],
  trapLines: [],
  items: [
    { line: 4, names: ["User stories"], label: "named" },
    { line: 4, names: ["Requirements gathering", "Writing requirements"], label: "inferred" },
    { line: 5, names: ["User interviews", "Customer interviews"], label: "inferred" },
    { line: 5, names: ["User research", "Customer research"], label: "inferred" },
    { line: 6, names: ["Prototyping", "Prototypes"], label: "inferred" },
    { line: 6, names: ["Figma"], label: "named" },
    { line: 7, names: ["Jira"], label: "named" },
    { line: 7, names: ["Backlog prioritisation", "Backlog management"], label: "inferred" },
    { line: 8, names: ["A/B testing", "Experimentation"], label: "inferred" },
    { line: 9, names: ["Product roadmapping", "Roadmap management"], label: "inferred" },
    { line: 9, names: ["Stakeholder management", "Stakeholder communication"], label: "inferred" },
    { line: 9, names: ["Presentation skills", "Presenting"], label: "inferred" },
    { line: 10, names: ["Metrics definition", "Defining metrics"], label: "inferred" },
    { line: 10, names: ["Dashboards", "Dashboard creation"], label: "inferred" },
    { line: 10, names: ["Looker"], label: "named" },
    { line: 11, names: ["Product analytics"], label: "named" },
  ],
};
