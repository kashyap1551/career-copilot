import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeBullets, writeBulletsForEval } from "@/lib/ai/writeBullets";

// Step 8.3, stage 5b, tests first (docs/PLAN-8.3.md v2, amendment 0.29): `writeBulletsForEval` is used only by the eval. It runs the SAME inner code as
// `writeBullets` (the same request, the same checks) and also returns the AI's own text of every dropped bullet. `writeBullets` (the route's function) returns
// exactly what it returned before: no text of a dropped bullet. Real functions on a fake fetch: no network, no AI, a dummy key, invented text only.
// The pairs and the fake answer are those of tests/bulletsDropped.test.ts (hand work there): pair 1 accepted; 2 new-number; 3 lost-qualifier; 4 answered twice
// (repeated-pair); 5 missing; and a bullet for the unasked pair 9.

const LINES = [
  "Answered the phone and kept the stock sheet up to date in Excel",
  "Wrote SQL queries to reconcile order data",
  "Helped customers at the counter",
  "Built monthly dashboards in Tableau for the sales team",
  "Handled about 40 orders a day at the counter",
];
const PAIRS = LINES.map((line, i) => ({ id: i + 1, requirement: `Requirement ${i + 1}.`, line }));
const ANSWER = {
  bullets: [
    { pair: 1, text: "Kept the stock sheet up to date in Excel" },
    { pair: 2, text: "Wrote 300 SQL queries" },
    { pair: 3, text: "customers at the counter" },
    { pair: 4, text: "Built monthly dashboards" },
    { pair: 4, text: "Built monthly dashboards in Tableau" },
    { pair: 9, text: "Never asked for" },
  ],
};

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

const DROPPED = [
  { pair: 2, reason: "new-number" },
  { pair: 3, reason: "lost-qualifier" },
  { pair: 4, reason: "repeated-pair" },
  { pair: 5, reason: "missing" },
];

describe("writeBulletsForEval: the AI's own text of the dropped bullets, for the eval only", () => {
  it("W5: it returns the same bullets, asked, dropped and usage as writeBullets, plus the text of every dropped bullet", async () => {
    const r = await writeBulletsForEval(PAIRS, 5);
    expect(r.bullets).toEqual([{ pair: 1, text: "Kept the stock sheet up to date in Excel" }]);
    expect(r.asked).toBe(5);
    expect(r.dropped).toEqual(DROPPED);
    expect(r.usage).toEqual({ inputTokens: 7, outputTokens: 3 });
    expect(r.droppedDetail).toEqual([
      { pair: 2, reason: "new-number", texts: ["Wrote 300 SQL queries"] },
      { pair: 3, reason: "lost-qualifier", texts: ["customers at the counter"] },
      { pair: 4, reason: "repeated-pair", texts: ["Built monthly dashboards", "Built monthly dashboards in Tableau"] },
      { pair: 5, reason: "missing", texts: [] },
    ]);
  });

  it("W6: writeBullets (the route's function) is unchanged: no text of a dropped bullet and no extra field, whatever `show` is", async () => {
    for (const r of [await writeBullets(PAIRS), await writeBullets(PAIRS, 5)]) {
      expect(Object.keys(r).sort()).toEqual(["asked", "bullets", "dropped", "limits", "usage"]);
      expect(r.dropped).toEqual(DROPPED);
      const text = JSON.stringify(r);
      for (const secret of ["Wrote 300", "customers at the counter", "Built monthly dashboards", "Never asked for"]) expect(text).not.toContain(secret);
    }
  });

  it("W7: the request is the same: the body sent for writeBulletsForEval equals the body sent for writeBullets", async () => {
    await writeBullets(PAIRS);
    await writeBulletsForEval(PAIRS, 5);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
  });
});
