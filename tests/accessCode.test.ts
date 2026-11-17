import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Step 6.1b: the access code on /api/read and /api/cv (docs/PLAN-ACCESS-CODE.md, sections 2 and 5). Cases A1 to A19, for
// BOTH routes, with expectations written from the plan's tables. The readers are spies: no AI call. The code below is
// made up (26 characters); it is not a real code.

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

// timingSafeEqual is wrapped: it still does the real work, and the calls are recorded (A2, A7).
const compared: Buffer[][] = [];
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    timingSafeEqual: (a: Buffer, b: Buffer) => {
      compared.push([a, b]);
      return actual.timingSafeEqual(a, b);
    },
  };
});

import { POST as POST_AD } from "@/app/api/read/route";
import { POST as POST_CV } from "@/app/api/cv/route";
import { readCache } from "@/lib/ai/readCache";

const CODE = "test-code-0123456789abcdef"; // made up, 26 characters
const DENIED = { error: "The access code is missing or wrong." };
const NOT_SET_UP = { error: "This site is not set up to read yet. Please try again later." };
const PAUSED = { error: "The AI reading is paused right now. Please try again later." };

const AD_OK = {
  job: { id: "pasted-ad", title: "T", company: null, source: null, constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] }, requirements: [] },
  removed: [], moved: [], unlisted: [], notCounted: [], extraction: {},
};
const CV_OK = { skills: [], removed: [], duplicates: 0, unlisted: [] };

const routes = [
  { name: "/api/read", url: "http://localhost/api/read", POST: POST_AD, body: { text: "A job ad that is long enough to read." }, spy: readAd, ok: AD_OK },
  { name: "/api/cv", url: "http://localhost/api/cv", POST: POST_CV, body: { lines: ["Wrote SQL queries"] }, spy: readCv, ok: CV_OK },
];

// Environment helper: a value, or undefined to remove the variable; restored after each test.
const saved: Record<string, string | undefined> = {};
function env(name: string, value: string | undefined) {
  const e = process.env as Record<string, string | undefined>;
  if (!(name in saved)) saved[name] = e[name];
  if (value === undefined) delete e[name];
  else e[name] = value;
}

const logs = { log: vi.spyOn(console, "log"), info: vi.spyOn(console, "info"), warn: vi.spyOn(console, "warn"), error: vi.spyOn(console, "error") };

beforeEach(() => {
  readCache.clear();
  readAd.mockReset().mockResolvedValue(AD_OK);
  readCv.mockReset().mockResolvedValue(CV_OK);
  compared.length = 0;
  for (const l of Object.values(logs)) l.mockClear().mockImplementation(() => {});
  env("NODE_ENV", "production");
  env("ACCESS_CODE", CODE);
  env("AI_ENABLED", undefined);
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    const e = process.env as Record<string, string | undefined>;
    if (v === undefined) delete e[k];
    else e[k] = v;
  }
  for (const k of Object.keys(saved)) delete saved[k];
});

// Every answer a test gets is also checked for A16 (no code in it), A17 (no-store) and A18 (nothing logged).
const seen: Response[] = [];
async function send(r: (typeof routes)[number], opts: { header?: string | null; body?: unknown; url?: string; headerName?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const value = opts.header === undefined ? undefined : opts.header;
  if (value !== undefined && value !== null) headers[opts.headerName ?? "x-access-code"] = value;
  const body = opts.body === undefined ? r.body : opts.body;
  const res = await r.POST(new Request(opts.url ?? r.url, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }));
  seen.push(res.clone());
  const sent = value ?? "";
  const raw = JSON.stringify(await res.clone().json().catch(() => null)) + JSON.stringify([...res.headers.entries()]);
  expect(raw, "A16: the right code is never in an answer").not.toContain(CODE);
  if (sent.length >= 4) expect(raw, "A16: the sent value is never echoed").not.toContain(sent);
  expect(res.headers.get("Cache-Control"), "A17: no-store on every answer").toBe("no-store");
  for (const [k, l] of Object.entries(logs)) expect(JSON.stringify(l.mock.calls), `A18: console.${k} never gets the code`).not.toContain(CODE);
  if (sent.length >= 4) for (const l of Object.values(logs)) expect(JSON.stringify(l.mock.calls), "A18: nor the sent value").not.toContain(sent);
  return res;
}

