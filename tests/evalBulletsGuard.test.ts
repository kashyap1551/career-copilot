import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { jobs } from "@/fixtures/jobs";
import { skills } from "@/fixtures/skills";
import { cvFixtures } from "@/fixtures/synthetic-cvs";
import { numberLines } from "@/lib/cv/numberLines";
import { removeContactDetails } from "@/lib/cv/redact";
import { LEARNING_MARKERS } from "@/lib/engine/bulletPairs";
import { buildEvalItems, profileFromKey } from "@/lib/engine/evalBulletsProfile";
import { formatBulletsReport, reviewSheet, summarizeBullets } from "@/lib/engine/evalBulletsReport";
import type { BulletsEvalRow, BulletsEvalRun } from "@/lib/engine/evalBulletsRun";
import { foldText } from "@/lib/engine/text";
import { evalBulletsMain, type BulletsMainDeps } from "@/scripts/evalBulletsMain";

// Step 8.3, stage 5, tests first (docs/PLAN-8.3.md v2, section 4 "The eval", M1 to M5, amendments 0.20 and 0.27; tests T33 to T35). The bullets eval script and its
// guards. NO test below makes an AI call or imports the real runner: the script's logic (scripts/evalBulletsMain.ts) takes the runner as an argument, and the
// real one (lib/ai/writeBullets) is wired only in the command-line entry scripts/evalBullets.ts, which no test imports. Invented material only (the five invented
// CVs and the three invented jobs). Every expected value below is hand-worked from the CV fixtures, the key items, the vocabulary data and the job fixtures
// BEFORE the code exists; none is taken from the code's output.

const root = process.cwd();

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// T35: the eval's profiles come from the keys of the invented CVs
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

// The five CVs as the page numbers them (contact details removed, then numbered), as scripts/evalCv.ts does.
const cvs = cvFixtures.map((c) => ({
  id: c.id,
  key: c.key,
  lines: numberLines(removeContactDetails(c.text)),
  lang: (c.id === "cv-2-german" ? "de" : "en") as "en" | "de",
}));
const cv = (id: string) => cvs.find((c) => c.id === id)!;

// The rule (written before the code): walk the key's items in order; of each item take the FIRST name that is a skill of the vocabulary; the first item that gives a
// skill decides its line; a line with a learning marker is never used. Hand-worked from the key items and lib/vocab/data.ts:
const SKILLS_BY_HAND: Record<string, string[]> = {
  // cv-1-thin: Excel (line 4); "Inventory management" (4); "Phone support" (4); "Customer service" (5). Line 7 ("Learning Excel formulas ...") has no item.
  "cv-1-thin": ["excel@4", "inventory-management@4", "phone-support@4", "customer-service@5"],
  // cv-2-german: Excel 4; Pivot tables 4; Reporting 4; SQL 5; Database querying 5; Power BI 6; Dashboards 6; Python 8; Communication 9.
  "cv-2-german": ["excel@4", "pivot-tables@4", "reporting@4", "sql@5", "database-querying@5", "power-bi@6", "dashboards@6", "python@8", "communication@9"],
  // cv-3-injection: Mailchimp 4; Copywriting 4; Email marketing 4; Instagram 5; Social media 5; Audience growth 5; Canva 7; (Social media at 7 is a repeat:
  // the first line stays); Video editing 7; Content creation 7. Line 6 is the injected instruction: no item, no skill.
  "cv-3-injection": ["mailchimp@4", "copywriting@4", "email-marketing@4", "instagram@5", "social-media@5", "audience-growth@5", "canva@7", "video-editing@7", "content-creation@7"],
  // cv-4-skills-line: five skills on line 3; Frontend development 5; E-commerce 5; (React at 5, Jest at 6 and Git at 6 are repeats); Unit testing 6; Code review 6.
  "cv-4-skills-line": ["typescript@3", "react@3", "git@3", "jest@3", "accessibility@3", "frontend-development@5", "e-commerce@5", "unit-testing@6", "code-review@6"],
  // cv-5-prose: Scheduling 4; Delivery planning 4; Invoice checking 5; Documentation 6; Training 6; Spreadsheets 7; Cost reporting 7.
  "cv-5-prose": ["scheduling@4", "delivery-planning@4", "invoice-checking@5", "documentation@6", "training@6", "spreadsheets@7", "cost-reporting@7"],
};

const skillList = (p: ReturnType<typeof profileFromKey>) => p.skills.map((s) => (s.kind === "have" ? `${s.skillId}@${s.evidence?.line}` : "in-progress"));
const hasMarker = (text: string) => foldText(text).split(/[^\p{L}\p{N}]+/u).some((w) => LEARNING_MARKERS.has(w));

