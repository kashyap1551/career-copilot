import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBullet } from "@/lib/engine/bulletCheck";
import { skills } from "@/lib/vocab";

// Step 8.3, stage 1a, tests first (docs/PLAN-8.3.md v2, section 3 and 3.1; tests T1 to T9 and T26). EVERY expected verdict below is a hand
// result of the rules R1 to R10 written in the plan BEFORE lib/engine/bulletCheck.ts existed; none comes from running code. The invented CV
// "CV-A" is the plan's (section 3.1). Invented text only; no AI call, no network.

const CV_A = [
  "Sam Placeholder, Junior Assistant, Testville", // 1
  "2023-2024 Office Assistant, Imaginary Bakery Ltd", // 2
  "Answered the phone and kept the stock sheet up to date in Excel", // 3
  "Handled about 40 orders a day at the counter", // 4
  "Wrote SQL queries to reconcile order data", // 5
  "Led a weekend shift of 3 helpers", // 6
  "Built monthly dashboards in Tableau for the sales team", // 7
  "Grew the Instagram account from 2,000 to 9,000 followers", // 8
  "Pflege der Lagerliste in Excel und Beantwortung von Kundenanfragen", // 9
  "Did not handle cash", // 10
  "Learning Python basics in an evening course", // 11
  "Acted as deputy lead of the weekend stock team", // 12
  "Helped customers at the counter", // 13
];

type Reason =
  | "bad-citation" | "bad-length" | "new-date" | "new-number" | "new-skill" | "new-name" | "new-claim" | "lost-qualifier" | "new-word" | "reordered";
type Verdict = { ok: true } | { ok: false; reason: Reason };
const OK: Verdict = { ok: true };
const NO = (reason: Reason): Verdict => ({ ok: false, reason });

const run = (bullet: string, cited: number[], lines: string[] = CV_A): Verdict =>
  checkBullet(bullet, cited, { lines, vocabulary: skills }) as Verdict;
// A one-line CV for the table tests (the cited line is line 1).
const one = (line: string, bullet: string): Verdict => run(bullet, [1], [line]);

// ---- the hand table of section 3.1 (V1 to V32, V11b and L1) ----------------------------------------------------------------------
type Case = { id: string; cited: number[]; bullet: string; verdict: Verdict };
const CASES: Case[] = [
  { id: "V1", cited: [3], bullet: "Kept the stock sheet up to date in Excel", verdict: OK },
  { id: "V2", cited: [7], bullet: "Built monthly Tableau dashboards for the sales team", verdict: NO("reordered") },
  { id: "V3", cited: [7], bullet: "Built a monthly dashboard in Tableau for sales teams", verdict: OK },
  { id: "V4", cited: [4], bullet: "Handled about 40 orders a day", verdict: OK },
  { id: "V5", cited: [4], bullet: "Handled about 400 orders a day", verdict: NO("new-number") },
  { id: "V6", cited: [6], bullet: "Led a weekend shift of three helpers", verdict: OK },
  { id: "V7", cited: [6], bullet: "Led a weekend shift of four helpers", verdict: NO("new-number") },
  { id: "V8", cited: [3], bullet: "Kept the stock sheet in Excel and SQL", verdict: NO("new-skill") },
  { id: "V9", cited: [3], bullet: "Kept the stock sheet up to date in Airtable", verdict: NO("new-name") },
  { id: "V10", cited: [3], bullet: "Kept the stock sheet at Imaginary Bakery Ltd", verdict: NO("new-name") },
  { id: "V11", cited: [2, 3], bullet: "Kept the stock sheet at Imaginary Bakery Ltd", verdict: NO("lost-qualifier") },
  { id: "V11b", cited: [2, 3], bullet: "Kept the stock sheet as assistant at Imaginary Bakery Ltd", verdict: OK },
  { id: "V12", cited: [3], bullet: "Kept the stock sheet as a senior assistant", verdict: NO("new-claim") },
  { id: "V13", cited: [3], bullet: "Kept the stock sheet in Excel since 2021", verdict: NO("new-date") },
  { id: "V14", cited: [3], bullet: "Kept the stock sheet in Excel in September", verdict: NO("new-date") },
  { id: "V15", cited: [4], bullet: "Handled about 40 orders a day and improved satisfaction", verdict: NO("new-claim") },
  { id: "V16", cited: [7], bullet: "Built monthly executive dashboards in Tableau", verdict: NO("new-word") },
  { id: "V17", cited: [5], bullet: "Built monthly dashboards in Tableau", verdict: NO("new-skill") },
  { id: "V18", cited: [3], bullet: "Excel", verdict: NO("bad-length") },
  { id: "V19", cited: [99], bullet: "Kept the stock sheet in Excel", verdict: NO("bad-citation") },
  { id: "V20", cited: [10], bullet: "Handled the cash", verdict: NO("lost-qualifier") },
  { id: "V21", cited: [11], bullet: "Used Python basics in an evening course", verdict: NO("lost-qualifier") },
  { id: "V22", cited: [8], bullet: "Grew the Instagram account from 2000 to 9000 followers", verdict: OK },
  { id: "V23", cited: [8], bullet: "Grew the Instagram account to 9,500 followers", verdict: NO("new-number") },
  { id: "V24", cited: [9], bullet: "Pflege der Lagerliste in Excel", verdict: OK },
  { id: "V25", cited: [9], bullet: "Pflege der Lagerliste im ERP-System", verdict: NO("new-name") },
  { id: "V26", cited: [3], bullet: "Kept 12 stock sheets in SQL", verdict: NO("new-number") },
  { id: "V27", cited: [3, 5], bullet: "Kept the stock sheet in Excel and wrote SQL queries", verdict: OK },
  { id: "V28", cited: [3], bullet: "Kept the stock sheet in Excel for 10% of orders", verdict: NO("new-number") },
  { id: "V29", cited: [4], bullet: "Handled 40 orders a day at the counter", verdict: NO("lost-qualifier") },
  { id: "V30", cited: [8], bullet: "Grew the Instagram account from 9,000 to 2,000 followers", verdict: NO("reordered") },
  { id: "V31", cited: [12], bullet: "Lead of the weekend stock team", verdict: NO("lost-qualifier") },
  { id: "V32", cited: [13], bullet: "Customers helped the counter", verdict: NO("reordered") },
  { id: "L1", cited: [3], bullet: "Answered the phone in Excel", verdict: OK }, // a stated limit of the verifier, not a pass line
];

