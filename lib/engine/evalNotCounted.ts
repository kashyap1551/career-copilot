import type { EvalAd, ScoredAd } from "./evalRun";

// `npm run eval -- --not-counted` (docs/DECISIONS.md, 2026-11-16, scorer v2): the key requirements of the tuning ads
// that landed in "not counted", so the owner can check that none is a real skill the reader dropped as a trait. It
// never covers the holdout (ad-09, ad-10): the script selects the ads BEFORE any AI call, and the formatter refuses a
// holdout ad again. Known cases are left out too (they are not in the totals). Pure code.

export function selectNotCountedAds<T extends Pick<EvalAd, "holdout" | "known">>(ads: T[]): T[] {
  return ads.filter((a) => !a.holdout && !a.known);
}

export function formatNotCountedList(scored: ScoredAd[]): string {
  if (scored.some((x) => x.ad.holdout)) throw new Error("holdout ad: the not-counted list refuses it");
  const out: string[] = ["NOT COUNTED (key requirements of the tuning ads that the reader set aside as not-a-skill; check that none is a real skill)"];
  let nc = 0;
  let total = 0;
  for (const { ad, score } of scored) {
    const r = score.requirements;
    const keyCount = r.mustTotal + r.niceTotal;
    nc += r.notCounted;
    total += keyCount;
    out.push(`${ad.id}: not counted ${r.notCounted} of ${keyCount} key requirements`);
    for (const d of r.details.notCounted) out.push(`  (${d.importance}) "${d.quote}" [${d.skills.join(", ")}]`);
  }
  out.push(`TOTAL: not counted ${nc} of ${total} key requirements in ${scored.length} ads`);
  return out.join("\n") + "\n";
}
