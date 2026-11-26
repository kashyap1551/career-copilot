// The counting wrapper of the check eval (docs/PLAN-EVERY-CV.md, the check eval). Used ONLY inside the eval script. It replaces `fetch` for the length
// of one run and puts it back afterwards, also after an error. Around each call it records every HTTP attempt: the status, the time, the tokens the
// body reports and the rate-limit headers. The AI SDK tries a failed call up to three times by itself; this makes those hidden attempts visible.
// After the FIRST 429 of a call, the SDK's further attempts in that call are answered from that 429 without any network, so a busy service is
// asked once and the run can stop. Pure code over an injected fetch: no network of its own.

export type Attempt = { status: number; ms: number; inputTokens: number; outputTokens: number; synthetic: boolean };
export type CallRecord = {
  attempts: Attempt[];
  elapsedMs: number;
  inputTokens: number; // added up over the attempts
  outputTokens: number;
  limits: Record<string, string> | undefined; // the x-ratelimit headers of the last attempt that had any
  real429: number; // real answers with status 429 (not the repeated ones)
};
export type Counter = { begin: () => void; end: () => CallRecord };

// What a result file keeps of a call.
export type CallSummary = { attempts: number; statuses: number[]; real429: number; ms: number; inputTokens: number; outputTokens: number };
export const summarizeCall = (r: CallRecord): CallSummary => ({
  attempts: r.attempts.length,
  statuses: r.attempts.map((a) => a.status),
  real429: r.real429,
  ms: r.elapsedMs,
  inputTokens: r.inputTokens,
  outputTokens: r.outputTokens,
});

const rateHeaders = (res: Response): Record<string, string> | undefined => {
  const kept: Record<string, string> = {};
  res.headers.forEach((value, name) => {
    if (name.toLowerCase().startsWith("x-ratelimit")) kept[name.toLowerCase()] = value;
  });
  return Object.keys(kept).length > 0 ? kept : undefined;
};

async function tokensOf(res: Response): Promise<{ input: number; output: number }> {
  try {
    const body = (await res.clone().json()) as { usage?: { prompt_tokens?: number; completion_tokens?: number } };
    return { input: body.usage?.prompt_tokens ?? 0, output: body.usage?.completion_tokens ?? 0 };
  } catch {
    return { input: 0, output: 0 };
  }
}

export async function withCountingFetch<T>(
  run: (counter: Counter) => Promise<T>,
  opts: { target?: { fetch: typeof fetch }; clock?: () => number } = {},
): Promise<T> {
  const target = opts.target ?? globalThis;
  const clock = opts.clock ?? (() => performance.now());
  const original = target.fetch;
  let attempts: Attempt[] = [];
  let startedAt = 0;
  let limits: Record<string, string> | undefined;
  let busy: { body: string; status: number; headers: [string, string][] } | null = null; // the first 429 of this call

  target.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const t0 = clock();
    if (busy !== null) {
      attempts.push({ status: busy.status, ms: 0, inputTokens: 0, outputTokens: 0, synthetic: true });
      return new Response(busy.body, { status: busy.status, headers: busy.headers });
    }
    const res = await original(input, init);
    const tokens = await tokensOf(res);
    attempts.push({ status: res.status, ms: clock() - t0, inputTokens: tokens.input, outputTokens: tokens.output, synthetic: false });
    limits = rateHeaders(res) ?? limits;
    if (res.status === 429) busy = { body: await res.clone().text(), status: 429, headers: [...res.headers.entries()] };
    return res;
  }) as typeof fetch;

  const counter: Counter = {
    begin() {
      attempts = [];
      limits = undefined;
      busy = null;
      startedAt = clock();
    },
    end() {
      const real = attempts.filter((a) => !a.synthetic);
      return {
        attempts,
        elapsedMs: clock() - startedAt,
        inputTokens: real.reduce((n, a) => n + a.inputTokens, 0),
        outputTokens: real.reduce((n, a) => n + a.outputTokens, 0),
        limits,
        real429: real.filter((a) => a.status === 429).length,
      };
    },
  };
  try {
    return await run(counter);
  } finally {
    target.fetch = original;
  }
}