describe("T1: the accepted cases of the hand table", () => {
  for (const c of CASES.filter((x) => x.verdict.ok)) {
    it(`T1: ${c.id} ACCEPT: "${c.bullet}" (cited ${c.cited.join(" and ")})`, () => {
      expect(run(c.bullet, c.cited)).toEqual(OK);
    });
  }
});

describe("T2: the rejected cases of the hand table, each with its reason", () => {
  for (const c of CASES.filter((x) => !x.verdict.ok)) {
    it(`T2: ${c.id} REJECT ${(c.verdict as { reason: string }).reason}: "${c.bullet}" (cited ${c.cited.join(" and ")})`, () => {
      expect(run(c.bullet, c.cited)).toEqual(c.verdict);
    });
  }
});

describe("T3: the first failing rule gives the reason", () => {
  it("T3: a number AND a skill fail: the number comes first (V26)", () => {
    expect(run("Kept 12 stock sheets in SQL", [3])).toEqual(NO("new-number"));
  });
  it("T3: a bad citation AND a bad length: the citation comes first", () => {
    expect(run("Excel", [99])).toEqual(NO("bad-citation"));
  });
  it("T3: a claim word AND a new word fail: the claim word comes first", () => {
    expect(run("Kept the stock sheet as a senior", [3])).toEqual(NO("new-claim"));
  });
  it("T3: a new word AND a reordering fail: the new word comes first", () => {
    // line 7: "Built monthly dashboards in Tableau for the sales team"; "executive" is in no cited line; the order is also wrong
    expect(run("Tableau dashboards executive", [7])).toEqual(NO("new-word"));
  });
});

