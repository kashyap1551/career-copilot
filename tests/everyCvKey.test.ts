import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { numberLines } from "@/lib/cv/numberLines";
import { removeContactDetails } from "@/lib/cv/redact";
import { checkEveryCvKey, everyCvKeyLevel } from "@/lib/engine/evalEveryCvKey";

// EC-0b, part 1 and 2 (docs/PLAN-EVERY-CV.md section 9): the state of a key, its problems, and the level of a complete key.
// Every key below is invented inline. Every expectation is worked out by hand (written in the comments), not read from the code.

const SENTENCES = [
  "Alpha work is required.", // R1
  "Beta work is required.", // R2
  "Gamma work is required.", // R3
  "Delta work is required.", // R4
  "Epsilon work is a plus.", // R5
  "Zeta work is a plus.", // R6
];
const TRAIT = "You are a reliable person.";
const AD = [...SENTENCES, TRAIT].join("\n");

type B = { tag?: "must" | "nice"; v?: string; lines?: string; unsure?: string; why?: string };
const block = (n: number, b: B) =>
  [
    `R${n} [${b.tag ?? "must"}] "${SENTENCES[n - 1]}"`,
    `verdict:${b.v ? " " + b.v : ""}`,
    `cv line(s):${b.lines ? " " + b.lines : ""}`,
    `unsure:${b.unsure ? " " + b.unsure : ""}`,
    `why:${b.why ? " " + b.why : ""}`,
  ].join("\n");
const keyOf = (bs: B[]) => [...bs.map((b, i) => block(i + 1, b)), `T1 [trait, not counted] "${TRAIT}"`].join("\n\n");
const check = (bs: B[], cvLines = 10) => checkEveryCvKey(keyOf(bs), AD, cvLines);
const said = (r: { problems: { block: string; sentence: string }[] }) => r.problems.map((p) => `${p.block}: ${p.sentence}`).join(" | ");

// four musts then two nice-to-haves, as the ad words them
const noLines = (x?: string) => !x || x.trim().toLowerCase() === "none";
const FOUR_MUST_TWO_NICE = (v: string[]): B[] => [
  { tag: "must", v: v[0], lines: noLines(v[0]) ? "" : "2" },
  { tag: "must", v: v[1], lines: noLines(v[1]) ? "" : "3" },
  { tag: "must", v: v[2], lines: noLines(v[2]) ? "" : "4" },
  { tag: "must", v: v[3], lines: noLines(v[3]) ? "" : "5" },
  { tag: "nice", v: v[4], lines: noLines(v[4]) ? "" : "6" },
  { tag: "nice", v: v[5], lines: noLines(v[5]) ? "" : "7" },
];

describe("EC-0b part 1: the state of a key (computed from its R blocks only)", () => {
  it("K1: no R block has a verdict: blank (0 of 6 answered)", () => {
    const r = check(FOUR_MUST_TWO_NICE(["", "", "", "", "", ""]));
    expect([r.state, r.answered, r.total]).toEqual(["blank", 0, 6]);
    expect(r.problems).toEqual([]);
  });

  it("K2: 3 of the 6 R blocks have a verdict: incomplete (3 of 6)", () => {
    const r = check(FOUR_MUST_TWO_NICE(["met", "none", "partly", "", "", ""]));
    expect([r.state, r.answered, r.total]).toEqual(["incomplete", 3, 6]);
    expect(said(r)).toContain("R4: no verdict");
  });

  it("K3: all 6 have a verdict and nothing is wrong: complete, no problems", () => {
    const r = check(FOUR_MUST_TWO_NICE(["met", "none", "partly", "met", "none", "met"]));
    expect([r.state, r.answered, r.total]).toEqual(["complete", 6, 6]);
    expect(r.problems).toEqual([]);
  });

  it("K4: a half-filled key with a bad verdict word is incomplete AND lists the problem", () => {
    const r = check(FOUR_MUST_TWO_NICE(["maybe", "met", "", "", "", ""]));
    expect(r.state).toBe("incomplete");
    expect(said(r)).toContain("R1: the verdict must be met, partly or none");
  });

  it("K5: a complete key can still have a problem (a bad word, a line past the end); it is complete WITH problems", () => {
    const r = check(FOUR_MUST_TWO_NICE(["met", "met", "met", "maybe", "none", "met"]), 6); // line 7 of R6 does not exist in a 6-line CV
    expect(r.state).toBe("complete");
    expect(said(r)).toContain("R4: the verdict must be met, partly or none");
    expect(said(r)).toContain("R6: line 7 does not exist (the CV has 6 lines)");
  });

  it("K6: every state lists problems: a blank key whose quote is not in the ad, and a blank key with a line but no verdict", () => {
    const wrongQuote = keyOf(FOUR_MUST_TWO_NICE(["", "", "", "", "", ""])).replace("Alpha work is required.", "Alpha work is optional.");
    const r = checkEveryCvKey(wrongQuote, AD, 10);
    expect(r.state).toBe("blank");
    expect(said(r)).toContain("R1: the quoted sentence is not in the ad");
    const lonely = check([{ lines: "3" }, {}, {}, {}, {}, {}]);
    expect(lonely.state).toBe("blank");
    expect(said(lonely)).toContain("R1: lines are cited but there is no verdict");
  });

  it("K7: capital letters and spaces in a verdict are forgiven ('Met ', 'PARTLY')", () => {
    const r = check(FOUR_MUST_TWO_NICE(["Met ", "PARTLY", "None", "met", "met", "met"]));
    expect([r.state, r.problems.length]).toEqual(["complete", 0]);
  });

  it("K8: the unsure rows are counted (yes) and anything else but empty is a problem", () => {
    const bs = FOUR_MUST_TWO_NICE(["met", "none", "partly", "met", "none", "met"]);
    bs[1].unsure = "yes";
    bs[2].unsure = "YES";
    expect(check(bs).unsureCount).toBe(2);
    bs[3].unsure = "perhaps";
    expect(said(check(bs))).toContain('R4: unsure must be empty or "yes"');
  });

  it("K9: a range and several lines are expanded; met needs a line, none must not cite one", () => {
    const r = check([{ v: "met", lines: "2, 4-6" }, { v: "none", lines: "3" }, { v: "partly" }, { v: "met", lines: "1" }, {}, {}]);
    expect(r.blocks[0].lines).toEqual([2, 4, 5, 6]);
    expect(said(r)).toContain("R2: a verdict of none cites no line");
    expect(said(r)).toContain("R3: partly needs at least one cited line");
  });

  it("K10: the example key of EC-0a is complete with no problems", () => {
    const dir = join(process.cwd(), "fixtures", "every-cv", "example");
    const cv = readFileSync(join(dir, "cv.txt"), "utf8");
    const r = checkEveryCvKey(readFileSync(join(dir, "key.txt"), "utf8"), readFileSync(join(dir, "ad.txt"), "utf8"), numberLines(removeContactDetails(cv)).length);
    expect([r.state, r.answered, r.total]).toEqual(["complete", 3, 3]);
    expect(r.problems).toEqual([]);
  });
});