describe("T35: the profiles are built from the keys of the invented CVs", () => {
  it("T35a: each of the five profiles holds exactly the skills and lines worked out by hand, every one with its line's own text", () => {
    for (const c of cvs) {
      const p = profileFromKey(c.key, c.lines, skills);
      expect(skillList(p), c.id).toEqual(SKILLS_BY_HAND[c.id]);
      expect(p.cvLines).toEqual(c.lines);
      for (const s of p.skills) {
        if (s.kind === "have") expect(s.evidence?.text).toBe(c.lines[(s.evidence?.line ?? 0) - 1]);
      }
    }
  });

  it("T35b: no profile line carries a learning marker (the repo's own LEARNING_MARKERS), and the five lists are what the plan says", () => {
    expect([...LEARNING_MARKERS].sort()).toEqual(["currently", "geplant", "learning", "lerne", "lernen", "lernend", "planning", "studiere", "studying"]);
    for (const c of cvs) {
      for (const s of profileFromKey(c.key, c.lines, skills).skills) {
        if (s.kind === "have") expect(hasMarker(s.evidence?.text ?? ""), `${c.id} line ${s.evidence?.line}`).toBe(false);
      }
    }
  });

  it("T35c: a key item on a learning-marker line is NOT turned into a skill (cv-1-thin line 7, 'Learning Excel formulas in an evening course')", () => {
    const thin = cv("cv-1-thin");
    expect(thin.lines[6]).toBe("Learning Excel formulas in an evening course");
    // an extra item on line 7 for SQL: SQL must not appear
    const extra = { ...thin.key, items: [...thin.key.items, { line: 7, names: ["SQL"], label: "inferred" as const }] };
    expect(skillList(profileFromKey(extra, thin.lines, skills))).toEqual(SKILLS_BY_HAND["cv-1-thin"]);
    // Excel evidenced ONLY by line 7: no Excel at all, and so no pair for an ad that wants Excel
    const only7 = { ...thin.key, items: [{ line: 7, names: ["Excel"], label: "named" as const }] };
    expect(skillList(profileFromKey(only7, thin.lines, skills))).toEqual([]);
    const items = buildEvalItems([{ ...thin, key: only7 }], jobs, skills);
    expect(items.map((i) => i.pairs.length)).toEqual([0, 0, 0]);
  });

  it("T35d: the 15 runs (five CVs x three jobs, in that order) and their pair lists, worked out by hand", () => {
    const items = buildEvalItems(cvs, jobs, skills);
    expect(items.map((i) => `${i.cv} | ${i.job} | ${i.lang}`)).toEqual(
      cvs.flatMap((c) => jobs.map((j) => `${c.id} | ${j.id} | ${c.lang}`)),
    );
    expect(items).toHaveLength(15);
    const pairsOf = (cvId: string, jobId: string) => items.find((i) => i.cv === cvId && i.job === jobId)!.pairs.map((p) => ({ id: p.id, requirement: p.requirement, line: p.line, text: p.text }));
    const N = "northwind-operations-analyst";
    const B = "brightwater-financial-planning-analyst";
    const F = "fjordlight-frontend-developer";

    // cv-1-thin x Northwind: musts SQL (no), Excel (yes, line 4), communication (no); nices Power BI/Tableau (no), Python (no): ONE pair. Line 7 is never a pair line.
    expect(pairsOf("cv-1-thin", N)).toEqual([
      { id: 1, requirement: "Advanced Excel, including pivot tables and lookups.", line: 4, text: "Answered the phone and kept the stock sheet up to date in Excel" },
    ]);
    // cv-1-thin x Brightwater (financial planning, modelling, Power BI, SQL) and x Fjordlight (TypeScript, React, Git, tests, accessibility): nothing is met.
    expect(pairsOf("cv-1-thin", B)).toEqual([]);
    expect(pairsOf("cv-1-thin", F)).toEqual([]);

    // cv-2-german x Northwind: musts SQL (5), Excel (4), communication (9); nices Power BI (6), Python (8): five pairs, musts first, each in the ad's order.
    expect(pairsOf("cv-2-german", N)).toEqual([
      { id: 1, requirement: "Strong SQL for querying large data sets.", line: 5, text: "Schrieb SQL-Abfragen für die Finanzabteilung" },
      { id: 2, requirement: "Advanced Excel, including pivot tables and lookups.", line: 4, text: "Erstellte wöchentliche Berichte in Excel mit Pivot-Tabellen" },
      { id: 3, requirement: "Able to explain findings clearly to non-technical managers.", line: 9, text: "Moderierte die monatliche Abstimmung mit dem Vertrieb" },
      { id: 4, requirement: "Power BI or Tableau dashboard experience.", line: 6, text: "Built the dashboards in Power BI for the sales team" },
      { id: 5, requirement: "Python for data cleaning.", line: 8, text: "Weiterbildung: Python-Grundkurs, 2024" },
    ]);
    // cv-2-german x Brightwater: must financial planning (no), must modelling (no), must Power BI (line 6), nice SQL (line 5): two pairs.
    expect(pairsOf("cv-2-german", B)).toEqual([
      { id: 1, requirement: "Power BI for monthly reporting.", line: 6, text: "Built the dashboards in Power BI for the sales team" },
      { id: 2, requirement: "Basic SQL.", line: 5, text: "Schrieb SQL-Abfragen für die Finanzabteilung" },
    ]);
    expect(pairsOf("cv-2-german", F)).toEqual([]);

    // cv-3 (marketing) and cv-5 (operations) meet nothing of the three jobs: no pair, so no call.
    for (const id of ["cv-3-injection", "cv-5-prose"]) for (const j of [N, B, F]) expect(pairsOf(id, j), `${id} x ${j}`).toEqual([]);

    // cv-4-skills-line x Fjordlight: TypeScript, React, Git, Jest and accessibility are all on line 3, and one line gives one pair: ONE pair (the first met must).
    expect(pairsOf("cv-4-skills-line", F)).toEqual([
      { id: 1, requirement: "Strong TypeScript and React.", line: 3, text: "Skills: TypeScript, React, Git, Jest, accessibility" },
    ]);
    expect(pairsOf("cv-4-skills-line", N)).toEqual([]);
    expect(pairsOf("cv-4-skills-line", B)).toEqual([]);

    // Totals: 1 + 5 + 2 + 1 = 9 pairs in 4 runs; the other 11 runs have no pair.
    expect(items.reduce((n, i) => n + i.pairs.length, 0)).toBe(9);
    expect(items.filter((i) => i.pairs.length > 0)).toHaveLength(4);
    // No pair of any run sits on a learning-marker line; cv-1-thin never uses line 7.
    for (const i of items) for (const p of i.pairs) expect(hasMarker(p.text)).toBe(false);
    for (const i of items.filter((x) => x.cv === "cv-1-thin")) expect(i.pairs.map((p) => p.line)).not.toContain(7);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// T34: the report, on FAKE outputs
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

type FakePair = { id: number; requirement: string; line: number; text: string };
const pairs = (...texts: string[]): FakePair[] => texts.map((text, i) => ({ id: i + 1, requirement: `Requirement ${i + 1}`, line: i + 3, text }));
const row = (r: Omit<BulletsEvalRow, "asked"> & { asked?: number }): BulletsEvalRow => ({ asked: r.pairs.length, ...r });

// The fake set, written by hand. Seven runs: five answered calls, one run with no pair (no call), one failed call.
//   R1 en: 5 asked; accepted pairs 1 to 4 (FOUR, so more than 3: the page would show 3); pair 5 dropped (new-word). Pair 2's bullet equals its line when
//      compared lower-case with spaces collapsed ("Handled  about ..." with two spaces; the bullet is in lower case): UNCHANGED 1.
//   R2 en: 2 asked; pair 1 accepted; pair 2 dropped (missing).
//   R3 de: 5 asked; accepted pairs 1, 2, 5 (pair 5 is the line word for word: UNCHANGED 1); pair 3 dropped (new-word), pair 4 dropped (lost-qualifier).
//   R4 de: 2 asked; none accepted; pair 1 dropped (new-number), pair 2 dropped (repeated-pair).
//   R5 en: 1 asked; accepted; shown 1.
const R1 = row({
  cv: "cv-3-injection", job: "northwind-operations-analyst", lang: "en",
  pairs: pairs("Kept the stock sheet in Excel", "Handled  about 40 orders a day", "Wrote SQL queries to reconcile order data", "Built monthly dashboards in Tableau", "Helped customers at the counter"),
  accepted: [
    { pair: 1, text: "Kept the stock sheet" },
    { pair: 2, text: "handled about 40 orders a day" },
    { pair: 3, text: "Wrote SQL queries" },
    { pair: 4, text: "Built monthly dashboards" },
  ],
  dropped: [{ pair: 5, reason: "new-word" }],
  usage: { inputTokens: 900, outputTokens: 120 }, seconds: 4,
});
const R2 = row({
  cv: "cv-1-thin", job: "northwind-operations-analyst", lang: "en",
  pairs: pairs("Answered the phone and kept the stock sheet up to date in Excel", "Helped customers at the counter"),
  accepted: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }],
  dropped: [{ pair: 2, reason: "missing" }],
  usage: { inputTokens: 400, outputTokens: 60 }, seconds: 2,
});
const R3 = row({
  cv: "cv-2-german", job: "northwind-operations-analyst", lang: "de",
  pairs: pairs("Pflege der Lagerliste in Excel und Beantwortung von Kundenanfragen", "Schrieb SQL-Abfragen für die Finanzabteilung", "Moderierte die monatliche Abstimmung mit dem Vertrieb", "Hilfe bei der Abstimmung", "Weiterbildung: Python-Grundkurs, 2024"),
  accepted: [
    { pair: 1, text: "Pflege der Lagerliste in Excel" },
    { pair: 2, text: "Schrieb SQL-Abfragen" },
    { pair: 5, text: "Weiterbildung: Python-Grundkurs, 2024" },
  ],
  dropped: [{ pair: 3, reason: "new-word" }, { pair: 4, reason: "lost-qualifier" }],
  usage: { inputTokens: 1000, outputTokens: 150 }, seconds: 5,
});
const R4 = row({
  cv: "cv-2-german", job: "brightwater-financial-planning-analyst", lang: "de",
  pairs: pairs("Built the dashboards in Power BI for the sales team", "Schrieb SQL-Abfragen für die Finanzabteilung"),
  accepted: [],
  dropped: [{ pair: 1, reason: "new-number" }, { pair: 2, reason: "repeated-pair" }],
  usage: { inputTokens: 500, outputTokens: 80 }, seconds: 3,
});
const R5 = row({
  cv: "cv-4-skills-line", job: "fjordlight-frontend-developer", lang: "en",
  pairs: pairs("Skills: TypeScript, React, Git, Jest, accessibility"),
  accepted: [{ pair: 1, text: "TypeScript, React, Git" }],
  dropped: [],
  usage: { inputTokens: 300, outputTokens: 40 }, seconds: 2,
});
const FAKE: BulletsEvalRun = {
  rows: [R1, R2, R3, R4, R5],
  noPairs: [{ cv: "cv-1-thin", job: "brightwater-financial-planning-analyst" }],
  failed: [{ cv: "cv-5-prose", job: "northwind-operations-analyst", reason: "rate limited, even after every retry" }],
  complete: false,
};

// The numbers, counted by hand from the rows above (accepted = asked - dropped, BEFORE the cap of 3, amendment 0.27):
//   asked 5+2+5+2+1 = 15; dropped 1+1+2+2+0 = 6; accepted 4+1+3+0+1 = 9 (= 15 - 6); shown min(3, accepted) per run: 3+1+3+0+1 = 8; unchanged 1 + 0 + 1 + 0 + 0 = 2.
//   reasons: new-word 2 (R1, R3), missing 1, lost-qualifier 1, new-number 1, repeated-pair 1.  Runs: 7 = 5 + 1 + 1.  Runs with an accepted bullet: R1, R2, R3, R5 = 4 of 5.
//   English (R1, R2, R5): asked 8, accepted 6, shown 3+1+1 = 5, runs with an accepted bullet 3 of 3.   German (R3, R4): asked 7, accepted 3, shown 3, 1 of 2.
//   M5: calls 5; tokens in 900+400+1000+500+300 = 3,100; out 120+60+150+80+40 = 450; seconds 4+2+5+3+2 = 16.
//   Pass-line counts: accepted 9 < 20: no; 9 x 100 = 900 >= 15 x 40 = 600: yes; runs with an accepted bullet 4 < 10: no.
const SUMMARY = {
  runs: 7, calls: 5, noPairs: 1, failed: 1,
  asked: 15, accepted: 9, shown: 8, dropped: 6,
  byReason: { "new-word": 2, "lost-qualifier": 1, "new-number": 1, missing: 1, "repeated-pair": 1 },
  runsWithAccepted: 4, unchanged: 2,
  en: { calls: 3, asked: 8, accepted: 6, shown: 5, runsWithAccepted: 3 },
  de: { calls: 2, asked: 7, accepted: 3, shown: 3, runsWithAccepted: 1 },
  tokensIn: 3100, tokensOut: 450, seconds: 16,
  passLines: { accepted20: false, yield40: true, runs10: false },
};

const linesOf = (text: string) => text.split("\n").filter((l) => l !== "");

describe("T34: the report on fake outputs", () => {
  it("T34a: the summary matches the hand count: M3 per reason, M4 before the cap with the shown number beside it, runs with a bullet, English and German, UNCHANGED, M5", () => {
    expect(summarizeBullets(FAKE)).toEqual(SUMMARY);
  });

  it("T34b: accepted is asked minus dropped, counted BEFORE the cap of 3: run R1 has 4 accepted and shows 3", () => {
    const s = summarizeBullets({ rows: [R1], noPairs: [], failed: [], complete: true });
    expect(s.accepted).toBe(4);
    expect(s.shown).toBe(3);
    expect(s.asked).toBe(5);
    expect(s.dropped).toBe(1);
    expect(s.accepted).toBe(s.asked - s.dropped);
  });

  it("T34c: UNCHANGED compares lower-case with spaces collapsed: R1 pair 2 (case and a double space) and R3 pair 5 (word for word) count, nothing else does", () => {
    expect(summarizeBullets({ rows: [R1], noPairs: [], failed: [], complete: true }).unchanged).toBe(1);
    expect(summarizeBullets({ rows: [R3], noPairs: [], failed: [], complete: true }).unchanged).toBe(1);
    expect(summarizeBullets({ rows: [R2, R4, R5], noPairs: [], failed: [], complete: true }).unchanged).toBe(0);
  });

  it("T34d: the printed report carries every pinned number and is at most 15 lines", () => {
    const text = formatBulletsReport(FAKE, false);
    const lines = linesOf(text);
    expect(lines.length).toBeLessThanOrEqual(15);
    expect(lines[0]).toMatch(/CALIBRATION RUN \(not counted\)/);
    expect(text).toMatch(/RUNS: 7 \| calls 5 \| no pairs, no call 1 \| failed 1/);
    expect(text).toMatch(/PAIRS: asked 15 \| accepted 9 \(before the cap of 3\) \| shown 8 \(at most 3 a run\) \| dropped 6/);
    for (const r of ["new-word 2", "lost-qualifier 1", "new-number 1", "missing 1", "repeated-pair 1"]) expect(text).toContain(r);
    expect(text).toMatch(/ENGLISH: accepted 6 of 8 asked, shown 5 \| runs with an accepted bullet 3 of 3/);
    expect(text).toMatch(/GERMAN: accepted 3 of 7 asked, shown 3 \| runs with an accepted bullet 1 of 2/);
    expect(text).toMatch(/runs with an accepted bullet 4 of 5 \| UNCHANGED 2 of 9 accepted/);
    expect(text).toMatch(/accepted 20 or more: NO/);
    expect(text).toMatch(/accepted at least 40% of asked: yes/);
    expect(text).toMatch(/10 of 15 runs with an accepted bullet: NO/);
    expect(text).toMatch(/M1 INVENTED: counted by hand from the review sheet/);
    expect(text).toMatch(/M5: calls 5 \| tokens 3,550 \(3,100 in, 450 out\) \| seconds 16/);
    expect(text).toMatch(/FAILED: cv-5-prose on northwind-operations-analyst \(rate limited, even after every retry\)/);
    expect(text).toMatch(/INCOMPLETE/);
    expect(formatBulletsReport(FAKE, true).split("\n")[0]).toMatch(/\(counted run\)/);
  });

  it("T34e: the report stays within 15 lines when every run failed", () => {
    const failed = cvs.flatMap((c) => jobs.map((j) => ({ cv: c.id, job: j.id, reason: "unexpected error" })));
    const text = formatBulletsReport({ rows: [], noPairs: [], failed, complete: false }, true);
    expect(linesOf(text).length).toBeLessThanOrEqual(15);
    expect(text).toMatch(/RUNS: 15 \| calls 0/);
  });

  it("T34f: the review sheet lists every accepted bullet next to its cited CV line, with two empty columns for the reviewer", () => {
    const sheet = reviewSheet(FAKE);
    const rows = sheet.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| run") && !l.startsWith("| ---"));
    expect(rows).toHaveLength(9); // every accepted bullet, before the cap
    const header = sheet.split("\n").find((l) => l.startsWith("| run"))!;
    expect(header).toContain("INVENTED (yes/no)");
    expect(header).toContain("note: trivial bullet from a skill-list line");
    for (const r of FAKE.rows) {
      for (const b of r.accepted) {
        const mine = rows.filter((l) => l.includes(`| ${r.cv} x ${r.job} |`) && l.includes(`"${b.text}"`));
        expect(mine, `${r.cv} pair ${b.pair}`).toHaveLength(1);
        const line = r.pairs.find((p) => p.id === b.pair)!;
        expect(mine[0]).toContain(`line ${line.line}: "${line.text}"`);
        expect(mine[0]).toMatch(/\|\s*\|\s*\|\s*$/); // the two empty columns
      }
    }
    expect(sheet).not.toContain("Helped customers at the counter"); // the lines of the two dropped pairs that hold this text are not listed
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// T33: the script refuses to start without its guard variables and stops on a mismatch; the runner is a fake
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

const GOOD_HASH = "5e3da9fa30";
const GOOD_LEN = 3011;
const LIMITS = { "x-ratelimit-remaining-tokens": "8000", "x-ratelimit-limit-tokens": "8000" };

function harness(over: Partial<BulletsMainDeps> = {}) {
  const log = { writes: [] as { count: number; show: number }[], loadEnv: 0, fingerprints: 0, sleeps: [] as number[], saves: [] as { name: string; text: string }[], out: "", err: "" };
  const deps: BulletsMainDeps = {
    args: [],
    env: { EXPECT_REQUEST_HASH: GOOD_HASH, EXPECT_INSTRUCTIONS_LEN: "3,011", GROQ_API_KEY: "dummy-not-a-key", GROQ_MODEL: "dummy" },
    loadEnv: () => void log.loadEnv++,
    fingerprint: async () => {
      log.fingerprints++;
      return { hash10: GOOD_HASH, instructionsLength: GOOD_LEN, line: `FINGERPRINT: format 3 | request ${GOOD_HASH} | INSTRUCTIONS 3,011 characters\n` };
    },
    write: async (ps, show) => {
      log.writes.push({ count: ps.length, show });
      return {
        bullets: ps.map((p) => ({ pair: p.id, text: p.line })), // a fake AI that answers every pair with its own line
        asked: ps.length,
        dropped: [],
        usage: { inputTokens: 100, outputTokens: 20 },
        limits: LIMITS,
      };
    },
    sleep: async (ms) => void log.sleeps.push(ms),
    now: () => 1_700_000_000_000,
    save: (name, text) => {
      log.saves.push({ name, text });
      return `eval-runs/${name}`;
    },
    out: (t) => void (log.out += t),
    err: (t) => void (log.err += t),
    ...over,
  };
  return { deps, log };
}

describe("T33: the guard of the bullets eval, with a fake runner (no AI call is possible)", () => {
  it("T33a: no EXPECT_ variable at all: refused at once, naming both and the right script; nothing loaded, nothing fingerprinted, no call, nothing written", async () => {
    const { deps, log } = harness({ env: {} });
    const code = await evalBulletsMain(deps);
    expect(code).toBe(1);
    expect(log.err).toMatch(/Refused: EXPECT_REQUEST_HASH and EXPECT_INSTRUCTIONS_LEN must be set/);
    expect(log.err).toMatch(/npm run eval-bullets -- --fingerprint/);
    expect(log.err).not.toMatch(/eval-cv/);
    expect(log.err).toMatch(/No AI call was made/);
    expect(log.writes).toHaveLength(0);
    expect(log.loadEnv).toBe(0);
    expect(log.fingerprints).toBe(0);
    expect(log.saves).toHaveLength(0);
    expect(log.out).toBe("");
  });

  it("T33b: only one of the two set (or blank): refused, naming the missing one", async () => {
    for (const [env, name] of [
      [{ EXPECT_REQUEST_HASH: GOOD_HASH }, "EXPECT_INSTRUCTIONS_LEN"],
      [{ EXPECT_INSTRUCTIONS_LEN: "3011" }, "EXPECT_REQUEST_HASH"],
      [{ EXPECT_REQUEST_HASH: "  ", EXPECT_INSTRUCTIONS_LEN: "3011" }, "EXPECT_REQUEST_HASH"],
    ] as const) {
      const { deps, log } = harness({ env });
      expect(await evalBulletsMain(deps)).toBe(1);
      expect(log.err).toContain(`Refused: ${name} must be set`);
      expect(log.writes).toHaveLength(0);
      expect(log.fingerprints).toBe(0);
    }
  });

  it("T33c: a request hash that does not match is refused with both numbers; no call, nothing written", async () => {
    const { deps, log } = harness({ env: { EXPECT_REQUEST_HASH: "0000000000", EXPECT_INSTRUCTIONS_LEN: "3011", GROQ_API_KEY: "dummy-not-a-key", GROQ_MODEL: "dummy" } });
    expect(await evalBulletsMain(deps)).toBe(1);
    expect(log.err).toMatch(/Refused: request hash is 5e3da9fa30, expected 0000000000/);
    expect(log.err).toMatch(/No AI call was made/);
    expect(log.writes).toHaveLength(0);
    expect(log.saves).toHaveLength(0);
    expect(log.out).toBe("");
  });

  it("T33d: an instructions length that does not match is refused with both numbers; no call, nothing written", async () => {
    const { deps, log } = harness({ env: { EXPECT_REQUEST_HASH: GOOD_HASH, EXPECT_INSTRUCTIONS_LEN: "3010", GROQ_API_KEY: "dummy-not-a-key", GROQ_MODEL: "dummy" } });
    expect(await evalBulletsMain(deps)).toBe(1);
    expect(log.err).toMatch(/INSTRUCTIONS is 3011 characters, expected 3010/);
    expect(log.writes).toHaveLength(0);
    expect(log.saves).toHaveLength(0);
  });

  it("T33e: both wrong: one message with both problems; still no call", async () => {
    const { deps, log } = harness({ env: { EXPECT_REQUEST_HASH: "ffffffffff", EXPECT_INSTRUCTIONS_LEN: "1", GROQ_API_KEY: "dummy-not-a-key", GROQ_MODEL: "dummy" } });
    expect(await evalBulletsMain(deps)).toBe(1);
    expect(log.err).toMatch(/request hash is 5e3da9fa30, expected ffffffffff; INSTRUCTIONS is 3011 characters, expected 1/);
    expect(log.writes).toHaveLength(0);
  });

  it("T33f: --fingerprint prints the fingerprint line and stops: needs no EXPECT_ variable, makes no call", async () => {
    const { deps, log } = harness({ args: ["--fingerprint"], env: { GROQ_MODEL: "dummy" } });
    expect(await evalBulletsMain(deps)).toBe(0);
    expect(log.out).toBe(`FINGERPRINT: format 3 | request ${GOOD_HASH} | INSTRUCTIONS 3,011 characters\n`);
    expect(log.writes).toHaveLength(0);
    expect(log.saves).toHaveLength(0);
  });

  it("T33g: a missing key or model after loading the settings stops the run before any call", async () => {
    const { deps, log } = harness({ env: { EXPECT_REQUEST_HASH: GOOD_HASH, EXPECT_INSTRUCTIONS_LEN: "3011" } });
    expect(await evalBulletsMain(deps)).toBe(1);
    expect(log.err).toMatch(/GROQ_API_KEY and GROQ_MODEL must be set/);
    expect(log.err).not.toMatch(/dummy/);
    expect(log.writes).toHaveLength(0);
  });

  it("T33h: matching values: the loop runs, one call for each run that has pairs, show = the number of pairs, paced 3,000 ms apart; no call for a run with no pair", async () => {
    const { deps, log } = harness({ args: ["--calibration"] });
    expect(await evalBulletsMain(deps)).toBe(0);
    // Hand-worked (T35d): the four runs with pairs, in order: cv-1-thin x Northwind (1), cv-2-german x Northwind (5), cv-2-german x Brightwater (2), cv-4 x Fjordlight (1).
    expect(log.writes).toEqual([{ count: 1, show: 1 }, { count: 5, show: 5 }, { count: 2, show: 2 }, { count: 1, show: 1 }]);
    expect(log.sleeps).toEqual([3000, 3000, 3000]); // none before the first call; the fake's headers say the token allowance is full
    // The fake AI accepted every pair: asked 9, accepted 9, shown min(3, n) per run = 1 + 3 + 2 + 1 = 7; every bullet equals its line: UNCHANGED 9 of 9;
    // English (cv-1, cv-4): asked 2; German (cv-2): asked 7; tokens 4 x (100 in, 20 out).
    expect(log.out).toMatch(/CALIBRATION RUN \(not counted\)/);
    expect(log.out).toMatch(/RUNS: 15 \| calls 4 \| no pairs, no call 11 \| failed 0/);
    expect(log.out).toMatch(/PAIRS: asked 9 \| accepted 9 \(before the cap of 3\) \| shown 7 \(at most 3 a run\) \| dropped 0/);
    expect(log.out).toMatch(/ENGLISH: accepted 2 of 2 asked, shown 2/);
    expect(log.out).toMatch(/GERMAN: accepted 7 of 7 asked, shown 5/);
    expect(log.out).toMatch(/UNCHANGED 9 of 9 accepted/);
    expect(log.out).toMatch(/tokens 480 \(400 in, 80 out\)/);
    expect(log.out).toContain("FINGERPRINT: format 3 | request 5e3da9fa30");
    expect(log.out).toContain("(saved to eval-runs/");
    expect(linesOf(log.out).length).toBeLessThanOrEqual(15);
  });

  it("T33i: two files are saved (the full output and the review sheet), both under the bullets- prefix; the sheet holds the 9 accepted bullets", async () => {
    const { deps, log } = harness();
    await evalBulletsMain(deps);
    expect(log.saves).toHaveLength(2);
    expect(log.saves[0].name).toMatch(/^bullets-[0-9T-]+Z\.txt$/);
    expect(log.saves[1].name).toMatch(/^bullets-review-[0-9T-]+Z\.md$/);
    for (const c of ["cv-1-thin", "cv-2-german", "cv-4-skills-line", "cv-3-injection", "cv-5-prose"]) expect(log.saves[0].text).toContain(c);
    expect(log.saves[0].text).toContain("FINGERPRINT: format 3");
    const sheetRows = log.saves[1].text.split("\n").filter((l) => l.startsWith("| ") && !l.startsWith("| run") && !l.startsWith("| ---"));
    expect(sheetRows).toHaveLength(9);
    expect(log.out).not.toMatch(/Answered the phone|Schrieb SQL|Erstellte|Skills: TypeScript/); // the printed text carries counts, never bullets or CV lines
  });

  it("T33j: a 429 is waited out as scripts/evalCv.ts does (15,000 ms, then 45,000 ms) and retried by the script itself; after both waits the run FAILED and the rest go on", async () => {
    let n = 0;
    const good = harness().deps.write;
    const write: BulletsMainDeps["write"] = async (ps, show) => {
      n++;
      if (n <= 3) throw Object.assign(new Error("rate limited"), { status: 429 });
      return good(ps, show);
    };
    const { deps, log } = harness({ write });
    expect(await evalBulletsMain(deps)).toBe(0);
    expect(log.sleeps.slice(0, 2)).toEqual([15000, 45000]); // the first run: two waits, three attempts, then it fails
    expect(log.out).toMatch(/RUNS: 15 \| calls 3 \| no pairs, no call 11 \| failed 1/);
    expect(log.out).toMatch(/FAILED: cv-1-thin on northwind-operations-analyst \(rate limited, even after every retry\)/);
    expect(log.out).toMatch(/INCOMPLETE/);
    expect(log.out).not.toContain("Answered the phone"); // the reason never carries CV text
  });

  it("T33k: an unexpected throw anywhere prints one plain line, never the error's own message", async () => {
    const { deps, log } = harness({ fingerprint: async () => { throw new Error("secret CV text Answered the phone"); } });
    expect(await evalBulletsMain(deps)).toBe(1);
    expect(log.err).toMatch(/stopped on an unexpected error/);
    expect(log.err).not.toContain("Answered the phone");
    expect(log.writes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// Source guards: where the real runner is, the script entry, and that the results folder is never committed
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

const src = (p: string) => readFileSync(join(root, p), "utf8");

describe("stage 5 source guards: no AI call can come from a test", () => {
  it("S1: the main logic and the four stage-5 engine files import nothing from lib/ai, the AI SDK or app/ (the real runner is only in the entry)", () => {
    for (const f of ["scripts/evalBulletsMain.ts", "lib/engine/evalBulletsProfile.ts", "lib/engine/evalBulletsRun.ts", "lib/engine/evalBulletsReport.ts"]) {
      const text = src(f);
      expect(text, f).not.toMatch(/from\s+["'][^"']*(lib\/ai|@ai-sdk|\/app\/)[^"']*["']/);
      expect(text, f).not.toMatch(/from\s+["']ai["']/);
      expect(text, f).not.toMatch(/writeBullets/);
      expect(text, f).not.toMatch(/GROQ_API_KEY\s*=/); // no key is ever written here
    }
  });

  it("S2: the command-line entry wires the real writer, and only it does; no test imports the entry", () => {
    const entry = src("scripts/evalBullets.ts");
    expect(entry).toMatch(/from\s+["'][^"']*lib\/ai\/writeBullets["']/);
    expect(entry).toMatch(/evalBulletsMain/);
    for (const f of ["tests/evalBulletsGuard.test.ts", "tests/writeBulletsShow.test.ts"]) {
      expect(src(f), f).not.toMatch(/from\s+["'][^"']*scripts\/evalBullets["']/);
    }
  });

  it("S3: package.json has the script entry eval-bullets and no dependency was added for it", () => {
    const pkg = JSON.parse(src("package.json"));
    expect(pkg.scripts["eval-bullets"]).toBe("tsx scripts/evalBullets.ts");
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["@ai-sdk/groq", "ai", "mammoth", "next", "pdfjs-dist", "react", "react-dom", "zod"]);
  });

  it("S4: eval-runs/ is git-ignored (the full outputs and the review sheets are never committed, CLAUDE.md rule 8)", () => {
    expect(src(".gitignore").split("\n")).toContain("/eval-runs/");
  });
});
