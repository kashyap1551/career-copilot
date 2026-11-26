import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as POST_CV } from "@/app/api/cv/route";
import { POST as POST_CHECK } from "@/app/api/check/route";
import { jsonNoStore } from "@/lib/ai/noStore";
import { DENIED, ENTRIES, EXAMPLE_ANSWERS, goodBody, post, REQUIREMENTS, SEND_JSON, setUp, stubFetch, state, tearDown, WRONG_FIELDS, type Spies } from "./checkRouteKit";

// EC-3b, the route POST /api/check (docs/PLAN-EVERY-CV.md 4.3; tests CR1 to CR8). Same order as /api/cv: the kill switch, the access code, the body read,
// the shape check, then the call. Nothing is mocked inside lib/ai; the fake fetch is restored after every test. Invented data; every expectation is
// worked out by hand from the prompt of EC-3b. MARKER-6612 stands for text that must never be echoed.

const MARKER = "MARKER-6612";
let spies: Spies;
beforeEach(() => {
  ({ spies } = setUp());
  stubFetch({ answers: EXAMPLE_ANSWERS });
});
afterEach(tearDown);

describe("EC-3b /api/check: what it refuses, and in which order", () => {
  it("CR1: AI paused: the same status and body as /api/cv gives when paused, 0 fetch calls, also with NO access header (the kill switch is first)", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const check = await POST_CHECK(post(goodBody(), { code: null }));
    const cv = await POST_CV(new Request("http://localhost/api/cv", { method: "POST", body: JSON.stringify({ lines: ["x"] }) }));
    expect(check.status).toBe(503);
    expect([check.status, await check.json()]).toEqual([cv.status, await cv.json()]);
    expect(state.bodies).toHaveLength(0);
  });

  it("CR2 and CR3: no access header, or a wrong code: 401 'The access code is missing or wrong.', 0 fetch calls", async () => {
    for (const code of [null, "a-wrong-code-0123456789"]) {
      const res = await POST_CHECK(post(goodBody(), { code }));
      expect([res.status, await res.json()]).toEqual([401, { error: DENIED }]);
    }
    expect(state.bodies).toHaveLength(0);
  });

  it("CR4: malformed JSON, and an empty body: 400 with the first fixed sentence, 0 fetch calls, a marker in the body is not in the answer", async () => {
    for (const raw of [`${MARKER}{not json`, ""]) {
      const res = await POST_CHECK(post(null, { raw }));
      const text = await res.text();
      expect(res.status).toBe(400);
      expect(JSON.parse(text)).toEqual({ error: SEND_JSON });
      expect(text).not.toContain(MARKER);
    }
    expect(state.bodies).toHaveLength(0);
  });

  it("CR5: wrong fields or limits: 400 with the second fixed sentence, 0 fetch calls, no echo of a marker (nine cases)", async () => {
    const e1 = { name: "n", text: "t" };
    const cases: [string, unknown][] = [
      ["requirements not an array", { requirements: MARKER, entries: [e1] }],
      ["requirements empty", { requirements: [], entries: [e1] }],
      ["31 requirements", { requirements: Array.from({ length: 31 }, () => MARKER), entries: [e1] }],
      ["entries empty", { requirements: [MARKER], entries: [] }],
      ["121 entries", { requirements: [MARKER], entries: Array.from({ length: 121 }, () => ({ name: MARKER, text: MARKER })) }],
      ["an entry without text", { requirements: [MARKER], entries: [{ name: MARKER }] }],
      ["a requirement that is not a string", { requirements: [MARKER, 7], entries: [e1] }],
      ["a requirement of 1,001 characters", { requirements: [MARKER + "a".repeat(1001 - MARKER.length)], entries: [e1] }],
      ["an entry text of 1,001 characters", { requirements: [MARKER], entries: [{ name: "n", text: "a".repeat(1001) }] }],
    ];
    for (const [label, body] of cases) {
      const res = await POST_CHECK(post(body));
      const text = await res.text();
      expect([label, res.status, JSON.parse(text)]).toEqual([label, 400, { error: WRONG_FIELDS }]);
      expect(text, label).not.toContain(MARKER);
    }
    expect(state.bodies).toHaveLength(0);
    // the limits themselves are allowed: 30 requirements, 120 entries, 1,000 characters
    stubFetch({ answers: [] });
    const ok = await POST_CHECK(post({ requirements: Array.from({ length: 30 }, () => "r".repeat(1000)), entries: Array.from({ length: 120 }, () => ({ name: "n".repeat(120), text: "t".repeat(1000) })) }));
    expect(ok.status).toBe(200);
  });

  it("CR6: order: paused AND wrong code AND malformed body gives the paused answer; wrong code AND malformed body gives 401; 0 fetch calls in both", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const paused = await POST_CHECK(post(null, { code: "wrong-code-0123456789", raw: `${MARKER}{not json` }));
    expect([paused.status, (await paused.json()).error]).toEqual([503, "The AI reading is paused right now. Please try again later."]);
    vi.stubEnv("AI_ENABLED", "");
    const denied = await POST_CHECK(post(null, { code: "wrong-code-0123456789", raw: `${MARKER}{not json` }));
    expect([denied.status, await denied.json()]).toEqual([401, { error: DENIED }]);
    expect(state.bodies).toHaveLength(0);
  });
});

describe("EC-3b /api/check: the answer", () => {
  it("CR7: the four example requirements and entries: 200, no-store like /api/cv, exactly the accepted answers and thrownAway 0, nothing of any entry in the answer, 1 fetch call", async () => {
    const res = await POST_CHECK(post(goodBody()));
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(jsonNoStore({}).headers.get("cache-control"));
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(JSON.parse(text)).toEqual({
      answers: [
        { requirement: 1, verdict: "met", entry: 1, quote: "Stitched torn sails" },
        { requirement: 2, verdict: "partly", entry: 2, quote: "Drew up the fortnightly crossing plan" },
        { requirement: 3, verdict: "met", entry: 3, quote: "Polished the brass lantern" },
        { requirement: 4, verdict: "none", entry: null, quote: null },
      ],
      thrownAway: 0,
    });
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(["answers", "thrownAway"]);
    for (const e of ENTRIES) {
      expect(text).not.toContain(e.name);
      expect(text).not.toContain(e.text);
    }
    expect(text).not.toMatch(/usage|inputTokens|outputTokens|ratelimit|limits/i);
    expect(state.bodies).toHaveLength(1);
    expect(spies.error.mock.calls).toEqual([]);
  });

  it("CR8: an invented quote for R1 ('Stitched torn canvas'): 200, the answers hold requirements 2, 3 and 4 only, thrownAway 1", async () => {
    stubFetch({ answers: [{ requirement: 1, verdict: "met", entry: 1, quote: "Stitched torn canvas" }, ...EXAMPLE_ANSWERS.slice(1)] });
    const res = await POST_CHECK(post(goodBody()));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.answers.map((a: { requirement: number }) => a.requirement)).toEqual([2, 3, 4]);
    expect(body.thrownAway).toBe(1);
  });

  it("CR8b: the answers come in ascending requirement order whatever order the AI used, and the code does not need the requirements it sent to be in any order", async () => {
    stubFetch({ answers: [...EXAMPLE_ANSWERS].reverse() });
    const body = await (await POST_CHECK(post(goodBody({ requirements: REQUIREMENTS })))).json();
    expect(body.answers.map((a: { requirement: number }) => a.requirement)).toEqual([1, 2, 3, 4]);
  });
});