describe("T4: the number table (section 3.1, N1 to N9), by value", () => {
  it("T4 N1: 2,000 = 2000 = 2.000 (German thousands)", () => {
    const line = "Grew the account to 2,000 followers";
    expect(one(line, "Grew the account to 2000 followers")).toEqual(OK);
    expect(one(line, "Grew the account to 2.000 followers")).toEqual(OK);
    expect(one(line, "Grew the account to 2,000 followers")).toEqual(OK);
    expect(one(line, "Grew the account to 2,001 followers")).toEqual(NO("new-number"));
  });
  it("T4 N2: 3.5 = 3,5 = 3.50 (decimals)", () => {
    const line = "Rated 3.5 stars";
    expect(one(line, "Rated 3,5 stars")).toEqual(OK);
    expect(one(line, "Rated 3.50 stars")).toEqual(OK);
    expect(one(line, "Rated 3.6 stars")).toEqual(NO("new-number"));
  });
  it("T4 N3: 1.234 is read as 1234 (the stated limit); 1.2 is not 1234", () => {
    const line = "Reached 1.234 users";
    expect(one(line, "Reached 1,234 users")).toEqual(OK);
    expect(one(line, "Reached 1234 users")).toEqual(OK);
    expect(one(line, "Reached 1.2 users")).toEqual(NO("new-number"));
  });
  it("T4 N4: 10k is NOT 10,000 (a token with a letter suffix is compared as a string)", () => {
    expect(one("Handled 10,000 orders", "Handled 10k orders")).toEqual(NO("new-number"));
    expect(one("Handled 10k orders", "Handled 10k orders")).toEqual(OK);
  });
  it("T4 N5: twelve = 12 = a dozen, both ways", () => {
    expect(one("Handled twelve orders", "Handled 12 orders")).toEqual(OK);
    expect(one("Handled a dozen orders", "Handled 12 orders")).toEqual(OK);
    expect(one("Handled 12 orders", "Handled twelve orders")).toEqual(OK);
    expect(one("Handled 12 orders", "Handled thirteen orders")).toEqual(NO("new-word"));
  });
  it("T4 N6: 'one' and 'a' are not numbers (so they need no number in the line)", () => {
    expect(one("Kept the sheet", "Kept a sheet")).toEqual(OK);
    expect(one("Handled one order a day", "Handled one order")).toEqual(OK);
    expect(one("Handled the orders", "Handled one order")).toEqual(NO("new-word")); // not a number: the closed-world rule rejects it
  });
  it("T4 N7: a symbol in the bullet needs the symbol in a cited line", () => {
    expect(one("Handled 10 orders", "Handled 10% orders")).toEqual(NO("new-number"));
    expect(one("Handled 10% of orders", "Handled 10% of orders")).toEqual(OK);
  });
  it("T4 N8: 2023-2024 gives 2023 and 2024", () => {
    const line = "Worked 2023-2024 at the counter";
    expect(one(line, "Worked 2023 at the counter")).toEqual(OK);
    expect(one(line, "Worked 2024 at the counter")).toEqual(OK);
    expect(one(line, "Worked 2025 at the counter")).toEqual(NO("new-date"));
  });
  it("T4 N9: a number word of the LINE equals the digits of the bullet", () => {
    expect(one("Led three helpers", "Led 3 helpers")).toEqual(OK);
    expect(one("Led three helpers", "Led 4 helpers")).toEqual(NO("new-number"));
  });
});

describe("T5: the date table", () => {
  it("T5: a quarter token must stand in the line", () => {
    expect(one("Shipped the Q3 report", "Shipped the Q3 report")).toEqual(OK);
    expect(one("Shipped the Q3 report", "Shipped the Q4 report")).toEqual(NO("new-date"));
  });
  it("T5: an ISO date must stand in the line", () => {
    expect(one("Started on 2023-05-01 at the counter", "Started on 2023-05-01 at the counter")).toEqual(OK);
    expect(one("Started on 2023-05-01 at the counter", "Started on 2023-06-01 at the counter")).toEqual(NO("new-date"));
  });
  it("T5: a German month name must stand in the line", () => {
    expect(one("Seit Januar im Lager", "Seit Januar im Lager")).toEqual(OK);
    expect(one("Seit Januar im Lager", "Seit Februar im Lager")).toEqual(NO("new-date"));
  });
  it("T5: a month inside a cited range may be used alone", () => {
    expect(one("Worked January 2023 to June 2023 at the counter", "Worked January 2023 at the counter")).toEqual(OK);
  });
  it("T5: a year-shaped number equal by value to a number of the line passes (2000 and 2,000)", () => {
    expect(one("Reached 2,000 followers", "Reached 2000 followers")).toEqual(OK);
  });
  it("T5: 'may' and 'march' are NOT read as months (R3 leaves them to R9)", () => {
    expect(one("Kept the stock sheet", "Kept the stock sheet may")).toEqual(NO("new-word"));
    expect(one("Kept the stock sheet", "Kept the stock sheet march")).toEqual(NO("new-word"));
  });
});

