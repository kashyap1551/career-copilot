import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeBullets } from "@/lib/ai/writeBullets";

// Step 8.3, stage 5, step B, tests first (docs/PLAN-8.3.md v2, 0.27 and 0.28): `writeBullets(pairs, show = 3)` has an OPTIONAL second parameter so the eval can
// count accepted bullets BEFORE the cap of 3. The route passes nothing and so still shows 3. `show` is not part of the request: what is sent to the AI does not
// change with it (the bullets request hash stays pinned by tests/bulletsRequestHashPin.test.ts, unedited). The real writer runs on a fake fetch: no network, no AI,
// a dummy key, invented text only. Hand work: five pairs; the AI's fake answer gives pairs 1 to 4 their own line word for word (a line always passes as its own
// bullet, T9c), and pair 5 a bullet that adds the year 2021 (R3: `new-date`). So 4 are accepted, 1 is dropped, asked 5.

const LINES = [
  "Answered the phone and kept the stock sheet up to date in Excel",
  "Handled about 40 orders a day at the counter",
  "Wrote SQL queries to reconcile order data",
  "Built monthly dashboards in Tableau for the sales team",
  "Helped customers at the counter",
];
const PAIRS = LINES.map((line, i) => ({ id: i + 1, requirement: `Requirement ${i + 1}.`, line }));
const ANSWER = { bullets: [...LINES.slice(0, 4).map((text, i) => ({ pair: i + 1, text })), { pair: 5, text: "Helped customers at the counter since 2021" }] };

const realFetch = globalThis.fetch;
let sent: Record<string, unknown>[] = [];
beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "fingerprint-probe-not-a-key");
  vi.stubEnv("GROQ_MODEL", "probe-model");
  sent = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        id: "probe", object: "chat.completion", created: 1, model: "probe",
        choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(ANSWER) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
});
afterEach(() => {
  vi.unstubAllEnvs();
  globalThis.fetch = realFetch;
});

describe("writeBullets: the optional `show` parameter", () => {
  it("W1: the default is 3: four bullets are accepted, three are returned, and the dropped list is the same", async () => {
    const r = await writeBullets(PAIRS);
    expect(r.bullets.map((b) => b.pair)).toEqual([1, 2, 3]);
    expect(r.asked).toBe(5);
    expect(r.dropped).toEqual([{ pair: 5, reason: "new-date" }]);
    expect(r.usage).toEqual({ inputTokens: 7, outputTokens: 3 });
  });

  it("W2: passing the number of pairs returns every accepted bullet (4), in pair order, and the same dropped list", async () => {
    const r = await writeBullets(PAIRS, PAIRS.length);
    expect(r.bullets.map((b) => b.pair)).toEqual([1, 2, 3, 4]);
    expect(r.bullets.map((b) => b.text)).toEqual(LINES.slice(0, 4));
    expect(r.asked).toBe(5);
    expect(r.dropped).toEqual([{ pair: 5, reason: "new-date" }]);
    expect(r.bullets.length).toBe(r.asked - r.dropped.length); // accepted = asked - dropped, before the cap (0.27)
  });

  it("W3: a smaller number caps it (2), and 3 is the same as the default", async () => {
    expect((await writeBullets(PAIRS, 2)).bullets.map((b) => b.pair)).toEqual([1, 2]);
    expect((await writeBullets(PAIRS, 3)).bullets.map((b) => b.pair)).toEqual([1, 2, 3]);
  });

  it("W4: `show` is not part of the request: the body sent to the AI is the same for the default, 2 and 5", async () => {
    await writeBullets(PAIRS);
    await writeBullets(PAIRS, 2);
    await writeBullets(PAIRS, 5);
    expect(sent).toHaveLength(3);
    expect(sent[1]).toEqual(sent[0]);
    expect(sent[2]).toEqual(sent[0]);
  });
});
