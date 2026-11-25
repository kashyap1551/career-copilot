import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as POST_CHECK } from "@/app/api/check/route";
import { CODE, DENIED, ENTRIES, goodBody, METHODS, post, SEND_JSON, setUp, state, stubFetch, tearDown, WRONG_FIELDS, type Spies } from "./checkRouteKit";

// EC-3b (docs/PLAN-EVERY-CV.md section 8; tests CR9 and CR10), the pattern of tests/logHygiene.test.ts for /api/check: can any error path print CV text, ad
// text or the AI SDK's error objects? The real route, the real checkEvidence, the real generateText and the real Groq provider run; only globalThis.fetch is
// replaced (restored after every test), the key is a dummy.
//
// HAND-WORKED EXPECTATIONS
//  The AI SDK (ai@7.0.172, node_modules/ai/dist/index.js:2429 and :2450) has maxRetries 2, first wait 2,000 ms, factor 2: one failing request is 1 try + 2
//  retries = 3 fetch calls, for a 500 and for a 429 alike (claim C15). The fake clock runs 10,000 ms, more than the 6,000 ms of waiting. The marker is in
//  the CV line that is sent, so it is in every request body once; the instructions and the schema do not hold it.
//  CR9  an entry text holds MARKER-9731. The fake answers 500: 3 calls (marker once in each body); status 502; the answer JSON has no marker; console.error
//       once, with the one argument "check: AI service error, status 500"; console.log, info, warn, debug and process.emitWarning 0 calls; nothing logged
//       holds the marker. Then 429: 3 calls, status 429, the busy sentence of /api/cv ("The AI service is busy right now. Please try again in a minute."),
//       one log "check: AI service error, status 429".
//  CR10 seven hostile bodies (the cases of L5 in tests/logHygiene.test.ts, for /api/check; marker MARKER-5521), each CALLED directly:
//         1 malformed JSON `MARKER-5521{not json` with the code   400  Send JSON like { "requirements": ... }.
//         2 an empty body                                          400  the same sentence
//         3 a JSON array ["MARKER-5521"]                           400  Zod's own "Invalid input: expected object, received array"
//         4 a JSON string "MARKER-5521"                            400  Zod's own "Invalid input: expected object, received string"
//         5 {"requirements":123}                                   400  Send 1 to 30 requirements as texts, ...
//         6 {"other":"MARKER-5521"}                                400  the same sentence as case 5
//         7 malformed JSON and NO access header                    401  The access code is missing or wrong.
//       7 calls, every call resolves, nothing is logged, process.emitWarning is not called, and the marker is in no answer.

const MARKER = "MARKER-9731";
const HOSTILE = "MARKER-5521";
let spies: Spies;
let emitWarning: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  ({ spies, emitWarning } = setUp());
});
afterEach(() => {
  vi.useRealTimers(); // always: a test that fails must not leave fake timers behind
  tearDown();
});

const occurrences = (text: string) => text.split(MARKER).length - 1;
const withMarker = () => goodBody({ entries: [{ name: ENTRIES[0].name, text: `${ENTRIES[0].text} ${MARKER}` }, ...ENTRIES.slice(1)] });
const everythingLogged = () => JSON.stringify([...METHODS.map((m) => spies[m].mock.calls), emitWarning.mock.calls]);

async function drive(started: Promise<Response>): Promise<Response> {
  await vi.advanceTimersByTimeAsync(10_000);
  return started;
}

