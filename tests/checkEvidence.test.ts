import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCheckInput } from "@/lib/ai/checkInput";
import { checkEvidence, INSTRUCTIONS_CHECK } from "@/lib/ai/checkEvidence";
import { ReadAdError } from "@/lib/ai/errors";
import type { SentEntry, SentRequirement } from "@/lib/engine/evidenceProof";

// EC-3a, the evidence call on a FAKE fetch (docs/PLAN-EVERY-CV.md 4.3; tests CE1 to CE7). Nothing is mocked inside lib/ai: the real checkEvidence, the
// real generateText and the real Groq provider run; only globalThis.fetch is replaced (restored after every test; the key is a dummy), so no network call
// can happen. Invented data; every expectation is worked out by hand from the prompt of EC-3a.
//
// The four example requirements and entries of the prompt; the fake's answers are the example's four answers:
//   R1 met, entry 1, "Stitched torn sails"        R2 partly, entry 2, "Drew up the fortnightly crossing plan"
//   R3 met, entry 3, "Polished the brass lantern"  R4 none, entry null, quote null

const MARKER = "MARKER-8841";
const R = (n: number, quote: string): SentRequirement => ({ n, index: n - 1, quote, importance: "must" });
const E = (n: number, name: string, text: string): SentEntry => ({ n, name, skillId: `new:e${n}`, line: n + 1, text, inferred: false });
const REQS = ["Mends sails and rigging", "Has run a ferry rota for five seasons", "Can polish brass or copper fittings", "Speaks Portuguese at work"].map((q, i) => R(i + 1, q));
const ENTRIES = [
  E(1, "Sail repair", "Stitched torn sails and spliced new rope on two sloops"),
  E(2, "Crossing plans", "Drew up the fortnightly crossing plan for the island boat"),
  E(3, "Lantern care", "Polished the brass lantern of the quay beacon each dawn"),
  E(4, "Basque", "Chatted in Basque with visitors at the quay café"),
];
const EXAMPLE_ANSWERS = [
  { requirement: 1, verdict: "met", entry: 1, quote: "Stitched torn sails" },
  { requirement: 2, verdict: "partly", entry: 2, quote: "Drew up the fortnightly crossing plan" },
  { requirement: 3, verdict: "met", entry: 3, quote: "Polished the brass lantern" },
  { requirement: 4, verdict: "none", entry: null, quote: null },
];

const realFetch = globalThis.fetch;
let bodies: Record<string, unknown>[] = [];
function stubFetch(content: unknown, status = 200) {
  bodies = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test", object: "chat.completion", created: 1, model: "openai/gpt-oss-120b",
        choices: [{ index: 0, message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
      }),
      { status, headers: { "content-type": "application/json", "x-ratelimit-remaining-tokens": "7000", "set-cookie": "no" } },
    );
  }) as typeof fetch;
}

const METHODS = ["log", "info", "warn", "error", "debug"] as const;
let spies: Record<(typeof METHODS)[number], ReturnType<typeof vi.spyOn>>;

beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "test-key-not-a-real-key");
  vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
  spies = Object.fromEntries(METHODS.map((m) => [m, vi.spyOn(console, m).mockImplementation(() => {})])) as typeof spies;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const withAnswers = (over: Record<number, unknown>, extra: unknown[] = []) => ({ answers: [...EXAMPLE_ANSWERS.map((a) => over[a.requirement] ?? a), ...extra] });

