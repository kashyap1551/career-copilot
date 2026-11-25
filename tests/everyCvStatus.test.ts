import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkEveryCvKey } from "@/lib/engine/evalEveryCvKey";
import { formatKeysStatus, loadPairKeys } from "@/lib/engine/evalEveryCvStatus";

// EC-0b part 2: the status of the keys (npm run every-cv:keys). Invented keys; every expected line is written by hand.

const AD = ["Alpha work is required.", "Beta work is required.", "Gamma work is required.", "Delta work is a plus.", "You are a reliable person."].join("\n");
const rb = (n: number, tag: string, quote: string, v = "", lines = "", unsure = "") =>
  `R${n} [${tag}] "${quote}"\nverdict:${v ? " " + v : ""}\ncv line(s):${lines ? " " + lines : ""}\nunsure:${unsure ? " " + unsure : ""}\nwhy:`;
const T = `T1 [trait, not counted] "You are a reliable person."`;
const mk = (v: string[], unsureAt = -1) =>
  [
    rb(1, "must", "Alpha work is required.", v[0], v[0] && v[0] !== "none" ? "2" : "", unsureAt === 0 ? "yes" : ""),
    rb(2, "must", "Beta work is required.", v[1], v[1] && v[1] !== "none" ? "2" : "", unsureAt === 1 ? "yes" : ""),
    rb(3, "must", "Gamma work is required.", v[2], v[2] && v[2] !== "none" ? "2" : ""),
    rb(4, "nice", "Delta work is a plus.", v[3], v[3] && v[3] !== "none" ? "2" : ""),
    T,
  ].join("\n\n");
const chk = (v: string[], unsureAt = -1) => checkEveryCvKey(mk(v, unsureAt), AD, 5);

