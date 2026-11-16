import { describe, expect, it } from "vitest";
import {
  detailRows,
  formatSetLines,
  judge,
  measureSet,
  outcomeFor,
  repeatNote,
  type Item,
  type Outcome,
} from "@/lib/engine/mapMeasure";
import type { Skill } from "@/lib/engine/types";
import { skills } from "@/lib/vocab";

// The arithmetic of the 5.2 measure (docs/PLAN-5.1.md, "5.2 stage 2 rules and outcome definitions"), on made-up
// labelled names with hand-worked answers. No AI, no real names.

const mapped = (id: string): Outcome => ({ kind: "mapped", id });
const FLAG: Outcome = { kind: "flagged" };
const NONE: Outcome = { kind: "notmapped", how: "none" };
const TIE: Outcome = { kind: "notmapped", how: "tie" };
const it1 = (label: string, outcome: Outcome, name = "n"): Item => ({ name, label, outcome });
// n names that are right (label s, mapped s)
const rights = (n: number): Item[] => Array.from({ length: n }, (_, i) => it1("s", mapped("s"), `r${i}`));
const wrongs = (n: number): Item[] => Array.from({ length: n }, (_, i) => it1("s", mapped("other"), `w${i}`));

describe("measureSet: the categories", () => {
  it("K1: eleven labelled names, counted by hand", () => {
    const items: Item[] = [
      it1("a", mapped("a")), // right
      it1("a", mapped("b")), // wrong merge
      it1("a", FLAG), // wrongly flagged
      it1("a", TIE), // not mapped (tie)
      it1("a", NONE), // not mapped (none)
      it1("none", NONE), // right
      it1("none", mapped("x")), // wrong merge
      it1("none", FLAG), // wrongly flagged
      it1("not-a-skill", FLAG), // right
      it1("not-a-skill", mapped("y")), // wrong merge
      it1("not-a-skill", NONE), // trait not flagged (neutral)
    ];
    expect(measureSet(items, [], [])).toEqual({
      L: 11, M: 5, rightM: 1, right: 3, wrongMerges: 3, wronglyFlagged: 2, wrong: 5,
      notMappedTie: 1, notMappedNone: 1, traitNotFlagged: 1, mustNotMerge: 0,
    });
  });

  it("K2: an empty set is all zeros", () => {
    expect(measureSet([], [], [])).toEqual({
      L: 0, M: 0, rightM: 0, right: 0, wrongMerges: 0, wronglyFlagged: 0, wrong: 0,
      notMappedTie: 0, notMappedNone: 0, traitNotFlagged: 0, mustNotMerge: 0,
    });
  });
});

describe("the wrong line: wrong <= floor(5 x |L| / 100)", () => {
  const wrongLine = (items: Item[]) => judge(measureSet(items, [], [])).wrong;

  it("W1: |L| = 19 allows 0 wrong; |L| = 20 allows 1", () => {
    expect(wrongLine([...rights(18), ...wrongs(1)])).toEqual({ pass: false, limit: 0 }); // L 19, 1 wrong
    expect(wrongLine(rights(19))).toEqual({ pass: true, limit: 0 });
    expect(wrongLine([...rights(19), ...wrongs(1)])).toEqual({ pass: true, limit: 1 }); // L 20, 1 wrong
    expect(wrongLine([...rights(18), ...wrongs(2)])).toEqual({ pass: false, limit: 1 }); // L 20, 2 wrong
  });

  it("W2: floor, not round: |L| = 30 allows 1 (1.5 floors to 1); |L| = 39 allows 1; |L| = 40 allows 2", () => {
    expect(wrongLine([...rights(29), ...wrongs(1)])).toEqual({ pass: true, limit: 1 });
    expect(wrongLine([...rights(28), ...wrongs(2)])).toEqual({ pass: false, limit: 1 });
    expect(wrongLine([...rights(38), ...wrongs(1)]).limit).toBe(1); // 39
    expect(wrongLine([...rights(38), ...wrongs(2)]).limit).toBe(2); // 40
  });

  it("W3: wrongly flagged names count as wrong too", () => {
    expect(wrongLine([...rights(19), it1("s", FLAG)])).toEqual({ pass: true, limit: 1 });
    expect(wrongLine([...rights(18), it1("s", FLAG), it1("none", FLAG)])).toEqual({ pass: false, limit: 1 });
  });

  it("W4: a name not mapped is not wrong (a miss costs one line)", () => {
    expect(wrongLine([...rights(18), it1("s", TIE), it1("s", NONE)]).pass).toBe(true);
  });
});

