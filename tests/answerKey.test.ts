import { describe, expect, it } from "vitest";
import { checkKey, type AnswerKey } from "@/lib/engine/answerKey";

// The key checks of section 3 in docs/PLAN-3.2.md: every quote must be in
// its ad, and the values must be well formed. Problems name the place, never
// the text, so a holdout key cannot leak through them.

const ad = `Data Analyst
Acme GmbH, Berlin

You have 3 years of experience. Hybrid work, two days a week.
Strong SQL; Python or R is a plus. Fluent German.
A degree is required. Start: 1 April 2027.`;

const good: AnswerKey = {
  ad: "ad-x",
  status: "reviewed",
  title: "Data Analyst",
  company: "Acme GmbH",
  location: "Berlin",
  workMode: { value: "hybrid", quote: "Hybrid work, two days a week." },
  minYears: { years: 3, quote: "3 years of experience" },
  startDate: { date: "2027-04-01", quote: "Start: 1 April 2027." },
  languages: [{ code: "de", level: "C1", quote: "Fluent German." }],
  otherConditions: [{ quote: "A degree is required." }],
  requirements: [
    { quote: "Strong SQL", importance: "must", skills: ["SQL"] },
    { quote: "Python or R is a plus.", importance: "nice", skills: ["Python", "R"] },
  ],
  acceptedExtras: [{ quote: "two days a week" }],
};

const problems = (k: AnswerKey) => checkKey(k, ad).map((p) => p.where);

describe("checkKey", () => {
  it("a good key has no problems", () => {
    expect(checkKey(good, ad)).toEqual([]);
  });

  it("a quote that is not in the ad is a problem, named by place only", () => {
    const bad = { ...good, requirements: [{ quote: "Five years of Kubernetes", importance: "must" as const, skills: ["Kubernetes"] }] };
    const found = checkKey(bad, ad);
    expect(found.map((p) => p.where)).toEqual(["requirements[0]"]);
    expect(JSON.stringify(found)).not.toContain("Kubernetes");
  });

  it("title, company and location must be in the ad", () => {
    expect(problems({ ...good, title: "Chief Wizard" })).toEqual(["title"]);
    expect(problems({ ...good, company: "Globex" })).toEqual(["company"]);
    expect(problems({ ...good, location: "Paris" })).toEqual(["location"]);
  });

  it("a requirement needs at least one real skill name", () => {
    expect(problems({ ...good, requirements: [{ quote: "Strong SQL", importance: "must", skills: [] }] })).toEqual(["requirements[0]"]);
    expect(problems({ ...good, requirements: [{ quote: "Strong SQL", importance: "must", skills: [" "] }] })).toEqual(["requirements[0]"]);
  });

  it("years must be between 0 and 50, and in their quote", () => {
    expect(problems({ ...good, minYears: { years: 60, quote: "3 years of experience" } })).toEqual(["minYears"]);
    expect(problems({ ...good, minYears: { years: 5, quote: "3 years of experience" } })).toEqual(["minYears"]);
  });

  it("a start date must be one of the dates in its quote", () => {
    expect(problems({ ...good, startDate: { date: "2027-04-02", quote: "Start: 1 April 2027." } })).toEqual(["startDate"]);
    expect(problems({ ...good, startDate: { date: "2027-04-01", quote: "A degree is required." } })).toEqual(["startDate"]);
  });

  it("a language needs a two-letter code and a valid level", () => {
    expect(problems({ ...good, languages: [{ code: "german", level: "C1", quote: "Fluent German." }] })).toEqual(["languages[0]"]);
    expect(problems({ ...good, languages: [{ code: "de", level: "C3" as never, quote: "Fluent German." }] })).toEqual(["languages[0]"]);
    expect(problems({ ...good, languages: [{ code: "de", level: null, quote: "Fluent German." }] })).toEqual([]);
  });

  it("conditions and accepted extras must be in the ad too", () => {
    expect(problems({ ...good, otherConditions: [{ quote: "Must own a boat." }] })).toEqual(["otherConditions[0]"]);
    expect(problems({ ...good, acceptedExtras: [{ quote: "Must own a boat." }] })).toEqual(["acceptedExtras[0]"]);
  });

  it("the status must be draft or reviewed", () => {
    expect(problems({ ...good, status: "done" as never })).toEqual(["status"]);
  });

  it("a key may be all null and empty", () => {
    const empty: AnswerKey = { ...good, title: null, company: null, location: null, workMode: null, minYears: null, startDate: null, languages: [], otherConditions: [], requirements: [], acceptedExtras: [] };
    expect(checkKey(empty, ad)).toEqual([]);
  });
});
