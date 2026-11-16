import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Step 3.3 part 3b. readJobAd now returns token counts and Groq's rate-limit
// headers for the eval script. The web route must never pass them on.

vi.mock("@/lib/ai/readJob", () => {
  class ReadAdError extends Error {
    status = 500;
    detail?: string;
  }
  return {
    ReadAdError,
    readJobAd: vi.fn(async () => ({
      job: { id: "pasted-ad", title: "Untitled job", company: null, source: null, constraints: {}, requirements: [] },
      removed: [],
      moved: [],
      unlisted: [],
      notCounted: [{ quote: "You are a team player.", importance: "must" }],
      extraction: { title: null }, // 6.1: extraction added
      usage: { inputTokens: 12345, outputTokens: 6789 },
      limits: { "x-ratelimit-remaining-tokens": "74", "x-ratelimit-limit-requests": "1000" },
    })),
  };
});

import { POST } from "@/app/api/read/route";
import { readJobAd } from "@/lib/ai/readJob";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/read", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers with job, removed, moved, unlisted, notCounted and extraction (6.1: extraction added), and nothing else", async () => {
    const res = await post({ text: "Some job ad text that is long enough to be read." });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["extraction", "job", "moved", "notCounted", "removed", "unlisted"]); // 6.1: extraction added
    expect(body.notCounted).toEqual([{ quote: "You are a team player.", importance: "must" }]);
  });

  it("never returns usage, limits, token counts or rate-limit headers", async () => {
    const res = await post({ text: "Some job ad text that is long enough to be read." });
    const raw = JSON.stringify(await res.json());
    expect(raw).not.toContain("usage");
    expect(raw).not.toContain("limits");
    expect(raw).not.toContain("ratelimit");
    expect(raw).not.toContain("12345");
    expect(raw).not.toContain("6789");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("the kill switch: AI_ENABLED=false answers 503 'paused' and never calls the reader", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const res = await post({ text: "Some job ad text that is long enough to be read." });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/paused/i);
    expect(readJobAd).not.toHaveBeenCalled();
  });

  it("any other value of AI_ENABLED means on", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    const res = await post({ text: "Some job ad text that is long enough to be read." });
    expect(res.status).toBe(200);
  });
});
