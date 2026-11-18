import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Step 8.3, stage 3, tests first (docs/PLAN-8.3.md v2, sections 4, 5 and 7; tests T15 to T19 and T31). /api/bullets: the kill switch, then the access code,
// then the body, then the writer (a FAKE in every test below, except T18b and T17c, which run the real writeBullets on a fake fetch: no network, no AI, a
// dummy key). Every expected value is hand-worked from the plan and from the route order of /api/cv. Invented text only.

const fake = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/writeBullets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/writeBullets")>("@/lib/ai/writeBullets");
  return { ...actual, writeBullets: (...a: unknown[]) => fake(...a) };
});

import { POST } from "@/app/api/bullets/route";
import { ReadAdError, toReadError } from "@/lib/ai/errors";
import { MissingSettingError } from "@/lib/ai/model";

const CODE = "test-access-code-0123456789"; // an invented test value, not a secret
const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/bullets", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));

const L4 = "Answered the phone and kept the stock sheet up to date in Excel";
const L5 = "Helped customers at the counter";
const TWO = { pairs: [{ id: 1, requirement: "Excel is required.", line: L4 }, { id: 2, requirement: "Customer service is a plus.", line: L5 }] };
const ANSWER = { bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }], asked: 2, dropped: [{ pair: 2, reason: "new-date" }] };

const realFetch = globalThis.fetch;
beforeEach(() => {
  fake.mockReset();
  fake.mockResolvedValue({ ...ANSWER, usage: { inputTokens: 111, outputTokens: 222 }, limits: { "x-ratelimit-remaining-tokens": "5" } });
  vi.stubEnv("GROQ_API_KEY", "fingerprint-probe-not-a-key");
  vi.stubEnv("GROQ_MODEL", "probe-model");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  globalThis.fetch = realFetch;
});

// A fake Groq: records what is sent and answers with a chat completion that holds `content`. No network.
function fakeGroq(content: unknown, status = 200) {
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        id: "probe", object: "chat.completion", created: 1, model: "probe",
        choices: [{ index: 0, message: { role: "assistant", content: typeof content === "string" ? content : JSON.stringify(content) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return sent;
}
const useRealWriter = async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/writeBullets")>("@/lib/ai/writeBullets");
  fake.mockImplementation(actual.writeBullets);
};

describe("T15: the kill switch comes first", () => {
  it("T15: AI_ENABLED=false answers 503 'paused' before anything is read, and the writer is never called", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const res = await post(TWO);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/paused/i);
    expect(fake).not.toHaveBeenCalled();
  });
  it("T15: a bad body gets 'paused', not a 400; so does a missing access code in production (503, not 401)", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    expect((await post("{nope")).status).toBe(503);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACCESS_CODE", CODE);
    expect((await post(TWO)).status).toBe(503);
    expect(fake).not.toHaveBeenCalled();
  });
  it("T15: False, FALSE and ' false ' also pause; any other value means on", async () => {
    for (const v of ["False", "FALSE", " false "]) {
      vi.stubEnv("AI_ENABLED", v);
      expect((await post(TWO)).status).toBe(503);
    }
    for (const v of ["true", "", "0", "no", "falsey"]) {
      vi.stubEnv("AI_ENABLED", v);
      expect((await post(TWO)).status).toBe(200);
    }
  });
});

describe("T16: the access code comes after the kill switch and before the body is parsed", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACCESS_CODE", CODE);
  });
  it("T16: no code, a valid body: 401 and no writer call", async () => {
    const res = await post(TWO);
    expect(res.status).toBe(401);
    expect(typeof (await res.json()).error).toBe("string");
    expect(fake).not.toHaveBeenCalled();
  });
  it("T16: a wrong code: 401", async () => {
    expect((await post(TWO, { "x-access-code": "wrong-code-0123456789ab" })).status).toBe(401);
    expect(fake).not.toHaveBeenCalled();
  });
  it("T16: no code and a malformed body: 401, NOT 400 (the check comes before parsing)", async () => {
    expect((await post("{nope")).status).toBe(401);
  });
  it("T16: the right code and a malformed body: 400; the right code and a valid body: 200 and one writer call", async () => {
    expect((await post("{nope", { "x-access-code": CODE })).status).toBe(400);
    expect(fake).not.toHaveBeenCalled();
    expect((await post(TWO, { "x-access-code": CODE })).status).toBe(200);
    expect(fake).toHaveBeenCalledTimes(1);
  });
  it("T16: production with no code configured: 503 'not set up', no writer call", async () => {
    vi.stubEnv("ACCESS_CODE", "");
    expect((await post(TWO, { "x-access-code": CODE })).status).toBe(503);
    expect(fake).not.toHaveBeenCalled();
  });
});

