import { describe, expect, it } from "vitest";
import {
  evalFingerprint,
  FINGERPRINT_FORMAT,
  fingerprintLine,
  stableStringify,
  type FingerprintInput,
} from "@/lib/engine/evalFingerprint";

// The request is a made-up body in the shape the Groq provider sends. Expectations
// worked out by hand: the same inputs give the same fingerprint, and changing any
// one thing gives a different one.

interface Req {
  model: string;
  temperature: number;
  seed?: number;
  reasoning_effort: string;
  messages: { role: string; content: string }[];
  response_format: { type: string; json_schema: { name: string; schema: { type: string; properties: { city: { type: string[]; description: string } } } } };
}

const baseRequest = (): Req => ({
  model: "openai/gpt-oss-120b",
  temperature: 0,
  seed: 1,
  reasoning_effort: "medium",
  messages: [
    { role: "system", content: "Read the ad." },
    { role: "user", content: "Read this job ad." },
  ],
  response_format: {
    type: "json_schema",
    json_schema: { name: "response", schema: { type: "object", properties: { city: { type: ["string", "null"], description: "The city only." } } } },
  },
});

const base = (): FingerprintInput => ({
  request: baseRequest(),
  ads: [
    { id: "ad-01", text: "Text one", key: { a: 1 } },
    { id: "ad-02", text: "Text two", key: { a: 2 } },
  ],
});

// The same content with every object's keys in the opposite order.
const reversed = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(reversed)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reversed((v as Record<string, unknown>)[k])]))
      : v;

describe("evalFingerprint", () => {
  it("is the same for the same inputs", () => {
    expect(evalFingerprint(base())).toBe(evalFingerprint(base()));
  });

  it("does not depend on the order of keys inside the request or a key", () => {
    const x = base();
    x.request = reversed(baseRequest());
    expect(evalFingerprint(x)).toBe(evalFingerprint(base()));
    expect(Object.keys(reversed(baseRequest()) as object)).not.toEqual(Object.keys(baseRequest())); // the reordering is real
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it.each([
    ["the temperature", (r: Req) => (r.temperature = 0.5)],
    ["the seed", (r: Req) => (r.seed = 2)],
    ["the reasoning effort", (r: Req) => (r.reasoning_effort = "high")],
    ["the model name", (r: Req) => (r.model = "openai/gpt-oss-20b")],
    ["the instructions", (r: Req) => (r.messages[0].content = "Read the ad carefully.")],
    ["one description in the schema", (r: Req) => (r.response_format.json_schema.schema.properties.city.description = "The city only, once.")],
    ["a setting removed", (r: Req) => delete r.seed],
  ])("changes when %s changes", (_name, change) => {
    const x = base();
    change(x.request as Req);
    expect(evalFingerprint(x)).not.toBe(evalFingerprint(base()));
  });

  it("changes with the format number, so a format 1 fingerprint never equals a format 2 one", () => {
    expect(evalFingerprint(base(), 1)).not.toBe(evalFingerprint(base(), 2));
    expect(evalFingerprint(base(), 2)).toBe(evalFingerprint(base()));
  });

  it("still changes with an ad text or a key", () => {
    const f = evalFingerprint(base());
    const c = base(); c.ads[0].text = "Text one changed";
    const d = base(); d.ads[1].key = { a: 3 };
    for (const x of [c, d]) expect(evalFingerprint(x)).not.toBe(f);
  });
});

describe("fingerprint format", () => {
  it("is format 2 and the report line says so", () => {
    expect(FINGERPRINT_FORMAT).toBe(2);
    const line = fingerprintLine(baseRequest(), 3347, evalFingerprint(base()));
    expect(line).toMatch(/^FINGERPRINT: format 2 \| request [0-9a-f]{10} \| full [0-9a-f]{10} \| INSTRUCTIONS 3,347 characters\n$/);
  });

  it("the line for a partial run has no full fingerprint", () => {
    expect(fingerprintLine(baseRequest(), 4000)).toMatch(/^FINGERPRINT: format 2 \| request [0-9a-f]{10} \| INSTRUCTIONS 4,000 characters\n$/);
  });
});
