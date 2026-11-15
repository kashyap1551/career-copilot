import { beforeEach, describe, expect, it, vi } from "vitest";

// readCvLines on a fake provider: what is sent, how the answer is checked, and
// how a failure is mapped. generateText is fake, so no network and no tokens.

const generateText = vi.fn();
vi.mock("ai", async (importActual) => {
  const actual = await importActual<typeof import("ai")>();
  return { ...actual, generateText: (...args: unknown[]) => generateText(...args) };
});
vi.mock("@/lib/ai/model", () => ({
  getModel: () => "fake-model",
  MissingSettingError: class extends Error {},
}));

import { APICallError, RetryError } from "ai";
import { INSTRUCTIONS_CV, readCvLines } from "@/lib/ai/readCv";

const reading = (skills: unknown[]) => ({
  output: { skills },
  usage: { inputTokens: 100, outputTokens: 50 },
  response: { headers: { "x-ratelimit-remaining-tokens": "7000", "set-cookie": "no" } },
});

beforeEach(() => {
  generateText.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("readCvLines", () => {
  it("V1: sends the instructions and exactly the numbered lines", async () => {
    generateText.mockResolvedValue(reading([]));
    await readCvLines(["first line", "second line"]);
    const arg = generateText.mock.calls[0][0] as { instructions: string; prompt: string };
    expect(arg.instructions).toBe(INSTRUCTIONS_CV);
    expect(arg.prompt).toBe("Read this CV.\n\n<cv>\n1: first line\n2: second line\n</cv>");
  });

  it("V2: the answer is checked by fromCv, usage and only rate-limit headers come back", async () => {
    generateText.mockResolvedValue(
      reading([
        { name: "SQL", line: 2, quote: "Wrote SQL queries" },
        { name: "Python", line: 2, quote: "Python scripts" }, // not in line 2: removed
      ]),
    );
    const r = await readCvLines(["Robin Sample", "Wrote SQL queries"]);
    expect(r.skills.map((s) => [s.skillId, s.line])).toEqual([["sql", 2]]);
    expect(r.removed.map((x) => x.why)).toEqual(["quote-not-in-line"]);
    expect(r.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
    expect(r.limits).toEqual({ "x-ratelimit-remaining-tokens": "7000" });
  });

  it("V3: a failure that outlasts the SDK's retries keeps its code, and the message says CV", async () => {
    const last = new APICallError({ message: "boom", url: "https://example.invalid", requestBodyValues: {}, statusCode: 429 });
    generateText.mockRejectedValue(new RetryError({ message: "Failed after 3 attempts", reason: "maxRetriesExceeded", errors: [last] }));
    const error = await readCvLines(["a"]).catch((e) => e);
    expect(error.status).toBe(429);
    generateText.mockRejectedValue(new Error("x"));
    const other = await readCvLines(["a"]).catch((e) => e);
    expect(other.message).toContain("reading the CV");
  });
});