describe("T17: errors become their own status and plain message", () => {
  it("T17: a writer error keeps its status and message", async () => {
    for (const [status, message] of [
      [429, "The AI service is busy right now. Please try again in a minute."],
      [502, "The AI answered, but not in the expected shape. Please try again."],
      [500, "The server is missing its AI settings. Check GROQ_API_KEY and GROQ_MODEL."],
    ] as const) {
      fake.mockRejectedValueOnce(new ReadAdError(message, status));
      const res = await post(TWO);
      expect(res.status).toBe(status);
      expect((await res.json()).error).toBe(message);
    }
  });
  it("T17: anything unexpected is a plain 500 'Something went wrong. Please try again.' and logs no text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    fake.mockRejectedValue(new Error("SECRET CV TEXT"));
    const res = await post(TWO);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Something went wrong. Please try again.");
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("SECRET");
    expect(logged).toContain("bullets: unexpected error in route");
  });
  it("T17: a request that is not valid gets a 400 with a plain message and no writer call", async () => {
    for (const body of [{}, { pairs: [] }, { pairs: [{ id: 2, requirement: "a", line: "b" }] }, { pairs: [{ id: 1, requirement: "a", line: "mail x@y.example" }] }]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe("string");
    }
    expect(fake).not.toHaveBeenCalled();
  });

  // The mapping itself (toReadError), for the new subject, with fake errors only (the method of tests/errors.test.ts).
  const api = (statusCode: number, message = "upstream said no") =>
    new APICallError({ message, url: "https://example.invalid", requestBodyValues: {}, statusCode });
  const retry = (last: unknown) => new RetryError({ message: "Failed after 3 attempts. Last error: x", reason: "maxRetriesExceeded", errors: [last, last, last] });

  it("T17: toReadError for 'bullets': 429 is 'busy', 503 names the status, a wrong shape is 502, a missing setting is 500", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const busy = toReadError(retry(api(429)), "bullets");
    expect([busy.status, busy.message]).toEqual([429, "The AI service is busy right now. Please try again in a minute."]);
    const down = toReadError(retry(api(503)), "bullets");
    expect([down.status, down.message]).toEqual([502, "The AI service had a problem (status 503). Please try again."]);
    const noObject = new NoObjectGeneratedError({
      message: "no object",
      text: "x",
      response: { id: "r", timestamp: new Date(), modelId: "m" },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, inputTokenDetails: {}, outputTokenDetails: {} } as never,
      finishReason: "stop",
    });
    const shape = toReadError(noObject, "bullets");
    expect([shape.status, shape.message]).toEqual([502, "The AI answered, but not in the expected shape. Please try again."]);
    const missing = toReadError(new MissingSettingError("GROQ_API_KEY"), "bullets");
    expect([missing.status, missing.message]).toEqual([500, "The server is missing its AI settings. Check GROQ_API_KEY and GROQ_MODEL."]);
  });
  it("T17: toReadError for 'bullets': an unexpected error says 'writing the bullets'; the messages for 'ad' and 'cv' are unchanged", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toReadError(new Error("x"), "bullets").message).toBe("Something went wrong while writing the bullets. Please try again.");
    expect(toReadError(new Error("x"), "ad").message).toBe("Something went wrong while reading the ad. Please try again.");
    expect(toReadError(new Error("x"), "cv").message).toBe("Something went wrong while reading the CV. Please try again.");
  });
  it("T17: toReadError for 'bullets' logs the kind and status under its own tag, never the text", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    toReadError(retry(api(429, "SECRET CV TEXT: Jane Doe, 12 Example Street")), "bullets");
    toReadError(new Error("SECRET CV TEXT again"), "bullets");
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).toContain("bullets: AI service error, status 429");
    expect(logged).toContain("bullets: unexpected error");
    expect(logged).not.toContain("SECRET");
  });

  it("T17c: the real writer on a fake Groq: an answer that is not in the schema is a 502; a missing key is a 500; no text in the answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await useRealWriter();
    fakeGroq({ nope: 1 });
    const bad = await post(TWO);
    expect(bad.status).toBe(502);
    expect((await bad.json()).error).toBe("The AI answered, but not in the expected shape. Please try again.");
    vi.stubEnv("GROQ_API_KEY", "");
    const missing = await post(TWO);
    expect(missing.status).toBe(500);
    expect((await missing.json()).error).toBe("The server is missing its AI settings. Check GROQ_API_KEY and GROQ_MODEL.");
  });
});

