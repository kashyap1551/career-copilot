// Not a test file. Step 8.1 (docs/PLAN-8.1.md F11 and D4): the number checker, a TEST helper (it moves into app/ only when AI-written
// words arrive, step 8.1b). It returns every number that stands in the lines of a report: left to right, after removing
//   1. every label (job labels with their caveats, skill names), longest first, so the caveat variant goes before the bare label
//      and a digit inside a title ("Level 2 Analyst") is never read as a number;
//   2. every list marker at the start of a line ("1. ");
//   3. every ISO date ("2027-03-01").
export function reportNumbers(lines: string[], labels: string[]): number[] {
  const longestFirst = [...labels].filter((l) => l !== "").sort((a, b) => b.length - a.length);
  const out: number[] = [];
  for (const raw of lines) {
    let t = raw.replace(/^\d+\. /, "");
    for (const l of longestFirst) t = t.split(l).join(" ");
    t = t.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
    for (const m of t.matchAll(/\d+/g)) out.push(Number(m[0]));
  }
  return out;
}
