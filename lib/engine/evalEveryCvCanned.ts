import { buildJob } from "./fromAd";
import { fromCv, type CvBuildResult } from "./fromCv";
import type { AdReading } from "./evalEveryCvCompare";
import type { Skill } from "./types";

// The readings the DRY mode uses (npm run every-cv:baseline -- --dry): invented, for the EXAMPLE pair only (fixtures/every-cv/example,
// "EXAMPLE ONLY, format demonstration, never sent to an AI"). They are what an AI reading of that tiny pair could look like, and they go
// through the real checks (fromCv, buildJob), so the report has its real layout. They are not a measurement of anything.

export function cannedExampleReadings(cvLines: string[], adText: string, skills: Skill[]): { cv: CvBuildResult; ad: AdReading } {
  const cv = fromCv(
    {
      skills: [
        { name: "Customer service", line: 3, quote: "served customers at the counter" },
        { name: "Cash handling", line: 4, quote: "Handled cash and card payments" },
        { name: "Bookkeeping", line: 5, quote: "Evening course in bookkeeping" },
        { name: "Bread shaping", line: 6, quote: "bread shaping" },
      ],
    },
    cvLines,
    skills,
  );
  const ad = buildJob(
    {
      title: "Shop Assistant",
      company: "Silverbrook Delicatessen",
      location: null,
      workMode: null,
      minYears: null,
      startDate: null,
      languages: [],
      otherConditions: [],
      requirements: [
        { quote: "Experience serving customers in a bakery or shop.", importance: "must", skills: [{ name: "Customer service" }] },
        { quote: "At least two years of experience training new team members.", importance: "must", skills: [{ name: "Training" }] },
        { quote: "A valid food-hygiene certificate.", importance: "must", skills: [{ name: "Food hygiene certificate" }] },
      ],
    },
    adText,
    skills,
    { id: "pasted-ad", source: null },
  );
  return { cv, ad };
}
