import { skills } from "@/fixtures/skills";
import type { PairCheckInput } from "@/lib/engine/evalEveryCvCheckScore";
import { checkEveryCvKey } from "@/lib/engine/evalEveryCvKey";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Requirement, Skill } from "@/lib/engine/types";

// Invented material for the EC-5 tests (docs/PLAN-EVERY-CV.md, the check eval). Not a test file. Everything is made up. A pair is described by its
// CV lines, the CV skills the reading found, the ad's requirements, and the owner's key (one entry for each requirement, in the ad's order).
// The levels follow the product's own fit rules (lib/engine/fit.ts): 0 missing musts Strong, 1 Good, 2 Stretch, 3 or more Long shot.

export type KeySpec = { v: "met" | "partly" | "none"; lines?: string; unsure?: boolean };
export type Spec = {
  pair: string;
  cvLines: string[];
  proposals: CvSkill[];
  reqs: Requirement[];
  key: KeySpec[];
  unlisted: Skill[];
};

export const req = (quote: string, importance: "must" | "nice", ...skillIds: string[]): Requirement => ({ quote, importance, skillIds });
export const prop = (name: string, skillId: string, listed: boolean, line: number, quote: string): CvSkill => ({ name, skillId, listed, line, quote, label: "named" });

export function pairInput(s: Spec, over: Partial<PairCheckInput> = {}): PairCheckInput {
  const adText = s.reqs.map((r) => r.quote).join("\n");
  const keyText = s.reqs
    .map((r, i) => `R${i + 1} [${r.importance}] "${r.quote}"\nverdict: ${s.key[i].v}\ncv line(s): ${s.key[i].lines ?? ""}\nunsure:${s.key[i].unsure ? " yes" : ""}\nwhy:`)
    .join("\n\n");
  const key = checkEveryCvKey(keyText, adText, s.cvLines.length);
  if (key.state !== "complete" || key.problems.length > 0) throw new Error(`the invented key of ${s.pair} is not complete: ${JSON.stringify(key.problems)}`);
  return {
    pair: s.pair,
    crossLanguage: false,
    key,
    cvLines: s.cvLines,
    cv: { skills: s.proposals, removed: [], duplicates: 0, unlisted: s.unlisted },
    ad: {
      job: {
        id: s.pair, title: "Invented role", company: null, source: null,
        constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
        requirements: s.reqs,
      },
      removed: [], moved: [], unlisted: s.unlisted, notCounted: [],
    },
    skills,
    confirm: "named",
    estimate: 5000,
    call: null,
    answered: null,
    failure: null,
    ...over,
  };
}

const U = (id: string, name: string): Skill => ({ id, name }) as Skill;

// ---- X: the level equals the key's ---------------------------------------------------------------------------------------------------------
// Musts M1 met (line 3), M2 partly, M3 none; the nice N1 (Excel, line 5) is met by the list and is not sent.
export const X: Spec = {
  pair: "pair-x",
  cvLines: ["Alex Example", "Opened the workshop each morning", "Kept pastry molds in order daily", "Swept the floor", "Wrote Excel sheets for the shop"],
  proposals: [prop("Mold care", "new:mold-care", false, 3, "Kept pastry molds"), prop("Excel", "excel", true, 5, "Excel sheets")],
  reqs: [
    req("You keep equipment in order.", "must", "new:equipment-order"),
    req("You have run a shift for five years.", "must", "new:shift-lead"),
    req("You hold a food-safety certificate.", "must", "new:food-safety"),
    req("Excel is a plus.", "nice", "excel"),
  ],
  key: [{ v: "met", lines: "3" }, { v: "partly", lines: "3" }, { v: "none" }, { v: "met", lines: "5" }],
  unlisted: [U("new:equipment-order", "Equipment order"), U("new:shift-lead", "Shift lead"), U("new:food-safety", "Food safety")],
};
// EC-8a: the entries sent are the CV's own lines: E1 to E5 are CV line 1 to CV line 5, so the line of an entry is its number. Requirements sent: R1 M1,
// R2 M2, R3 M3.
export const REPLY_X = {
  answers: [
    { requirement: 1, verdict: "met", entry: 3, quote: "pastry molds in order" },
    { requirement: 2, verdict: "partly", entry: 3, quote: "Kept pastry molds" },
    { requirement: 3, verdict: "none", entry: null, quote: null },
  ],
  thrownAway: 0,
};

// ---- Y: STRONGER than the key (a wrong line and a false met) ---------------------------------------------------------------------------------
// Musts M1 met (line 2), M2 none. The AI says M1 met on line 4 (wrong evidence, 1b) and M2 met on line 6 (1a).
export const Y: Spec = {
  pair: "pair-y",
  cvLines: ["Alex Example", "Ran the front counter with the tills", "Wrote SQL queries for the till reports", "Closed the shop at night alone", "Cleaned the windows", "Spoke fluent Spanish to guests"],
  proposals: [prop("Counter work", "new:counter-work", false, 2, "front counter"), prop("SQL", "sql", true, 3, "Wrote SQL queries"), prop("Night closing", "new:night-closing", false, 4, "Closed the shop"), prop("Guest talk", "new:guest-talk", false, 6, "fluent Spanish")],
  reqs: [req("You can run a front counter.", "must", "new:counter-skill"), req("You hold a forklift licence.", "must", "new:forklift")],
  key: [{ v: "met", lines: "2" }, { v: "none" }],
  unlisted: [U("new:counter-skill", "Counter skill"), U("new:forklift", "Forklift")],
};
// Entries (EC-8a): E1 to E6 are CV line 1 to CV line 6. (A listed skill is on the profile, as on every real one. Before EC-8b a profile with
// only unlisted skills was shown as "No level (no skills on your profile)" whatever the check said; this world keeps its listed skill.)
export const REPLY_Y = {
  answers: [
    { requirement: 1, verdict: "met", entry: 4, quote: "Closed the shop at night" },
    { requirement: 2, verdict: "met", entry: 6, quote: "fluent Spanish" },
  ],
  thrownAway: 0,
};

// ---- Z: a must stays unjudged: the level is a ceiling ------------------------------------------------------------------------------------------
// Musts M1 met (line 1), M2 met (line 2). The AI says M1 met on line 1; the answer for M2 was thrown away (the route says so in `thrownAway`).
export const Z: Spec = {
  pair: "pair-z",
  cvLines: ["Handled supplier orders weekly", "Trained two new colleagues each term", "Wrote SQL queries for stock reports"],
  proposals: [prop("Ordering", "new:ordering", false, 1, "supplier orders"), prop("Training", "new:training", false, 2, "Trained two"), prop("SQL", "sql", true, 3, "Wrote SQL queries")],
  reqs: [req("You handle supplier orders.", "must", "new:order-skill"), req("You train colleagues.", "must", "new:train-skill")],
  key: [{ v: "met", lines: "1" }, { v: "met", lines: "2" }],
  unlisted: [U("new:order-skill", "Order skill"), U("new:train-skill", "Train skill")],
};
export const REPLY_Z = { answers: [{ requirement: 1, verdict: "met", entry: 1, quote: "Handled supplier orders" }], thrownAway: 1 };

export const CALL = (inputTokens: number, outputTokens: number, over: Record<string, unknown> = {}) => ({
  attempts: 1, statuses: [200], real429: 0, ms: 4000, inputTokens, outputTokens, ...over,
});
