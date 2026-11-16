import { describe, expect, it, vi } from "vitest";

// Order, not only outcome: a name flagged as not-a-skill is never given to stage 2. closeMatch has a guard of its own,
// so the outcome would be the same even if the order were wrong; this test counts the calls instead.

const seen: string[] = [];
vi.mock("@/lib/engine/closeSpelling", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine/closeSpelling")>();
  return { ...actual, closeMatch: (name: string, skills: Parameters<typeof actual.closeMatch>[1]) => (seen.push(name), actual.closeMatch(name, skills)) };
});

import { skills } from "@/fixtures/skills";
import { buildJob } from "@/lib/engine/fromAd";
import { fromCv } from "@/lib/engine/fromCv";

const FLAGGED = ["Personal development", "data analyst experience", "product analyst experience", "team player"];
const AD = "Personal development.\nData analyst experience.\nProduct analyst experience.\nA team player.\nErfahrung mit Experimenten.";
const CV = ["Personal development", "Data analyst experience", "Product analyst experience", "A team player", "Leitete Experimenten"];
const empty = { title: null, company: null, location: null, workMode: null, minYears: null, startDate: null, languages: [], otherConditions: [], requirements: [] };

describe("e: the not-a-skill flag comes before stage 2", () => {
  it("O1 (ad): closeMatch is called for 'Experimenten' and for no flagged name", () => {
    seen.length = 0;
    buildJob(
      { ...empty, requirements: [
        { quote: "Personal development.", importance: "must", skills: [{ name: FLAGGED[0] }] },
        { quote: "Data analyst experience.", importance: "must", skills: [{ name: FLAGGED[1] }] },
        { quote: "Product analyst experience.", importance: "must", skills: [{ name: FLAGGED[2] }] },
        { quote: "A team player.", importance: "must", skills: [{ name: FLAGGED[3] }] },
        { quote: "Erfahrung mit Experimenten.", importance: "must", skills: [{ name: "Experimenten" }] },
      ] },
      AD, skills, { id: "t", source: null },
    );
    expect(seen).toEqual(["Experimenten"]);
  });

  it("O2 (CV): closeMatch is called for 'Experimenten' and for no flagged name", () => {
    seen.length = 0;
    fromCv(
      { skills: [
        { name: FLAGGED[0], line: 1, quote: "Personal development" },
        { name: FLAGGED[1], line: 2, quote: "Data analyst experience" },
        { name: FLAGGED[2], line: 3, quote: "Product analyst experience" },
        { name: FLAGGED[3], line: 4, quote: "team player" },
        { name: "Experimenten", line: 5, quote: "Leitete Experimenten" },
      ] },
      CV, skills,
    );
    expect(seen).toEqual(["Experimenten"]);
  });
});
