// The must-not-merge groups of docs/VOCAB-REVIEW.md ("Must-not-merge pairs"), as skill ids. A name labelled with one
// member that is mapped to another member of the same group is a merge error: the 5.2 measure counts it and its line
// is 0. A test checks that this data equals the paragraph of the document.
export const MUST_NOT_MERGE: string[][] = [
  ["java", "javascript", "typescript"],
  ["c-language", "c-plus-plus", "c-sharp"],
  ["sql", "nosql", "mysql", "postgresql", "sql-server"],
  ["power-bi", "power-query", "business-intelligence", "looker"],
  ["excel", "spreadsheets", "google-sheets", "vba"],
  ["r-language", "rust"],
  ["git", "github"],
  ["react", "angular", "vuejs"],
  ["jest", "vitest"],
  ["docker", "kubernetes"],
  ["communication", "executive-communication", "stakeholder-management"],
  ["product-management", "project-management", "growth-product-management"],
  ["salesforce", "pardot"],
  ["email-marketing", "email-outreach"],
  ["reporting", "cost-reporting", "financial-reporting"],
  ["scrum", "agile", "kanban"],
  ["experimentation", "ab-testing"],
  ["iso-9001", "iso-14001", "iso-45001", "iso-50001", "iso-27001"],
];

// The last group of the document is Swift | the word "shift": a name that is the word "shift" must not become Swift.
export const MUST_NOT_MERGE_NAMES: { name: string; notId: string }[] = [{ name: "shift", notId: "swift" }];
