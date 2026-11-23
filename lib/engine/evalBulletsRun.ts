import type { DropReason } from "./bulletsFrom";
import type { BulletsEvalItem, EvalLang } from "./evalBulletsProfile";
import { reasonFor, serverErrorCode, statusOf, waitForTokens } from "./evalCvRun";

// Step 8.3, stage 5 (docs/PLAN-8.3.md v2, section 4, "The eval"): runs the 15 runs (five invented CVs x three invented jobs), one call each, paced to Groq's rate limit
// exactly as lib/engine/evalCvRun.ts does. The writer, the sleeper and the clock are passed in, so the tests use fakes and no AI is called. No network and no AI of
// its own; nothing from lib/ai or app/. A run with no pair makes no call (the page shows "nothing to write from" and sends nothing).

export type RequestPair = { id: number; requirement: string; line: string };

export type WriterOutcome = {
  bullets: { pair: number; text: string }[]; // every accepted bullet: the eval asks for show = the number of pairs
  asked: number;
  dropped: { pair: number; reason: DropReason }[];
  usage?: { inputTokens: number; outputTokens: number };
  limits?: Record<string, string>;
};
export type BulletsWriter = (pairs: RequestPair[], show: number) => Promise<WriterOutcome>;

export type BulletsRunDeps = {
  write: BulletsWriter;
  sleep: (ms: number) => Promise<void>;
  now: () => number; // milliseconds
  minGapMs: number; // at least this long between two calls
  backoffsMs: number[]; // waits before each retry after a 429
  serverRetryMs?: number; // wait before the one retry after a 5xx (default 20000)
  firstEstimate?: number; // tokens one call is assumed to use before one has been seen
  noHeaderWaitMs?: number; // the wait when Groq's headers are missing (default 30000)
};

export type BulletsEvalRow = {
  cv: string;
  job: string;
  lang: EvalLang;
  pairs: { id: number; requirement: string; line: number; text: string }[]; // what was asked, with the real CV line numbers
  asked: number;
  accepted: { pair: number; text: string }[]; // every accepted bullet, before the cap of 3
  dropped: { pair: number; reason: DropReason }[];
  usage?: { inputTokens: number; outputTokens: number };
  seconds: number;
};

export type BulletsEvalRun = {
  rows: BulletsEvalRow[];
  noPairs: { cv: string; job: string }[];
  failed: { cv: string; job: string; reason: string }[];
  complete: boolean;
};

async function writeWithRetry(pairs: RequestPair[], deps: BulletsRunDeps, note: { serverCode?: number }): Promise<WriterOutcome> {
  let rateAttempt = 0;
  for (;;) {
    try {
      return await deps.write(pairs, pairs.length);
    } catch (error) {
      if (statusOf(error) === 429 && rateAttempt < deps.backoffsMs.length) {
        await deps.sleep(deps.backoffsMs[rateAttempt++]);
        continue;
      }
      const code = serverErrorCode(error);
      if (code !== undefined && note.serverCode === undefined) {
        note.serverCode = code;
        await deps.sleep(deps.serverRetryMs ?? 20000);
        continue;
      }
      throw error;
    }
  }
}

export async function runBulletsEval(items: BulletsEvalItem[], deps: BulletsRunDeps): Promise<BulletsEvalRun> {
  const run: BulletsEvalRun = { rows: [], noPairs: [], failed: [], complete: true };
  let largestCall = deps.firstEstimate ?? 4500;
  let lastLimits: Record<string, string> | undefined;
  let attempts = 0;

  for (const item of items) {
    if (item.pairs.length === 0) {
      run.noPairs.push({ cv: item.cv, job: item.job });
      continue;
    }
    if (attempts > 0) {
      await deps.sleep(Math.max(deps.minGapMs, waitForTokens(lastLimits, largestCall, deps.noHeaderWaitMs ?? 30000)));
    }
    attempts++;
    const requestPairs: RequestPair[] = item.pairs.map((p) => ({ id: p.id, requirement: p.requirement, line: p.text }));
    const note: { serverCode?: number } = {};
    const started = deps.now();
    try {
      const out = await writeWithRetry(requestPairs, deps, note);
      const seconds = Math.round(((deps.now() - started) / 1000) * 10) / 10;
      run.rows.push({
        cv: item.cv,
        job: item.job,
        lang: item.lang,
        pairs: item.pairs.map((p) => ({ id: p.id, requirement: p.requirement, line: p.line, text: p.text })),
        asked: out.asked,
        accepted: out.bullets.map((b) => ({ pair: b.pair, text: b.text })),
        dropped: out.dropped.map((d) => ({ pair: d.pair, reason: d.reason })),
        usage: out.usage,
        seconds,
      });
      if (out.usage) largestCall = Math.max(largestCall, out.usage.inputTokens + out.usage.outputTokens);
      if (out.limits) lastLimits = out.limits;
    } catch (error) {
      // The reason never contains the CV text or the error's own message.
      run.failed.push({ cv: item.cv, job: item.job, reason: reasonFor(error) });
      run.complete = false;
    }
  }
  return run;
}