describe("T6: word forms", () => {
  it("T6: a plural or a tense of a word of the line is tolerated, both ways (4 letters or more)", () => {
    expect(one("Built monthly dashboards", "Built monthly dashboard")).toEqual(OK);
    expect(one("Built monthly dashboard", "Built monthly dashboards")).toEqual(OK);
    expect(one("Handled the orders daily", "Handle the orders daily")).toEqual(OK);
    expect(one("Sort orders daily", "Sorting orders daily")).toEqual(OK);
  });
  it("T6: only a suffix is tolerated: 'handling' is not 'handle' plus ing", () => {
    expect(one("Handle orders daily", "Handling orders daily")).toEqual(NO("new-word"));
  });
  it("T6: no tolerance for a word under 4 letters ('run' is not 'runs')", () => {
    expect(one("Run the shop daily", "Runs the shop daily")).toEqual(NO("new-word"));
  });
  it("T6: a claim word must stand in EXACTLY that form ('led' is not 'leading')", () => {
    expect(one("Leading a weekend shift", "Led a weekend shift")).toEqual(NO("new-claim"));
    expect(one("Led a weekend shift", "Led a weekend shift")).toEqual(OK);
  });
  it("T6: case and accents never matter", () => {
    expect(one("Pflege der Lagerliste", "PFLEGE DER LAGERLISTE")).toEqual(OK);
    expect(one("Cafe service at the counter", "Café service at the counter")).toEqual(OK);
  });
});

// The extended R8 list of the plan (0.4), folded form. The test compares these literals with the plan's own list (below).
const R8_EN = [
  "helped", "help", "helping", "assisted", "assist", "assisting", "supported", "supporting", "contributed", "contributing", "participated", "participating",
  "basic", "basics", "beginner", "learning", "studying", "familiar", "exposure", "shadowed", "attended", "about", "around", "approximately", "roughly",
  "nearly", "almost", "over", "under", "some", "several", "only", "mostly", "mainly", "partly", "partially", "occasionally", "sometimes", "rarely",
  "junior", "assistant", "deputy", "associate", "acting", "interim", "vice",
];
const R8_NEG = ["not", "no", "never", "without"];
const R8_DE = [
  "nicht", "kein", "keine", "ohne", "half", "mithilfe", "mitarbeit", "unterstutzte", "assistierte", "grundkenntnisse", "grundlagen", "etwa", "circa", "rund",
  "ungefahr", "fast", "uber", "ueber", "einige", "mehrere", "nur", "meist", "hauptsachlich", "teilweise", "gelegentlich", "manchmal", "selten",
  "stellvertretend", "stellvertretender", "stellvertretende", "assistent", "assistentin", "junior", "praktikum",
];

