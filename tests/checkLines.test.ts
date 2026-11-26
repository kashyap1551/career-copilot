import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildCheckInput, CHECK_INPUT_REFUSED, CHECK_MAX_ENTRIES } from "@/lib/ai/checkInput";
import { buildCheckPlan, PLAN_MAX_ENTRIES } from "@/lib/cv/checkPlan";
import { toViewAnswers } from "@/lib/cv/checkBridge";
import { numberLines } from "@/lib/cv/numberLines";
import { removeContactDetails } from "@/lib/cv/redact";
import { proveAnswers, type SentEntry } from "@/lib/engine/evidenceProof";
import { checkRequestSchema } from "@/lib/schemas/check";
import { job } from "./support/evidenceFixtures";
import { LINES_W, personW } from "./support/checkWorld";

// EC-8a (docs/PLAN-EVERY-CV.md, EC-8): the check reads the person's own CV lines. One entry for each non-empty line the page sent to the CV reader
// (contact details already removed), named "CV line <n>" with n the page's own line number. Ticking or unticking a skill decides nothing about which
// lines are sent. Every expectation is worked out by hand from the invented CVs below; none comes from running the code.

const pageLines = (raw: string) => numberLines(removeContactDetails(raw));
const lineTexts = (i: number) => `Invented line ${i + 1} about the weekly report`;
const manyLines = (n: number) => Array.from({ length: n }, (_, i) => lineTexts(i));

