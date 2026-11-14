import { describe, expect, it } from "vitest";
import { fitLevel } from "@/lib/engine/fit";
import type { ConflictKind, DecidedBy, FitLevel } from "@/lib/engine/types";

// Expected values come from the written rules (docs/SPRINT.md) and the
// combination rule in docs/DECISIONS.md, worked out by hand. Never from
// running the code.
//   c = a conflict that can be closed, X = one that can't be closed soon

const c = (kind: ConflictKind) => ({ kind, closable: true });
const X = (kind: ConflictKind) => ({ kind, closable: false });

type Row = {
  name: string;
  missing: number;
  conflicts: { kind: ConflictKind; closable: boolean }[];
  level: FitLevel;
  decidedBy: DecidedBy;
};

const rows: Row[] = [
  { name: "nothing missing", missing: 0, conflicts: [], level: "strong", decidedBy: "all-musts-met" },
  { name: "one must-have missing", missing: 1, conflicts: [], level: "good", decidedBy: "one-must-missing" },
  { name: "one closable conflict alone", missing: 0, conflicts: [c("language")], level: "stretch", decidedBy: "one-closable-conflict" },
  { name: "two missing", missing: 2, conflicts: [], level: "stretch", decidedBy: "two-gaps" },
  { name: "one missing + one closable", missing: 1, conflicts: [c("years")], level: "stretch", decidedBy: "two-gaps" },
  { name: "two closable conflicts", missing: 0, conflicts: [c("language"), c("years")], level: "stretch", decidedBy: "two-gaps" },
  { name: "three missing", missing: 3, conflicts: [], level: "longShot", decidedBy: "three-or-more-gaps" },
  { name: "two missing + a closable language gap (the DECISIONS example)", missing: 2, conflicts: [c("language")], level: "longShot", decidedBy: "three-or-more-gaps" },
  { name: "three closable conflicts", missing: 0, conflicts: [c("language"), c("years"), c("startDate")], level: "longShot", decidedBy: "three-or-more-gaps" },
  { name: "unclosable years alone", missing: 0, conflicts: [X("years")], level: "longShot", decidedBy: "unclosable-conflict:years" },
  { name: "unclosable city with one missing", missing: 1, conflicts: [X("city")], level: "longShot", decidedBy: "unclosable-conflict:city" },
  { name: "unclosable beats a pile of missing", missing: 5, conflicts: [c("language"), X("city")], level: "longShot", decidedBy: "unclosable-conflict:city" },
  { name: "two unclosable: the first one is named", missing: 0, conflicts: [X("years"), X("city")], level: "longShot", decidedBy: "unclosable-conflict:years" },
];

describe("fitLevel", () => {
  it.each(rows)("$name", ({ missing, conflicts, level, decidedBy }) => {
    expect(fitLevel({ missingMusts: missing, conflicts })).toEqual({
      level,
      decidedBy,
    });
  });
});