describe("T7: qualifiers and negations (the extended R8 list), kept or lost", () => {
  for (const w of [...R8_EN, ...R8_NEG]) {
    it(`T7 en: "${w}" in the line must stay in the bullet`, () => {
      const line = `Worked ${w} on the counter shift`;
      expect(one(line, `Worked ${w} on the counter shift`)).toEqual(OK); // kept
      expect(one(line, "Worked on the counter shift")).toEqual(NO("lost-qualifier")); // lost
    });
  }
  for (const w of R8_DE) {
    it(`T7 de: "${w}" in the line must stay in the bullet`, () => {
      const line = `Arbeit ${w} im Lager`;
      expect(one(line, `Arbeit ${w} im Lager`)).toEqual(OK);
      expect(one(line, "Arbeit im Lager")).toEqual(NO("lost-qualifier"));
    });
  }
  it("T7: the lists written here are the lists written in docs/PLAN-8.3.md (rule R8)", () => {
    const plan = readFileSync(join(process.cwd(), "docs/PLAN-8.3.md"), "utf8");
    const start = plan.indexOf("- **R8. Qualifiers kept");
    const end = plan.indexOf("- **R9. Closed world");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    // the backticked lists of rule R8 (the reason code `lost-qualifier` has a hyphen and is not a list word)
    const fromPlan = [...plan.slice(start, end).matchAll(/`([^`]+)`/g)].flatMap((m) => m[1].split(/\s+/)).filter((w) => /^[a-z]+$/.test(w));
    const mine = new Set([...R8_EN, ...R8_NEG, ...R8_DE]);
    const planSet = new Set(fromPlan);
    for (const w of mine) expect(planSet.has(w), `"${w}" is in the test but not in the plan`).toBe(true);
    for (const w of planSet) expect(mine.has(w), `"${w}" is in the plan but not in the test`).toBe(true);
  });
});

describe("T8: citations", () => {
  const b = "Kept the stock sheet up to date in Excel";
  it("T8: no cited line, three cited lines, a repeated line, a non-integer, zero, a negative, a line past the end", () => {
    expect(run(b, [])).toEqual(NO("bad-citation"));
    expect(run(b, [3, 5, 7])).toEqual(NO("bad-citation"));
    expect(run(b, [3, 3])).toEqual(NO("bad-citation"));
    expect(run(b, [3.5])).toEqual(NO("bad-citation"));
    expect(run(b, [0])).toEqual(NO("bad-citation"));
    expect(run(b, [-1])).toEqual(NO("bad-citation"));
    expect(run(b, [CV_A.length + 1])).toEqual(NO("bad-citation"));
  });
  it("T8: one or two distinct valid lines are fine", () => {
    expect(run(b, [3])).toEqual(OK);
    expect(run("Kept the stock sheet in Excel and wrote SQL queries", [3, 5])).toEqual(OK);
  });
  it("T8: an empty cited line is a bad citation", () => {
    expect(run(b, [2], ["Something else", "", "Kept the stock sheet up to date in Excel"])).toEqual(NO("bad-citation"));
  });
});

describe("T9: it never throws and never changes its input", () => {
  const deepFreeze = <T,>(x: T): T => {
    if (x && typeof x === "object") {
      Object.freeze(x);
      for (const v of Object.values(x as Record<string, unknown>)) deepFreeze(v);
    }
    return x;
  };
  const odd = ["", " ", "\n", "Kept\nthe stock sheet", "x".repeat(10_000), "😀 😀 😀 😀", "Kept \u0000 the \u0007 sheet", "(((((", "10% 10% 10% 10%", "ÄÖÜ ß äöü", "'''' --- ///"];
  for (const bullet of odd) {
    it(`T9: bullet ${JSON.stringify(bullet.slice(0, 24))} (${bullet.length} characters) gives a verdict and changes nothing`, () => {
      const lines = deepFreeze([...CV_A]);
      const cited = deepFreeze([3]);
      const before = JSON.stringify([bullet, lines, cited]);
      let verdict: Verdict | undefined;
      expect(() => {
        verdict = checkBullet(bullet, cited, { lines, vocabulary: skills }) as Verdict;
      }).not.toThrow();
      expect(typeof verdict?.ok).toBe("boolean");
      expect(JSON.stringify([bullet, lines, cited])).toBe(before);
      expect(JSON.stringify(checkBullet(bullet, cited, { lines, vocabulary: skills }))).toBe(JSON.stringify(verdict)); // the same input, the same answer
    });
  }
  it("T9: odd citations and odd lines give a verdict and never throw", () => {
    for (const cited of [[NaN], [Infinity], [3, NaN], [Number.MAX_SAFE_INTEGER]]) {
      expect(() => checkBullet("Kept the stock sheet in Excel", cited, { lines: CV_A, vocabulary: skills })).not.toThrow();
    }
    expect(() => checkBullet("Kept the stock sheet in Excel", [1], { lines: ["", "\u0000"], vocabulary: skills })).not.toThrow();
    expect(() => checkBullet("Kept the stock sheet in Excel", [1], { lines: [], vocabulary: [] })).not.toThrow();
  });
});

// ---- T26: the table of the plan is the table of the test ----------------------------------------------------------------------------
describe("T26: the case table in this test equals the table in docs/PLAN-8.3.md", () => {
  const plan = readFileSync(join(process.cwd(), "docs/PLAN-8.3.md"), "utf8");
  const section = plan.slice(plan.indexOf("### 3.1 Hand-worked cases"), plan.indexOf("**Number table (hand values).**"));

  it("T26: the CV-A lines are the same", () => {
    const block = /```\n(1: Sam Placeholder[\s\S]*?)```/.exec(section);
    expect(block, "the CV-A block was not found in the plan").not.toBeNull();
    const lines = (block as RegExpExecArray)[1].trim().split("\n").map((l) => l.replace(/^\d+: /, ""));
    expect(lines).toEqual(CV_A);
  });

  it("T26: every row of the plan's table (V1 to V32, V11b, L1) has the same cited lines, bullet and verdict as the test", () => {
    const rows = [...section.matchAll(/^\| (V\d+b?|L1) \| ([^|]*) \| ([^|]*) \| ((?:ACCEPT|REJECT)[^|]*) \|/gm)];
    const fromPlan = rows.map((m) => {
      const verdict: Verdict = m[4].startsWith("ACCEPT") ? OK : NO(/`([a-z-]+)`/.exec(m[4])?.[1] as Reason);
      return { id: m[1], cited: m[2].trim().split(/ and /).map(Number), bullet: m[3].trim(), verdict };
    });
    expect(fromPlan.map((c) => c.id)).toEqual(CASES.map((c) => c.id));
    expect(fromPlan).toEqual(CASES);
  });
});
