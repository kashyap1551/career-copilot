import { buildJob } from "@/lib/engine/fromAd";
import type { Job } from "@/lib/engine/types";
import type { ExtractedAd } from "@/lib/schemas/job";
import { skills } from "./roadmapFixtures";

// Not a test file. The same ten titles and companies as the ten invented ads of docs/MANUAL-CHECK-TEN-ADS.md (the duty lines below are this
// helper's own and affect no count), built by the REAL `buildJob` with the id the page's reader gives
// ("pasted-ad"), as the P0c test of tests/roadmapIds.test.ts does. Berlin, hybrid, must SQL only.
export const TEN: [string, string, string][] = [
  ["Report Clerk", "Alder Works Ltd", "You build the weekly report for the sales team."],
  ["Data Assistant", "Birch Yard Ltd", "You help the team keep its data tidy."],
  ["Sales Analyst", "Cedar Mill Ltd", "You look at monthly sales figures."],
  ["Finance Clerk", "Elm Court Ltd", "You check invoices against the ledger."],
  ["Stock Analyst", "Fern Dock Ltd", "You follow stock levels in the warehouse."],
  ["Billing Clerk", "Gorse Lane Ltd", "You prepare customer bills each month."],
  ["Order Analyst", "Heath Row Ltd", "You study how long orders take to arrive."],
  ["Ledger Clerk", "Ivy Gate Ltd", "You keep the books up to date."],
  ["Survey Assistant", "Juniper Hall Ltd", "You help prepare customer survey results."],
  ["Tally Clerk", "Larch Wharf Ltd", "You count and record deliveries."],
];
export const TEN_LABELS = TEN.map(([t, c]) => `${t}, ${c}`);
export const N10 = TEN_LABELS.join("; ");

export function tenJobs(): Job[] {
  return TEN.map(([title, company, duty]) => {
    const text = `${title}\n${company}, Berlin. Hybrid, two days in the office.\nSQL is required.\n${duty}`;
    const extraction: ExtractedAd = {
      title, company, location: "Berlin", workMode: { value: "hybrid", quote: "Hybrid" }, minYears: null, startDate: null,
      languages: [], otherConditions: [],
      requirements: [{ quote: "SQL is required.", importance: "must", skills: [{ name: "SQL" }] }],
    };
    return buildJob(extraction, text, skills, { id: "pasted-ad", source: null }).job;
  });
}
