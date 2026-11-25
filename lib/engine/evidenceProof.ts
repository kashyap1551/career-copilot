import { hasRealWord } from "./quoteMatch";
import { foldText } from "./text";

// The proof of the evidence check (docs/PLAN-EVERY-CV.md 4.3). Pure code: no AI, no network, no files. The AI only POINTS ("this entry shows this
// requirement, here is the quote"); this file decides whether the pointing is real, with the same rules `fromCv` uses for a CV skill. An answer
// counts only if ALL of these hold:
//   1. the requirement number is one we sent, and it was answered exactly once (twice, or never, means unanswered);
//   2. for met and partly: the entry number is one we sent (an entry with a CV line);
//   3. the quote has a real word (quoteMatch.hasRealWord);
//   4. the quote is really inside THAT entry's line (case and accents ignored). A quote found only on another entry's line is not rescued.
// If 2, 3 or 4 fails the answer is thrown away and the requirement reads "no evidence found" (verdict none). A none answer needs no entry and
// no quote. A requirement the AI skipped is never turned into none: it stays unanswered ("could not judge", as today).

export type Verdict = "met" | "partly" | "none";

// What we sent, numbered from 1. `index` is the requirement's place in the ad's own list (job.requirements), so an answer can be tied back to it.
export type SentRequirement = { n: number; index: number; quote: string; importance: "must" | "nice" };
// `text` is the CV line word for word (the full stored line, not the clipped copy that was sent).
export type SentEntry = { n: number; name: string; skillId: string; line: number; text: string; inferred: boolean };
export type AiAnswer = { requirement: number; verdict: Verdict; entry: number | null; quote: string | null };

export type ThrownReason = "no-entry" | "entry-not-sent" | "no-quote" | "no-real-word" | "quote-not-on-line";
export type Accepted = { requirement: number; verdict: Verdict; entry: SentEntry | null; quote: string | null };
export type Decided = Accepted & { thrown: ThrownReason | null }; // thrown: the AI said met or partly, the proof says none

export type ProofResult = {
  accepted: Accepted[];
  thrownAway: { requirement: number; reason: ThrownReason }[];
  decided: Decided[]; // accepted and thrown-away answers together, in the order requirements were sent: one verdict each
  unanswered: number[]; // requirement numbers: skipped, or answered more than once
  ignored: number; // answers for a requirement number that was not sent
};

// The quote is inside the line, case and accents ignored (foldText), whitespace made equal.
const inLine = (quote: string, line: string) => {
  const q = foldText(quote);
  return q !== "" && foldText(line).includes(q);
};

export function proveAnswers(sent: SentRequirement[], entries: SentEntry[], answers: AiAnswer[]): ProofResult {
  const result: ProofResult = { accepted: [], thrownAway: [], decided: [], unanswered: [], ignored: 0 };
  const sentNumbers = new Set(sent.map((r) => r.n));
  result.ignored = answers.filter((a) => !sentNumbers.has(a.requirement)).length;

  for (const r of sent) {
    const mine = answers.filter((a) => a.requirement === r.n);
    if (mine.length !== 1) {
      result.unanswered.push(r.n); // never answered, or answered twice
      continue;
    }
    const a = mine[0];
    if (a.verdict === "none") {
      const none: Accepted = { requirement: r.n, verdict: "none", entry: null, quote: null };
      result.accepted.push(none);
      result.decided.push({ ...none, thrown: null });
      continue;
    }
    const entry = a.entry === null ? undefined : entries.find((e) => e.n === a.entry);
    const reason: ThrownReason | null =
      a.entry === null
        ? "no-entry"
        : entry === undefined
          ? "entry-not-sent"
          : a.quote === null || a.quote.trim() === ""
            ? "no-quote"
            : !hasRealWord(a.quote)
              ? "no-real-word"
              : !inLine(a.quote, entry.text)
                ? "quote-not-on-line"
                : null;
    if (reason !== null || entry === undefined || a.quote === null) {
      result.thrownAway.push({ requirement: r.n, reason: reason ?? "no-entry" });
      result.decided.push({ requirement: r.n, verdict: "none", entry: null, quote: null, thrown: reason ?? "no-entry" });
      continue;
    }
    const ok: Accepted = { requirement: r.n, verdict: a.verdict, entry, quote: a.quote };
    result.accepted.push(ok);
    result.decided.push({ ...ok, thrown: null });
  }
  return result;
}