describe("EC-8a entries are the CV's own lines (EL)", () => {
  it("EL1: a CV of 5 raw lines with one blank line gives 4 entries named by the PAGE's line numbers (1 to 4), each with its own text", () => {
    const raw = ["Alex Example", "", "Wrote SQL queries for the weekly report", "Welded steel frames in a workshop", "Dressed and monitored wounds on a surgical ward"].join("\n");
    const lines = pageLines(raw);
    expect(lines).toHaveLength(4); // the blank line is not a line of the page
    const r = buildCheckPlan(job(), personW({}, lines), skills, null);
    expect(r.entries.map((e) => [e.n, e.name, e.line, e.text])).toEqual([
      [1, "CV line 1", 1, "Alex Example"],
      [2, "CV line 2", 2, "Wrote SQL queries for the weekly report"],
      [3, "CV line 3", 3, "Welded steel frames in a workshop"],
      [4, "CV line 4", 4, "Dressed and monitored wounds on a surgical ward"],
    ]);
    expect(r.entriesAvailable).toBe(4);
    expect(r.entriesNotSent).toBe(0);
  });

  it("EL2: a line that held only an email address is NOT dropped by the page (it reads '[email removed]'), so it is an entry with its page number", () => {
    const raw = ["Alex Example", "jane.sample@example.com", "Wrote SQL queries for the weekly report", "Welded steel frames in a workshop", "Dressed and monitored wounds on a surgical ward"].join("\n");
    const lines = pageLines(raw);
    expect(lines[1]).toBe("[email removed]");
    const r = buildCheckPlan(job(), personW({}, lines), skills, null);
    expect(r.entries).toHaveLength(5);
    expect([r.entries[1].name, r.entries[1].text]).toEqual(["CV line 2", "[email removed]"]);
    expect(r.entries.map((e) => e.text).join("\n")).not.toContain("jane.sample@example.com");
  });

  it("EL3: 125 non-empty lines: 120 are sent (CV line 1 to CV line 120, n 1 to 120), 125 were available, 5 are counted as not sent", () => {
    const r = buildCheckPlan(job(), personW({}, manyLines(125)), skills, null);
    expect(PLAN_MAX_ENTRIES).toBe(120);
    expect(r.entries).toHaveLength(120);
    expect([r.entries[0].n, r.entries[0].name]).toEqual([1, "CV line 1"]);
    expect([r.entries[119].n, r.entries[119].name, r.entries[119].line]).toEqual([120, "CV line 120", 120]);
    expect(r.entries.some((e) => e.name === "CV line 121")).toBe(false);
    expect(r.entriesAvailable).toBe(125);
    expect(r.entriesNotSent).toBe(5);
  });

  it("EL4: ticking or unticking a skill does not change the entries (all kept, none kept, a hand-added skill: the same 4 entries)", () => {
    const all = buildCheckPlan(job(), personW({ keptIds: ["sql", "new:ward-nursing"] }), skills, null).entries;
    const none = buildCheckPlan(job(), personW({ keptIds: [] }), skills, null).entries;
    const handAdded = buildCheckPlan(job(), personW({ added: ["Excel"] }), skills, null).entries;
    expect(all).toHaveLength(4);
    expect(none).toEqual(all);
    expect(handAdded).toEqual(all);
    expect(all.every((e) => e.inferred === false)).toBe(true);
  });

  it("EL5: a line of 1,200 characters is cut to 1,000 for sending", () => {
    const long = "x".repeat(1200);
    const r = buildCheckPlan(job(), personW({}, [long, ...LINES_W.slice(1)]), skills, null);
    expect(r.entries[0].text).toHaveLength(1000);
    expect(r.entries[1].text).toBe(LINES_W[1]);
  });

  it("EL6: empty lines (a saved profile keeps only the lines its skills cite) are skipped, but the others keep their own line numbers: lines 2 and 4 are entries n 1 and 2", () => {
    const built = personW();
    const sparse = { ...built, profile: { ...built.profile, cvLines: ["", LINES_W[1], "  ", LINES_W[3]] } };
    const r = buildCheckPlan(job(), sparse, skills, null);
    expect(r.entries.map((e) => [e.n, e.name, e.line])).toEqual([[1, "CV line 2", 2], [2, "CV line 4", 4]]);
  });

  it("EL7: the proof still holds: a quote that is not inside its line's text is thrown away; one that is inside is accepted", () => {
    const { entries } = buildCheckPlan(job(), personW(), skills, null);
    const sent = [{ n: 1, index: 0, quote: "Can weld steel", importance: "must" as const }];
    const wrong = proveAnswers(sent, entries, [{ requirement: 1, verdict: "met", entry: 2, quote: "Welded steel frames" }]); // that text is on line 3, not line 2
    expect(wrong.accepted).toEqual([]);
    expect(wrong.thrownAway).toEqual([{ requirement: 1, reason: "quote-not-on-line" }]);
    const right = proveAnswers(sent, entries, [{ requirement: 1, verdict: "met", entry: 3, quote: "Welded steel frames" }]);
    expect(right.accepted.map((a) => [a.entry?.name, a.quote])).toEqual([["CV line 3", "Welded steel frames"]]);
  });

  it("EL8: an answer on the entry named 'CV line 7' maps to line 7, whatever the entry's position or its line field say", () => {
    const entries: SentEntry[] = [
      { n: 1, name: "CV line 7", skillId: "line:7", line: 1, text: "Dressed and monitored wounds on a surgical ward", inferred: false },
      { n: 2, name: "CV line 9", skillId: "line:9", line: 2, text: "Wrote SQL queries for the weekly report", inferred: false },
    ];
    const sent = { requirements: [{ n: 1, index: 2, quote: "You can care for wounds.", importance: "must" as const }], entries };
    const r = toViewAnswers(sent, { answers: [{ requirement: 1, verdict: "met", entry: 1, quote: "Dressed and monitored wounds" }], thrownAway: 0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.answers[0].entry?.evidence).toEqual({ line: 7, text: "Dressed and monitored wounds on a surgical ward" });
    expect(r.answers[0].entry?.name).toBe("CV line 7");
  });

  it("EL9: the caps are 120 everywhere: the plan, the input text and the route's schema take 120 entries and refuse 121", () => {
    expect(PLAN_MAX_ENTRIES).toBe(120);
    expect(CHECK_MAX_ENTRIES).toBe(120);
    const reqs = [{ n: 1, index: 0, quote: "Can weld.", importance: "must" as const }];
    const entry = (i: number): SentEntry => ({ n: i + 1, name: `CV line ${i + 1}`, skillId: `line:${i + 1}`, line: i + 1, text: lineTexts(i), inferred: false });
    expect(() => buildCheckInput(reqs, Array.from({ length: 120 }, (_, i) => entry(i)))).not.toThrow();
    expect(() => buildCheckInput(reqs, Array.from({ length: 121 }, (_, i) => entry(i)))).toThrow(CHECK_INPUT_REFUSED);
    expect(CHECK_INPUT_REFUSED).toBe("The check needs 1 to 30 requirements and 1 to 120 CV entries.");
    const body = (n: number) => ({ requirements: ["Can weld."], entries: Array.from({ length: n }, (_, i) => ({ name: `CV line ${i + 1}`, text: lineTexts(i) })) });
    expect(checkRequestSchema.safeParse(body(120)).success).toBe(true);
    expect(checkRequestSchema.safeParse(body(121)).success).toBe(false);
  });
});
