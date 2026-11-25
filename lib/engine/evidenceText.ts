// The words of the evidence check that a person reads (docs/PLAN-EVERY-CV.md 4.4 and 4.5). Pure strings: no screen, no AI. EVERY text here is a
// DRAFT until the owner approves it (plan section 6); an approved change goes in with its pinned test in one commit.

// The title of the block of AI-judged rows, shown apart from the rows judged by the skill list.
export const AI_BLOCK_TITLE = "Judged by the AI from your CV lines (read each quote)";

// Said next to an entry the person ticked from the "inferred" group.
export const INFERRED_NOTE = "inferred from your wording, confirmed by you";

const must = (n: number) => (n === 1 ? "must-have" : "must-haves");

// The counts sentence when at least one must-have was judged by the AI (the same number as in the label, rule R5):
// "You meet 2 of 4 must-haves (2 judged by AI), missing: Excel, Patient intake."
export function aiCountsSentence(total: number, met: number, missing: string[], aiMusts: number, couldNotJudge: number): string {
  let s = `You meet ${met} of ${total} must-haves (${aiMusts} judged by AI)`;
  if (missing.length > 0) s += `, missing: ${missing.join(", ")}`;
  if (couldNotJudge > 0) s += `, plus ${couldNotJudge} ${must(couldNotJudge)} we could not judge`;
  return s + ".";
}

export type AiRowInput = {
  label: string; // the requirement's own skill name(s), "Power BI or Tableau"
  verdict: "met" | "partly" | "none";
  line: number | null;
  quote: string | null;
  entryName: string | null;
  inferred: boolean;
};

// One row of the block: the requirement, the verdict, and for met and partly the CV line, the quote and the skill it was found under.
export function aiRowText(x: AiRowInput): string {
  if (x.verdict === "none" || x.line === null || x.quote === null) return `${x.label}: no evidence found`;
  const under = `${x.entryName ?? ""}${x.inferred ? `; ${INFERRED_NOTE}` : ""}`;
  return `${x.label}: ${x.verdict}. CV line ${x.line}: "${x.quote}" (${under})`;
}

// How many answers the proof threw away; null when none.
export function thrownAwayLine(n: number): string | null {
  if (n <= 0) return null;
  return n === 1
    ? "1 answer was not accepted because its quote was not on the CV line."
    : `${n} answers were not accepted because their quote was not on the CV line.`;
}
