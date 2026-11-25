import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as POST_CV } from "@/app/api/cv/route";
import { POST as POST_AD } from "@/app/api/read/route";

// Step 9.3, stage 2.1 (docs/PLAN-9.3.md section 9, tests L1 to L4, with amendment A12): can any error path print CV text, ad text or the AI SDK's
// error objects? Nothing is mocked inside lib/ai: the real route, the real readJobAd or readCvLines, the real generateText and the real Groq provider
// run. Only globalThis.fetch is replaced, by a fake that records every request body and answers an error status with the marker in its body (no real
// network call can happen: the key is a dummy and the fake is restored after every test). The same marker is in the CV line and in the ad text that
// are sent.
//
// FAKE TIMERS (A12): the SDK waits 2,000 ms and then 4,000 ms between its tries. vi.useFakeTimers() replaces the timer functions for the file, and
// each request is driven with `await vi.advanceTimersByTimeAsync(10_000)` (more than the 6,000 ms of waiting), so the waits cost no real time.
// Real timers are restored after every test.
//
// HAND-WORKED EXPECTATIONS (updated BEFORE this version was run; the first version expected 1 call and measured 3):
//  The AI SDK (ai@7.0.172, node_modules/ai/dist/index.js:2429 and :2450) has maxRetries 2, first wait 2,000 ms, factor 2, so one failing request is
//  1 first try + 2 retries = 3 fetch calls, for a 500 and for a 429 alike. Every try sends the same prompt, so the marker is in every request body;
//  the fixed instructions and the schema do not contain the marker, so it occurs exactly once per body.
//  L1  POST /api/read (production, a dummy access code sent), the fake answers 500 with MARKER-9731 in its body:
//        exactly 3 fetch calls, each request body containing MARKER-9731 exactly once;
//        console.error called exactly once, with exactly the one argument "read: AI service error, status 500"; console.log, info, warn, debug 0 calls;
//        nothing any spy received contains MARKER-9731 (process.emitWarning included); answer status 502 and its JSON does not contain the marker.
//  L2  POST /api/cv, the same: 3 fetch calls with the marker once each; console.error once, "cv: AI service error, status 500"; status 502.
//  L3  429, two requests: /api/read gives 3 fetch calls (marker once each), console.error once "read: AI service error, status 429", status 429;
//        then /api/cv gives 3 more fetch calls (marker once each), console.error once "cv: AI service error, status 429", status 429. Six calls in all.
//  L4  /api/read with a 500, two requests: with NODE_ENV "production" the JSON has no `detail` key; with NODE_ENV "development" it has one (a string),
//        so the test proves the switch. (No call count here; unchanged from the first version.)
//  L5  (stage 2.3b, PLAN-9.3 C6 and the probe of 2026-11-25) HOSTILE BODIES. Both handlers are called directly, 14 calls (2 routes x 7 cases), with
//        a made-up access code in x-access-code (except case 7), and the marker MARKER-5521 in the body. Worked out from app/api/cv/route.ts:14-33 and
//        app/api/read/route.ts:11-30: the kill switch, then the access check, then the body read inside try/catch (400), then safeParse (400).
//        Every call RESOLVES (none rejects), nothing is written to console.log, info, warn, error or debug, process.emitWarning is not called,
//        and the marker is in no answer. Expected answers, in order:
//          case 1  malformed JSON `MARKER-5521{not json`   400  /api/cv:   Send JSON like { "lines": ["first line", "second line"] }.
//                                                               /api/read: Send JSON like { "text": "the job ad" }.
//          case 2  an empty body                           400  the same two sentences
//          case 3  a JSON array ["MARKER-5521"]            400  Zod's own "Invalid input: expected object, received array"
//          case 4  a JSON string "MARKER-5521"             400  Zod's own "Invalid input: expected object, received string"
//          case 5  {"text":123}                            400  /api/cv: Send the CV as a list of lines.   /api/read: Send the ad as text.
//          case 6  {"other":"MARKER-5521"}                 400  the same two sentences as case 5
//          case 7  malformed JSON and NO access header     401  The access code is missing or wrong.
//        (Zod's two own sentences are matched by their start, so a wording change in Zod does not fail this test; the marker is still checked.)
//  TIME: the whole file runs in under 5 seconds (real time).
//
// COUNTS: this file has 5 tests (L1, L2, L3, L4, L5).

