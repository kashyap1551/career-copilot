import { describe, expect, it } from "vitest";
import { pickRateLimitHeaders } from "@/lib/ai/usage";

// Which of Groq's answer headers we keep: only the rate-limit ones (numbers).
describe("pickRateLimitHeaders", () => {
  it("keeps the x-ratelimit headers, with lower-case names, and nothing else", () => {
    expect(
      pickRateLimitHeaders({
        "x-ratelimit-limit-tokens": "8000",
        "X-RateLimit-Remaining-Tokens": "7000",
        "content-type": "application/json",
        authorization: "secret",
        "set-cookie": "a=b",
      }),
    ).toEqual({ "x-ratelimit-limit-tokens": "8000", "x-ratelimit-remaining-tokens": "7000" });
  });

  it("gives an empty record when there are no headers", () => {
    expect(pickRateLimitHeaders(undefined)).toEqual({});
    expect(pickRateLimitHeaders({})).toEqual({});
  });
});
