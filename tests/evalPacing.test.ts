import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paceBeforeCall, TokenWindow, WINDOW_CAP_TOKENS, WINDOW_MS } from "@/lib/engine/evalPacing";

// EC-8e (docs/PLAN-EVERY-CV.md, EC-8): the check eval keeps its own rolling window. In no 60-second window may the calls hold more than 6,000 tokens; each
// call is counted at the LARGER of its estimate and its actual tokens, and the call about to start is counted at its estimate. A call belongs to the window
// from its start: the window at time t holds the calls that started after t - 60,000 ms and up to t. Time is a plain number of milliseconds here (a fake
// clock); nothing sleeps. Every expectation is worked out by hand.

// A schedule: each call runs `duration` ms; before each call the window says how long to wait.
function schedule(calls: { estimate: number; actual: number }[], duration: number) {
  const w = new TokenWindow();
  let t = 0;
  const starts: number[] = [];
  for (const c of calls) {
    t += w.waitMs(t, c.estimate);
    starts.push(t);
    w.add(t, c.estimate, c.actual);
    t += duration;
  }
  return starts;
}
// The most tokens (the larger of estimate and actual for each call) any 60-second window ever holds, looking at every call's own start.
function busiest(starts: number[], calls: { estimate: number; actual: number }[]) {
  return Math.max(
    ...starts.map((s) => starts.reduce((sum, u, i) => (u > s - WINDOW_MS && u <= s ? sum + Math.max(calls[i].estimate, calls[i].actual) : sum), 0)),
  );
}

