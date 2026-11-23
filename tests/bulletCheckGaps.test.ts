import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBullet, type BulletReason } from "@/lib/engine/bulletCheck";
import { skills } from "@/lib/vocab";

// Step 8.3, stage 6b, tests first (docs/PLAN-8.3.md amendment 0.32): four gaps that the deliberate breaks of stage 6 found (B7, B8, B10, B15): no test made them fail.
// EVERY expected verdict and reason below was worked out by hand from rules R1 to R10 of the plan's section 3 and their ORDER (the first failing rule gives the reason)
// BEFORE this file was run; none comes from running the code. Invented lines only; no AI call, no network.
//
// Rule order: R1 citation, R2 length (3 to 25 words), R3 dates, R4 numbers, R5 a vocabulary skill written in the bullet must be written in a cited line, R6 a capital
// word (not the first token) must stand in a cited line, R7 a CLAIM word must stand in a cited line in exactly that form, R8 limiting words of the line must stay,
// R9 closed world (every word is a line word, a form of one by an ending s, es, ed, d, ing when both words have 4 letters or more, or a function word), R10 order.

const OK = { ok: true } as const;
const NO = (reason: BulletReason) => ({ ok: false, reason }) as const;
const check = (bullet: string, lines: string[], cited: number[] = [1]) => checkBullet(bullet, cited, { lines, vocabulary: skills });

describe("G7: R5 and the GERMAN names and aliases of the vocabulary (gap of B7)", () => {
  // Vocabulary, by hand: accounting has the German name "Buchhaltung"; procurement has the German alias "Beschaffung" and training the alias "Einarbeitung".
  const L_ACC = "Zuständig für die Buchhaltung und die Abrechnung der Kunden";
  const L_PROC = "Erledigte die Beschaffung von Büromaterial und kümmerte sich um die Einarbeitung neuer Kollegen";
  const L_PLAIN = "Pflege der Kundenliste und Beantwortung von Anfragen";

  it("G7a1: ACCEPT: the line holds the German NAME 'Buchhaltung' and the bullet keeps it (R5 sees it in the cited line; every other word is a line word; order kept)", () => {
    expect(check("Zuständig für die Buchhaltung", [L_ACC])).toEqual(OK);
  });

  it("G7a2: ACCEPT: the line holds the German ALIAS 'Beschaffung' and the bullet keeps it", () => {
    expect(check("Erledigte die Beschaffung von Büromaterial", [L_PROC])).toEqual(OK);
  });

  it("G7b1: REJECT new-skill: the bullet names 'Buchhaltung' (a German name) that stands only in line 2, and cites line 1 (R5 comes before R6 and R9)", () => {
    expect(check("Pflege der Kundenliste und Buchhaltung", [L_PLAIN, "Zuständig für die Buchhaltung"], [1])).toEqual(NO("new-skill"));
  });

  it("G7b2: REJECT new-skill: the German ALIAS 'Beschaffung' stands only in line 2, the bullet cites line 1", () => {
    expect(check("Pflege der Kundenliste und Beschaffung", [L_PLAIN, "Erledigte die Beschaffung von Büromaterial"], [1])).toEqual(NO("new-skill"));
  });

  it("G7b3 (control): the same bullet citing BOTH lines passes (R5 reads the cited lines; the words and their order, line 1 then line 2, are right)", () => {
    expect(check("Pflege der Kundenliste und Buchhaltung", [L_PLAIN, "Zuständig für die Buchhaltung"], [1, 2])).toEqual(OK);
  });
});

describe("G8: R9 and the FIRST word of the bullet (gap of B8)", () => {
  const LINE = "Answered customer emails and kept the order list up to date";

  it("G8a: REJECT new-word: the first word 'Processed' is not in the line, not a form of one, not a function word, not a claim word (R6 exempts only the capital letter)", () => {
    expect(check("Processed customer emails", [LINE])).toEqual(NO("new-word"));
  });

  it("G8b: REJECT new-word: the same for 'Handled'", () => {
    expect(check("Handled customer emails", [LINE])).toEqual(NO("new-word"));
  });

  it("G8c: ACCEPT: the first word 'Report' is a form of the line word 'reports' (ending s, 4 letters or more); the order is kept", () => {
    expect(check("Report for the finance team", ["Prepared weekly reports for the finance team"])).toEqual(OK);
  });

  it("G8d (control): the first word may start with a capital without being new: 'Answered customer emails' is accepted", () => {
    expect(check("Answered customer emails", [LINE])).toEqual(OK);
  });
});

