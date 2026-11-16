import type { NotCounted } from "@/lib/engine/fromAd";

// Text the report shows around the fit: pure functions (no AI, no network), so the exact wording is tested.

// "N requirements are not skills a CV can show (for example personal traits) and were not counted; they are listed
// below." The not-a-skill list holds more than traits (working environments, vague phrases, role descriptions), so
// the sentence does not call every one of them a trait.
export function notCountedSentence(n: number): string | null {
  if (n <= 0) return null;
  if (n === 1) {
    return "1 requirement is not a skill a CV can show (for example a personal trait) and was not counted; it is listed below.";
  }
  return `${n} requirements are not skills a CV can show (for example personal traits) and were not counted; they are listed below.`;
}

export type CheckRow = { quote: string; note: string | null };

// "Check this yourself": the engine's quotes (eligibility, work permit...) first, then the requirements that were
// not counted, each with a plain note saying why it is here.
export function checkYourselfRows(engine: string[], notCounted: NotCounted[]): CheckRow[] {
  return [
    ...engine.map((quote) => ({ quote, note: null })),
    ...notCounted.map((n) => ({
      quote: n.quote,
      note: `not counted: a ${n.importance === "must" ? "must-have" : "nice-to-have"} in the ad, but not a skill a CV can show`,
    })),
  ];
}

// Skill levels ("advanced", "basic") are dropped when names are matched (docs/DECISIONS.md, 2026-11-14).
export const LEVELS_NOTE = "Skill levels (such as advanced) are not compared.";

export function reportNote(kind: "cv" | "list"): string {
  const base =
    kind === "cv"
      ? "Evidence for each skill is the CV line it came from. A kind you did not set is not judged."
      : "Skills only: a skill counts because it is on your list (from your list, not a CV). Language, location, work mode, years and start date are not judged.";
  return `${base} ${LEVELS_NOTE}`;
}

// The one short line shown where a name was matched by close spelling (stage 2). `skillName` is the skill's name in our
// list; `written` is the wording in the ad or CV. Exact matches show nothing.
// For the ad: one line per distinct close match across the requirements (the same wording and skill only once).
export function closeMatchLines(
  requirements: { closeMatches?: { name: string; skillId: string; via: string }[] }[],
  nameOf: (skillId: string) => string,
): string[] {
  const lines: string[] = [];
  for (const r of requirements) {
    for (const c of r.closeMatches ?? []) {
      const line = closeMatchLine(c.name, nameOf(c.skillId));
      if (!lines.includes(line)) lines.push(line);
    }
  }
  return lines;
}

export function closeMatchLine(written: string, skillName: string): string {
  return `Read as "${skillName}" (close spelling of "${written}")`;
}
