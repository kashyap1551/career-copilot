// EC-8e (docs/PLAN-EVERY-CV.md, EC-8): the check eval's own rolling window over tokens. Pure code: no clock, no sleeping, no network; the caller passes the time
// in milliseconds and sleeps for what it is told.
//
// The free limit is 8,000 tokens a minute. The rule here keeps a safety margin: no 60-second window may hold more than 6,000 tokens. A window at time t holds
// the calls that STARTED after t - 60,000 ms and up to t. Every finished call is counted at the LARGER of its estimate and the tokens it really used (an
// estimate that was too high still counts; a call that used more than expected counts for what it used). The call about to start is counted at its estimate.
// A call that alone is over the cap waits for an empty window, and then goes.

export const WINDOW_MS = 60_000;
export const WINDOW_CAP_TOKENS = 6000;

export class TokenWindow {
  private calls: { start: number; tokens: number }[] = [];

  // A call that started at `start` (ms), expected to use `estimate` tokens, that really used `actual`.
  add(start: number, estimate: number, actual: number): void {
    this.calls.push({ start, tokens: Math.max(estimate, actual) });
    this.calls.sort((a, b) => a.start - b.start);
  }

  // How long to wait from `now` before a call of `estimate` tokens may start, so that the window it starts in holds at most the cap.
  waitMs(now: number, estimate: number): number {
    let from = 0; // calls before this index have been waited out
    let t = now;
    const holds = () => this.calls.slice(from).filter((c) => c.start > t - WINDOW_MS && c.start <= t).reduce((n, c) => n + c.tokens, 0);
    while (from < this.calls.length) {
      if (holds() + estimate <= WINDOW_CAP_TOKENS) break;
      // wait until the oldest call that is still in the window has left it (it leaves at its start + 60,000)
      const oldest = this.calls.slice(from).find((c) => c.start > t - WINDOW_MS && c.start <= t);
      if (!oldest) break;
      t = Math.max(t, oldest.start + WINDOW_MS);
      from = this.calls.indexOf(oldest) + 1;
    }
    return Math.max(0, t - now);
  }
}

// The wait before a call: the old wait (the gap and the provider's own header, `base`, from lib/engine/evalEveryCvCheckScore.ts pacingWaitMs) and then, from
// the time the call could start after it, whatever the window still needs. `now` is the caller's own clock in ms.
export function paceBeforeCall(window: TokenWindow, now: number, base: number, estimate: number): number {
  return base + window.waitMs(now + base, estimate);
}
