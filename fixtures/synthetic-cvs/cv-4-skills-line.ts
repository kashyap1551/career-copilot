import type { CvKey } from "../../lib/engine/cvKey";

// Made-up CV: every name, employer, number, email and phone is invented
// (docs/PLAN-4.2-cvs.md). Raw text, with the contact line as written.
export const text = `Taylor Placeholder, Software Developer, Sampleburg
taylor.placeholder@example.com | +353 1 555 0188
Skills: TypeScript, React, Git, Jest, accessibility
2022-2025 Frontend Developer, Fictional Apps Ltd
Built the checkout screens in React for a shop used by 10,000 customers
Reviewed pull requests and wrote unit tests with Jest
Languages: English (fluent), Irish (B2)
`;

export const key: CvKey = {
  cv: "cv-4-skills-line",
  status: "reviewed",
  lineCount: 7,
  injectionLines: [],
  trapLines: [],
  items: [
    { line: 3, names: ["TypeScript"], label: "named" },
    { line: 3, names: ["React"], label: "named" },
    { line: 3, names: ["Git"], label: "named" },
    { line: 3, names: ["Jest"], label: "named" },
    { line: 3, names: ["Accessibility"], label: "named" },
    { line: 5, names: ["React"], label: "named" },
    { line: 5, names: ["Frontend development", "Front-end development", "Web development", "UI development"], label: "inferred" },
    { line: 5, names: ["E-commerce", "Ecommerce", "Online shop development"], label: "inferred" },
    { line: 6, names: ["Jest"], label: "named" },
    { line: 6, names: ["Git", "Pull requests"], label: "inferred" },
    { line: 6, names: ["Unit testing", "Testing"], label: "inferred" },
    { line: 6, names: ["Code review", "Reviewing code"], label: "inferred" },
  ],
};