const MARKER = "MARKER-9731";
const HOSTILE = "MARKER-5521"; // the marker of L5
const CODE = "test-code-0123456789abcdef"; // made up, 26 characters, not a real code
const AD_TEXT = `A bakery needs a careful analyst. ${MARKER} is written in this ad text.`;
const CV_LINES = [`Wrote reports for a bakery ${MARKER}`];

const realFetch = globalThis.fetch;
let bodies: string[] = [];
function stubFetch(status: number) {
  bodies = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    bodies.push(String(init?.body));
    return new Response(JSON.stringify({ error: { message: `${MARKER} echoed by the service`, type: "invalid_request_error" } }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

// How many times the marker occurs in one text.
const occurrences = (text: string) => text.split(MARKER).length - 1;

const METHODS = ["log", "info", "warn", "error", "debug"] as const;
let spies: Record<(typeof METHODS)[number], ReturnType<typeof vi.spyOn>>;
let emitWarning: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("GROQ_API_KEY", "test-key-not-a-real-key");
  vi.stubEnv("GROQ_MODEL", "test-model");
  vi.stubEnv("ACCESS_CODE", CODE);
  vi.stubEnv("AI_ENABLED", "");
  vi.stubEnv("NODE_ENV", "production");
  spies = Object.fromEntries(METHODS.map((m) => [m, vi.spyOn(console, m).mockImplementation(() => {})])) as typeof spies;
  emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers(); // always: a test that fails must not leave fake timers behind
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function request(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-access-code": CODE },
    body: JSON.stringify(body),
  });
}

// Starts the request, lets the fake clock run past the SDK's waits (2 s and 4 s), and returns the answer.
async function drive(started: Promise<Response>): Promise<Response> {
  await vi.advanceTimersByTimeAsync(10_000);
  return started;
}

const everythingLogged = () => JSON.stringify([...METHODS.map((m) => spies[m].mock.calls), emitWarning.mock.calls]);

function expectOnlyThisLine(line: string) {
  expect(spies.error.mock.calls).toEqual([[line]]);
  for (const m of ["log", "info", "warn", "debug"] as const) expect(spies[m].mock.calls, `console.${m}`).toEqual([]);
  expect(everythingLogged()).not.toContain(MARKER);
}

// The SDK's default: 3 tries, each carrying the same text.
function expectThreeTriesWithTheMarker() {
  expect(bodies.length).toBe(3);
  for (const b of bodies) expect(occurrences(b)).toBe(1);
}

describe("no CV text, ad text or SDK error object reaches a log (PLAN-9.3 L1 to L4, A12)", () => {
  it("L1: a failing ad read (500) logs only the fixed line, after 3 tries", async () => {
    stubFetch(500);
    const res = await drive(POST_AD(request("/api/read", { text: AD_TEXT })));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain(MARKER);
    expectOnlyThisLine("read: AI service error, status 500");
    expectThreeTriesWithTheMarker();
  });

  it("L2: a failing CV read (500) logs only the fixed line, after 3 tries", async () => {
    stubFetch(500);
    const res = await drive(POST_CV(request("/api/cv", { lines: CV_LINES })));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain(MARKER);
    expectOnlyThisLine("cv: AI service error, status 500");
    expectThreeTriesWithTheMarker();
  });

  it("L3: a busy service (429) logs only the status, on both routes, after 3 tries each", async () => {
    stubFetch(429);
    const ad = await drive(POST_AD(request("/api/read", { text: `${AD_TEXT} (429)` })));
    expect(ad.status).toBe(429);
    expect(JSON.stringify(await ad.json())).not.toContain(MARKER);
    expectOnlyThisLine("read: AI service error, status 429");
    expectThreeTriesWithTheMarker();

    spies.error.mockClear();
    stubFetch(429);
    const cv = await drive(POST_CV(request("/api/cv", { lines: CV_LINES })));
    expect(cv.status).toBe(429);
    expect(JSON.stringify(await cv.json())).not.toContain(MARKER);
    expectOnlyThisLine("cv: AI service error, status 429");
    expectThreeTriesWithTheMarker();
  });

  it("L4: the technical detail is in the answer only outside production", async () => {
    stubFetch(500);
    const live = await drive(POST_AD(request("/api/read", { text: `${AD_TEXT} (L4 production)` })));
    expect("detail" in (await live.json())).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    stubFetch(500);
    const dev = await drive(POST_AD(request("/api/read", { text: `${AD_TEXT} (L4 development)` })));
    const body = (await dev.json()) as { detail?: unknown };
    expect("detail" in body).toBe(true);
    expect(typeof body.detail).toBe("string");
  });

  it("L5: a hostile body gets a fixed error, never a rejection, a log line or an echo of the text", async () => {
    const CASES: { n: number; label: string; body: string; header: boolean }[] = [
      { n: 1, label: "malformed JSON", body: `${HOSTILE}{not json`, header: true },
      { n: 2, label: "empty body", body: "", header: true },
      { n: 3, label: "JSON array", body: JSON.stringify([HOSTILE]), header: true },
      { n: 4, label: "JSON string", body: JSON.stringify(HOSTILE), header: true },
      { n: 5, label: '{"text":123}', body: '{"text":123}', header: true },
      { n: 6, label: "object without the wanted field", body: JSON.stringify({ other: HOSTILE }), header: true },
      { n: 7, label: "malformed JSON, no access header", body: `${HOSTILE}{not json`, header: false },
    ];
    const SEND_JSON = { "/api/cv": 'Send JSON like { "lines": ["first line", "second line"] }.', "/api/read": 'Send JSON like { "text": "the job ad" }.' };
    const WRONG_TYPE = { "/api/cv": "Send the CV as a list of lines.", "/api/read": "Send the ad as text." };
    const ZOD = /^Invalid input: expected object, received (array|string)$/;
    const expected = (route: "/api/cv" | "/api/read", n: number): { status: number; test: (s: string) => boolean } => {
      if (n === 1 || n === 2) return { status: 400, test: (s) => s === SEND_JSON[route] };
      if (n === 3 || n === 4) return { status: 400, test: (s) => ZOD.test(s) };
      if (n === 5 || n === 6) return { status: 400, test: (s) => s === WRONG_TYPE[route] };
      return { status: 401, test: (s) => s === "The access code is missing or wrong." };
    };
    const problems: string[] = [];
    let calls = 0;
    for (const [route, POST] of [["/api/cv", POST_CV], ["/api/read", POST_AD]] as const) {
      for (const c of CASES) {
        for (const m of METHODS) spies[m].mockClear();
        emitWarning.mockClear();
        const headers: Record<string, string> = { "content-type": "application/json" };
        if (c.header) headers["x-access-code"] = CODE;
        const name = `${route} case ${c.n} (${c.label})`;
        calls++;
        let res: Response;
        try {
          res = await POST(new Request(`http://localhost${route}`, { method: "POST", headers, body: c.body === "" ? undefined : c.body }));
        } catch (e) {
          problems.push(`${name}: the handler REJECTED (${e instanceof Error ? e.constructor.name : typeof e})`);
          continue;
        }
        const text = await res.text();
        const want = expected(route, c.n);
        let error = "";
        try {
          error = (JSON.parse(text) as { error?: string }).error ?? "";
        } catch {
          problems.push(`${name}: the answer is not JSON`);
        }
        if (res.status !== want.status) problems.push(`${name}: status ${res.status}, expected ${want.status}`);
        if (!want.test(error)) problems.push(`${name}: answer "${error}" is not the fixed error`);
        const logged = JSON.stringify([...METHODS.map((m) => spies[m].mock.calls), emitWarning.mock.calls]);
        if (logged !== JSON.stringify([...METHODS.map(() => []), []])) problems.push(`${name}: something was logged: ${logged}`);
        if (text.includes(HOSTILE) || logged.includes(HOSTILE)) problems.push(`${name}: the marker ${HOSTILE} was echoed or logged`);
      }
    }
    expect(calls).toBe(14);
    expect(problems).toEqual([]);
  });
});