describe("the recall line: 4 x right_M >= 3 x |M|", () => {
  const recall = (right: number, m: number) => {
    const items = [...rights(right), ...Array.from({ length: m - right }, (_, i) => it1("s", NONE, `m${i}`))];
    return judge(measureSet(items, [], [])).recall;
  };

  it("R1: 3 of 4 passes (12 >= 12); 2 of 3 fails (8 < 9); 4 of 5 passes (16 >= 15); 3 of 5 fails (12 < 15)", () => {
    expect(recall(3, 4).pass).toBe(true);
    expect(recall(2, 3).pass).toBe(false);
    expect(recall(4, 5).pass).toBe(true);
    expect(recall(3, 5).pass).toBe(false);
  });

  it("R2: 1 of 1 passes, 0 of 1 fails, 1 of 2 fails", () => {
    expect(recall(1, 1).pass).toBe(true);
    expect(recall(0, 1).pass).toBe(false);
    expect(recall(1, 2).pass).toBe(false);
  });

  it("R3: |M| = 0 is 'not measurable' and counts as NOT passed", () => {
    const only = [it1("none", NONE), it1("not-a-skill", FLAG)];
    const r = judge(measureSet(only, [], [])).recall;
    expect(r).toEqual({ pass: false, measurable: false });
    expect(judge(measureSet(only, [], [])).allPass).toBe(false);
  });
});

describe("the must-not-merge line", () => {
  const groups = [["java", "javascript", "typescript"], ["sql", "nosql"]];

  it("M1: a name mapped to another member of its label's group counts, and fails the line even when the other lines pass", () => {
    const items = [...rights(98), it1("java", mapped("javascript")), it1("s", mapped("s"))];
    const m = measureSet(items, groups, []);
    expect(m.L).toBe(100);
    expect(m.mustNotMerge).toBe(1);
    const j = judge(m);
    expect(j.wrong.pass).toBe(true); // 1 wrong of an allowed 5
    expect(j.recall.pass).toBe(true);
    expect(j.mustNotMerge.pass).toBe(false);
    expect(j.allPass).toBe(false);
  });

  it("M2: mapped to a wrong id in a DIFFERENT group, or outside any group, is wrong but not a merge", () => {
    const m = measureSet([it1("java", mapped("nosql")), it1("java", mapped("python"))], groups, []);
    expect(m.wrong).toBe(2);
    expect(m.mustNotMerge).toBe(0);
  });

  it("M3: the banned names: the word 'shift' mapped to swift counts, in any case, even with the label none", () => {
    const bans = [{ name: "shift", notId: "swift" }];
    const m = measureSet([it1("none", mapped("swift"), "Shift"), it1("none", mapped("swift"), "Swiftly"), it1("none", NONE, "shift")], [], bans);
    expect(m.mustNotMerge).toBe(1);
    expect(m.wrongMerges).toBe(2);
  });

  it("M4: no hit passes the line", () => {
    expect(judge(measureSet(rights(10), groups, [])).mustNotMerge.pass).toBe(true);
  });
});

describe("the verdict", () => {
  it("V1: all three lines must pass", () => {
    const good = measureSet(rights(20), [], []);
    expect(judge(good).allPass).toBe(true);
    const manyWrong = measureSet([...rights(18), ...wrongs(2)], [], []);
    expect(judge(manyWrong).allPass).toBe(false);
  });
});