describe("EC-8e the rolling token window (EP)", () => {
  it("EP0: the limits are 6,000 tokens in 60,000 ms", () => {
    expect([WINDOW_CAP_TOKENS, WINDOW_MS]).toEqual([6000, 60000]);
  });

  it("EP1: seven calls of 4,000 estimated tokens: two never fit in one window (8,000 > 6,000), so each starts 60,000 ms after the one before; no window holds more than 4,000", () => {
    // call 1 starts at 0 and runs 1,000 ms. At 1,000 the window holds 4,000; 4,000 + 4,000 > 6,000, so wait until call 1 leaves: it started at 0, so it is out at
    // 60,000 (the window is (t - 60,000, t]): wait 59,000. Call 2 starts at 60,000, and so on: 0, 60,000, 120,000 ... 360,000.
    const calls = Array.from({ length: 7 }, () => ({ estimate: 4000, actual: 4000 }));
    const starts = schedule(calls, 1000);
    expect(starts).toEqual([0, 60000, 120000, 180000, 240000, 300000, 360000]);
    expect(busiest(starts, calls)).toBe(4000);
  });

  it("EP2: a call whose actual is below its estimate is counted at the estimate: estimate 4,000, actual 500, then a call of 4,000: still a wait of 59,000 ms (at the actual it would be 0)", () => {
    const w = new TokenWindow();
    w.add(0, 4000, 500);
    expect(w.waitMs(1000, 4000)).toBe(59000);
  });

  it("EP3: a call whose actual is above its estimate is counted at the actual: estimate 2,000, actual 5,000, then an estimate of 1,500: 5,000 + 1,500 > 6,000, wait 59,000 ms (at the estimate: 3,500, no wait)", () => {
    const w = new TokenWindow();
    w.add(0, 2000, 5000);
    expect(w.waitMs(1000, 1500)).toBe(59000);
  });

  it("EP4: the window slides, and the edge is exact: calls at 0 (3,000) and 20,000 (2,500); at 30,000 an estimate of 1,000 gives 6,500 > 6,000: drop the call at 0 (out at 60,000): wait 30,000; at exactly 60,000 no wait", () => {
    const w = new TokenWindow();
    w.add(0, 3000, 3000);
    w.add(20000, 2500, 2500);
    expect(w.waitMs(30000, 1000)).toBe(30000);
    expect(w.waitMs(60000, 1000)).toBe(0);
    expect(w.waitMs(59999, 1000)).toBe(1); // the call at 0 is still in the window for one more millisecond
  });

  it("EP5: the cap itself fits: 3,000 + 3,000 = 6,000 is allowed (no wait), 3,000 + 3,001 is not (wait until the first call leaves)", () => {
    const w = new TokenWindow();
    w.add(0, 3000, 3000);
    expect(w.waitMs(10000, 3000)).toBe(0);
    expect(w.waitMs(10000, 3001)).toBe(50000);
  });

  it("EP6: a call that alone is over the cap (7,000) starts when the window is empty, and never waits for more than that", () => {
    const w = new TokenWindow();
    expect(w.waitMs(0, 7000)).toBe(0);
    w.add(0, 1000, 1000);
    w.add(10000, 1000, 1000);
    expect(w.waitMs(20000, 7000)).toBe(50000); // both calls must leave: the second started at 10,000, so it is out at 70,000: 70,000 - 20,000
  });

  it("EP7: with real-looking sizes (estimates 3,818 to 4,049, actuals 1,865 to 3,532) a seventh call is never put into a window that already holds 6,000", () => {
    const calls = [[3885, 2986], [4049, 3532], [3818, 1865], [3935, 2899], [3979, 2981], [3915, 3141], [4036, 2746]].map(([estimate, actual]) => ({ estimate, actual }));
    const starts = schedule(calls, 3500);
    expect(busiest(starts, calls)).toBeLessThanOrEqual(6000);
    expect(starts[6] - starts[0]).toBeGreaterThanOrEqual(6 * (WINDOW_MS - 3500)); // one call per window: each next start is 60,000 ms after the previous start
  });

  it("EP8: the wait before a call is the old header wait (here the 3,000 ms gap) PLUS what the window needs on top of it: three calls of estimate 3,817, actual 4,500, lasting 3,000 ms", () => {
    // call 1 at 0, over at 3,000. Call 2: the old wait is 3,000 (6,000 left of 8,000 covers 3,817), so it could start at 6,000; the window holds 4,500 (the larger of
    // 3,817 and 4,500), 4,500 + 3,817 = 8,317 > 6,000, so it waits for call 1 to leave at 60,000: 54,000 more. Sleep 57,000; call 2 starts at 60,000, over at 63,000.
    // Call 3: the same: old wait 3,000 (to 66,000), call 2 leaves at 120,000: 54,000 more. Sleep 57,000.
    const w = new TokenWindow();
    let clock = 0;
    const sleeps: number[] = [];
    const starts: number[] = [];
    for (let i = 0; i < 3; i++) {
      const sleep = i === 0 ? 0 : paceBeforeCall(w, clock, 3000, 3817);
      sleeps.push(sleep);
      clock += sleep;
      starts.push(clock);
      w.add(clock, 3817, 4500);
      clock += 3000;
    }
    expect(sleeps).toEqual([0, 57000, 57000]);
    expect(starts).toEqual([0, 60000, 120000]);
  });

  it("EP9: when the window needs nothing, the wait is the old one: small calls (1,000 estimated) every 3,000 ms never wait more than the gap, up to the cap of 6 in a window", () => {
    const w = new TokenWindow();
    let clock = 0;
    const sleeps: number[] = [];
    for (let i = 0; i < 6; i++) {
      const sleep = i === 0 ? 0 : paceBeforeCall(w, clock, 3000, 1000);
      sleeps.push(sleep);
      clock += sleep;
      w.add(clock, 1000, 800);
      clock += 500;
    }
    expect(sleeps).toEqual([0, 3000, 3000, 3000, 3000, 3000]); // 6 x 1,000 = 6,000: allowed
    // a seventh call would make 7,000: it waits until the first call (it started at 0) leaves the window, at 60,000
    expect(paceBeforeCall(w, clock, 3000, 1000)).toBe(60000 - clock);
  });

  it("EP10: the check eval's loop uses the window: it asks paceBeforeCall before each call and records every call (start, estimate, actual tokens) after it", () => {
    const src = readFileSync(join(process.cwd(), "scripts/everyCvCheckMain.ts"), "utf8");
    expect(src).toMatch(/paceBeforeCall\(/);
    expect(src).toMatch(/window\.add\(/);
    expect(src).toMatch(/done\.call\.ms/);
  });
});