describe("T18: the route returns only checked bullets and the dropped list", () => {
  it("T18a: with a fake writer: exactly bullets, asked and dropped; never usage, limits, ignored or a line number", async () => {
    fake.mockResolvedValue({
      bullets: [{ pair: 1, line: 4, text: "Kept the stock sheet up to date in Excel" }],
      asked: 2,
      dropped: [{ pair: 2, reason: "new-date" }],
      ignored: 1,
      usage: { inputTokens: 1, outputTokens: 2 },
      limits: { "x-ratelimit-remaining-tokens": "5" },
    });
    const res = await post(TWO);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ANSWER);
  });
  it("T18a: the pairs reach the writer unchanged (id, requirement, line) and nothing else", async () => {
    await post({ pairs: [{ id: 1, requirement: "Excel is required.", line: "  a  ", skillId: "excel", evidence: { line: 4 } }] });
    expect(fake).toHaveBeenCalledWith([{ id: 1, requirement: "Excel is required.", line: "  a  " }]);
  });
  it("T18b: the real writer on a fake Groq: a good bullet is shown, a bullet that adds a date is dropped with its reason", async () => {
    await useRealWriter();
    fakeGroq({ bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }, { pair: 2, text: "Helped customers at the counter since 2021" }] });
    const res = await post(TWO);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }],
      asked: 2,
      dropped: [{ pair: 2, reason: "new-date" }],
    });
  });
  it("T18b: a bullet for a pair that was not asked is ignored, and a pair that was not answered is `missing`", async () => {
    await useRealWriter();
    fakeGroq({ bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }, { pair: 7, text: "Helped customers at the counter" }] });
    const res = await post(TWO);
    expect(await res.json()).toEqual({
      bullets: [{ pair: 1, text: "Kept the stock sheet up to date in Excel" }],
      asked: 2,
      dropped: [{ pair: 2, reason: "missing" }],
    });
  });
  it("T18b: what is sent to Groq holds the line texts and the requirements, no skill id and no line number; the settings are the pinned ones", async () => {
    await useRealWriter();
    const sent = fakeGroq({ bullets: [] });
    await post(TWO);
    expect(sent.length).toBe(1);
    const raw = JSON.stringify(sent[0]);
    expect(raw).toContain(L4);
    expect(raw).toContain(L5);
    expect(raw).toContain("Excel is required.");
    expect(raw).not.toContain("skillId");
    expect(raw).not.toContain("evidence");
    expect(sent[0].temperature).toBe(0);
    expect(sent[0].seed).toBe(20261115);
  });
});

describe("T19: no cache, and no text in the logs", () => {
  it("T19: every answer says Cache-Control: no-store (200, 400, 401, 503, 429, 500)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const cc = (r: Response) => r.headers.get("Cache-Control");
    expect(cc(await post(TWO))).toBe("no-store");
    expect(cc(await post("{nope"))).toBe("no-store");
    fake.mockRejectedValueOnce(new ReadAdError("The AI service is busy right now. Please try again in a minute.", 429));
    expect(cc(await post(TWO))).toBe("no-store");
    fake.mockRejectedValueOnce(new Error("x"));
    expect(cc(await post(TWO))).toBe("no-store");
    vi.stubEnv("AI_ENABLED", "false");
    expect(cc(await post(TWO))).toBe("no-store");
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ACCESS_CODE", CODE);
    expect(cc(await post(TWO))).toBe("no-store");
  });
  it("T19: no CV line, requirement or bullet reaches the console, on success or on any error", async () => {
    const spies = (["log", "error", "warn", "info", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const body = { pairs: [{ id: 1, requirement: "SECRET REQUIREMENT", line: "SECRET LINE" }] };
    fake.mockResolvedValueOnce({ bullets: [{ pair: 1, text: "SECRET BULLET" }], asked: 1, dropped: [] });
    await post(body);
    fake.mockRejectedValueOnce(new Error("SECRET LINE SECRET REQUIREMENT"));
    await post(body);
    fake.mockRejectedValueOnce(new ReadAdError("The AI service is busy right now. Please try again in a minute.", 429, "SECRET LINE"));
    await post(body);
    await post({ pairs: [{ id: 1, requirement: "SECRET REQUIREMENT", line: "SECRET LINE jane@example.com" }] }); // refused: contact details
    expect(spies.flatMap((s) => s.mock.calls.flat()).join(" ")).not.toContain("SECRET");
  });
});

describe("T31: the route checks in the order kill switch, access code, body, schema, writer", () => {
  it("T31: aiPaused, then checkAccess, then request.json, then safeParse, then writeBullets, in the source", () => {
    const src = readFileSync(join(process.cwd(), "app/api/bullets/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .split("\n")
      .filter((l) => !/^\s*import\s/.test(l))
      .join("\n");
    const at = (needle: string) => src.indexOf(needle);
    const order = ["aiPaused(", "checkAccess(", "request.json(", "safeParse(", "writeBullets("].map(at);
    expect(order.every((i) => i >= 0), `a step is missing: ${JSON.stringify(order)}`).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(src).toContain("jsonNoStore");
    expect(src).not.toContain("console.log");
  });
});