describe("EC-3a checkEvidence", () => {
  it("CE1: the four example answers: 4 accepted (met, partly, met, none for requirements 1 to 4), 0 thrown away, exactly 1 fetch call", async () => {
    stubFetch({ answers: EXAMPLE_ANSWERS });
    const r = await checkEvidence(REQS, ENTRIES);
    expect(bodies).toHaveLength(1);
    expect(r.accepted.map((a) => [a.requirement, a.verdict])).toEqual([[1, "met"], [2, "partly"], [3, "met"], [4, "none"]]);
    expect(r.thrownAwayCount).toBe(0);
    expect(r.accepted[0].entry?.name).toBe("Sail repair");
    expect(r.usage).toEqual({ inputTokens: 11, outputTokens: 7 });
    expect(r.limits).toEqual({ "x-ratelimit-remaining-tokens": "7000" });
  });

  it("CE2: the request the fake saw: model, temperature 0, seed 20261115, medium reasoning, the instructions, the user text equal to buildCheckInput, a strict schema with the four fields, no token limit", async () => {
    stubFetch({ answers: EXAMPLE_ANSWERS });
    await checkEvidence(REQS, ENTRIES);
    const b = bodies[0] as {
      model: string; temperature: number; seed: number; reasoning_effort: string; max_tokens?: unknown; max_completion_tokens?: unknown;
      messages: { role: string; content: string }[];
      response_format: { type: string; json_schema: { strict: boolean; schema: { properties: { answers: { items: { properties: object; required: string[] } } }; required: string[] } } };
    };
    expect(b.model).toBe("openai/gpt-oss-120b");
    expect(b.temperature).toBe(0);
    expect(b.seed).toBe(20261115);
    expect(b.reasoning_effort).toBe("medium");
    expect(b.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(b.messages[0].content).toBe(INSTRUCTIONS_CHECK);
    expect(b.messages[1].content).toBe(buildCheckInput(REQS, ENTRIES));
    expect(b.response_format.type).toBe("json_schema");
    expect(b.response_format.json_schema.strict).toBe(true);
    expect(b.response_format.json_schema.schema.required).toEqual(["answers"]);
    const item = b.response_format.json_schema.schema.properties.answers.items;
    expect(Object.keys(item.properties).sort()).toEqual(["entry", "quote", "requirement", "verdict"]);
    expect([...item.required].sort()).toEqual(["entry", "quote", "requirement", "verdict"]);
    expect("max_tokens" in b || "max_completion_tokens" in b).toBe(false);
  });

  it("CE3: an invented quote: R1 is not accepted and 1 is thrown away; R2, R3 and R4 are as in CE1", async () => {
    stubFetch(withAnswers({ 1: { requirement: 1, verdict: "met", entry: 1, quote: "Stitched torn canvas" } }));
    const r = await checkEvidence(REQS, ENTRIES);
    expect(r.accepted.map((a) => [a.requirement, a.verdict])).toEqual([[2, "partly"], [3, "met"], [4, "none"]]);
    expect(r.thrownAwayCount).toBe(1);
    expect(r.thrownAway).toEqual([{ requirement: 1, reason: "quote-not-on-line" }]);
    expect(r.decided.find((d) => d.requirement === 1)).toMatchObject({ verdict: "none", thrown: "quote-not-on-line" }); // it reads "no evidence found"
  });

  it("CE4: out of range: an answer naming entry 9 (only 4 sent) is not accepted; an answer for requirement 9 (only 4 sent) is accepted for nothing", async () => {
    stubFetch(withAnswers({ 3: { requirement: 3, verdict: "met", entry: 9, quote: "Polished the brass lantern" } }, [{ requirement: 9, verdict: "met", entry: 1, quote: "Stitched torn sails" }]));
    const r = await checkEvidence(REQS, ENTRIES);
    expect(r.accepted.map((a) => a.requirement)).toEqual([1, 2, 4]);
    expect(r.thrownAway).toEqual([{ requirement: 3, reason: "entry-not-sent" }]);
    expect(r.accepted.some((a) => a.requirement === 9)).toBe(false);
    expect(r.decided.some((d) => d.requirement === 9)).toBe(false);
  });

  it("CE5: an answer that does not match the schema ({\"answers\":\"yes\"}) is refused like the CV path (ReadAdError 502 'not in the expected shape'); one fixed log line, nothing else, no marker", async () => {
    stubFetch({ answers: "yes" });
    const entries = [E(1, "Sail repair", `Stitched torn sails ${MARKER}`), ...ENTRIES.slice(1)];
    const error = await checkEvidence(REQS, entries).catch((e) => e);
    expect(error).toBeInstanceOf(ReadAdError);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/not in the expected shape/);
    expect(spies.error.mock.calls).toEqual([["check: the model's answer did not match the schema"]]);
    for (const m of ["log", "info", "warn", "debug"] as const) expect(spies[m].mock.calls, `console.${m}`).toEqual([]);
    expect(JSON.stringify(METHODS.map((m) => spies[m].mock.calls))).not.toContain(MARKER);
    expect(bodies).toHaveLength(1); // no retry for an answer in the wrong shape
  });

  it("CE6: a missing setting (GROQ_API_KEY empty): refused like the CV path, one fixed log line, the fake fetch is never called", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    stubFetch({ answers: EXAMPLE_ANSWERS });
    const error = await checkEvidence(REQS, ENTRIES).catch((e) => e);
    expect(error).toBeInstanceOf(ReadAdError);
    expect(error.status).toBe(500);
    expect(error.message).toBe("The server is missing its AI settings. Check GROQ_API_KEY and GROQ_MODEL.");
    expect(spies.error.mock.calls).toEqual([["check: missing setting"]]);
    expect(bodies).toHaveLength(0);
  });

  it("CE7: the proof works on the positions that were sent: objects that carry other numbers are numbered 1, 2, 3 ... as in the text, so the answers line up", async () => {
    stubFetch({ answers: [{ requirement: 2, verdict: "met", entry: 1, quote: "Polished the brass lantern" }, { requirement: 1, verdict: "none", entry: null, quote: null }] });
    const reqs = [R(7, "Can polish brass or copper fittings"), R(3, "Speaks Portuguese at work")];
    const entries = [E(9, "Lantern care", "Polished the brass lantern of the quay beacon each dawn")];
    const r = await checkEvidence(reqs, entries);
    expect(r.accepted.map((a) => [a.requirement, a.verdict])).toEqual([[1, "none"], [2, "met"]]);
    expect(r.accepted[1].entry?.name).toBe("Lantern care");
    expect((bodies[0] as { messages: { content: string }[] }).messages[1].content).toContain('R2 "Speaks Portuguese at work"');
  });

  it("CE8: a 429 from the service, tried again by the SDK as always (3 tries, the same text each time), comes out as a busy ReadAdError 429 with one fixed log line", async () => {
    vi.useFakeTimers();
    try {
      stubFetch({ error: { message: `${MARKER} echoed`, type: "x" } }, 429);
      const started = checkEvidence(REQS, ENTRIES).catch((e) => e);
      await vi.advanceTimersByTimeAsync(10_000);
      const error = await started;
      expect(error.status).toBe(429);
      expect(spies.error.mock.calls).toEqual([["check: AI service error, status 429"]]);
      expect(bodies).toHaveLength(3); // the SDK's default of 2 retries is untouched (claim C15)
    } finally {
      vi.useRealTimers();
    }
  });
});
