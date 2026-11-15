import { zodSchema } from "ai";
import { describe, expect, it } from "vitest";
import { extractedCvSchema } from "@/lib/schemas/cv";

// Groq's strict mode: every property required, every object closed. Checked on
// the JSON schema the AI SDK really sends (the same check as tests/schema.test.ts).
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

describe("the CV schema sent to Groq is strict-mode shaped", () => {
  const objects = objectsIn(zodSchema(extractedCvSchema).jsonSchema as Json);

  it("has the top level and the skill item (2 objects)", () => {
    expect(objects.length).toBe(2);
  });
  it.each(objects.map((o, i) => [i, o] as const))("object %i lists every property as required and is closed", (_i, o) => {
    expect([...((o.required as string[]) ?? [])].sort()).toEqual(Object.keys(o.properties as Json).sort());
    expect(o.additionalProperties).toBe(false);
  });
  it("the skill item has exactly name, line and quote", () => {
    const item = objects.find((o) => "quote" in (o.properties as Json))!;
    expect(Object.keys(item.properties as Json).sort()).toEqual(["line", "name", "quote"]);
  });
});
