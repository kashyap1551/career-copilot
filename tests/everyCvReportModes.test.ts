import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { compareBaseline, type AdReading, type PairBaseline } from "@/lib/engine/evalEveryCvCompare";
import { checkEveryCvKey } from "@/lib/engine/evalEveryCvKey";
import { baselineJson, baselineMarkdown, sameNameEffect, summaryTable } from "@/lib/engine/evalEveryCvReport";
import type { CvBuildResult, CvSkill } from "@/lib/engine/fromCv";
import type { Job, Requirement } from "@/lib/engine/types";
import { baselineMain } from "../scripts/everyCvBaselineMain";

// EC-0c part 1 (docs/PLAN-EVERY-CV.md section 10): the baseline report prints BOTH modes. The headline is the product as it was before the kept
// skills ("Today, before the kept skills (the original problem)"); the second set is "After the same-name match, before the AI check". Invented readings,
// the same shape as tests/everyCvCompare.test.ts. Every expectation is worked out by hand.
//
// The CV (as the page numbers it): 1 name, 2 contact, 3 "Analyst: wrote SQL queries for the sales team.", 4 "Skills: Welding".
// The CV reading: SQL (listed, line 3, named) and Welding (NOT listed, line 4, named). The ad has three musts and one nice:
//   R1 "Strong SQL skills."      [sql]           met by line 3 in both modes
//   R2 "A welding certificate."  [new:welding]   before: could not judge; after the same-name match: met by line 4
//   R3 "Excel for reporting."    [excel]         missing in both modes
//   R4 "Free coffee for all."    nice [new:coffee]   could not judge in both modes (an unlisted nice-to-have, not in the key)
const CV_LINES = ["Alex Example", "[email removed] | [phone removed]", "Analyst: wrote SQL queries for the sales team.", "Skills: Welding"];
const P = (name: string, skillId: string, listed: boolean, line: number): CvSkill => ({ name, skillId, listed, line, quote: "q", label: "named" });
const CV: CvBuildResult = { skills: [P("SQL", "sql", true, 3), P("Welding", "new:welding", false, 4)], removed: [], duplicates: 0, unlisted: [{ id: "new:welding", name: "Welding" }] };
const req = (quote: string, importance: "must" | "nice", ...skillIds: string[]): Requirement => ({ quote, importance, skillIds });
const Q = { sql: "Strong SQL skills.", weld: "A welding certificate.", xl: "Excel for reporting." };
const job: Job = {
  id: "ad", title: "Invented role", company: null, source: null,
  constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
  requirements: [req(Q.sql, "must", "sql"), req(Q.weld, "must", "new:welding"), req(Q.xl, "must", "excel"), req("Free coffee for all.", "nice", "new:coffee")],
};
const AD: AdReading = { job, removed: [], moved: [], unlisted: [{ id: "new:welding", name: "Welding" }, { id: "new:coffee", name: "Coffee" }], notCounted: [] };
const AD_TEXT = `${Object.values(Q).join("\n")}\nFree coffee for all.\nYou are a reliable person.`;
const keyText = (weldVerdict: string, weldLines: string, unsure = "") =>
  [
    `R1 [must] "${Q.sql}"\nverdict: met\ncv line(s): 3\nunsure:\nwhy:`,
    `R2 [must] "${Q.weld}"\nverdict: ${weldVerdict}\ncv line(s):${weldLines ? " " + weldLines : ""}\nunsure:${unsure ? " " + unsure : ""}\nwhy:`,
    `R3 [must] "${Q.xl}"\nverdict: none\ncv line(s):\nunsure:\nwhy:`,
    `T1 [trait, not counted] "You are a reliable person."`,
  ].join("\n\n");
const both = (weldVerdict = "met", weldLines = "4", unsure = "", pair = "pair-05", crossLanguage = false): { before: PairBaseline; after: PairBaseline } => {
  const key = checkEveryCvKey(keyText(weldVerdict, weldLines, unsure), AD_TEXT, CV_LINES.length);
  expect(key.state).toBe("complete");
  const base = { pair, crossLanguage, key, cvLines: CV_LINES, cv: CV, ad: AD, skills };
  return { before: compareBaseline({ ...base, withKept: false }), after: compareBaseline({ ...base, withKept: true }) };
};
const report = (bs = [both()]) => ({
  info: { runId: "r", fingerprint: "f".repeat(64), keyCommit: "abc1234", vocabulary: "v".repeat(64), dry: false },
  pairs: bs.map((b) => b.before),
  pairsAfter: bs.map((b) => b.after),
  calls: [], stopped: null, failed: [],
});

