import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import { checkAnswerSchema } from "@/lib/schemas/check";

// EC-3a, the schema of the evidence check's answer (docs/PLAN-EVERY-CV.md 4.3; tests CK1 to CK3). Groq's strict mode: every field required, `.nullable()`
// and never `.optional()`. Invented data; every expectation is worked out by hand from the prompt of EC-3a.

const answer = (over: Record<string, unknown> = {}) => ({ requirement: 1, verdict: "met", entry: 1, quote: "Stitched torn sails", ...over });
const parses = (v: unknown) => checkAnswerSchema.safeParse(v).success;

describe("EC-3a the answer schema", () => {
  it("CK1: accepts the two answers of the prompt's shape (a met with an entry and a quote, a none with nulls), and an empty list", () => {
    expect(parses({ answers: [answer(), { requirement: 2, verdict: "none", entry: null, quote: null }] })).toBe(true);
    expect(parses({ answers: [] })).toBe(true);
  });

  it("CK2: rejects a missing quote, the verdict 'maybe', requirement 1.5, entry as a string, quote as a number, no answers field, answers not a list", () => {
    const { quote: _q, ...noQuote } = answer();
    void _q;
    expect(parses({ answers: [noQuote] })).toBe(false);
    expect(parses({ answers: [answer({ verdict: "maybe" })] })).toBe(false);
    expect(parses({ answers: [answer({ requirement: 1.5 })] })).toBe(false);
    expect(parses({ answers: [answer({ entry: "1" })] })).toBe(false);
    expect(parses({ answers: [answer({ quote: 5 })] })).toBe(false);
    expect(parses({})).toBe(false);
    expect(parses({ answers: "yes" })).toBe(false);
    expect(parses({ answers: { requirement: 1 } })).toBe(false);
  });

  it("CK3: the JSON schema the SDK sends is strict-shaped: one required top-level field; the item has exactly four properties, all required; entry and quote accept null; verdict is exactly met, partly, none", () => {
    const sent = zodSchema(checkAnswerSchema).jsonSchema as Record<string, unknown>;
    expect(sent.type).toBe("object");
    expect(Object.keys(sent.properties as object)).toEqual(["answers"]);
    expect(sent.required).toEqual(["answers"]);
    expect(sent.additionalProperties).toBe(false);
    const items = ((sent.properties as Record<string, { items: Record<string, unknown> }>).answers).items;
    const props = items.properties as Record<string, Record<string, unknown>>;
    expect(Object.keys(props).sort()).toEqual(["entry", "quote", "requirement", "verdict"]);
    expect([...(items.required as string[])].sort()).toEqual(["entry", "quote", "requirement", "verdict"]);
    expect(items.additionalProperties).toBe(false);
    expect(props.verdict.enum).toEqual(["met", "partly", "none"]);
    for (const k of ["entry", "quote"]) expect(JSON.stringify(props[k])).toContain('"null"');
    expect(props.requirement.type).toBe("integer");
    // no description texts: the instruction text is the only guidance
    expect(JSON.stringify(sent)).not.toContain("description");
  });
});
