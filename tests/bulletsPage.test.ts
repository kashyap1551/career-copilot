import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile, type ConfirmState } from "@/lib/cv/profile";
import { bulletCandidates, bulletCandidatesSafe, blockKey, requestBodyFor } from "@/app/bullets";
import type { BulletPair } from "@/lib/engine/bulletPairs";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job, Requirement } from "@/lib/engine/types";
import { writeBulletsRequestSchema } from "@/lib/schemas/bullets";
import { ad } from "./support/roadmapFixtures";
import { adsViaPage, pastedId, savedIdsFor } from "./support/viaPage";

// Step 8.3, stage 4, tests first (docs/PLAN-8.3.md v2, 0.26 and section 18; tests T28, T29 and T37). The pairs of the block come from the engine view of the AD ON SCREEN
// and the profile in use, built the page's way (the ad reaches the engine through roadmapAds: job id "pasted-ad", never a saved id). A candidate the route would refuse is
// not sent and the next one takes its place, up to 5; the ids sent are renumbered 1..n. Every expected pair below is a hand result of the plan's P cases. Invented text only.

const L4 = "Answered the phone and kept the stock sheet up to date in Excel";
const L5 = "Helped customers at the counter";
const CV1 = ["Sam Placeholder, Junior Assistant, Testville", "[email removed] | [phone removed]", "2023-2024 Office Assistant, Imaginary Bakery Ltd", L4, L5];

const prop = (name: string, skillId: string, line: number, quote: string): CvSkill => ({ name, skillId, listed: true, line, quote, label: "named" });
const confirm = (o: Partial<ConfirmState>): ConfirmState => ({ keptIds: [], added: [], inProgress: [], languages: [], cities: "Berlin", workModes: [], years: "", availableFrom: "", ...o });
const req = (importance: "must" | "nice", id: string, quote: string): Requirement => ({ skillIds: [id], importance, quote });

// The ad on screen, the page's way: through roadmapAds (job id "pasted-ad", a distinct saved id), never by a saved id.
const onScreen = (reqs: Requirement[], jobIdOf?: (i: number) => string): Job => adsViaPage([ad("j1", "Invented Ad", "Invented Co", reqs)], savedIdsFor(1), jobIdOf)[0].job;

const EXCEL4 = prop("Excel", "excel", 4, "kept the stock sheet up to date in Excel");
const CUST5 = prop("Customer service", "customer-service", 5, "Helped customers at the counter");
const P1_REQS = [req("must", "excel", "Excel is required."), req("must", "python", "Python is required."), req("nice", "customer-service", "Customer service is a plus.")];
const P1_BUILT = () => buildProfile(CV1, [EXCEL4, CUST5], confirm({ keptIds: ["excel", "customer-service"] }), skills);

const L7 = [
  "Kept the books in Excel",
  "Wrote SQL queries",
  "Wrote Python scripts",
  "Built dashboards in Tableau",
  "Kept spreadsheets tidy",
  "Planned in Google Sheets",
  "Helped customers at the counter",
];
const P7 = [
  prop("Excel", "excel", 1, "Excel"),
  prop("SQL", "sql", 2, "SQL"),
  prop("Python", "python", 3, "Python"),
  prop("Tableau", "tableau", 4, "Tableau"),
  prop("Spreadsheets", "spreadsheets", 5, "spreadsheets"),
  prop("Google Sheets", "google-sheets", 6, "Google Sheets"),
  prop("Customer service", "customer-service", 7, "Helped customers"),
];
const KEPT7 = confirm({ keptIds: P7.map((p) => p.skillId) });
const SIX_MUSTS = (firstQuote = "Excel is required.") => [
  req("must", "excel", firstQuote),
  req("must", "sql", "SQL is required."),
  req("must", "python", "Python is required."),
  req("must", "tableau", "Tableau is required."),
  req("must", "spreadsheets", "Spreadsheets are required."),
  req("must", "google-sheets", "Google Sheets is required."),
  req("nice", "customer-service", "Customer service is a plus."),
];
const ids = (pairs: BulletPair[]) => pairs.map((p) => p.id);
const skillIds = (pairs: BulletPair[]) => pairs.map((p) => p.skillId);
const lines = (pairs: BulletPair[]) => pairs.map((p) => p.line);

