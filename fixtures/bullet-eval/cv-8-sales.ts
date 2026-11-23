import type { CvKey } from "../../lib/engine/cvKey";

// Made-up CV for the bullets eval (docs/PLAN-8.3.md amendment 0.30): every name, employer, number, email and phone is invented. Raw text, with the contact line as
// written; the page removes the contact details and numbers the lines. Written without running any checker on it. Line 11 is a skills list.
export const text = `Jordan Fabricated, Sales Executive, Pretendford
jordan.fabricated@example.com | 020 7946 0555
2018-2024 Sales Executive, Sample Office Supplies Ltd
Managed a portfolio of 40 business customers and visited the largest ones every quarter
Made about 30 cold calls a day to find new customers
Mostly worked out prices and quotes for renewals and new customers
Negotiated yearly contracts worth up to 50,000 euros
Logged every call and deal in Salesforce and kept the pipeline up to date
Gave product demos to prospects
Helped the marketing team plan campaigns, write the emails and follow up with the leads we received from trade shows and webinars
Skills: LinkedIn Sales Navigator, Excel, Pipedrive, negotiation, account management
Currently learning HubSpot in an evening course
`;

export const key: CvKey = {
  cv: "cv-8-sales",
  status: "reviewed",
  lineCount: 12,
  injectionLines: [],
  trapLines: [],
  items: [
    { line: 4, names: ["Account management", "Key account management"], label: "inferred" },
    { line: 4, names: ["Relationship management", "Customer relationships"], label: "inferred" },
    { line: 5, names: ["Cold calling", "Outbound calls"], label: "inferred" },
    { line: 5, names: ["Lead generation", "Prospecting"], label: "inferred" },
    { line: 6, names: ["Pricing", "Quoting"], label: "inferred" },
    { line: 7, names: ["Negotiation", "Contract negotiation"], label: "inferred" },
    { line: 8, names: ["Salesforce"], label: "named" },
    { line: 8, names: ["CRM systems", "CRM"], label: "inferred" },
    { line: 9, names: ["Pre-sales", "Product demos"], label: "inferred" },
    { line: 10, names: ["Email outreach", "Outreach emails"], label: "inferred" },
    { line: 11, names: ["LinkedIn Sales Navigator"], label: "named" },
    { line: 11, names: ["Excel"], label: "named" },
    { line: 11, names: ["Pipedrive"], label: "named" },
    { line: 11, names: ["Negotiation"], label: "named" },
    { line: 11, names: ["Account management"], label: "named" },
    { line: 12, names: ["HubSpot"], label: "named" },
  ],
};
