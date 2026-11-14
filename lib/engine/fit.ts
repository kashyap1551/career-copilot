import type { ConflictKind, DecidedBy, FitLevel } from "./types";

// The fit rules (docs/SPRINT.md, with the combination rule in
// docs/DECISIONS.md). Pure: counts in, level out.
//
// gaps = missing must-haves + conflicts that can be closed.
//   any conflict that can't be closed soon -> Long shot (named first)
//   3 or more gaps                         -> Long shot
//   2 gaps                                 -> Stretch
//   1 gap: a missing must-have             -> Good
//          a closable conflict             -> Stretch
//   0 gaps                                 -> Strong
// Nice-to-haves never come in here.

export type FitInput = {
  missingMusts: number;
  // In the order match() found them; the first one that can't be closed is
  // the one named in decidedBy.
  conflicts: { kind: ConflictKind; closable: boolean }[];
};

export function fitLevel(input: FitInput): {
  level: FitLevel;
  decidedBy: DecidedBy;
} {
  const unclosable = input.conflicts.find((c) => !c.closable);
  if (unclosable) {
    return {
      level: "longShot",
      decidedBy: `unclosable-conflict:${unclosable.kind}`,
    };
  }

  const closable = input.conflicts.length;
  const gaps = input.missingMusts + closable;

  if (gaps >= 3) return { level: "longShot", decidedBy: "three-or-more-gaps" };
  if (gaps === 2) return { level: "stretch", decidedBy: "two-gaps" };
  if (gaps === 1) {
    return input.missingMusts === 1
      ? { level: "good", decidedBy: "one-must-missing" }
      : { level: "stretch", decidedBy: "one-closable-conflict" };
  }
  return { level: "strong", decidedBy: "all-musts-met" };
}
