import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { skills } from "@/fixtures/skills";
import { askBullets, checkAnswer, createBulletsRunner, makePost, type BulletsOutcome } from "@/app/bullets";
import { getAccessUi, keepAccessCode, showAccess } from "@/app/accessFetch";
import { NEED_CODE_MESSAGE } from "@/lib/ai/accessMessages";
import type { BulletPair } from "@/lib/engine/bulletPairs";
import {
  BULLETS_FAILED_LINE,
  BULLETS_TIMEOUT_LINE,
  COULD_NOT_REACH_LINE,
  serverErrorLine,
} from "@/lib/saved/messages";

// Step 8.3, stage 4, tests first (docs/PLAN-8.3.md v2, 0.26 and D9, D12; tests T20, T22, T38, T39, T40, T41). The block's logic without a browser: the answer is re-checked
// by the page (T22), one call per press and none while waiting (T20), a 30-second timer that ignores a late answer (T38), nothing stored (T39), a 401 behaves as for the
// other two AI calls (T40), and every way the answer can be wrong is a plain line (T41). Every network call is a fake; no AI; invented text only.

const L4 = "Answered the phone and kept the stock sheet up to date in Excel";
const L5 = "Helped customers at the counter";
const TWO: BulletPair[] = [
  { id: 1, requirement: "Excel is required.", skillId: "excel", line: 4, text: L4 },
  { id: 2, requirement: "Customer service is a plus.", skillId: "customer-service", line: 5, text: L5 },
];
const FIVE: BulletPair[] = [
  { id: 1, requirement: "Excel is required.", skillId: "excel", line: 1, text: "Kept the books in Excel" },
  { id: 2, requirement: "SQL is required.", skillId: "sql", line: 2, text: "Wrote SQL queries" },
  { id: 3, requirement: "Python is required.", skillId: "python", line: 3, text: "Wrote Python scripts" },
  { id: 4, requirement: "Tableau is required.", skillId: "tableau", line: 4, text: "Built dashboards in Tableau" },
  { id: 5, requirement: "Spreadsheets are required.", skillId: "spreadsheets", line: 5, text: "Kept spreadsheets tidy" },
];

const json = (body: unknown, status = 200) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const memoryStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe("T22: the page re-checks every returned bullet against its own pair's line (D9)", () => {
  it("T22: a bullet the route sent that fails the checks is not shown, and counts as dropped with the route's own dropped pairs", () => {
    const got = checkAnswer(
      { bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }, { pair: 2, text: "Helped customers at the counter since 2021" }], dropped: [] },
      TWO,
    );
    expect(got.shown).toEqual([
      { pair: 1, line: 4, text: "Kept the stock sheet up to date in Excel", source: `from your CV line 4: "${L4}"` },
    ]);
    expect(got.dropped).toBe(1);
  });

  it("T22: five pairs, the route kept 3 and dropped 2; the page drops one of the 3: 2 shown, 3 dropped (every dropped pair counts, whoever dropped it)", () => {
    const got = checkAnswer(
      {
        bullets: [{ pair: 1, text: "Kept the books in Excel" }, { pair: 2, text: "Wrote 40 SQL queries" }, { pair: 3, text: "Wrote Python scripts" }],
        dropped: [{ pair: 4, reason: "new-word" }, { pair: 5, reason: "missing" }], // the route's own dropped list (completed: the route names the pairs it dropped)
      },
      FIVE,
    );
    expect(got.shown.map((b) => b.pair)).toEqual([1, 3]);
    expect(got.shown.map((b) => b.line)).toEqual([1, 3]); // the REAL CV line numbers, not the ids that were sent
    expect(got.dropped).toBe(3); // pair 2 (the page), pairs 4 and 5 (the route)
  });

  it("T22: at most 3 bullets are shown, in pair order", () => {
    const answer = { bullets: FIVE.map((p) => ({ pair: p.id, text: p.text })), dropped: [] }; // a defensive case: the real route never sends more than 3
    expect(checkAnswer(answer, FIVE).shown.map((b) => b.pair)).toEqual([1, 2, 3]);
  });

  it("T22: a bullet that equals its line (lower-case, spaces collapsed) shows the source once: 'from your CV line N' with no quote", () => {
    const got = checkAnswer({ bullets: [{ pair: 2, text: "helped  CUSTOMERS at the counter" }, { pair: 1, text: "Kept the stock sheet up to date in Excel" }], dropped: [] }, TWO);
    expect(got.shown.find((b) => b.pair === 2)?.source).toBe("from your CV line 5");
    expect(got.shown.find((b) => b.pair === 1)?.source).toBe(`from your CV line 4: "${L4}"`);
  });

  it("T22: a pair that was not asked is ignored; a pair answered twice is dropped", () => {
    const got = checkAnswer(
      {
        bullets: [{ pair: 9, text: "Helped customers at the counter" }, { pair: 1, text: "Kept the stock sheet up to date in Excel" }, { pair: 1, text: "Kept the stock sheet up to date in Excel" }],
        dropped: [{ pair: 2, reason: "missing" }], // completed: the pair the AI skipped is on the route's dropped list
      },
      TWO,
    );
    expect(got.shown).toEqual([]);
    expect(got.dropped).toBe(2);
  });
});

