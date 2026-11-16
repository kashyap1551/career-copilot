import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Step 5.3 at the route (docs/DECISIONS.md, "the reading cache"): the same ad twice is one reader call. The reader is a
// stub here: no AI call. Order in the route: kill switch, then JSON and validation, then the cache, then the reader.

let counter = 0;
vi.mock("@/lib/ai/readJob", () => {
  class ReadAdError extends Error {
    status: number;
    detail?: string;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }
  return {
    ReadAdError,
    readJobAd: vi.fn(async (text: string) => ({
      job: { id: "pasted-ad", title: `Read number ${++counter}`, company: null, source: null, constraints: {}, requirements: [{ quote: "SQL", importance: "must", skillIds: ["sql"] }] },
      removed: [], moved: [], unlisted: [], notCounted: [],
      extraction: { title: `Extraction ${counter}` }, // 6.1: extraction added
      usage: { inputTokens: text.length, outputTokens: 1 },
    })),
  };
});
const readCv = vi.fn();
vi.mock("@/lib/ai/readCv", () => ({ readCvLines: (...a: unknown[]) => readCv(...a) }));

import { POST } from "@/app/api/read/route";
import { POST as POST_CV } from "@/app/api/cv/route";
import { readCache } from "@/lib/ai/readCache";
import { ReadAdError, readJobAd } from "@/lib/ai/readJob";
import { MAX_AD_CHARS } from "@/lib/schemas/job";

const post = (body: unknown) => POST(new Request("http://localhost/api/read", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const reader = vi.mocked(readJobAd);

beforeEach(() => {
  counter = 0;
  readCache.clear();
  reader.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("the ad route with the cache", () => {
  it("R1 (test 1): the same ad twice: one reader call; miss, then hit; the same body", async () => {
    const first = await post({ text: "Data analyst wanted. SQL and Excel." });
    const second = await post({ text: "Data analyst wanted. SQL and Excel." });
    expect(reader).toHaveBeenCalledTimes(1);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-reading-cache")).toBe("miss");
    expect(second.headers.get("x-reading-cache")).toBe("hit");
    const a = await first.json();
    const b = await second.json();
    expect(b).toEqual(a);
    expect(b.job.title).toBe("Read number 1"); // the second answer came from memory, not from a second read
    expect(Object.keys(b).sort()).toEqual(["extraction", "job", "moved", "notCounted", "removed", "unlisted"]); // 6.1: extraction added
  });

  it("R2 (test 2): two different ads: two calls, both miss", async () => {
    const one = await post({ text: "First ad about SQL." });
    const two = await post({ text: "Second ad about Excel." });
    expect(reader).toHaveBeenCalledTimes(2);
    expect([one.headers.get("x-reading-cache"), two.headers.get("x-reading-cache")]).toEqual(["miss", "miss"]);
  });

  it("R3 (test 3): two pastes that differ only in what the cleaner removes share one entry. The cleaner is the request schema's trim (leading and trailing whitespace); nothing else is removed from an ad", async () => {
    const plain = await post({ text: "Data analyst wanted. SQL." });
    const padded = await post({ text: "  \n\t Data analyst wanted. SQL.  \n\n" });
    expect(reader).toHaveBeenCalledTimes(1);
    expect(padded.headers.get("x-reading-cache")).toBe("hit");
    expect(await padded.json()).toEqual(await plain.json());
    expect(reader).toHaveBeenCalledWith("Data analyst wanted. SQL."); // what the reader got is the cleaned string
    // inside the text a difference is a difference: another entry
    await post({ text: "Data analyst  wanted. SQL." });
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it("R4 (test 4): a failed read is not cached: the reader fails once with a 502, then works: two calls; the second answer is a miss and is right", async () => {
    reader.mockRejectedValueOnce(new ReadAdError("The AI answered, but not in the expected shape.", 502));
    const failed = await post({ text: "Flaky ad." });
    expect(failed.status).toBe(502);
    expect(failed.headers.get("x-reading-cache")).toBeNull(); // only successful reads carry the header
    const ok = await post({ text: "Flaky ad." });
    expect(reader).toHaveBeenCalledTimes(2);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("x-reading-cache")).toBe("miss");
    expect((await ok.json()).job.title).toBe("Read number 1");
  });

  it("R5 (test 7): AI_ENABLED=false answers 503 for an ad that is cached, and the reader is not called", async () => {
    await post({ text: "Cached ad." });
    expect(reader).toHaveBeenCalledTimes(1);
    vi.stubEnv("AI_ENABLED", "false");
    const res = await post({ text: "Cached ad." });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/paused/i);
    expect(res.headers.get("x-reading-cache")).toBeNull();
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it("R6 (test 8): invalid input gets the answer it always got, and nothing goes in the cache", async () => {
    const empty = await post({ text: "   " });
    const tooLong = await post({ text: "x".repeat(MAX_AD_CHARS + 1) });
    const notText = await post({ text: 42 });
    const notJson = await post("this is not json");
    expect([empty.status, tooLong.status, notText.status, notJson.status]).toEqual([400, 400, 400, 400]);
    expect((await empty.json()).error).toBe("Paste a job ad first.");
    expect((await tooLong.json()).error).toMatch(/too long/);
    expect(reader).not.toHaveBeenCalled();
    expect(readCache.size).toBe(0);
    for (const r of [empty, tooLong, notText, notJson]) expect(r.headers.get("x-reading-cache")).toBeNull();
  });

  it("R7 (test 5 at the route): 20 ads fill the cache; the 21st drops the oldest unused one", async () => {
    for (let i = 1; i <= 20; i++) await post({ text: `Ad number ${i}` });
    expect(reader).toHaveBeenCalledTimes(20);
    expect((await post({ text: "Ad number 1" })).headers.get("x-reading-cache")).toBe("hit");
    expect((await post({ text: "Ad number 21" })).headers.get("x-reading-cache")).toBe("miss");
    expect((await post({ text: "Ad number 1" })).headers.get("x-reading-cache")).toBe("hit");
    expect((await post({ text: "Ad number 2" })).headers.get("x-reading-cache")).toBe("miss");
    expect(reader).toHaveBeenCalledTimes(22);
  });

  it("R8: the answer holds no usage, limits or token counts, on a miss and on a hit", async () => {
    for (let i = 0; i < 2; i++) {
      const raw = JSON.stringify(await (await post({ text: "Some ad." })).json());
      expect(raw).not.toContain("usage");
      expect(raw).not.toContain("inputTokens");
    }
  });
});

describe("the CV route is not cached (test 14)", () => {
  it("V1: /api/cv answers, on success and on an error, carry no x-reading-cache header, and the same CV twice reads twice", async () => {
    readCv.mockReset();
    readCv.mockResolvedValue({ skills: [], removed: [], duplicates: 0, unlisted: [] });
    const body = JSON.stringify({ lines: ["Wrote SQL queries"] });
    const a = await POST_CV(new Request("http://localhost/api/cv", { method: "POST", body }));
    const b = await POST_CV(new Request("http://localhost/api/cv", { method: "POST", body }));
    expect(a.status).toBe(200);
    expect(a.headers.get("x-reading-cache")).toBeNull();
    expect(b.headers.get("x-reading-cache")).toBeNull();
    expect(readCv).toHaveBeenCalledTimes(2);
    const bad = await POST_CV(new Request("http://localhost/api/cv", { method: "POST", body: "not json" }));
    expect(bad.status).toBe(400);
    expect(bad.headers.get("x-reading-cache")).toBeNull();
  });
});
