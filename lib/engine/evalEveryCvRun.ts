import { waitForTokens } from "./evalCvRun";
import type { AdReading } from "./evalEveryCvCompare";
import type { CvBuildResult } from "./fromCv";

// The paced reading of the baseline (docs/PLAN-EVERY-CV.md sections 5 and 10): one CV read and one ad read for each pair, in order. The two
// readers and the sleeper are PASSED IN, so the tests use fakes and no AI is called. Not shared with the other evals: they keep their pacing.
//
// Pacing (8,000 tokens and 30 requests a minute): before every call but the first, wait for the larger of the gap between two calls (at
// least 2 seconds would do for 30 a minute; 3 seconds is what the other evals use) and the time the allowance needs to refill to what THIS
// call is expected to use (waitForTokens, from the limits the last answer reported). The other evals expect the largest call seen so far;
// the near-cap CV is larger than the calls before it, so here the expectation is made from the size of the call itself (callEstimate).
//
// A 429 stops the run at once: no retry, nothing after it is read. Any other failure is written down for that pair and the run goes on
// with the next pair, also without a retry (and a pair whose CV failed does not get its ad read).

export type Usage = { inputTokens: number; outputTokens: number };
export type CvOutcome = CvBuildResult & { usage?: Usage; limits?: Record<string, string> };
export type AdOutcome = AdReading & { usage?: Usage; limits?: Record<string, string>; extraction?: unknown };
export type PairInput = { id: string; cvLines: string[]; adText: string };
export type CallRecord = { pair: string; kind: "cv" | "ad"; input: number; output: number };
export type Failure = { pair: string; kind: "cv" | "ad"; reason: string };

const MAX_ESTIMATE = 7800; // never expect more than the minute can hold

// Tokens a call is expected to use: the prompt (instructions + schema and framing + the text) at about four characters a token, plus room
// for the answer (which, for this model, includes its own reasoning).
export function callEstimate(kind: "cv" | "ad", x: { instructionsLength: number; textChars: number }): number {
  const framing = kind === "cv" ? 1000 : 1500;
  const answer = kind === "cv" ? 3000 : 2500;
  return Math.min(MAX_ESTIMATE, Math.ceil((x.instructionsLength + framing + x.textChars) / 4) + answer);
}

const statusOf = (e: unknown): number | undefined =>
  typeof e === "object" && e !== null && "status" in e ? (e as { status?: number }).status : undefined;

// Never the error's own message: it could carry text from a CV.
const reasonOf = (e: unknown): string => {
  const s = statusOf(e);
  return s === undefined ? "unexpected error" : `AI service error (status ${s})`;
};

export type ReadDeps = {
  readCv: (lines: string[]) => Promise<CvOutcome>;
  readAd: (text: string) => Promise<AdOutcome>;
  sleep: (ms: number) => Promise<void>;
  minGapMs: number;
  cvInstructionsLength: number;
  adInstructionsLength: number;
  noHeaderWaitMs?: number;
  onRead: (pair: string, kind: "cv" | "ad", outcome: CvOutcome | AdOutcome) => void; // called for every successful read, at once
};

export type ReadRun = {
  cv: Record<string, CvOutcome>;
  ad: Record<string, AdOutcome>;
  failed: Failure[];
  stopped: { pair: string; kind: "cv" | "ad" } | null; // a 429
  calls: CallRecord[];
};

export async function readAllPairs(pairs: PairInput[], deps: ReadDeps): Promise<ReadRun> {
  const run: ReadRun = { cv: {}, ad: {}, failed: [], stopped: null, calls: [] };
  let lastLimits: Record<string, string> | undefined;
  let first = true;

  const pace = async (estimate: number) => {
    if (!first) await deps.sleep(Math.max(deps.minGapMs, waitForTokens(lastLimits, estimate, deps.noHeaderWaitMs ?? 30000)));
    first = false;
  };

  for (const p of pairs) {
    const cvChars = p.cvLines.reduce((n, l) => n + l.length, 0);
    for (const kind of ["cv", "ad"] as const) {
      if (kind === "ad" && run.failed.some((f) => f.pair === p.id)) continue; // no ad read for a pair whose CV could not be read
      await pace(callEstimate(kind, { instructionsLength: kind === "cv" ? deps.cvInstructionsLength : deps.adInstructionsLength, textChars: kind === "cv" ? cvChars : p.adText.length }));
      try {
        const out = kind === "cv" ? await deps.readCv(p.cvLines) : await deps.readAd(p.adText);
        if (kind === "cv") run.cv[p.id] = out as CvOutcome;
        else run.ad[p.id] = out as AdOutcome;
        run.calls.push({ pair: p.id, kind, input: out.usage?.inputTokens ?? 0, output: out.usage?.outputTokens ?? 0 });
        if (out.limits) lastLimits = out.limits;
        deps.onRead(p.id, kind, out);
      } catch (error) {
        if (statusOf(error) === 429) {
          run.stopped = { pair: p.id, kind };
          return run;
        }
        run.failed.push({ pair: p.id, kind, reason: reasonOf(error) });
      }
    }
  }
  return run;
}