describe("D1 (0.27): W8 counts only the pairs a CHECK dropped, never a pair the cap of 3 left out", () => {
  const ok = (ids: number[]) => ids.map((id) => ({ pair: id, text: FIVE[id - 1].text }));
  const ids = (r: { shown: { pair: number }[] }) => r.shown.map((b) => b.pair);

  it("D1 a: five valid pairs, the route returns 1, 2 and 3 (the cap), dropped []: shown 1, 2, 3; dropped 0 (pairs 4 and 5 were only left out by the cap)", () => {
    const got = checkAnswer({ bullets: ok([1, 2, 3]), dropped: [] }, FIVE);
    expect(ids(got)).toEqual([1, 2, 3]);
    expect(got.dropped).toBe(0);
  });
  it("D1 b: the route returns 1, 3 and 4 (all valid) and dropped [{ pair 2, new-number }]: shown 1, 3, 4; dropped 1", () => {
    const got = checkAnswer({ bullets: ok([1, 3, 4]), dropped: [{ pair: 2, reason: "new-number" }] }, FIVE);
    expect(ids(got)).toEqual([1, 3, 4]);
    expect(got.dropped).toBe(1);
  });
  it("D1 c: the route returns 1, 2, 3 where pair 2 is 'Wrote 40 SQL queries' (the page rejects it) and dropped [{ pair 4, new-word }]: shown 1, 3; dropped 2 (pair 4 by the route, pair 2 by the page); pair 5 is not counted", () => {
    const bullets = ok([1, 2, 3]);
    bullets[1] = { pair: 2, text: "Wrote 40 SQL queries" };
    const got = checkAnswer({ bullets, dropped: [{ pair: 4, reason: "new-word" }] }, FIVE);
    expect(ids(got)).toEqual([1, 3]);
    expect(got.dropped).toBe(2);
  });
  it("D1 d: the T22 five-pairs case with the route's dropped list [{ pair 4 }, { pair 5 }]: 2 shown, dropped 3 (this is the test above, unchanged in its expected values)", () => {
    const got = checkAnswer(
      { bullets: [{ pair: 1, text: "Kept the books in Excel" }, { pair: 2, text: "Wrote 40 SQL queries" }, { pair: 3, text: "Wrote Python scripts" }], dropped: [{ pair: 4, reason: "new-word" }, { pair: 5, reason: "missing" }] },
      FIVE,
    );
    expect(ids(got)).toEqual([1, 3]);
    expect(got.dropped).toBe(3);
  });
  it("D1 e: the route's dropped list names a pair id that was not asked (9): ignored, not counted", () => {
    const got = checkAnswer({ bullets: ok([1, 2, 3]), dropped: [{ pair: 9, reason: "new-word" }] }, FIVE);
    expect(got.dropped).toBe(0);
  });
  it("D1 f: the route's dropped list names pair 2 twice: counted once", () => {
    const got = checkAnswer({ bullets: ok([1, 3, 4]), dropped: [{ pair: 2, reason: "new-number" }, { pair: 2, reason: "new-number" }] }, FIVE);
    expect(got.dropped).toBe(1);
  });
  it("D1 g: two pairs, two valid bullets, nothing dropped: dropped 0", () => {
    const got = checkAnswer({ bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }, { pair: 2, text: "Helped customers at the counter" }], dropped: [] }, TWO);
    expect(ids(got)).toEqual([1, 2]);
    expect(got.dropped).toBe(0);
  });
  it("D1: through askBullets, a route answer of 3 bullets for 5 valid pairs shows 3 and says nothing was dropped", async () => {
    const res = json({ bullets: ok([1, 2, 3]), asked: 5, dropped: [] });
    const out = await askBullets(FIVE, { post: async () => ({ kind: "answer", res }) });
    expect(out.kind).toBe("shown");
    if (out.kind === "shown") {
      expect(out.bullets.map((b) => b.pair)).toEqual([1, 2, 3]);
      expect(out.dropped).toBe(0);
    }
  });
});

