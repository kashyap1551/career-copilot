import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { scoreAd } from "@/lib/engine/evalScore";
import { sameCompany } from "@/lib/engine/companyMatch";
import type { AnswerKey } from "@/lib/engine/answerKey";

// Step 3.3 part 3a. The rule, worked out by hand before the code:
//   1. Fold both names (case, accents), cut out bracketed text, and split into
//      words (letters and digits only, so "Inc." is "inc").
//   2. Right when the word lists are equal, OR when one list starts with the
//      other (a whole-word start, never a part of a word) and every extra word
//      is a legal form or qualifier: gmbh ag se inc ltd llc plc kg holding
//      group germany.
//   3. Anything else is wrong: other words ("Schwab", "Labs", "Global
//      Transport and Logistics"), other legal forms in place of each other, or
//      a name that only starts the same letters ("DSV" and "DSVX").

const table: [string, string, string, boolean][] = [
  // id, key, AI, right?
  ["c1", "DSV", "DSV Holding Germany GmbH (Group)", true], // the ad-07 case
  ["c2", "4flow SE", "4flow", true], // the key carries the legal form
  ["c3", "4flow", "4flow SE", true],
  ["c4", "Flexport", "Flexport Inc.", true], // the dot is dropped
  ["c5", "Charles", "Charles Schwab", false], // "Schwab" is a name, not a qualifier
  ["c6", "DSV", "DSVX", false], // not a whole-word start
  ["c7", "Apple", "Pineapple", false], // the other name does not start the same
  ["c8", "Acme", "Acme – Global Parcel Services", false], // a name plus a tagline: descriptor words are not qualifiers
  ["c9", "Acme", "ACME", true], // case
  ["c10", "Café Müller", "Cafe Muller GmbH", true], // accents
  ["c11", "Acme GmbH", "Acme GmbH", true], // equal
  ["c12", "Acme AG", "Acme GmbH", false], // two different legal forms: not a prefix of each other
  ["c13", "Acme", "Acme Group Holding", true], // several qualifiers
  ["c14", "Acme", "Acme Labs", false],
  ["c15", "Acme (Berlin)", "Acme", true], // bracketed text on the key side
  ["c16", "Acme", "The Acme", false], // starts earlier, not a prefix
  ["c17", "Coca-Cola", "Coca", false], // hyphen splits words; "cola" is not a qualifier
  ["c18", "DSV", "DSV Germany", true],
  ["c19", "Acme Plc", "Acme KG", false],
  ["c20", "Acme", "Acme Ltd. (UK)", true], // dot and brackets
  ["c21", "Acme", "Acme Holding Berlin", false], // "Berlin" is not on the list
];

describe("sameCompany", () => {
  it.each(table)("%s: %j vs %j -> %s", (_id, key, ai, right) => {
    expect(sameCompany(key, ai)).toBe(right);
  });

  it("is the same both ways round when the extra words are all qualifiers", () => {
    expect(sameCompany("DSV Holding Germany GmbH (Group)", "DSV")).toBe(true);
  });

  it("two names with no words left after cleaning are equal only if the text is equal", () => {
    expect(sameCompany("(Group)", "(Group)")).toBe(true);
    expect(sameCompany("(Group)", "(Holding)")).toBe(false);
  });
});

const keyWith = (company: string | null): AnswerKey => ({
  ad: "ad-x", status: "reviewed", title: null, company, location: null, workMode: null,
  minYears: null, startDate: null, languages: [], otherConditions: [], requirements: [], acceptedExtras: [],
});
const resultWith = (company: string | null) => ({
  job: {
    id: "x", title: "Untitled job", company, source: null,
    constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
    requirements: [],
  },
  removed: [], moved: [], unlisted: [],
});

describe("company verdict in scoreAd", () => {
  const verdict = (k: string | null, ai: string | null) => scoreAd(keyWith(k), resultWith(ai), skills).constraints.fields.company;
  it("right for a legal-form difference, wrong for a different name", () => {
    expect(verdict("DSV", "DSV Holding Germany GmbH (Group)")).toBe("right");
    expect(verdict("Charles", "Charles Schwab")).toBe("wrong");
  });
  it("still notStated, missed and invented as before", () => {
    expect(verdict(null, null)).toBe("notStated");
    expect(verdict("DSV", null)).toBe("missed");
    expect(verdict(null, "DSV")).toBe("invented");
  });
});