describe("G10: R7 claim words stand in EXACTLY the form of the line (gap of B10)", () => {
  // R7 only looks at words of the CLAIMS list. Two pairs of the list are regular variants of each other: head / headed and award / awarded (checked in G10z below).
  // A variant that is NOT on the list is not an R7 matter (R9's ending tolerance decides it), so only these two pairs show R7's exactness.
  it("G10a: ACCEPT: the line holds 'Headed' and the bullet writes 'Headed' (exact)", () => {
    expect(check("Headed the weekend stock team", ["Headed the weekend stock team"])).toEqual(OK);
  });

  it("G10b: REJECT new-claim: the line holds 'Headed', the bullet writes 'Head' (a claim word, not in the line in that form)", () => {
    expect(check("Head the weekend stock team", ["Headed the weekend stock team"])).toEqual(NO("new-claim"));
  });

  it("G10c: REJECT new-claim: the line holds 'Head', the bullet writes 'Headed'", () => {
    expect(check("Headed the weekend stock team", ["Head of the weekend stock team"])).toEqual(NO("new-claim"));
  });

  it("G10d: ACCEPT: the line holds 'Head' and the bullet writes 'Head' (exact)", () => {
    expect(check("Head of the weekend stock team", ["Head of the weekend stock team"])).toEqual(OK);
  });

  it("G10e: ACCEPT: the line holds 'Awarded', the bullet writes 'Awarded'", () => {
    expect(check("Awarded a certificate", ["Awarded a certificate at the summer trade show"])).toEqual(OK);
  });

  it("G10f: REJECT new-claim: the line holds 'Awarded', the bullet writes 'Award'", () => {
    expect(check("Award a certificate", ["Awarded a certificate at the summer trade show"])).toEqual(NO("new-claim"));
  });

  it("G10z: the list is what the hand work assumed: head, headed, award, awarded are claim words, and no other two claim words are regular variants of each other", () => {
    const source = readFileSync(join(process.cwd(), "lib/engine/bulletCheck.ts"), "utf8");
    const block = /const CLAIMS = set\(([\s\S]*?)\n\);/.exec(source);
    expect(block).not.toBeNull();
    const words = [...new Set([...(block as RegExpExecArray)[1].matchAll(/"([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean))].sort();
    for (const w of ["head", "headed", "award", "awarded", "manager", "coordinator", "leader", "lead", "led"]) expect(words, w).toContain(w);
    const suffixes = ["s", "es", "ed", "d", "ing"];
    const variant = (a: string, b: string) => a.length >= 4 && b.length >= 4 && suffixes.some((s) => a === b + s || b === a + s);
    const pairs: string[] = [];
    for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) if (variant(words[i], words[j])) pairs.push(`${words[i]} ${words[j]}`);
    expect(pairs).toEqual(["award awarded", "head headed"]);
  });
});

describe("G15: R9 word forms: only the endings s, es, ed, d, ing; a longer word is NOT a form (gap of B15)", () => {
  it("G15a: REJECT new-word: line 'design', bullet 'designer' ('er' is not an allowed ending, although 'design' is a prefix)", () => {
    expect(check("Wrote the weekly designer notes", ["Wrote the weekly design notes for the team"])).toEqual(NO("new-word"));
  });

  it("G15b: REJECT new-word: line 'write', bullet 'writer'", () => {
    expect(check("Writer of the weekly status page", ["Write the weekly status page for the team"])).toEqual(NO("new-word"));
  });

  it("G15c: REJECT new-word: line 'plan', bullet 'planner'", () => {
    expect(check("Kept the weekly planner for the packing team", ["Kept the weekly plan for the packing team"])).toEqual(NO("new-word"));
  });

  it("G15d: REJECT new-word: line 'deliver', bullet 'delivery'", () => {
    expect(check("Delivery parts to the north depot", ["Deliver parts to the north depot"])).toEqual(NO("new-word"));
  });

  it("G15e: REJECT new-word: the other way round: line 'designer', bullet 'design'", () => {
    expect(check("Wrote the weekly design notes", ["Wrote the weekly designer notes for the team"])).toEqual(NO("new-word"));
  });

  it("G15f: the examples with a CLAIM word (managed / manager, coordinated / coordinator, lead / leader) are stopped one rule earlier, by R7, with new-claim", () => {
    expect(check("Manager the weekend stock team", ["Managed the weekend stock team"])).toEqual(NO("new-claim"));
    expect(check("Coordinator of the weekend stock team", ["Coordinated the weekend stock team"])).toEqual(NO("new-claim"));
    expect(check("Leader of the weekend stock team", ["Lead the weekend stock team"])).toEqual(NO("new-claim"));
  });

  it("G15g: ACCEPT the allowed endings: s, es, ed, d, ing (each word has 4 letters or more)", () => {
    expect(check("Wrote report for the sales team", ["Wrote reports for the sales team"])).toEqual(OK); // s
    expect(check("Fixed the watch for the team", ["Fixed the watches for the team"])).toEqual(OK); // es
    expect(check("Report weekly numbers to the team", ["Reported weekly numbers to the team"])).toEqual(OK); // ed
    expect(check("Update the stock sheet", ["Updated the stock sheet"])).toEqual(OK); // d
    expect(check("Report weekly numbers to the team", ["Reporting weekly numbers to the team"])).toEqual(OK); // ing
  });

  it("G15h: a word under 4 letters gets no tolerance: 'Set' is not 'sets', 'Run' is not 'runs'", () => {
    expect(check("Set the weekend shifts", ["Sets the weekend shifts"])).toEqual(NO("new-word"));
    expect(check("Run the weekend shift", ["Runs the weekend shift"])).toEqual(NO("new-word"));
  });
});
