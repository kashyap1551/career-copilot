import { describe, expect, it } from "vitest";
import { lindenbergAdText } from "@/fixtures/synthetic-ad-texts";
import { skills } from "@/fixtures/skills";
import { buildJob } from "@/lib/engine/fromAd";
import type { ExtractedAd } from "@/lib/schemas/job";

// The German and English stress ad (a synthetic ad, see docs/DECISIONS.md).
// The "AI output" is hand-written, including one thing a model may well do
// against its instructions: it gives the two cities as the location. The
// expected results below were worked out by hand from the conversion table in
// docs/PLAN-3.1.md before the real AI was run on this ad.

const req = (quote: string, importance: "must" | "nice", ...names: string[]) => ({
  quote,
  importance,
  skills: names.map((name) => ({ name })),
});

const reading: ExtractedAd = {
  title: "Product Analyst (m/w/d)",
  company: "Lindenberg Mobility GmbH",
  location: "München oder Hamburg",
  workMode: { value: "hybrid", quote: "We work hybrid: two days a week in the office." },
  minYears: { years: 3, quote: "Mindestens drei Jahre Erfahrung in einer Analytics- oder Data-Rolle." },
  startDate: { date: "2027-04-01", quote: "Start: ab 1. April 2027, or earlier by arrangement." },
  languages: [
    { language: "German", levelWording: "Fließend", quote: "Fließend Deutsch und gutes Englisch." },
    { language: "English", levelWording: "gutes", quote: "Fließend Deutsch und gutes Englisch." },
  ],
  otherConditions: [
    { quote: "you need a valid work permit for Germany" },
    // The AI writes a straight apostrophe; the ad has a curly one.
    { quote: "A Bachelor's degree in a quantitative field (statistics, economics) is expected." },
  ],
  requirements: [
    req("Sehr gute SQL-Kenntnisse", "must", "SQL"),
    req("Python or R is a plus.", "nice", "Python", "R"),
    req("Experience with A/B testing and product metrics (retention, funnels).", "must", "A/B testing"),
    req("Experience with A/B testing and product metrics (retention, funnels).", "must", "Product metrics"),
    req("Erfahrung mit Mixpanel oder Amplitude.", "must", "Mixpanel", "Amplitude"),
    req("Strong communication skills: you explain results to non-technical colleagues.", "must", "Communication"),
    req("Tableau or Looker dashboards.", "nice", "Tableau", "Looker"),
    req("Basic knowledge of dbt.", "nice", "dbt"),
  ],
};

describe("the German and English stress ad", () => {
  const r = buildJob(reading, lindenbergAdText, skills, { id: "lindenberg", source: "synthetic sample" });
  const c = r.job.constraints;

  it("title and company are in the ad and kept", () => {
    expect(r.job.title).toBe("Product Analyst (m/w/d)");
    expect(r.job.company).toBe("Lindenberg Mobility GmbH");
  });

  it("two cities: location null, and the text goes to 'check this yourself'", () => {
    expect(c.location).toBeNull();
    expect(r.removed.map((x) => `${x.what}:${x.why}`)).toEqual(["location:several-cities"]);
    expect(r.moved).toEqual([{ from: "location", quote: "München oder Hamburg" }]);
  });

  it("hybrid, 3 years from the word 'drei', and the date 'ab 1. April 2027'", () => {
    expect(c.remote).toBe("hybrid");
    expect(c.minYears).toBe(3);
    expect(c.startDate).toBe("2027-04-01");
  });

  it("German 'Fließend' is C1 and 'gutes' is B2 (the endings table of step 3.2a)", () => {
    // From the wording table: gut with the ending es is B2, fließend is C1.
    expect(c.languages).toEqual([
      { code: "de", level: "C1" },
      { code: "en", level: "B2" },
    ]);
  });

  it("conditions: the AI's two (the curly apostrophe matches), then the moved cities", () => {
    expect(c.otherConditions.map((x) => x.quote)).toEqual([
      "you need a valid work permit for Germany",
      "A Bachelor's degree in a quantitative field (statistics, economics) is expected.",
      "München oder Hamburg",
    ]);
  });

  it("requirements: 'and' split, 'or' kept together, listed skills get listed ids", () => {
    expect(r.job.requirements.map((q) => [q.skillIds, q.importance])).toEqual([
      [["sql"], "must"],
      [["python", "new:r"], "nice"],
      [["new:a-b-testing"], "must"],
      [["new:product-metrics"], "must"],
      [["new:mixpanel", "new:amplitude"], "must"],
      [["communication"], "must"],
      [["tableau", "new:looker"], "nice"],
      [["new:dbt"], "nice"],
    ]);
  });

  it("the unlisted skills, in the order they first appear", () => {
    expect(r.unlisted).toEqual([
      { id: "new:r", name: "R" },
      { id: "new:a-b-testing", name: "A/B testing" },
      { id: "new:product-metrics", name: "Product metrics" },
      { id: "new:mixpanel", name: "Mixpanel" },
      { id: "new:amplitude", name: "Amplitude" },
      { id: "new:looker", name: "Looker" },
      { id: "new:dbt", name: "dbt" },
    ]);
  });
});