describe("EC-0c part 1: the report prints both modes", () => {
  it("RM1: what the same-name match alone changed: the welding requirement moved from 'could not judge' to met (1 to met, 0 to missing), no mistake when the key says met", () => {
    const b = both();
    expect(b.before.rows.find((r) => r.id === "R2")?.today.kind).toBe("unjudged");
    expect(b.after.rows.find((r) => r.id === "R2")?.today).toEqual({ kind: "met", line: 4 });
    expect(sameNameEffect([b.before], [b.after])).toEqual({ toMet: 1, toMissing: 0, mistakes: [] });
  });

  it("RM2: a same-name MISTAKE (the match says met, the key says partly or none) is listed with the pair, the requirement and the CV line", () => {
    const b = both("partly", "4", "", "pair-03");
    expect(sameNameEffect([b.before], [b.after])).toEqual({ toMet: 1, toMissing: 0, mistakes: [{ pair: "pair-03", id: "R2", quote: Q.weld, line: 4, verdict: "partly" }] });
    const n = both("none", "", "", "pair-04");
    expect(sameNameEffect([n.before], [n.after]).mistakes.map((m) => [m.pair, m.verdict])).toEqual([["pair-04", "none"]]);
  });

  it("RM3: an unsure row is not listed as a mistake (and, as everywhere, not counted)", () => {
    const b = both("partly", "4", "yes");
    expect(sameNameEffect([b.before], [b.after]).mistakes).toEqual([]);
  });

  it("RM4: baseline.md has the two titles, the 'What the same-name match alone changed' block, and the recall ceiling ONCE", () => {
    const md = baselineMarkdown(report([both("partly", "4", "", "pair-03")]));
    expect(md).toContain("## Today, before the kept skills (the original problem)");
    expect(md).toContain("## After the same-name match, before the AI check");
    expect(md).toContain("### What the same-name match alone changed");
    expect(md).toContain("1 requirement moved from could not judge to met, 0 to missing.");
    expect(md).toContain("Same-name mistakes (the match says met, the key says partly or none): 1");
    expect(md).toContain('- pair-03, R2, CV line 4, key says partly: "A welding certificate."');
    expect(md.match(/## Recall ceiling/g)).toHaveLength(1);
    expect(md.indexOf("## Today, before the kept skills")).toBeLessThan(md.indexOf("## After the same-name match"));
    // the headline set is the "before" numbers: R2 is could-not-judge there, met in the second set
    const head = md.slice(md.indexOf("## Today, before"), md.indexOf("## After the same-name match"));
    const second = md.slice(md.indexOf("## After the same-name match"), md.indexOf("## Recall ceiling"));
    expect(head).toMatch(/\| pair-03 \| R2 \| must \| partly \| could not judge \|/);
    expect(second).toMatch(/\| pair-03 \| R2 \| must \| partly \| met \(line 4\) \|/);
  });

  it("RM5: baseline.json carries both sets: the headline under pairs and summary (the single-set layout), the second under afterSameName", () => {
    const j = baselineJson(report([both(), both("met", "4", "", "pair-06", true)])) as unknown as {
      pairs: PairBaseline[]; summary: { crossLanguage: { pairs: string[] } };
      afterSameName: { pairs: PairBaseline[]; summary: { crossLanguage: { pairs: string[] } }; effect: { toMet: number } };
    };
    expect(j.pairs.map((p) => p.pair)).toEqual(["pair-05", "pair-06"]);
    expect(j.pairs[0].rows.find((r) => r.id === "R2")?.today.kind).toBe("unjudged");
    expect(j.afterSameName.pairs[0].rows.find((r) => r.id === "R2")?.today.kind).toBe("met");
    expect(j.summary.crossLanguage.pairs).toEqual(["pair-06"]);
    expect(j.afterSameName.summary.crossLanguage.pairs).toEqual(["pair-06"]);
    expect(j.afterSameName.effect.toMet).toBe(2);
  });

  it("RM6: the screen table shows two rows for each pair, the headline first; the header still starts '| Pair |'", () => {
    const b = both();
    const t = summaryTable([b.before], [b.after]);
    const lines = t.trim().split("\n");
    expect(lines[0].startsWith("| Pair |")).toBe(true);
    expect(lines[0]).toContain("| Mode |");
    expect(lines).toHaveLength(4); // header, rule, two rows
    expect(lines[2]).toContain("| pair-05 | before the kept skills |");
    expect(lines[3]).toContain("| pair-05 | after the same-name match |");
    // and the old single-set call still works
    expect(summaryTable([b.before]).trim().split("\n")).toHaveLength(3);
  });

  it("RM7: the ceiling is the same in both modes (it does not depend on the mode)", () => {
    const b = both();
    expect(b.after.ceiling).toEqual(b.before.ceiling);
  });

  it("RM8: the --dry screen shows both rows for the example pair, with the 'Mode' column, and writes nothing", async () => {
    const out: string[] = [];
    const written: string[] = [];
    const dir = join(process.cwd(), "fixtures/every-cv/example");
    const r = await baselineMain({
      args: ["--dry"], env: {}, root: "/virtual", outRoot: "/virtual/out",
      io: { readFile: (p) => readFileSync(join(dir, p.split("/").pop() as string), "utf8"), writeFile: (p) => void written.push(p), mkdirp: () => undefined, listDirs: () => [] },
      skills, git: { dirtyUnder: () => false, keyCommit: () => "x" }, now: () => new Date(0), sleep: async () => undefined,
      out: (t) => void out.push(t), err: () => undefined, loadReal: async () => ({ refusal: "never" }),
    });
    expect(r.exitCode).toBe(0);
    expect(written).toEqual([]);
    const screen = out.join("");
    expect(screen).toContain("| Pair | Mode |");
    expect(screen).toContain("| example | before the kept skills |");
    expect(screen).toContain("| example | after the same-name match |");
  });
});