describe("T37: the candidates of the block", () => {
  it("T37 P1, the page's way: Excel (line 4) and Customer service (line 5), ids 1 and 2, Python (unmet) none", () => {
    expect(bulletCandidates(onScreen(P1_REQS), P1_BUILT())).toEqual([
      { id: 1, requirement: "Excel is required.", skillId: "excel", line: 4, text: L4 },
      { id: 2, requirement: "Customer service is a plus.", skillId: "customer-service", line: 5, text: L5 },
    ]);
  });

  it("T37: a requirement over 300 characters is NOT sent; the next candidate takes its place, up to 5; the ids are renumbered 1..5", () => {
    const got = bulletCandidates(onScreen(SIX_MUSTS("a".repeat(301))), buildProfile(L7, P7, KEPT7, skills));
    expect(ids(got)).toEqual([1, 2, 3, 4, 5]);
    expect(skillIds(got)).toEqual(["sql", "python", "tableau", "spreadsheets", "google-sheets"]);
    expect(lines(got)).toEqual([2, 3, 4, 5, 6]); // the real CV line numbers are kept
  });

  it("T37: a requirement of exactly 300 characters is sent (the edge)", () => {
    const got = bulletCandidates(onScreen(SIX_MUSTS("a".repeat(300))), buildProfile(L7, P7, KEPT7, skills));
    expect(skillIds(got)).toEqual(["excel", "sql", "python", "tableau", "spreadsheets"]);
    expect(lines(got)).toEqual([1, 2, 3, 4, 5]);
  });

  it("T37: a CV line that still holds an email address is NOT sent; the next candidate takes its place; ids 1..5", () => {
    const lines7 = [...L7];
    lines7[2] = "Wrote Python scripts, mail me at a@b.example";
    const got = bulletCandidates(onScreen(SIX_MUSTS()), buildProfile(lines7, P7, KEPT7, skills));
    expect(skillIds(got)).toEqual(["excel", "sql", "tableau", "spreadsheets", "google-sheets"]);
    expect(ids(got)).toEqual([1, 2, 3, 4, 5]);
    expect(lines(got)).toEqual([1, 2, 4, 5, 6]);
  });

  it("T37: a CV line of 1,001 characters is NOT sent; one of 1,000 is", () => {
    const long = [...L7];
    long[0] = "Kept the books in Excel" + " a".repeat(489); // 23 + 978 = 1,001 characters
    expect(long[0].length).toBe(1001);
    expect(skillIds(bulletCandidates(onScreen(SIX_MUSTS()), buildProfile(long, P7, KEPT7, skills)))).toEqual(["sql", "python", "tableau", "spreadsheets", "google-sheets"]);
    const edge = [...L7];
    edge[0] = "Kept the books in Excel" + " a".repeat(488) + "b"; // 23 + 976 + 1 = 1,000 characters
    expect(edge[0].length).toBe(1000);
    expect(bulletCandidates(onScreen(SIX_MUSTS()), buildProfile(edge, P7, KEPT7, skills))[0].skillId).toBe("excel");
  });

  it("T37: when every candidate is refused nothing is left: an empty list (the block shows its 'nothing to write from' line)", () => {
    expect(bulletCandidates(onScreen([req("must", "excel", "a".repeat(301))]), P1_BUILT())).toEqual([]);
  });

  it("T37: the body sent holds the id, the requirement and the line text of each pair, and nothing else; the route's own schema accepts it", () => {
    const pairs = bulletCandidates(onScreen(P1_REQS), P1_BUILT());
    const body = requestBodyFor(pairs);
    expect(body).toEqual({
      pairs: [
        { id: 1, requirement: "Excel is required.", line: L4 },
        { id: 2, requirement: "Customer service is a plus.", line: L5 },
      ],
    });
    expect(writeBulletsRequestSchema.safeParse(body).success).toBe(true);
    const five = bulletCandidates(onScreen(SIX_MUSTS("a".repeat(301))), buildProfile(L7, P7, KEPT7, skills));
    expect(writeBulletsRequestSchema.safeParse(requestBodyFor(five)).success).toBe(true);
  });
});

describe("T28: when the block has nothing to write from", () => {
  const r = [req("must", "excel", "Excel is required.")];
  it("T28: no profile in use, a profile with no skills, an Excel added by hand (no CV line), Excel in progress: no candidate", () => {
    expect(bulletCandidates(onScreen(r), null)).toEqual([]);
    expect(bulletCandidates(onScreen(r), buildProfile(CV1, [], confirm({}), skills))).toEqual([]);
    expect(bulletCandidates(onScreen(r), buildProfile(CV1, [], confirm({ added: ["Excel"] }), skills))).toEqual([]);
    expect(bulletCandidates(onScreen(r), buildProfile(CV1, [], confirm({ inProgress: [{ name: "Excel", date: "2027-03-01" }] }), skills))).toEqual([]);
  });
  it("T28: a learning line is not used: Excel evidenced by 'Learning Excel formulas ...' gives no candidate", () => {
    const lines1 = ["Learning Excel formulas in an evening course"];
    expect(bulletCandidates(onScreen(r), buildProfile(lines1, [prop("Excel", "excel", 1, "Learning Excel formulas")], confirm({ keptIds: ["excel"] }), skills))).toEqual([]);
  });
});

describe("T29 (page): P0 for the block: the same ad gives the same candidates whatever its job id", () => {
  it("T29: job id 'pasted-ad' or a distinct job id: equal candidates, equal to the hand pairs", () => {
    const want = [
      { id: 1, requirement: "Excel is required.", skillId: "excel", line: 4, text: L4 },
      { id: 2, requirement: "Customer service is a plus.", skillId: "customer-service", line: 5, text: L5 },
    ];
    expect(bulletCandidates(onScreen(P1_REQS, pastedId), P1_BUILT())).toEqual(want);
    expect(bulletCandidates(onScreen(P1_REQS, (i) => `job-${i}`), P1_BUILT())).toEqual(want);
  });
});

describe("the block's key and the safe wrapper", () => {
  it("the key changes with the ad and with the profile, and is the same for the same ad and profile", () => {
    const a = onScreen(P1_REQS);
    const k = blockKey(a, P1_BUILT());
    expect(blockKey(onScreen(P1_REQS), P1_BUILT())).toBe(k);
    expect(blockKey(onScreen([req("must", "excel", "Excel, please.")]), P1_BUILT())).not.toBe(k);
    expect(blockKey(a, buildProfile(CV1, [EXCEL4], confirm({ keptIds: ["excel"] }), skills))).not.toBe(k);
  });
  it("T42: an unexpected throw (a reading with no requirements) is a failed outcome, not an exception", () => {
    const broken = { ...onScreen(P1_REQS), requirements: undefined } as never as Job;
    expect(() => bulletCandidates(broken, P1_BUILT())).toThrow();
    expect(bulletCandidatesSafe(broken, P1_BUILT())).toEqual({ kind: "failed" });
    expect(bulletCandidatesSafe(onScreen(P1_REQS), P1_BUILT())).toEqual({ kind: "pairs", pairs: bulletCandidates(onScreen(P1_REQS), P1_BUILT()) });
  });
});
