import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// /api/cv: the request limits (docs/PLAN-4.2.md section a, stage 5), the kill
// switch, and that nothing but the checked skills goes back. readCvLines is a
// fake here: no AI call.

const readCvLines = vi.fn();
vi.mock("@/lib/ai/readCv", () => ({ readCvLines: (...a: unknown[]) => readCvLines(...a) }));

import { POST } from "@/app/api/cv/route";
import { ReadAdError } from "@/lib/ai/errors";
import { MAX_CV_CHARS, MAX_CV_LINES, MAX_LINE_CHARS } from "@/lib/cv/limits";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/cv", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

const ok = {
  skills: [{ name: "SQL", skillId: "sql", listed: true, line: 1, quote: "SQL", label: "named" }],
  removed: [],
  duplicates: 0,
  unlisted: [],
  usage: { inputTokens: 12345, outputTokens: 6789 },
  limits: { "x-ratelimit-remaining-tokens": "74" },
};

beforeEach(() => {
  readCvLines.mockReset();
  readCvLines.mockResolvedValue(ok);
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/cv", () => {
  it("K1: answers with skills, removed, duplicates and unlisted, and never usage or limits", async () => {
    const res = await post({ lines: ["Wrote SQL queries"] });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["duplicates", "removed", "skills", "unlisted"]);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("usage");
    expect(raw).not.toContain("12345");
    expect(raw).not.toContain("ratelimit");
  });

  it("K2: the lines reach the reader unchanged", async () => {
    await post({ lines: ["  a  ", "b"] });
    expect(readCvLines).toHaveBeenCalledWith(["  a  ", "b"]);
  });

  it("K3: refuses what is not valid, with 400 and no call", async () => {
    const bad: [string, unknown][] = [
      ["not json", "{nope"],
      ["no lines", {}],
      ["lines not an array", { lines: "a" }],
      ["an empty list", { lines: [] }],
      ["a number as a line", { lines: [1] }],
      ["an empty line", { lines: ["a", ""] }],
      ["a blank line", { lines: ["a", "   "] }],
      ["a line with a line break", { lines: ["a\nb"] }],
      ["a line over the limit", { lines: ["a".repeat(MAX_LINE_CHARS + 1)] }],
      ["too many lines", { lines: Array.from({ length: MAX_CV_LINES + 1 }, () => "a") }],
      ["too many characters in total", { lines: Array.from({ length: 13 }, () => "a".repeat(1000)) }],
      ["an email left in", { lines: ["write to jane@example.com"] }],
      ["a phone number left in", { lines: ["call +49 30 1234567"] }],
      ["a link left in", { lines: ["see www.example.com"] }],
    ];
    for (const [, body] of bad) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).error).toBe("string");
    }
    expect(readCvLines).not.toHaveBeenCalled();
  });

  it("K4: the edges are accepted: 400 lines, 12,000 characters, a 1,000 character line", async () => {
    expect((await post({ lines: Array.from({ length: MAX_CV_LINES }, () => "a") })).status).toBe(200);
    expect((await post({ lines: Array.from({ length: 12 }, () => "a".repeat(1000)) })).status).toBe(200);
    expect(12 * 1000).toBe(MAX_CV_CHARS);
    expect((await post({ lines: ["a".repeat(MAX_LINE_CHARS)] })).status).toBe(200);
  });

  it("K5: a reader error becomes its own status and message", async () => {
    readCvLines.mockRejectedValue(new ReadAdError("The AI service is busy right now. Please try again in a minute.", 429));
    const res = await post({ lines: ["a"] });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/busy/);
  });

  it("K6: an unknown error is a plain 500 and logs no CV text", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    readCvLines.mockRejectedValue(new Error("SECRET CV TEXT"));
    const res = await post({ lines: ["a"] });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(spy.mock.calls.flat().join(" ")).not.toContain("SECRET");
    spy.mockRestore();
  });

  it("K7: the kill switch: AI_ENABLED=false answers 503 'paused' before anything is read or called", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const res = await post({ lines: ["a"] });
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/paused/i);
    expect(readCvLines).not.toHaveBeenCalled();
    const res2 = await post("{nope"); // even a bad body gets "paused", not a 400
    expect(res2.status).toBe(503);
  });

  it("K7b: False, FALSE and ' false ' also pause (a typo must not leave the AI on)", async () => {
    for (const v of ["False", "FALSE", " false "]) {
      vi.stubEnv("AI_ENABLED", v);
      expect((await post({ lines: ["a"] })).status).toBe(503);
    }
  });

  it("K8: any other value of AI_ENABLED means on", async () => {
    for (const v of ["true", "", "0", "no", "falsey"]) {
      vi.stubEnv("AI_ENABLED", v);
      expect((await post({ lines: ["a"] })).status).toBe(200);
    }
    vi.unstubAllEnvs();
    expect((await post({ lines: ["a"] })).status).toBe(200);
  });
});
