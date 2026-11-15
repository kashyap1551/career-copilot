import type { CvKey } from "../../lib/engine/cvKey";

// Made-up CV: every name, employer, number, email and phone is invented
// (docs/PLAN-4.2-cvs.md). Raw text, with the contact line as written.
export const text = `Sam Placeholder, Junior Assistant, Testville
sam.placeholder@example.com | +44 20 5550 0147
2023-2024 Office Assistant, Imaginary Bakery Ltd
Answered the phone and kept the stock sheet up to date in Excel
Helped customers at the counter
2022-2023 Weekend Helper, Pretend Garden Centre
Learning Excel formulas in an evening course
Languages: English (native)
`;

export const key: CvKey = {
  cv: "cv-1-thin",
  status: "reviewed",
  lineCount: 8,
  injectionLines: [],
  trapLines: [7],
  items: [
    { line: 4, names: ["Excel"], label: "named" },
    { line: 4, names: ["Inventory management", "Stock keeping", "Stock control", "Inventory"], label: "inferred" },
    { line: 4, names: ["Phone support", "Telephone support", "Customer service", "Customer support"], label: "inferred" },
    { line: 5, names: ["Customer service", "Customer support"], label: "inferred" },
  ],
};