describe("EC-0b part 2: the level of a complete key (the product's own fit rules)", () => {
  // Hand-worked: only [must] blocks count; partly and none both count as missing; nice and trait never count.
  // 0 missing = Strong, 1 = Good, 2 = Stretch, 3 or more = Long shot (lib/engine/fit.ts).
  const level = (v: string[]) => everyCvKeyLevel(check(FOUR_MUST_TWO_NICE(v)));

  it("L1: 4 musts met: Strong", () => expect(level(["met", "met", "met", "met", "met", "met"])).toBe("strong"));
  it("L2: one must partly (counts as missing): Good", () => expect(level(["met", "partly", "met", "met", "met", "met"])).toBe("good"));
  it("L3: one partly and one none: 2 missing: Stretch", () => expect(level(["partly", "met", "none", "met", "met", "met"])).toBe("stretch"));
  it("L4: three missing: Long shot", () => expect(level(["partly", "none", "none", "met", "met", "met"])).toBe("longShot"));
  it("L5: four missing: Long shot", () => expect(level(["none", "none", "none", "none", "met", "met"])).toBe("longShot"));
  it("L6: the nice-to-haves never count: all musts met and both nice none is still Strong", () => {
    expect(level(["met", "met", "met", "met", "none", "partly"])).toBe("strong");
  });
  it("L7: a trait never counts (the key above has one trait block and it is ignored)", () => {
    expect(check(FOUR_MUST_TWO_NICE(["met", "met", "met", "met", "met", "met"])).blocks.filter((b) => b.kind === "T")).toHaveLength(1);
  });
  it("L8: a key with no must block gives 'no-level'", () => {
    const bs: B[] = [{ tag: "nice", v: "met", lines: "2" }, { tag: "nice", v: "none" }];
    const text = [block(5, bs[0]).replace("R5", "R1"), block(6, bs[1]).replace("R6", "R2")].join("\n\n");
    const r = checkEveryCvKey(text, AD, 10);
    expect(r.state).toBe("complete");
    expect(everyCvKeyLevel(r)).toBe("no-level");
  });
  it("L9: a blank or incomplete key gives no level (null)", () => {
    expect(level(["", "", "", "", "", ""])).toBeNull();
    expect(level(["met", "met", "", "", "", ""])).toBeNull();
  });
  it("L10: a complete key with a problem gives no level (null)", () => {
    expect(level(["met", "met", "met", "maybe", "met", "met"])).toBeNull();
  });
  it("L11: the level comes from the product's own fit function, not a copy of its rules (source guard)", () => {
    const src = readFileSync(join(process.cwd(), "lib/engine/evalEveryCvKey.ts"), "utf8");
    expect(src).toMatch(/from "\.\/fit"/);
    expect(src).toMatch(/fitLevel\(/);
  });
});
