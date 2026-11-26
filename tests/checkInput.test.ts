import { describe, expect, it } from "vitest";
import { buildCheckInput, CHECK_MAX_ENTRIES, CHECK_MAX_LINE_CHARS, CHECK_MAX_REQUIREMENT_CHARS, CHECK_MAX_REQUIREMENTS } from "@/lib/ai/checkInput";
import type { SentEntry, SentRequirement } from "@/lib/engine/evidenceProof";

// EC-3a, what is sent to the check (docs/PLAN-EVERY-CV.md 4.3; tests CI1 to CI9). Pure text. Invented data; every expectation is worked out by hand
// from the layout of the prompt of EC-3a:
//   Requirements:
//   R1 "<text>"
//   CV entries:
//   E1 | <name> | "<line>"
// with no blank line and no trailing newline; every run of whitespace is one space; a double quote inside a text becomes a single quote; a requirement
// is cut to 300 characters and a CV line to 240; in a name, | becomes /.

const R = (n: number, quote: string, importance: "must" | "nice" = "must"): SentRequirement => ({ n, index: n - 1, quote, importance });
const E = (n: number, name: string, text: string, inferred = false): SentEntry => ({ n, name, skillId: `new:e${n}`, line: n + 1, text, inferred });
const build = (rs: SentRequirement[], es: SentEntry[]) => buildCheckInput(rs, es);

const EXAMPLE_R = ["Mends sails and rigging", "Has run a ferry rota for five seasons", "Can polish brass or copper fittings", "Speaks Portuguese at work"].map((q, i) => R(i + 1, q));
const EXAMPLE_E = [
  E(1, "Sail repair", "Stitched torn sails and spliced new rope on two sloops"),
  E(2, "Crossing plans", "Drew up the fortnightly crossing plan for the island boat"),
  E(3, "Lantern care", "Polished the brass lantern of the quay beacon each dawn"),
  E(4, "Basque", "Chatted in Basque with visitors at the quay café"),
];
const EXAMPLE_BLOCK = [
  "Requirements:",
  'R1 "Mends sails and rigging"',
  'R2 "Has run a ferry rota for five seasons"',
  'R3 "Can polish brass or copper fittings"',
  'R4 "Speaks Portuguese at work"',
  "CV entries:",
  'E1 | Sail repair | "Stitched torn sails and spliced new rope on two sloops"',
  'E2 | Crossing plans | "Drew up the fortnightly crossing plan for the island boat"',
  'E3 | Lantern care | "Polished the brass lantern of the quay beacon each dawn"',
  'E4 | Basque | "Chatted in Basque with visitors at the quay café"',
].join("\n");

