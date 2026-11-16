import { describe, expect, it } from "vitest";
import {
  evalFingerprint,
  FINGERPRINT_FORMAT,
  fingerprintLine,
  stableStringify,
  requestHash,
  vocabularyHash,
  type FingerprintInput,
} from "@/lib/engine/evalFingerprint";
import { LEFT_UNLISTED, NOT_A_SKILL, VOCAB } from "@/lib/vocab";

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
  vocabulary: "vocab-hash-one",
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

  it("changes with the format number, so a format 1 or 2 fingerprint never equals a format 3 one", () => {
    expect(evalFingerprint(base(), 1)).not.toBe(evalFingerprint(base(), 2));
    expect(evalFingerprint(base(), 2)).not.toBe(evalFingerprint(base(), 3));
    expect(evalFingerprint(base(), 3)).toBe(evalFingerprint(base()));
  });

  it("changes when the vocabulary changes, and not when it stays the same", () => {
    const changed = base();
    changed.vocabulary = "vocab-hash-two";
    expect(evalFingerprint(changed)).not.toBe(evalFingerprint(base()));
    expect(evalFingerprint({ ...base(), vocabulary: "vocab-hash-one" })).toBe(evalFingerprint(base()));
  });

  it("the request hash does not depend on the vocabulary (the prompts are untouched by Day 5)", () => {
    expect(requestHash(baseRequest())).toBe(requestHash(baseRequest()));
    const a = fingerprintLine(baseRequest(), 100, evalFingerprint(base()), "aaaaaaaaaaaaaaa");
    const b = fingerprintLine(baseRequest(), 100, evalFingerprint({ ...base(), vocabulary: "other" }), "bbbbbbbbbbbbbbb");
    expect(a.match(/request ([0-9a-f]{10})/)?.[1]).toBe(b.match(/request ([0-9a-f]{10})/)?.[1]);
  });

  it("still changes with an ad text or a key", () => {
    const f = evalFingerprint(base());
    const c = base(); c.ads[0].text = "Text one changed";
    const d = base(); d.ads[1].key = { a: 3 };
    for (const x of [c, d]) expect(evalFingerprint(x)).not.toBe(f);
  });
});

describe("fingerprint format", () => {
  it("is format 3 and the report line carries the vocabulary hash", () => {
    expect(FINGERPRINT_FORMAT).toBe(3);
    const line = fingerprintLine(baseRequest(), 3347, evalFingerprint(base()), vocabularyHash({ a: 1 }));
    expect(line).toMatch(/^FINGERPRINT: format 3 \| request [0-9a-f]{10} \| full [0-9a-f]{10} \| vocab [0-9a-f]{10} \| INSTRUCTIONS 3,347 characters\n$/);
  });

  it("the line for a partial run has no full fingerprint, but still the vocabulary", () => {
    expect(fingerprintLine(baseRequest(), 4000, undefined, vocabularyHash({ a: 1 }))).toMatch(
      /^FINGERPRINT: format 3 \| request [0-9a-f]{10} \| vocab [0-9a-f]{10} \| INSTRUCTIONS 4,000 characters\n$/,
    );
    expect(fingerprintLine(baseRequest(), 4000)).toMatch(/^FINGERPRINT: format 3 \| request [0-9a-f]{10} \| INSTRUCTIONS 4,000 characters\n$/);
  });
});

describe("vocabularyHash", () => {
  const real = () => vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED });

  it("is 64 hex characters, the same for the same data, and independent of key order", () => {
    expect(real()).toMatch(/^[0-9a-f]{64}$/);
    expect(real()).toBe(real());
    expect(vocabularyHash({ a: 1, b: { c: 2, d: 3 } })).toBe(vocabularyHash({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it("changes when an alias, a not-a-skill phrase or an unlisted name changes", () => {
    const withAlias = VOCAB.map((e, i) => (i === 0 ? { ...e, aliases: [...e.aliases, "one more alias"] } : e));
    expect(vocabularyHash({ VOCAB: withAlias, NOT_A_SKILL, LEFT_UNLISTED })).not.toBe(real());
    expect(vocabularyHash({ VOCAB, NOT_A_SKILL: NOT_A_SKILL.slice(1), LEFT_UNLISTED })).not.toBe(real());
    expect(vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED: LEFT_UNLISTED.slice(1) })).not.toBe(real());
  });
});
