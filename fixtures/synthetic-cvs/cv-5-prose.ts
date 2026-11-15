import type { CvKey } from "../../lib/engine/cvKey";

// Made-up CV: every name, employer, number, email and phone is invented
// (docs/PLAN-4.2-cvs.md). Raw text, with the contact line as written.
export const text = `Casey Invented, Operations Coordinator, Faketon
casey.invented@example.com | 0151 555 0166
2019-2024 Operations Coordinator, Pretend Logistics Ltd
Planned the weekly delivery rota for 15 drivers and kept it up to date
Compared supplier invoices with orders and chased the differences
Wrote a short guide for new starters and trained 6 of them
Looked after the team's shared spreadsheets and set up the monthly cost summary
Languages: English (native), French (A2)
`;

export const key: CvKey = {
  cv: "cv-5-prose",
  status: "reviewed",
  lineCount: 8,
  injectionLines: [],
  trapLines: [],
  items: [
    { line: 4, names: ["Scheduling", "Rota planning", "Planning", "Shift planning", "Staff scheduling"], label: "inferred" },
    { line: 4, names: ["Delivery planning", "Logistics", "Dispatch planning", "Route planning"], label: "inferred" },
    { line: 5, names: ["Invoice checking", "Invoice reconciliation", "Reconciliation", "Invoice matching", "Order matching"], label: "inferred" },
    { line: 6, names: ["Documentation", "Technical writing", "Writing guides"], label: "inferred" },
    { line: 6, names: ["Training", "Onboarding", "Coaching"], label: "inferred" },
    { line: 7, names: ["Spreadsheets", "Spreadsheet management"], label: "named" },
    { line: 7, names: ["Cost reporting", "Reporting", "Cost tracking"], label: "inferred" },
  ],
};