describe("T20: one call per press, none while waiting, no automatic retry", () => {
  it("T20: a second press while the first call is pending makes no call and returns null; after it settles a press is a new call", async () => {
    let finish: (o: BulletsOutcome) => void = () => {};
    const ask = vi.fn(() => new Promise<BulletsOutcome>((resolve) => (finish = resolve)));
    const runner = createBulletsRunner(ask);
    const first = runner.press(TWO);
    expect(runner.busy).toBe(true);
    expect(runner.press(TWO)).toBeNull();
    expect(runner.press(TWO)).toBeNull();
    expect(ask).toHaveBeenCalledTimes(1);
    finish({ kind: "none-passed" });
    await expect(first).resolves.toEqual({ kind: "none-passed" });
    expect(runner.busy).toBe(false);
    ask.mockResolvedValueOnce({ kind: "none-passed" });
    await runner.press(TWO);
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it("T20: a failed call is not retried by itself: one call, one failed outcome", async () => {
    const ask = vi.fn().mockResolvedValue({ kind: "failed", line: "x" });
    const runner = createBulletsRunner(ask);
    await runner.press(TWO);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("T20: an ask that throws unexpectedly is a failed outcome with the plain line, and the runner is free again", async () => {
    const runner = createBulletsRunner(async () => {
      throw new Error("SECRET");
    });
    expect(await runner.press(TWO)).toEqual({ kind: "failed", line: BULLETS_FAILED_LINE });
    expect(runner.busy).toBe(false);
  });
});

describe("T38: the 30-second timer", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // A post that never answers by itself and rejects when its signal is aborted, like a fetch.
  const hangingPost = (late?: { resolve: () => void }) => (_body: unknown, signal: AbortSignal) =>
    new Promise<never>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      if (late) late.resolve = () => reject(new Error("late"));
    });

  it("T38: no answer within 30 seconds: the outcome is the timeout line; 29,999 ms is not yet", async () => {
    const done = vi.fn();
    const p = askBullets(TWO, { post: hangingPost() }).then(done);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toHaveBeenCalledWith({ kind: "failed", line: BULLETS_TIMEOUT_LINE });
  });

  it("T38: the request is aborted when the time is up", async () => {
    let seen: AbortSignal | undefined;
    const p = askBullets(TWO, { post: (_b, signal) => ((seen = signal), hangingPost()(_b, signal)) });
    await vi.advanceTimersByTimeAsync(30_000);
    await p;
    expect(seen?.aborted).toBe(true);
  });

  it("T38: an answer that comes AFTER the time is up is ignored: the outcome stays the timeout line", async () => {
    let answer: (r: Response) => void = () => {};
    const post = () => new Promise<{ kind: "answer"; res: Response }>((resolve) => (answer = (res) => resolve({ kind: "answer", res })));
    const p = askBullets(TWO, { post });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await p).toEqual({ kind: "failed", line: BULLETS_TIMEOUT_LINE });
    answer(json({ bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }], asked: 2, dropped: [] }));
    await vi.advanceTimersByTimeAsync(0);
    expect(await p).toEqual({ kind: "failed", line: BULLETS_TIMEOUT_LINE });
  });

  it("T38: an answer within the time clears the timer (nothing fires later) and the timeout is configurable", async () => {
    const post = vi.fn(async () => ({ kind: "answer" as const, res: json({ bullets: [], asked: 2, dropped: [] }) }));
    const out = await askBullets(TWO, { post });
    expect(out).toEqual({ kind: "none-passed" });
    expect(vi.getTimerCount()).toBe(0);
    const quick = askBullets(TWO, { post: hangingPost(), timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await quick).toEqual({ kind: "failed", line: BULLETS_TIMEOUT_LINE });
  });
});

describe("T41: the answer, and every way it can be wrong, as a plain line", () => {
  const ask = (res: Response | Error) => askBullets(TWO, { post: async () => { if (res instanceof Error) throw res; return { kind: "answer", res }; } });

  it("T41: a good answer: the bullets are shown with their real line numbers; the dropped count is every dropped pair", async () => {
    const out = await ask(json({ bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }], asked: 2, dropped: [{ pair: 2, reason: "new-date" }] }));
    expect(out).toEqual({
      kind: "shown",
      bullets: [{ pair: 1, line: 4, text: "Kept the stock sheet up to date in Excel", source: `from your CV line 4: "${L4}"` }],
      dropped: 1,
    });
  });
  it("T41: nothing passed (the route kept nothing, or the page dropped everything)", async () => {
    expect(await ask(json({ bullets: [], asked: 2, dropped: [{ pair: 1, reason: "new-word" }, { pair: 2, reason: "missing" }] }))).toEqual({ kind: "none-passed" });
    expect(await ask(json({ bullets: [{ pair: 1, text: "Kept 12 stock sheets in Excel" }], asked: 2, dropped: [] }))).toEqual({ kind: "none-passed" });
  });
  it("T41: an error answer shows the route's own message; without one, 'The server returned an error (status).'", async () => {
    expect(await ask(json({ error: "The AI service is busy right now. Please try again in a minute." }, 429))).toEqual({ kind: "failed", line: "The AI service is busy right now. Please try again in a minute." });
    expect(await ask(json({ error: "The AI reading is paused right now. Please try again later." }, 503))).toEqual({ kind: "failed", line: "The AI reading is paused right now. Please try again later." });
    expect(await ask(json("<html>gateway timeout</html>", 504))).toEqual({ kind: "failed", line: serverErrorLine(504) });
    expect(serverErrorLine(504)).toBe("The server returned an error (504).");
  });
  it("T41: an answer in a wrong shape, or not JSON, is the plain failed line", async () => {
    for (const body of [{ bullets: "x" }, { bullets: [{ pair: "1", text: 5 }], asked: 2, dropped: [] }, {}, null, "not json"]) {
      expect(await ask(json(body as never))).toEqual({ kind: "failed", line: BULLETS_FAILED_LINE });
    }
  });
  it("T41: no connection is 'Could not reach the server. Check your connection and try again.'", async () => {
    expect(await ask(new TypeError("Failed to fetch"))).toEqual({ kind: "failed", line: COULD_NOT_REACH_LINE });
    expect(COULD_NOT_REACH_LINE).toBe("Could not reach the server. Check your connection and try again.");
  });
});

