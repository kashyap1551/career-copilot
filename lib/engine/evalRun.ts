import type { AnswerKey } from "./answerKey";
import { scoreAd, type AdScore } from "./evalScore";
import type { BuildResult } from "./fromAd";
import type { Job, Skill } from "./types";

// Runs the eval over a set of ads, one at a time (docs/PLAN-3.2.md, section
// 5). The reader and the sleeper are passed in, so the tests use fakes and no
// AI is called. This file has no network and no AI of its own.

export type EvalAd = {
  id: string;
  text: string;
  key: AnswerKey;
  holdout: boolean; // totals only until the owner says tuning is done
  known: boolean; // a known case: reported apart, kept out of the target
};

export type ScoredAd = { ad: EvalAd; score: AdScore; job: Job };

export type Usage = { inputTokens: number; outputTokens: number };

// What a read gives back: the checked job, plus (when the AI service reports
// them) the tokens used and the rate limits it returned.
export type ReadOutcome = BuildResult & { usage?: Usage; limits?: Record<string, string> };

export type RunDeps = {
  read: (text: string) => Promise<ReadOutcome>;
  sleep: (ms: number) => Promise<void>;
  delayMs: number; // between two ads
  backoffsMs: number[]; // waits before each retry after a rate limit
  serverRetryMs?: number; // wait before the one retry after a 5xx (default 20000)
};

export type RunResult = {
  scored: ScoredAd[];
  failed: { id: string; reason: string }[];
  skipped: { id: string; reason: string }[];
  complete: boolean; // nothing failed and nothing was skipped
  usage: Usage & { calls: number }; // tokens added up over the calls that worked
  limits?: Record<string, string>; // the rate limits seen on the last call
  retried: { id: string; code: number; recovered: boolean }[]; // calls retried once after a 5xx
};

const statusOf = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;

// The reason never contains the ad text or the error's own message.
function reasonFor(error: unknown): string {
  const status = statusOf(error);
  if (status === 429) return "rate limited, even after every retry";
  if (status !== undefined) return `AI service error (status ${status})`;
  return "unexpected error";
}

// A 5xx (a server-side failure) produced no reading and used no tokens, so one
// more try hides no result. One exception: the reader's own "the AI answered,
// but not in the expected shape" also comes back as a 5xx, but the model did
// answer and tokens were spent, so that one is not retried.
const SERVER_RETRY_MS = 20000;
function serverErrorCode(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : "";
  if (/not in the expected shape/.test(message)) return undefined;
  // The reader words an AI service error as "... (status 400)" and sends 502 for it:
  // the code in the words is the service's own, so use it when it is there.
  const quoted = /\(status (\d{3})\)/.exec(message);
  const status = quoted ? Number(quoted[1]) : statusOf(error);
  return status !== undefined && status >= 500 && status <= 599 ? status : undefined;
}

async function readWithRetry(text: string, deps: RunDeps, note: { serverCode?: number }): Promise<ReadOutcome> {
  let rateAttempt = 0;
  for (;;) {
    try {
      return await deps.read(text);
    } catch (error) {
      if (statusOf(error) === 429 && rateAttempt < deps.backoffsMs.length) {
        await deps.sleep(deps.backoffsMs[rateAttempt++]);
        continue;
      }
      const code = serverErrorCode(error);
      if (code !== undefined && note.serverCode === undefined) {
        note.serverCode = code; // retry once, then it is a failed ad
        await deps.sleep(deps.serverRetryMs ?? SERVER_RETRY_MS);
        continue;
      }
      throw error;
    }
  }
}

export async function runEval(ads: EvalAd[], deps: RunDeps, skills: Skill[]): Promise<RunResult> {
  const run: RunResult = {
    scored: [],
    failed: [],
    skipped: [],
    complete: true,
    usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
    retried: [],
  };
  let reads = 0;

  for (const ad of ads) {
    if (ad.key.status !== "reviewed") {
      run.skipped.push({ id: ad.id, reason: "the key is not marked reviewed" });
      continue;
    }
    if (reads > 0) await deps.sleep(deps.delayMs);
    reads++;
    const note: { serverCode?: number } = {};
    try {
      const result = await readWithRetry(ad.text, deps, note);
      if (note.serverCode !== undefined) run.retried.push({ id: ad.id, code: note.serverCode, recovered: true });
      run.scored.push({ ad, score: scoreAd(ad.key, result, skills), job: result.job });
      run.usage.calls += 1;
      run.usage.inputTokens += result.usage?.inputTokens ?? 0;
      run.usage.outputTokens += result.usage?.outputTokens ?? 0;
      if (result.limits) run.limits = result.limits;
    } catch (error) {
      if (note.serverCode !== undefined) run.retried.push({ id: ad.id, code: note.serverCode, recovered: false });
      run.failed.push({ id: ad.id, reason: reasonFor(error) });
    }
  }

  run.complete = run.failed.length === 0 && run.skipped.length === 0;
  return run;
}

// "Held on two runs in a row": both runs met the target and were complete, and
// nothing that could change the result (prompt, model, keys) differed.
export type RunState = { fingerprint: string; met: boolean; complete: boolean };

export function twoInARow(previous: RunState | null, current: RunState): boolean {
  return (
    previous !== null &&
    previous.fingerprint === current.fingerprint &&
    previous.met &&
    previous.complete &&
    current.met &&
    current.complete
  );
}
