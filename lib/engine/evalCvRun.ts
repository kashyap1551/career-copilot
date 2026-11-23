import type { CvKey } from "./cvKey";
import { scoreCv, type CvScore } from "./evalCvScore";
import type { CvBuildResult } from "./fromCv";
import type { Skill } from "./types";

// Runs the CV eval over the five made-up CVs, one at a time and paced to
// Groq's rate limit (docs/PLAN-4.2.md, section d). The reader and the sleeper
// are passed in, so the tests use fakes and no AI is called. No network and no
// AI of its own.

export type CvEvalItem = { id: string; lines: string[]; key: CvKey };

export type CvReadOutcome = CvBuildResult & {
  usage?: { inputTokens: number; outputTokens: number };
  limits?: Record<string, string>;
};

export type CvRunDeps = {
  read: (lines: string[]) => Promise<CvReadOutcome>;
  sleep: (ms: number) => Promise<void>;
  minGapMs: number; // at least this long between two calls
  backoffsMs: number[]; // waits before each retry after a 429
  serverRetryMs?: number; // wait before the one retry after a 5xx (default 20000)
  firstEstimate?: number; // tokens one call is assumed to use before one has been seen
  noHeaderWaitMs?: number; // the wait when Groq's headers are missing (default 30000)
};

export type CvRunResult = {
  rows: { score: CvScore; usage?: { inputTokens: number; outputTokens: number } }[];
  failed: { id: string; reason: string }[];
  complete: boolean;
  usage: { inputTokens: number; outputTokens: number; calls: number };
  limits?: Record<string, string>;
  retried: { id: string; code: number; recovered: boolean }[];
};

// "6.5s", "250ms", "1m30s", "2m" -> milliseconds; null when it is not a duration.
export function parseDuration(text: string | undefined): number | null {
  if (!text) return null;
  const m = /^(?:(\d+(?:\.\d+)?)m(?!s))?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/.exec(text.trim());
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  return Math.round(Number(m[1] ?? 0) * 60000 + Number(m[2] ?? 0) * 1000 + Number(m[3] ?? 0));
}

// How long to wait so that the next call (assumed to use `estimate` tokens)
// fits in what Groq says is left of the minute. Groq refills the allowance
// steadily (limit tokens a minute), so only the missing part is waited for.
export function waitForTokens(
  limits: Record<string, string> | undefined,
  estimate: number,
  fallbackMs = 30000,
): number {
  const remaining = Number((limits?.["x-ratelimit-remaining-tokens"] ?? "").replace(/,/g, ""));
  const limit = Number((limits?.["x-ratelimit-limit-tokens"] ?? "").replace(/,/g, ""));
  if (!limits || !Number.isFinite(remaining) || limits["x-ratelimit-remaining-tokens"] === undefined) return fallbackMs;
  if (remaining >= estimate) return 0;
  if (Number.isFinite(limit) && limit > 0) {
    return Math.ceil(((estimate - remaining) / (limit / 60)) * 1000) + 500;
  }
  return (parseDuration(limits["x-ratelimit-reset-tokens"]) ?? fallbackMs) + 500;
}

export const statusOf = (error: unknown): number | undefined =>
  typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;

// The reader words an AI service error as "... (status 500)" and answers 502;
// the code in the words is the service's own. "Not in the expected shape" is
// not retried: the model did answer and tokens were spent.
export function serverErrorCode(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : "";
  if (/not in the expected shape/.test(message)) return undefined;
  const quoted = /\(status (\d{3})\)/.exec(message);
  const status = quoted ? Number(quoted[1]) : statusOf(error);
  return status !== undefined && status >= 500 && status <= 599 ? status : undefined;
}

// The reason never contains the CV text or the error's own message.
export function reasonFor(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const quoted = /\(status (\d{3})\)/.exec(message);
  const status = quoted ? Number(quoted[1]) : statusOf(error);
  if (status === 429) return "rate limited, even after every retry";
  if (status !== undefined) return `AI service error (status ${status})`;
  return "unexpected error";
}

async function readWithRetry(
  lines: string[],
  deps: CvRunDeps,
  note: { serverCode?: number },
): Promise<CvReadOutcome> {
  let rateAttempt = 0;
  for (;;) {
    try {
      return await deps.read(lines);
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

export async function runCvEval(items: CvEvalItem[], deps: CvRunDeps, skills: Skill[]): Promise<CvRunResult> {
  const run: CvRunResult = {
    rows: [],
    failed: [],
    complete: true,
    usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
    retried: [],
  };
  let largestCall = deps.firstEstimate ?? 4500;
  let lastLimits: Record<string, string> | undefined;
  let reads = 0;

  for (const item of items) {
    if (reads > 0) {
      await deps.sleep(Math.max(deps.minGapMs, waitForTokens(lastLimits, largestCall, deps.noHeaderWaitMs ?? 30000)));
    }
    reads++;
    const note: { serverCode?: number } = {};
    try {
      const out = await readWithRetry(item.lines, deps, note);
      if (note.serverCode !== undefined) run.retried.push({ id: item.id, code: note.serverCode, recovered: true });
      run.rows.push({ score: scoreCv(item.key, item.lines, out, skills), usage: out.usage });
      if (out.usage) {
        run.usage.inputTokens += out.usage.inputTokens;
        run.usage.outputTokens += out.usage.outputTokens;
        run.usage.calls++;
        largestCall = Math.max(largestCall, out.usage.inputTokens + out.usage.outputTokens);
      }
      if (out.limits) {
        lastLimits = out.limits;
        run.limits = out.limits;
      }
    } catch (error) {
      if (note.serverCode !== undefined) run.retried.push({ id: item.id, code: note.serverCode, recovered: false });
      run.failed.push({ id: item.id, reason: reasonFor(error) });
      run.complete = false;
    }
  }
  return run;
}
