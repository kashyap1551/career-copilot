import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 6.1 part 3c, step 3: EVERY answer of /api/read and /api/cv says `Cache-Control: no-store` (today the live answer says
// Vercel's default, "public, max-age=0, must-revalidate"; the CV answer holds a person's data and must say no-store
// explicitly). One test per kind of answer the routes give: 200, bad JSON, invalid input, paused (503), a known error
// from the reader, an unexpected error. The readers are stubs: no AI call.

const readAd = vi.fn();
const readCv = vi.fn();
vi.mock("@/lib/ai/readJob", () => {
  class ReadAdError extends Error {
    status: number;
    detail?: string;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }
  return { ReadAdError, readJobAd: (...a: unknown[]) => readAd(...a) };
});
vi.mock("@/lib/ai/readCv", () => ({ readCvLines: (...a: unknown[]) => readCv(...a) }));

import { POST as POST_AD } from "@/app/api/read/route";
import { POST as POST_CV } from "@/app/api/cv/route";
import { readCache } from "@/lib/ai/readCache";
import { ReadAdError as AdError } from "@/lib/ai/readJob";
import { ReadAdError as CvError } from "@/lib/ai/errors";

const AD_OK = {
  job: { id: "pasted-ad", title: "T", company: null, source: null, constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] }, requirements: [] },
  removed: [], moved: [], unlisted: [], notCounted: [], extraction: {},
};
const adReq = (body: unknown) => new Request("http://localhost/api/read", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const cvReq = (body: unknown) => new Request("http://localhost/api/cv", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const NO_STORE = "no-store";

beforeEach(() => {
  readCache.clear();
  readAd.mockReset();
  readCv.mockReset();
  readAd.mockResolvedValue(AD_OK);
  readCv.mockResolvedValue({ skills: [], removed: [], duplicates: 0, unlisted: [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/read: every kind of answer says no-store", () => {
  it("H1: 200 (a miss, and a hit)", async () => {
    const miss = await POST_AD(adReq({ text: "An ad." }));
    const hit = await POST_AD(adReq({ text: "An ad." }));
    expect([miss.status, hit.status]).toEqual([200, 200]);
    expect(miss.headers.get("Cache-Control")).toBe(NO_STORE);
    expect(hit.headers.get("Cache-Control")).toBe(NO_STORE);
    expect(miss.headers.get("x-reading-cache")).toBe("miss"); // the cache header is still there
  });
  it("H2: 400, the body is not JSON", async () => {
    const r = await POST_AD(adReq("not json"));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([400, NO_STORE]);
  });
  it("H3: 400, the input is invalid (empty)", async () => {
    const r = await POST_AD(adReq({ text: "   " }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([400, NO_STORE]);
  });
  it("H4: 503, paused", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const r = await POST_AD(adReq({ text: "An ad." }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([503, NO_STORE]);
  });
  it("H5: a known error from the reader (a ReadAdError with its own status)", async () => {
    readAd.mockRejectedValueOnce(new AdError("The AI answered, but not in the expected shape.", 502));
    const r = await POST_AD(adReq({ text: "Another ad." }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([502, NO_STORE]);
  });
  it("H6: an unexpected error: 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    readAd.mockRejectedValueOnce(new Error("surprise"));
    const r = await POST_AD(adReq({ text: "A third ad." }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([500, NO_STORE]);
  });
});

describe("/api/cv: every kind of answer says no-store (it holds a person's data)", () => {
  it("H7: 200", async () => {
    const r = await POST_CV(cvReq({ lines: ["Wrote SQL queries"] }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([200, NO_STORE]);
  });
  it("H8: 400, the body is not JSON", async () => {
    const r = await POST_CV(cvReq("not json"));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([400, NO_STORE]);
  });
  it("H9: 400, the input is invalid (no lines)", async () => {
    const r = await POST_CV(cvReq({ lines: [] }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([400, NO_STORE]);
  });
  it("H10: 503, paused", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const r = await POST_CV(cvReq({ lines: ["Wrote SQL queries"] }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([503, NO_STORE]);
  });
  it("H11: a known error from the reader", async () => {
    readCv.mockRejectedValueOnce(new CvError("The AI answered, but not in the expected shape.", 502));
    const r = await POST_CV(cvReq({ lines: ["Wrote SQL queries"] }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([502, NO_STORE]);
  });
  it("H12: an unexpected error: 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    readCv.mockRejectedValueOnce(new Error("surprise"));
    const r = await POST_CV(cvReq({ lines: ["Wrote SQL queries"] }));
    expect([r.status, r.headers.get("Cache-Control")]).toEqual([500, NO_STORE]);
  });
});
