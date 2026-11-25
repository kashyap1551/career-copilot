import { initialConfirm } from "../cv/profile";
import type { CvSkill } from "./fromCv";

// The recall ceiling of the accuracy test (docs/PLAN-EVERY-CV.md sections 8 and 9, tests RC1 to RC5). The check can only cite an
// entry that exists. For every requirement the owner's key marks "met": does a CONFIRMED entry (the profile as the page builds it from
// a CV reading: the named skills ticked, the inferred ones not) sit on one of the key's lines? Pure code: no AI, no network.
//
//   reachable          an entry that is confirmed sits on one of the key's lines
//   recoverable        no confirmed entry, but an unticked (inferred) proposal sits on one of them: option (i) would reach it
//   needs-prompt-change no proposal on any of them: only a CV prompt change (option (ii)) could reach it
//
// ceiling = reachable divided by all the requirements given; null when there are none (never 100 percent of nothing).
// The caller leaves the key's unsure rows out.

export type CeilingGroup = "reachable" | "recoverable" | "needs-prompt-change";
export type CeilingResult = {
  rows: { id: string; group: CeilingGroup }[];
  reachable: number;
  recoverable: number;
  needsPromptChange: number;
  total: number;
  ceiling: number | null;
};

export function recallCeiling(proposals: CvSkill[], keyMet: { id: string; lines: number[] }[]): CeilingResult {
  const ticked = new Set(initialConfirm(proposals).keptIds); // the page's own rule
  const confirmed = new Set<number>();
  const unticked = new Set<number>();
  for (const p of proposals) (ticked.has(p.skillId) ? confirmed : unticked).add(p.line);

  const rows = keyMet.map((k) => {
    const group: CeilingGroup = k.lines.some((n) => confirmed.has(n))
      ? "reachable"
      : k.lines.some((n) => unticked.has(n))
        ? "recoverable"
        : "needs-prompt-change";
    return { id: k.id, group };
  });
  const count = (g: CeilingGroup) => rows.filter((r) => r.group === g).length;
  const reachable = count("reachable");
  return {
    rows,
    reachable,
    recoverable: count("recoverable"),
    needsPromptChange: count("needs-prompt-change"),
    total: rows.length,
    ceiling: rows.length === 0 ? null : reachable / rows.length,
  };
}