describe("outcomeFor: the live order, flagged first", () => {
  const list: Skill[] = [{ id: "a", name: "Pillow" }, { id: "b", name: "Billow" }];
  const flag = (n: string) => n === "Team player";

  it("O1: flagged names are flagged and never mapped; a mapped name; a tie; none", () => {
    expect(outcomeFor("Team player", list, flag)).toEqual({ kind: "flagged" });
    expect(outcomeFor("Pillow", list, flag)).toEqual({ kind: "mapped", id: "a" });
    expect(outcomeFor("Pillows", list, flag)).toEqual({ kind: "mapped", id: "a" }); // close
    expect(outcomeFor("Dillow", list, flag)).toEqual({ kind: "notmapped", how: "tie" });
    // the live order: a name on the not-a-skill list is set aside BEFORE it is mapped, even if the mapper would find it
    expect(outcomeFor("Pillow", list, (n) => n === "Pillow")).toEqual({ kind: "flagged" });
    expect(outcomeFor("Zymurgy", list, flag)).toEqual({ kind: "notmapped", how: "none" });
  });

  it("O2: with the real vocabulary", () => {
    expect(outcomeFor("Excell", skills, () => false)).toEqual({ kind: "mapped", id: "excel" });
    expect(outcomeFor("Origami", skills, () => false)).toEqual({ kind: "notmapped", how: "none" });
  });
});

describe("repeatNote: the one-shot log", () => {
  const log = ["fresh | 2026-12-01 | aaaaaaaaaa", "", "holdout | 2026-12-01 | aaaaaaaaaa"];

  it("L1: nothing logged before: no note", () => {
    expect(repeatNote([], "fresh", "aaaaaaaaaa")).toEqual([]);
    expect(repeatNote(log, "newset", "aaaaaaaaaa")).toEqual([]);
  });

  it("L2: the same set measured before with a DIFFERENT vocabulary: the REPEAT line", () => {
    expect(repeatNote(log, "fresh", "bbbbbbbbbb")).toEqual(["REPEAT: second look, not the one-shot measure"]);
  });

  it("L3: the same set with the SAME vocabulary: a re-run note that names the date", () => {
    expect(repeatNote(log, "fresh", "aaaaaaaaaa")).toEqual(["RE-RUN: this set was already measured with this vocabulary on 2026-12-01"]);
  });
});

describe("what is printed and what is not", () => {
  const items: Item[] = [
    it1("a", mapped("a"), "SECRETNAME1"),
    it1("a", mapped("b"), "SECRETNAME2"),
    it1("a", NONE, "SECRETNAME3"),
    it1("not-a-skill", NONE, "SECRETNAME4"),
    it1("none", NONE, "SECRETNAME5"),
  ];
  const m = measureSet(items, [], []);

  it("P1: the lines carry counts and verdicts, never a name", () => {
    const text = formatSetLines("fresh", m, judge(m), true).join("\n");
    expect(text).not.toContain("SECRETNAME");
    expect(text).toContain("|L| 5");
    expect(text).toContain("|M| 3");
    expect(text).toMatch(/PASS|FAIL/);
    expect(text).not.toContain("%");
  });

  it("P2: an unjudged set is labelled so and has no verdict", () => {
    const text = formatSetLines("holdout", m, judge(m), false).join("\n");
    expect(text).toContain("not judged");
    expect(text).not.toContain("VERDICT");
  });

  it("P3: the detail rows (for the gitignored file) name the wrong, not-mapped and trait-not-flagged items", () => {
    const rows = detailRows("f.json", "fresh", items);
    expect(rows.map((r) => [r.name, r.kind])).toEqual([
      ["SECRETNAME2", "wrong"],
      ["SECRETNAME3", "notMapped"],
      ["SECRETNAME4", "traitNotFlagged"],
    ]);
  });
});