describe("EC-3b no CV text, ad text or SDK error object reaches a log (CR9)", () => {
  it("CR9: a failing call (500, then 429) logs only the fixed line, after 3 tries, with the marker in every body and in no answer or log", async () => {
    stubFetch(null, 500, MARKER);
    const res = await drive(POST_CHECK(post(withMarker())));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain(MARKER);
    expect(state.bodies).toHaveLength(3);
    for (const b of state.bodies) expect(occurrences(b)).toBe(1);
    expect(spies.error.mock.calls).toEqual([["check: AI service error, status 500"]]);
    for (const m of ["log", "info", "warn", "debug"] as const) expect(spies[m].mock.calls, `console.${m}`).toEqual([]);
    expect(emitWarning.mock.calls).toEqual([]);
    expect(everythingLogged()).not.toContain(MARKER);

    spies.error.mockClear();
    stubFetch(null, 429, MARKER);
    const busy = await drive(POST_CHECK(post(withMarker())));
    expect(busy.status).toBe(429);
    const busyBody = await busy.json();
    expect(busyBody).toEqual({ error: "The AI service is busy right now. Please try again in a minute." });
    expect(state.bodies).toHaveLength(3);
    for (const b of state.bodies) expect(occurrences(b)).toBe(1);
    expect(spies.error.mock.calls).toEqual([["check: AI service error, status 429"]]);
    for (const m of ["log", "info", "warn", "debug"] as const) expect(spies[m].mock.calls, `console.${m}`).toEqual([]);
    expect(emitWarning.mock.calls).toEqual([]);
    expect(everythingLogged()).not.toContain(MARKER);
  });

  it("CR10: seven hostile bodies get a fixed error, never a rejection, a log line or an echo of the text", async () => {
    const CASES: { n: number; label: string; body: string; header: boolean }[] = [
      { n: 1, label: "malformed JSON", body: `${HOSTILE}{not json`, header: true },
      { n: 2, label: "empty body", body: "", header: true },
      { n: 3, label: "JSON array", body: JSON.stringify([HOSTILE]), header: true },
      { n: 4, label: "JSON string", body: JSON.stringify(HOSTILE), header: true },
      { n: 5, label: '{"requirements":123}', body: '{"requirements":123}', header: true },
      { n: 6, label: "object without the wanted fields", body: JSON.stringify({ other: HOSTILE }), header: true },
      { n: 7, label: "malformed JSON, no access header", body: `${HOSTILE}{not json`, header: false },
    ];
    const ZOD = /^Invalid input: expected object, received (array|string)$/;
    const expected = (n: number): { status: number; test: (s: string) => boolean } => {
      if (n === 1 || n === 2) return { status: 400, test: (s) => s === SEND_JSON };
      if (n === 3 || n === 4) return { status: 400, test: (s) => ZOD.test(s) };
      if (n === 5 || n === 6) return { status: 400, test: (s) => s === WRONG_FIELDS };
      return { status: 401, test: (s) => s === DENIED };
    };
    const problems: string[] = [];
    let calls = 0;
    for (const c of CASES) {
      for (const m of METHODS) spies[m].mockClear();
      emitWarning.mockClear();
      const name = `/api/check case ${c.n} (${c.label})`;
      calls++;
      let res: Response;
      try {
        res = await POST_CHECK(post(null, { code: c.header ? CODE : null, raw: c.body }));
      } catch (e) {
        problems.push(`${name}: the handler REJECTED (${e instanceof Error ? e.constructor.name : typeof e})`);
        continue;
      }
      const text = await res.text();
      const want = expected(c.n);
      let error = "";
      try {
        error = (JSON.parse(text) as { error?: string }).error ?? "";
      } catch {
        problems.push(`${name}: the answer is not JSON`);
      }
      if (res.status !== want.status) problems.push(`${name}: status ${res.status}, expected ${want.status}`);
      if (!want.test(error)) problems.push(`${name}: answer "${error}" is not the fixed error`);
      const logged = everythingLogged();
      if (logged !== JSON.stringify([...METHODS.map(() => []), []])) problems.push(`${name}: something was logged: ${logged}`);
      if (text.includes(HOSTILE) || logged.includes(HOSTILE)) problems.push(`${name}: the marker ${HOSTILE} was echoed or logged`);
    }
    expect(calls).toBe(7);
    expect(problems).toEqual([]);
    expect(state.bodies).toHaveLength(0);
  });
});
