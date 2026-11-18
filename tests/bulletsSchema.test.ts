import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import { MAX_LINE_CHARS } from "@/lib/cv/limits";
import { bulletsAnswerSchema, MAX_REQUIREMENT_CHARS, writeBulletsRequestSchema } from "@/lib/schemas/bullets";

// Step 8.3, stage 3, tests first (docs/PLAN-8.3.md v2, section 4; tests T13 and T14). The request the page sends to /api/bullets: 1 to 5 pairs, ids
// 1..n in order, one CV line (no contact details, one line, up to 1,000 characters) and one requirement (up to 300 characters) each. The AI's answer
// schema is strict-mode shaped. Every expectation is hand-worked from the plan and this step's prompt; invented text only.

const pair = (id: number, over: Record<string, unknown> = {}) => ({ id, requirement: "Excel is required.", line: "Kept the books in Excel", ...over });
const ok = (pairs: unknown) => writeBulletsRequestSchema.safeParse({ pairs }).success;
const pairs = (n: number) => Array.from({ length: n }, (_, i) => pair(i + 1));

describe("T13: the request schema", () => {
  it("T13: 1 to 5 pairs are accepted", () => {
    for (const n of [1, 2, 3, 4, 5]) expect(ok(pairs(n)), `${n} pairs`).toBe(true);
  });

  it("T13: 0 pairs and 6 pairs are refused; so are no `pairs` field and a non-array", () => {
    expect(ok([])).toBe(false);
    expect(ok(pairs(6))).toBe(false);
    expect(writeBulletsRequestSchema.safeParse({}).success).toBe(false);
    expect(writeBulletsRequestSchema.safeParse({ pairs: "x" }).success).toBe(false);
    expect(writeBulletsRequestSchema.safeParse(null).success).toBe(false);
  });

  it("T13: the ids must be the numbers 1..n in order, without a repeat", () => {
    expect(ok([pair(2)])).toBe(false);
    expect(ok([pair(0)])).toBe(false);
    expect(ok([pair(1), pair(3)])).toBe(false);
    expect(ok([pair(2), pair(1)])).toBe(false);
    expect(ok([pair(1), pair(1)])).toBe(false);
    expect(ok([pair(1.5)])).toBe(false);
    expect(ok([pair("1" as unknown as number)])).toBe(false);
    expect(ok([pair(1), pair(2), pair(3)])).toBe(true);
  });

  it("T13: a missing field is refused (id, requirement, line)", () => {
    const { id: _a, ...noId } = pair(1);
    const { requirement: _b, ...noRequirement } = pair(1);
    const { line: _c, ...noLine } = pair(1);
    expect(ok([noId])).toBe(false);
    expect(ok([noRequirement])).toBe(false);
    expect(ok([noLine])).toBe(false);
    expect(ok([pair(1, { line: 5 })])).toBe(false);
    expect(ok([pair(1, { requirement: null })])).toBe(false);
  });

  it("T13: a CV line with an email address, a phone number or a link is refused, with the contact-details message of the CV schema", () => {
    for (const line of ["write to jane@example.com", "call +49 30 1234567", "see www.example.com"]) {
      const r = writeBulletsRequestSchema.safeParse({ pairs: [pair(1, { line })] });
      expect(r.success, line).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe("Remove email addresses, phone numbers and links before sending.");
    }
  });

  it("T13: an empty line, a blank line and a line with a line break are refused", () => {
    expect(ok([pair(1, { line: "" })])).toBe(false);
    expect(ok([pair(1, { line: "   " })])).toBe(false);
    expect(ok([pair(1, { line: "a\nb" })])).toBe(false);
    expect(ok([pair(1, { line: "a\r\nb" })])).toBe(false);
  });

  it("T13: the line limit is 1,000 characters (1,000 accepted, 1,001 refused)", () => {
    expect(MAX_LINE_CHARS).toBe(1000);
    expect(ok([pair(1, { line: "a".repeat(1000) })])).toBe(true);
    expect(ok([pair(1, { line: "a".repeat(1001) })])).toBe(false);
  });

  it("T13: the requirement limit is 300 characters (300 accepted, 301 refused) and an empty requirement is refused", () => {
    expect(MAX_REQUIREMENT_CHARS).toBe(300);
    expect(ok([pair(1, { requirement: "a".repeat(300) })])).toBe(true);
    expect(ok([pair(1, { requirement: "a".repeat(301) })])).toBe(false);
    expect(ok([pair(1, { requirement: "" })])).toBe(false);
  });

  it("T13: the lines of several pairs are each checked (a bad line in the third pair refuses the whole request)", () => {
    expect(ok([pair(1), pair(2), pair(3, { line: "mail me at x@y.example" })])).toBe(false);
  });
});

// ---- T14: Groq's strict mode, checked on the JSON schema the AI SDK really sends (the method of tests/cvSchema.test.ts) ---------------------------------
type Json = { [k: string]: unknown };
function objectsIn(node: unknown, found: Json[] = []): Json[] {
  if (Array.isArray(node)) node.forEach((n) => objectsIn(n, found));
  else if (node && typeof node === "object") {
    const o = node as Json;
    if (o.properties && typeof o.properties === "object") found.push(o);
    Object.values(o).forEach((v) => objectsIn(v, found));
  }
  return found;
}

describe("T14: the answer schema sent to Groq is strict-mode shaped", () => {
  const objects = objectsIn(zodSchema(bulletsAnswerSchema).jsonSchema as Json);

  it("has the top level and the bullet item (2 objects)", () => {
    expect(objects.length).toBe(2);
  });
  it.each(objects.map((o, i) => [i, o] as const))("object %i lists every property as required and is closed", (_i, o) => {
    expect([...((o.required as string[]) ?? [])].sort()).toEqual(Object.keys(o.properties as Json).sort());
    expect(o.additionalProperties).toBe(false);
  });
  it("the top level has exactly `bullets`; the item has exactly `pair` and `text`", () => {
    const top = objects.find((o) => "bullets" in (o.properties as Json))!;
    expect(Object.keys(top.properties as Json)).toEqual(["bullets"]);
    const item = objects.find((o) => "text" in (o.properties as Json))!;
    expect(Object.keys(item.properties as Json).sort()).toEqual(["pair", "text"]);
  });
  it("no property is nullable or optional: a null or a missing field does not parse", () => {
    expect(bulletsAnswerSchema.safeParse({ bullets: [{ pair: 1, text: "Kept the books in Excel" }] }).success).toBe(true);
    expect(bulletsAnswerSchema.safeParse({ bullets: [{ pair: 1, text: null }] }).success).toBe(false);
    expect(bulletsAnswerSchema.safeParse({ bullets: [{ pair: 1 }] }).success).toBe(false);
    expect(bulletsAnswerSchema.safeParse({ bullets: [{ text: "x y z" }] }).success).toBe(false);
    expect(bulletsAnswerSchema.safeParse({}).success).toBe(false);
  });
});