describe("EC-0b part 2: the key status lines", () => {
  it("S1: ten blank keys: every row says blank, the spread is all zero, nothing weak is said, exit 0", () => {
    const pairs = Array.from({ length: 10 }, (_, i) => ({ id: `pair-${String(i + 1).padStart(2, "0")}`, check: chk(["", "", "", ""]) }));
    const r = formatKeysStatus(pairs, null);
    expect(r.text.split("\n")).toContain("pair-01  blank");
    expect(r.text.split("\n")).toContain("pair-10  blank");
    expect(r.text).toContain("Level spread over complete keys: Strong 0, Good 0, Stretch 0, Long shot 0");
    expect(r.text).not.toContain("would be weak");
    expect(r.exitCode).toBe(0);
  });

  it("S2: a half-filled key reads 'n of m answered' and does not list the missing verdicts as mistakes; exit 0", () => {
    const r = formatKeysStatus([{ id: "pair-03", check: chk(["met", "none", "", ""]) }], null);
    expect(r.text.split("\n")).toContain("pair-03  2 of 4 answered");
    expect(r.text).not.toContain("no verdict yet");
    expect(r.exitCode).toBe(0);
  });

  it("S3: a half-filled key with a typo shows the typo with its block number", () => {
    const r = formatKeysStatus([{ id: "pair-03", check: chk(["maybe", "none", "", ""]) }], null);
    expect(r.text).toContain("pair-03  2 of 4 answered  problems: R1: the verdict must be met, partly or none");
    expect(r.exitCode).toBe(0); // only a COMPLETE key with a problem is an error
  });

  it("S4: a complete key shows its level and unsure count: R1 met, R2 none, R3 partly = 2 missing = Stretch; one unsure row", () => {
    const r = formatKeysStatus([{ id: "pair-04", check: chk(["met", "none", "partly", "met"], 1) }], null);
    expect(r.text.split("\n")).toContain("pair-04  complete  level Stretch  unsure 1");
  });

  it("S5: a complete key with a problem lists the first 3 problems and makes the exit code 1", () => {
    const bad = checkEveryCvKey(mk(["met", "maybe", "met", "met"]).replace("cv line(s): 2", "cv line(s): 9"), AD, 5);
    const r = formatKeysStatus([{ id: "pair-05", check: bad }], null);
    expect(r.text).toMatch(/pair-05  complete  .*problems: R1: line 9 does not exist \(the CV has 5 lines\); R2: the verdict must be met, partly or none/);
    expect(r.exitCode).toBe(1);
  });

  it("S6: the spread counts the levels of the complete keys; more than three problems end with '(+n more)'", () => {
    const pairs = [
      { id: "pair-01", check: chk(["met", "met", "met", "met"]) }, // Strong
      { id: "pair-02", check: chk(["met", "partly", "met", "met"]) }, // Good
      { id: "pair-03", check: chk(["none", "partly", "met", "met"]) }, // Stretch
      { id: "pair-04", check: chk(["none", "none", "none", "met"]) }, // Long shot
      { id: "pair-05", check: chk(["met", "none", "", ""]) }, // not complete: not in the spread
    ];
    expect(formatKeysStatus(pairs, null).text).toContain("Level spread over complete keys: Strong 1, Good 1, Stretch 1, Long shot 1");
    const many = checkEveryCvKey(mk(["x1", "x2", "x3", "x4"]), AD, 5); // four bad verdict words: four problems
    expect(formatKeysStatus([{ id: "pair-09", check: many }], null).text).toContain("(+1 more)");
  });

  it("S7: all ten complete with fewer than three different levels: the weak-measure line is added", () => {
    const strong = Array.from({ length: 10 }, (_, i) => ({ id: `pair-${String(i + 1).padStart(2, "0")}`, check: chk(i < 5 ? ["met", "met", "met", "met"] : ["met", "partly", "met", "met"]) }));
    expect(formatKeysStatus(strong, null).text).toContain("The level measure would be weak: fewer than three different levels.");
    const varied = strong.map((p, i) => (i === 9 ? { ...p, check: chk(["none", "partly", "met", "met"]) } : p)); // Strong, Good, Stretch: three
    expect(formatKeysStatus(varied, null).text).not.toContain("would be weak");
    expect(formatKeysStatus(strong.slice(0, 9), null).text).not.toContain("would be weak"); // only when all ten are complete
  });

  it("S8: the example is shown on its own line, outside the ten, and is not in the spread", () => {
    const r = formatKeysStatus([{ id: "pair-01", check: chk(["", "", "", ""]) }], { id: "example", check: chk(["met", "partly", "none", "met"]) });
    expect(r.text).toContain("Example (format check, outside the ten): complete, level Stretch, no problems.");
    expect(r.text).toContain("Level spread over complete keys: Strong 0, Good 0, Stretch 0, Long shot 0");
  });
});

describe("EC-0b part 2: reading the keys from a folder", () => {
  it("S9: loadPairKeys reads cv.txt, ad.txt and key.txt of pair-NN folders and of example, in order, never the other way", () => {
    const root = mkdtempSync(join(tmpdir(), "every-cv-status-"));
    for (const [dir, key] of [["pair-02", mk(["met", "met", "met", "met"])], ["pair-01", mk(["", "", "", ""])], ["example", mk(["met", "none", "none", "met"])]] as const) {
      mkdirSync(join(root, dir));
      writeFileSync(join(root, dir, "cv.txt"), "Name\nline two\nline three\nline four\nline five\n");
      writeFileSync(join(root, dir, "ad.txt"), AD);
      writeFileSync(join(root, dir, "key.txt"), key);
    }
    const loaded = loadPairKeys((p) => readFileSync(p, "utf8"), root, ["pair-02", "pair-01", "example"]);
    expect(loaded.pairs.map((p) => p.id)).toEqual(["pair-01", "pair-02"]);
    expect(loaded.example?.id).toBe("example");
    expect(loaded.pairs[0].check.state).toBe("blank");
    expect(loaded.pairs[1].check.state).toBe("complete");
  });

  it("S10: the status code reads only key.txt, cv.txt and ad.txt and never writes (source guard)", () => {
    const src = readFileSync(join(process.cwd(), "lib/engine/evalEveryCvStatus.ts"), "utf8");
    expect(src).not.toMatch(/writeFile|appendFile|unlink|rmSync|mkdirSync/);
  });
});