describe.each(routes)("access code on $name", (r) => {
  it("A1: no header, production, code set: 401, the one plain message, no AI call", async () => {
    const res = await send(r);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(DENIED);
    expect(r.spy).not.toHaveBeenCalled();
  });

  it("A2: a wrong code of the same length: 401, and timingSafeEqual got two 32-byte buffers once", async () => {
    const wrong = "x".repeat(CODE.length);
    const res = await send(r, { header: wrong });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(DENIED);
    expect(compared.length).toBe(1);
    expect(compared[0].map((b) => b.length)).toEqual([32, 32]);
    expect(r.spy).not.toHaveBeenCalled();
  });

  it("A3: the right code: the route's normal 200, one AI call", async () => {
    const res = await send(r, { header: CODE });
    expect(res.status).toBe(200);
    expect(r.spy).toHaveBeenCalledTimes(1);
  });

  it("A4: an empty-string header: 401", async () => {
    const res = await send(r, { header: "" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(DENIED);
  });

  it("A5: a whitespace-only header: 401", async () => {
    const res = await send(r, { header: "   " });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(DENIED);
  });

  it("A6: the right code with a space on each side: 200 (the Fetch standard strips outer spaces)", async () => {
    const res = await send(r, { header: ` ${CODE} ` });
    expect(res.status).toBe(200);
  });

  it("A7: a header of 100,000 characters: 401, and timingSafeEqual still got 32-byte buffers", async () => {
    const res = await send(r, { header: "a".repeat(100_000) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(DENIED);
    expect(compared.length).toBe(1);
    expect(compared[0].map((b) => b.length)).toEqual([32, 32]);
  });

  it("A8: NODE_ENV production, code unset, a header sent: 503 not set up, no AI call", async () => {
    env("ACCESS_CODE", undefined);
    const res = await send(r, { header: CODE });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NOT_SET_UP);
    expect(r.spy).not.toHaveBeenCalled();
  });

  it("A8b: code set to blank, production, empty header: 503 (a blank code never matches a blank header)", async () => {
    env("ACCESS_CODE", "   ");
    const res = await send(r, { header: "" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NOT_SET_UP);
  });

  it("A8c: code shorter than 16 characters, production, header equal to it: 503", async () => {
    env("ACCESS_CODE", "short-code-15ch"); // 15 characters; the minimum is 16
    expect("short-code-15ch".length).toBe(15);
    const res = await send(r, { header: "short-code-15ch" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NOT_SET_UP);
  });

  it("A8d: NODE_ENV unset, code unset: 503", async () => {
    env("NODE_ENV", undefined);
    env("ACCESS_CODE", undefined);
    const res = await send(r);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NOT_SET_UP);
    expect(r.spy).not.toHaveBeenCalled();
  });

  it("A8e: NODE_ENV staging, code unset: 503", async () => {
    env("NODE_ENV", "staging");
    env("ACCESS_CODE", undefined);
    const res = await send(r);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(NOT_SET_UP);
  });

  it("A9: NODE_ENV development, code unset, no header: 200 (no check)", async () => {
    env("NODE_ENV", "development");
    env("ACCESS_CODE", undefined);
    const res = await send(r);
    expect(res.status).toBe(200);
    expect(r.spy).toHaveBeenCalledTimes(1);
  });

  it("A9b: NODE_ENV development, code unset, a header sent: 200 (the header is ignored)", async () => {
    env("NODE_ENV", "development");
    env("ACCESS_CODE", undefined);
    const res = await send(r, { header: "anything" });
    expect(res.status).toBe(200);
  });

  it("A9c: NODE_ENV test, code unset, no header: 200 (no check)", async () => {
    env("NODE_ENV", "test");
    env("ACCESS_CODE", undefined);
    const res = await send(r);
    expect(res.status).toBe(200);
  });

  it("A10: kill switch on, the right code: 503 paused, no AI call", async () => {
    env("AI_ENABLED", "false");
    const res = await send(r, { header: CODE });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(PAUSED);
    expect(r.spy).not.toHaveBeenCalled();
  });

  it("A11: kill switch on, a wrong code: 503 paused, NOT 401 (the kill switch comes first)", async () => {
    env("AI_ENABLED", "false");
    const res = await send(r, { header: "wrong" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual(PAUSED);
  });

  it("A13: no header and a malformed JSON body: 401, NOT 400 (the check comes before parsing)", async () => {
    const res = await send(r, { body: "not json" });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(DENIED);
  });

  it("A13b: the right code and a malformed JSON body: 400", async () => {
    const res = await send(r, { header: CODE, body: "not json" });
    expect(res.status).toBe(400);
  });

  it("A14: the right code only in the query string, no header: 401", async () => {
    const res = await send(r, { url: `${r.url}?code=${CODE}` });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(DENIED);
  });

  it("A15: the header name in capitals with the right code: 200", async () => {
    const res = await send(r, { header: CODE, headerName: "X-Access-Code" });
    expect(res.status).toBe(200);
  });

  it("A19: the right code plus one character, and the right code minus its last character: 401", async () => {
    const plus = await send(r, { header: CODE + "x" });
    const minus = await send(r, { header: CODE.slice(0, -1) });
    expect([plus.status, minus.status]).toEqual([401, 401]);
    expect(await plus.json()).toEqual(DENIED);
  });
});

describe("access code and the reading cache (/api/read only)", () => {
  const r = routes[0];
  it("A12: a right-code call fills the cache; the same ad with a wrong code is 401 with no cache header and no reader call", async () => {
    const first = await send(r, { header: CODE });
    expect([first.status, first.headers.get("x-reading-cache")]).toEqual([200, "miss"]);
    const wrong = await send(r, { header: "wrong-wrong-wrong-wrong" });
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("x-reading-cache")).toBeNull();
    expect(readAd).toHaveBeenCalledTimes(1);
  });

  it("A12b: then the same ad with the right code: 200, a cache hit, the reader still called once", async () => {
    await send(r, { header: CODE });
    await send(r, { header: "wrong-wrong-wrong-wrong" });
    const again = await send(r, { header: CODE });
    expect([again.status, again.headers.get("x-reading-cache")]).toEqual([200, "hit"]);
    expect(readAd).toHaveBeenCalledTimes(1);
  });
});
