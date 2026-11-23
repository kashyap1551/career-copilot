import type { CvKey } from "../../lib/engine/cvKey";

// Made-up CV for the bullets eval (docs/PLAN-8.3.md amendment 0.30): every name, employer, number, email and phone is invented. Raw text, with the contact line as
// written; the page removes the contact details and numbers the lines. Written without running any checker on it.
export const text = `Morgan Imaginary, Quality Officer, Nowhereton
morgan.imaginary@example.com | 0113 555 0187
2017-2024 Quality Officer, Specimen Foods Ltd
Carried out internal audits against ISO 9001 in 6 production areas each year
Wrote and updated work instructions and kept the document register up to date
Investigated customer complaints and found the root cause with the line managers
Assisted the manager with the risk assessments for new equipment
Trained new staff on quality checks
Reported non-conformities and tracked the corrective actions until they were closed and sent a monthly summary to the plant director
Supported the process improvement team on a project that cut waste on the packing line
Studying for the ISO 14001 lead auditor exam
Languages: English (native), Polish (B2)
`;

export const key: CvKey = {
  cv: "cv-7-quality",
  status: "reviewed",
  lineCount: 12,
  injectionLines: [],
  trapLines: [],
  items: [
    { line: 4, names: ["ISO 9001"], label: "named" },
    { line: 4, names: ["Audits", "Internal audits", "Auditing"], label: "named" },
    { line: 5, names: ["Documentation", "Document control", "Work instructions"], label: "inferred" },
    { line: 6, names: ["Root cause analysis", "Root cause investigation"], label: "inferred" },
    { line: 7, names: ["Risk assessment", "Risk assessments"], label: "inferred" },
    { line: 8, names: ["Training", "Staff training"], label: "inferred" },
    { line: 8, names: ["Quality assurance", "Quality control"], label: "inferred" },
    { line: 9, names: ["Deviation assessment", "Non-conformity handling", "Corrective actions"], label: "inferred" },
    { line: 10, names: ["Process improvement", "Continuous improvement"], label: "named" },
    { line: 11, names: ["ISO 14001"], label: "named" },
  ],
};
