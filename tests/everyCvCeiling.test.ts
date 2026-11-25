import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { recallCeiling } from "@/lib/engine/evalEveryCvCeiling";
import type { CvSkill } from "@/lib/engine/fromCv";

// EC-0b part 3 (docs/PLAN-EVERY-CV.md section 8, tests RC1 to RC5): the recall ceiling. The check can only cite an entry that exists, so
// for every requirement the key marks "met" we ask where an entry sits. Invented proposals; every expectation worked out by hand.
//
// The profile as the page builds it: the named proposals are ticked, the inferred ones are not (initialConfirm).
//   P1 SQL        listed,   named,    line 3   ticked
//   P2 Welding    unlisted, named,    line 5   ticked
//   P3 Reporting  listed,   inferred, line 4   NOT ticked
//   P4 Python     listed,   inferred, line 7   NOT ticked
const P = (name: string, skillId: string, listed: boolean, line: number, label: "named" | "inferred"): CvSkill => ({ name, skillId, listed, line, quote: "x", label });
const PROPOSALS = [P("SQL", "sql", true, 3, "named"), P("Welding", "new:welding", false, 5, "named"), P("Reporting", "reporting", true, 4, "inferred"), P("Python", "python", true, 7, "inferred")];
const m = (id: string, ...lines: number[]) => ({ id, lines });

describe("EC-0b part 3: the recall ceiling", () => {
  it("RC1: a key 'met' whose line holds a ticked entry is reachable (listed or unlisted alike); ceiling 1", () => {
    const r = recallCeiling(PROPOSALS, [m("R1", 3)]);
    expect(r.rows).toEqual([{ id: "R1", group: "reachable" }]);
    expect([r.reachable, r.recoverable, r.needsPromptChange, r.total, r.ceiling]).toEqual([1, 0, 0, 1, 1]);
    expect(recallCeiling(PROPOSALS, [m("R2", 5)]).rows[0].group).toBe("reachable"); // the unlisted Welding entry counts
  });

  it("RC2: an entry on ANOTHER line is not enough: a key line 2 with entries only on lines 3 and 5 is not reachable; ceiling 0", () => {
    const r = recallCeiling(PROPOSALS, [m("R1", 2)]);
    expect(r.rows[0].group).toBe("needs-prompt-change");
    expect(r.ceiling).toBe(0);
  });

  it("RC3: no ticked entry but an unticked inferred proposal on the line: recoverable by option (i)", () => {
    const r = recallCeiling(PROPOSALS, [m("R1", 4)]);
    expect(r.rows[0].group).toBe("recoverable");
    expect([r.reachable, r.recoverable, r.needsPromptChange, r.ceiling]).toEqual([0, 1, 0, 0]);
  });

  it("RC4: no proposal at all on any of the key's lines: needs option (ii) (a CV prompt change)", () => {
    const r = recallCeiling(PROPOSALS, [m("R1", 8, 9)]);
    expect(r.rows[0].group).toBe("needs-prompt-change");
    expect([r.reachable, r.recoverable, r.needsPromptChange]).toEqual([0, 0, 1]);
  });

  it("RC5: the ceiling is reachable divided by all 'met' of the key; with no 'met' there is no figure (null, never 100 %)", () => {
    // R1 line 3 reachable, R2 lines 5 and 9 reachable, R3 line 4 recoverable, R4 line 8 needs option (ii): 2 of 4
    const r = recallCeiling(PROPOSALS, [m("R1", 3), m("R2", 5, 9), m("R3", 4), m("R4", 8)]);
    expect([r.reachable, r.recoverable, r.needsPromptChange, r.total, r.ceiling]).toEqual([2, 1, 1, 4, 0.5]);
    const none = recallCeiling(PROPOSALS, []);
    expect([none.total, none.ceiling]).toEqual([0, null]);
  });

  it("RC6: a line with both a ticked and an unticked entry is reachable; several key lines: any one is enough", () => {
    const more = [...PROPOSALS, P("Dashboards", "dashboards", true, 4, "named")]; // a ticked entry joins the inferred one on line 4
    expect(recallCeiling(more, [m("R1", 4)]).rows[0].group).toBe("reachable");
    expect(recallCeiling(PROPOSALS, [m("R1", 1, 2, 3)]).rows[0].group).toBe("reachable"); // line 3 is one of the key's lines
  });

  it("RC7: the page's own rule decides what is ticked: no proposal that is only inferred ever counts as confirmed (source guard)", () => {
    const src = readFileSync(join(process.cwd(), "lib/engine/evalEveryCvCeiling.ts"), "utf8");
    expect(src).toMatch(/initialConfirm\(/);
  });
});