describe("EC-3a the input builder", () => {
  it("CI1: the four example requirements and entries give exactly the example block's input lines, in order, with no trailing newline", () => {
    const text = build(EXAMPLE_R, EXAMPLE_E);
    expect(text).toBe(EXAMPLE_BLOCK);
    expect(text.endsWith("\n")).toBe(false);
    expect(text).not.toContain("\n\n");
  });

  it("CI2: clipping: 301 letters a give 300; exactly 300 stays; a line of 241 gives 240 and 240 stays; 299 x, a space and y are cut at 300 and trimmed to the 299 x", () => {
    const first = (rs: SentRequirement[]) => build(rs, [E(1, "N", "line")]).split("\n")[1];
    expect(first([R(1, "a".repeat(301))])).toBe(`R1 "${"a".repeat(300)}"`);
    expect(first([R(1, "a".repeat(300))])).toBe(`R1 "${"a".repeat(300)}"`);
    expect(first([R(1, `${"x".repeat(299)} y`)])).toBe(`R1 "${"x".repeat(299)}"`); // 301 characters, cut at 300 (the space), trimmed
    const entryLine = (t: string) => build([R(1, "q")], [E(1, "N", t)]).split("\n")[3];
    expect(entryLine("b".repeat(241))).toBe(`E1 | N | "${"b".repeat(240)}"`);
    expect(entryLine("b".repeat(240))).toBe(`E1 | N | "${"b".repeat(240)}"`);
    expect([CHECK_MAX_REQUIREMENT_CHARS, CHECK_MAX_LINE_CHARS]).toEqual([300, 240]);
  });

  it("CI3: every run of whitespace (spaces, tabs, line breaks) becomes one space, and the text is trimmed: in a requirement, in a name and in a line", () => {
    const messy = "  two   spaces\tand\na newline ";
    const lines = build([R(1, messy)], [E(1, messy, messy)]).split("\n");
    expect(lines[1]).toBe('R1 "two spaces and a newline"');
    expect(lines[3]).toBe('E1 | two spaces and a newline | "two spaces and a newline"');
  });

  it("CI4: a double quote inside a text becomes a single quote", () => {
    expect(build([R(1, 'Said "hello" twice')], [E(1, 'N "x"', 'Said "hello" twice')]).split("\n")).toEqual([
      "Requirements:",
      "R1 \"Said 'hello' twice\"",
      "CV entries:",
      "E1 | N 'x' | \"Said 'hello' twice\"",
    ]);
  });

  it("CI5: the output never has [must], [nice] or 'inferred', even when the objects carry a must flag or inferred: true", () => {
    const text = build([R(1, "Needs SQL", "must"), R(2, "Likes Excel", "nice")], [E(1, "SQL", "Wrote SQL queries", true)]);
    expect(text).not.toMatch(/\[must\]|\[nice\]|inferred/i);
    expect(text).toBe(['Requirements:', 'R1 "Needs SQL"', 'R2 "Likes Excel"', 'CV entries:', 'E1 | SQL | "Wrote SQL queries"'].join("\n"));
  });

  it("CI6: 30 requirements and 120 entries pass; 31 requirements and 121 entries throw, always with the same fixed message that holds no input text", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => R(i + 1, `MARKER-6612 requirement ${i}`));
    const ents = (n: number) => Array.from({ length: n }, (_, i) => E(i + 1, "MARKER-6612", `MARKER-6612 line ${i}`));
    expect([CHECK_MAX_REQUIREMENTS, CHECK_MAX_ENTRIES]).toEqual([30, 120]);
    expect(() => build(many(30), ents(120))).not.toThrow();
    const messages = new Set<string>();
    for (const f of [() => build(many(31), ents(1)), () => build(many(1), ents(121)), () => build(many(31), ents(61))]) {
      try {
        f();
      } catch (e) {
        messages.add((e as Error).message);
      }
    }
    expect([...messages]).toHaveLength(1); // the same fixed text each time
    expect([...messages][0]).not.toContain("MARKER-6612");
    expect([...messages][0].length).toBeGreaterThan(10);
  });

  it("CI7: no requirement, or no entry, throws", () => {
    expect(() => build([], EXAMPLE_E)).toThrow();
    expect(() => build(EXAMPLE_R, [])).toThrow();
  });

  it("CI8: Straße, café and Müller come through unchanged, and the order of requirements and entries is kept", () => {
    const text = build([R(1, "Arbeit in der Straße"), R(2, "Kontakt mit Müller")], [E(1, "Café", "Servierte im café an der Straße"), E(2, "Müller", "Ging zu Müller")]);
    expect(text).toBe(
      ['Requirements:', 'R1 "Arbeit in der Straße"', 'R2 "Kontakt mit Müller"', 'CV entries:', 'E1 | Café | "Servierte im café an der Straße"', 'E2 | Müller | "Ging zu Müller"'].join("\n"),
    );
  });

  it("CI9: a name 'A | B' becomes 'A / B' (the separator cannot be faked); a | in a line or a requirement stays", () => {
    expect(build([R(1, "a | b")], [E(1, "A | B", "x | y")]).split("\n")).toEqual(["Requirements:", 'R1 "a | b"', "CV entries:", 'E1 | A / B | "x | y"']);
  });

  it("CI10: numbering is by position, from 1, whatever numbers the objects carry", () => {
    const text = build([R(7, "first"), R(3, "second")], [E(9, "N1", "l1"), E(4, "N2", "l2")]);
    expect(text.split("\n")).toEqual(["Requirements:", 'R1 "first"', 'R2 "second"', "CV entries:", 'E1 | N1 | "l1"', 'E2 | N2 | "l2"']);
  });
});