describe("T40: a 401 behaves as for the other two AI calls", () => {
  afterEach(() => showAccess("cv", null));
  it("T40: no code kept: the code box of the BLOCK opens with the 'enter the code' message, nothing else is shown by the block, no code header is sent", async () => {
    const store = memoryStore();
    const fetchFake = vi.fn(async () => json({ error: "x" }, 401));
    const out = await askBullets(TWO, { post: makePost({ fetch: fetchFake as never, store }) });
    expect(out).toEqual({ kind: "access" });
    expect(getAccessUi()).toEqual({ source: "bullets", message: NEED_CODE_MESSAGE }); // the block has its own access source (0.27): the box opens next to the button
    expect(fetchFake).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFake.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe("/api/bullets");
    expect(Object.keys(init.headers).map((h) => h.toLowerCase())).not.toContain("x-access-code");
    expect(JSON.parse(init.body)).toEqual({ pairs: [{ id: 1, requirement: "Excel is required.", line: L4 }, { id: 2, requirement: "Customer service is a plus.", line: L5 }] });
  });
  it("T40: a kept code is sent in the header (never printed here), and a wrong one is forgotten at once", async () => {
    const store = memoryStore();
    const code = "an-invented-test-code-0123";
    keepAccessCode(code, store);
    const fetchFake = vi.fn(async () => json({ error: "x" }, 401));
    await askBullets(TWO, { post: makePost({ fetch: fetchFake as never, store }) });
    const init = fetchFake.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(init[1].headers["x-access-code"]).toBe(code);
    expect(store.getItem("career-copilot.access-code")).toBeNull(); // forgotten by postJson, as for the other calls
  });
});

describe("T39: nothing is stored by the block", () => {
  it("T39: a whole successful call, a nothing-passed call and a failed call write nothing to localStorage, sessionStorage or IndexedDB", async () => {
    const writes = vi.fn();
    const store = () => ({ getItem: () => null, setItem: writes, removeItem: writes, clear: writes, key: writes, length: 0 });
    const idb = { open: writes, deleteDatabase: writes };
    const g = globalThis as unknown as Record<string, unknown>;
    const saved = { localStorage: g.localStorage, sessionStorage: g.sessionStorage, indexedDB: g.indexedDB };
    g.localStorage = store();
    g.sessionStorage = store();
    g.indexedDB = idb;
    try {
      const answers = [
        json({ bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }], asked: 2, dropped: [{ pair: 2, reason: "missing" }] }),
        json({ bullets: [], asked: 2, dropped: [] }),
        json({ error: "The AI service is busy right now. Please try again in a minute." }, 429),
      ];
      for (const res of answers) await askBullets(TWO, { post: async () => ({ kind: "answer", res }) });
      await askBullets(TWO, { post: makePost({ fetch: (async () => json({ bullets: [], asked: 2, dropped: [] })) as never }) });
    } finally {
      g.localStorage = saved.localStorage;
      g.sessionStorage = saved.sessionStorage;
      g.indexedDB = saved.indexedDB;
    }
    expect(writes).not.toHaveBeenCalled();
  });
});

describe("the check uses the real vocabulary", () => {
  it("a bullet that names a skill of another line is dropped by the page (new-skill)", () => {
    // completed: the pair the AI skipped (pair 2) is on the route's dropped list, as the real route answers
    const got = checkAnswer({ bullets: [{ pair: 1, text: "Kept the books in Excel and SQL" }], dropped: [{ pair: 2, reason: "missing" }] }, FIVE.slice(0, 2));
    expect(got.shown).toEqual([]);
    expect(got.dropped).toBe(2);
    expect(skills.length).toBeGreaterThan(100);
  });
});
