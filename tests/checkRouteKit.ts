import { vi } from "vitest";

// Shared setup of the /api/check route tests (EC-3b), in the way of tests/logHygiene.test.ts. Not a test file. It lives in tests/, NOT in tests/support/:
// it holds the example words of the check prompt, and tests/support/* is part of the test material that tests/checkPromptHygiene.test.ts keeps those words out of. Nothing inside lib/ai is mocked: the real
// route, the real checkEvidence, the real generateText and the real Groq provider run. Only globalThis.fetch is replaced, by a fake that records every
// request body (no real network call can happen: the key is a dummy, and the fake is restored after every test). Invented data only.

export const CODE = "test-code-0123456789abcdef"; // made up, 26 characters, not a real code
export const METHODS = ["log", "info", "warn", "error", "debug"] as const;
export type Spies = Record<(typeof METHODS)[number], ReturnType<typeof vi.spyOn>>;

export const REQUIREMENTS = ["Mends sails and rigging", "Has run a ferry rota for five seasons", "Can polish brass or copper fittings", "Speaks Portuguese at work"];
export const ENTRIES = [
  { name: "Sail repair", text: "Stitched torn sails and spliced new rope on two sloops" },
  { name: "Crossing plans", text: "Drew up the fortnightly crossing plan for the island boat" },
  { name: "Lantern care", text: "Polished the brass lantern of the quay beacon each dawn" },
  { name: "Basque", text: "Chatted in Basque with visitors at the quay café" },
];
export const EXAMPLE_ANSWERS = [
  { requirement: 1, verdict: "met", entry: 1, quote: "Stitched torn sails" },
  { requirement: 2, verdict: "partly", entry: 2, quote: "Drew up the fortnightly crossing plan" },
  { requirement: 3, verdict: "met", entry: 3, quote: "Polished the brass lantern" },
  { requirement: 4, verdict: "none", entry: null, quote: null },
];
export const goodBody = (over: Record<string, unknown> = {}) => ({ requirements: REQUIREMENTS, entries: ENTRIES, ...over });

export const realFetch = globalThis.fetch;
export const state: { bodies: string[] } = { bodies: [] };

// The fake service: answers `content` (an object is sent as JSON text) with a 200, or an error status with the marker in its body.
export function stubFetch(content: unknown, status = 200, marker = "MARKER-9731") {
  state.bodies = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    state.bodies.push(String(init?.body));
    if (status !== 200) {
      return new Response(JSON.stringify({ error: { message: `${marker} echoed by the service`, type: "invalid_request_error" } }), { status, headers: { "content-type": "application/json" } });
    }
    return new Response(
      JSON.stringify({
        id: "chatcmpl-test", object: "chat.completion", created: 1, model: "openai/gpt-oss-120b",
        choices: [{ index: 0, message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
      }),
      { status: 200, headers: { "content-type": "application/json", "x-ratelimit-remaining-tokens": "7000" } },
    );
  }) as typeof fetch;
}

export function setUp(): { spies: Spies; emitWarning: ReturnType<typeof vi.spyOn> } {
  state.bodies = []; // no request of an earlier test counts here
  vi.stubEnv("GROQ_API_KEY", "test-key-not-a-real-key");
  vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
  vi.stubEnv("ACCESS_CODE", CODE);
  vi.stubEnv("AI_ENABLED", "");
  vi.stubEnv("NODE_ENV", "production");
  const spies = Object.fromEntries(METHODS.map((m) => [m, vi.spyOn(console, m).mockImplementation(() => {})])) as Spies;
  const emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
  return { spies, emitWarning };
}

export function tearDown() {
  globalThis.fetch = realFetch;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
}

// A POST to /api/check. `code: null` sends no access header; `raw` sends that text as the body instead of JSON.
export function post(body: unknown, opts: { code?: string | null; raw?: string } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const code = opts.code === undefined ? CODE : opts.code;
  if (code !== null) headers["x-access-code"] = code;
  return new Request("http://localhost/api/check", { method: "POST", headers, body: opts.raw !== undefined ? (opts.raw === "" ? undefined : opts.raw) : JSON.stringify(body) });
}

export const SEND_JSON = 'Send JSON like { "requirements": ["first requirement"], "entries": [{ "name": "skill name", "text": "the CV line" }] }.';
export const WRONG_FIELDS = "Send 1 to 30 requirements as texts, and 1 to 60 CV entries, each with a name and the CV line text.";
export const CONTACT_REFUSAL = "Some CV lines still contain an email address, a phone number or a web link, so nothing was sent. Take it out and try again.";
export const DENIED = "The access code is missing or wrong.";

export const everythingLogged = (spies: Spies, emitWarning: { mock: { calls: unknown[] } }) => JSON.stringify([...METHODS.map((m) => spies[m].mock.calls), emitWarning.mock.calls]);
