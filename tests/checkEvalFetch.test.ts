import { describe, expect, it } from "vitest";
import { withCountingFetch } from "@/lib/engine/evalEveryCvCheckFetch";

// EC-5a (the check eval; tests EF1 to EF3): the counting wrapper around fetch, used only inside the eval script. No network: the inner fetch is a fake.

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const OK = (inTok: number, outTok: number) => json(200, { usage: { prompt_tokens: inTok, completion_tokens: outTok, total_tokens: inTok + outTok } }, { "x-ratelimit-remaining-tokens": "4000", "x-ratelimit-limit-tokens": "8000" });

function clockOf(step: number) {
  let t = 0;
  return () => (t += step);
}

describe("EC-5a the counting wrapper (EF)", () => {
  it("EF1: a 503 then a 200 in one call: 2 attempts, statuses [503, 200], the tokens of the body, the headers of the last answer, the elapsed time", async () => {
    const answers = [json(503, { error: "busy" }), OK(100, 50)];
    const target = { fetch: (async () => answers.shift()!) as unknown as typeof fetch };
    await withCountingFetch(async (c) => {
      c.begin();
      await target.fetch("https://x.invalid/a", { method: "POST" });
      await target.fetch("https://x.invalid/a", { method: "POST" });
      const r = c.end();
      expect(r.attempts.map((a) => a.status)).toEqual([503, 200]);
      expect(r.attempts.map((a) => a.synthetic)).toEqual([false, false]);
      expect([r.inputTokens, r.outputTokens]).toEqual([100, 50]);
      expect(r.limits).toEqual({ "x-ratelimit-remaining-tokens": "4000", "x-ratelimit-limit-tokens": "8000" });
      expect(r.real429).toBe(0);
      expect(r.elapsedMs).toBeGreaterThan(0);
    }, { target, clock: clockOf(10) });
  });

  it("EF2: the first 429 is counted once; the later attempts of that call are answered from it with 0 real requests; the next call reaches the network again", async () => {
    let real = 0;
    const target = { fetch: (async () => { real++; return json(429, { error: "slow down" }, { "retry-after": "1" }); }) as unknown as typeof fetch };
    await withCountingFetch(async (c) => {
      c.begin();
      const first = await target.fetch("https://x.invalid/a", { method: "POST" });
      const second = await target.fetch("https://x.invalid/a", { method: "POST" });
      const third = await target.fetch("https://x.invalid/a", { method: "POST" });
      expect([first.status, second.status, third.status]).toEqual([429, 429, 429]);
      expect(await second.json()).toEqual({ error: "slow down" });
      const r = c.end();
      expect(real).toBe(1);
      expect(r.attempts.map((a) => a.synthetic)).toEqual([false, true, true]);
      expect(r.real429).toBe(1);
      c.begin();
      await target.fetch("https://x.invalid/a", { method: "POST" });
      expect(real).toBe(2);
      expect(c.end().real429).toBe(1);
    }, { target, clock: clockOf(1) });
  });

  it("EF3: fetch is put back afterwards, also when the run throws", async () => {
    const original = (async () => OK(1, 1)) as unknown as typeof fetch;
    const target = { fetch: original };
    await expect(withCountingFetch(async () => { throw new Error("boom"); }, { target })).rejects.toThrow("boom");
    expect(target.fetch).toBe(original);
    await withCountingFetch(async () => { expect(target.fetch).not.toBe(original); }, { target });
    expect(target.fetch).toBe(original);
  });
});
