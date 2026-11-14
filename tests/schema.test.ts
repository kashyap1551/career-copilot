import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import { extractedAdSchema } from "@/lib/schemas/job";

// Section J of docs/PLAN-3.1.md. Groq's strict mode (from its docs): "All
// schema properties must be marked as required" and "All objects must set
// additionalProperties: false". This checks the JSON schema the AI SDK
// actually sends, not just the Zod code.

type Json = { [k: string]: unknown };

function objectsIn(node: unknown, found: Json[] = []): Json[] {
  if (Array.isArray(node)) {
    node.forEach((n) => objectsIn(n, found));
  } else if (node && typeof node === "object") {
    const obj = node as Json;
    if (obj.properties && typeof obj.properties === "object") found.push(obj);
    Object.values(obj).forEach((v) => objectsIn(v, found));
  }
  return found;
}

describe("J1. the schema sent to Groq is strict-mode shaped", () => {
  const sent = zodSchema(extractedAdSchema).jsonSchema as Json;
  const objects = objectsIn(sent);

  it("has the top level and the nested objects (the check is not vacuous)", () => {
    // top, workMode, minYears, startDate, languages item, otherConditions item,
    // requirements item, skills item
    expect(objects.length).toBe(8);
  });

  it.each(objects.map((o, i) => [i, o] as const))("object %i lists every property as required", (_i, o) => {
    const keys = Object.keys(o.properties as Json).sort();
    expect([...((o.required as string[]) ?? [])].sort()).toEqual(keys);
  });

  it.each(objects.map((o, i) => [i, o] as const))("object %i is closed (additionalProperties false)", (_i, o) => {
    expect(o.additionalProperties).toBe(false);
  });
});
