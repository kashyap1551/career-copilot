import { describe, expect, it } from "vitest";
import { checkBullet, type BulletReason } from "@/lib/engine/bulletCheck";
import { skills } from "@/lib/vocab";

// Step 8.3, stage 8b2, tests first (docs/PLAN-8.3.md amendment 0.34): two refinements of R11 `fragment`, both of which make it reject LESS.
//  (i)  check (c): a bullet word of at least two letters with NO lower-case letter (an acronym: IT, ER) is not a pronoun; "it", "It", "er", "Er" still are;
//  (ii) check (a) does not fire when the bullet starts at its (first) cited line's first word (the same test check (c) uses).
// Every verdict was worked out by hand (R1 to R10 in their order, then R11) BEFORE any code; none comes from running the code. Invented lines only; no AI.

const OK = { ok: true } as const;
const NO = (reason: BulletReason) => ({ ok: false, reason }) as const;
const check = (bullet: string, lines: string[], cited: number[] = [1]) => checkBullet(bullet, cited, { lines, vocabulary: skills });

describe("I: the two false rejects of stage 8b are gone", () => {
  it("I1: ACCEPT: 'IT' is an acronym, not the pronoun 'it' (R6: 'IT' has an inner capital and the line holds it)", () => {
    expect(check("IT support to the sales team", ["Gave IT support to the sales team and ordered new laptops"])).toEqual(OK);
  });
  it("I2: ACCEPT: 'ER' is an acronym, not the German pronoun 'er'", () => {
    expect(check("ER diagrams for the stock database", ["Drew ER diagrams for the stock database and the order list"])).toEqual(OK);
  });
  it("I3: ACCEPT: the whole line starts with 'In': it starts at the line's first word, so check (a) does not fire", () => {
    const line = "In 2023 moved the order list to a new spreadsheet";
    expect(check(line, [line])).toEqual(OK);
  });
});

describe("I: what must still be rejected", () => {
  it("I4: `fragment`: 'in 2023 to a new spreadsheet' starts mid-line on 'in'", () => {
    expect(check("in 2023 to a new spreadsheet", ["Moved the order list in 2023 to a new spreadsheet"])).toEqual(NO("fragment"));
  });
  it("I5: `fragment`: the lower-case pronoun 'it' still fires (the line also holds the acronym 'IT', which does not matter)", () => {
    expect(check("kept it up to date", ["Gave IT support to the sales team and kept it up to date"])).toEqual(NO("fragment"));
  });
  it("I6 (extra): `fragment`: the lower-case German pronoun 'ihn' still fires", () => {
    expect(check("prüfte ihn am Montag", ["Schrieb den Bericht und prüfte ihn am Montag"])).toEqual(NO("fragment"));
  });
});
