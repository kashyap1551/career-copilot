import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReadAdError, toReadError } from "@/lib/ai/errors";
import { MissingSettingError } from "@/lib/ai/model";

// Hand-worked table E1 to E5 of docs/PLAN-4.2.md, with fake errors only (no AI
// call). The AI SDK retries a retryable error twice and then throws a
// RetryError; before this fix a 429 or 503 inside it became a generic 500.

const api = (statusCode: number, message = "upstream said no") =>
  new APICallError({ message, url: "https://example.invalid", requestBodyValues: {}, statusCode });
const retry = (last: unknown) =>
  new RetryError({ message: "Failed after 3 attempts. Last error: x", reason: "maxRetriesExceeded", errors: [last, last, last] });

afterEach(() => vi.restoreAllMocks());

describe("toReadError", () => {
  it("E1: a RetryError wrapping a 429 is a 429 'busy'", () => {
    const e = toReadError(retry(api(429)), "ad");
    expect(e).toBeInstanceOf(ReadAdError);
    expect(e.status).toBe(429);
    expect(e.message).toMatch(/busy/i);
  });

  it("E2: a RetryError wrapping a 503 is a 502 that names the status", () => {
    const e = toReadError(retry(api(503)), "ad");
    expect(e.status).toBe(502);
    expect(e.message).toContain("status 503");
  });

  it("E3: a RetryError wrapping an unknown error stays a 500", () => {
    const e = toReadError(retry(new Error("boom")), "ad");
    expect(e.status).toBe(500);
    expect(e.message).toMatch(/Something went wrong/);
  });

  it("E4: a 429 that is not wrapped is still a 429", () => {
    expect(toReadError(api(429), "ad").status).toBe(429);
  });

  it("E5: a RetryError wrapping a 401 is a 500 about the key", () => {
    const e = toReadError(retry(api(401)), "ad");
    expect(e.status).toBe(500);
    expect(e.message).toMatch(/refused the server's key/);
  });

  it("E6: the other cases are unchanged: wrong shape is 502, a missing setting is 500", () => {
    const shape = new NoObjectGeneratedError({
      message: "no object",
      text: "x",
      response: { id: "r", timestamp: new Date(), modelId: "m" },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, inputTokenDetails: {}, outputTokenDetails: {} } as never,
      finishReason: "stop",
    });
    expect(toReadError(shape, "ad").status).toBe(502);
    expect(toReadError(shape, "ad").message).toMatch(/not in the expected shape/);
    const missing = toReadError(new MissingSettingError("GROQ_API_KEY"), "ad");
    expect(missing.status).toBe(500);
    expect(missing.message).toMatch(/missing its AI settings/);
  });

  it("E7: the wording says ad or CV, and an unknown error mentions the right one", () => {
    expect(toReadError(new Error("x"), "ad").message).toContain("reading the ad");
    expect(toReadError(new Error("x"), "cv").message).toContain("reading the CV");
  });

  it("E8: the console gets only the kind and the status, never the error's own text", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    toReadError(retry(api(429, "SECRET CV TEXT: Jane Doe, 12 Example Street")), "cv");
    toReadError(new Error("SECRET CV TEXT again"), "cv");
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain("SECRET");
    expect(logged).toContain("429");
  });

  it("E9: the technical detail is kept for development, and holds the original message", () => {
    const e = toReadError(retry(api(503)), "ad");
    expect(e.detail).toContain("Failed after 3 attempts");
  });
});
