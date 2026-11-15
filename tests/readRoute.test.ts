import { beforeEach, describe, expect, it, vi } from "vitest";

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
      usage: { inputTokens: 12345, outputTokens: 6789 },
      limits: { "x-ratelimit-remaining-tokens": "74", "x-ratelimit-limit-requests": "1000" },
    })),
  };
});

import { POST } from "@/app/api/read/route";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/read", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("answers with job, removed, moved and unlisted, and nothing else", async () => {
    const res = await post({ text: "Some job ad text that is long enough to be read." });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["job", "moved", "removed", "unlisted"]);
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
});
