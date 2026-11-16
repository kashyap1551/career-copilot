import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// `npm run map-measure` end to end on a made-up labels file (no real name, no AI call). The expected counts are worked
// out by hand with the real vocabulary:
//   Excel (exact, label excel) right | Excell (close) right | Pyhton (close, label python) right
//   Team player (flagged, label not-a-skill) right | Origami (none, label none) right | Zymurgy (none) right
//   Shift (close to Swift, label none): a wrong merge AND a must-not-merge hit (the word "shift" must not become Swift)
// So |L| 7, |M| 3, right 6, wrong 1, must-not-merge 1. The wrong line allows floor(5 x 7 / 100) = 0: FAIL.
// Recall 4 x 3 >= 3 x 3: PASS. Must-not-merge 0: FAIL. Verdict FAIL.

const run = (dir: string, ...files: string[]) =>
  spawnSync("npx", ["tsx", "scripts/mapMeasure.ts", ...files], {
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", MAP_MEASURE_DIR: dir } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 90000,
  });

describe("scripts/mapMeasure.ts", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "map-measure-"));
  const fresh = path.join(tmp, "fresh.json");
  const other = path.join(tmp, "other.json");
  fs.writeFileSync(
    fresh,
    JSON.stringify({
      set: "fresh",
      names: { Excel: "excel", Excell: "excel", Pyhton: "python", "Team player": "not-a-skill", Origami: "none", Zymurgy: "none", Shift: "none" },
    }),
  );
  fs.writeFileSync(other, JSON.stringify({ set: "holdout", names: { Excel: "excel", Origami: "none" } }));
  const dir = path.join(tmp, "out");

  it("S1: counts only, hand-worked, no name in the output; the holdout is informational", () => {
    const r = run(dir, fresh, other);
    expect(r.status).toBe(0);
    const text = r.stdout;
    for (const secret of ["Excel", "Excell", "Pyhton", "Team player", "Origami", "Zymurgy", "Shift"]) expect(text).not.toContain(secret);
    expect(text).toContain("|L| 7 | |M| 3 | right 6 (of M: 3) | wrong 1 (wrong merges 1, wrongly flagged 0)");
    expect(text).toContain("must-not-merge 1");
    expect(text).toContain("wrong <= floor(5 x 7 / 100) = 0: wrong 1: FAIL");
    expect(text).toContain("recall 4 x 3 >= 3 x 3: PASS");
    expect(text).toContain("must-not-merge 0: 1: FAIL");
    expect(text).toContain("VERDICT: FAIL");
    expect(text).toMatch(/SET holdout \(not judged/);
    expect(text.match(/VERDICT/g)?.length).toBe(1); // only the fresh set has a verdict
    expect(text).toMatch(/vocab [0-9a-f]{10}/);
    expect(text).not.toContain("%");
  });

  it("S2: the names of the wrong item went to the detail file and the run to the log", () => {
    const detail = JSON.parse(fs.readFileSync(path.join(dir, "map-measure-detail.json"), "utf8"));
    expect(detail.rows.map((x: { name: string; kind: string }) => [x.name, x.kind])).toEqual([["Shift", "wrong"]]);
    const log = fs.readFileSync(path.join(dir, "map-measure-log.txt"), "utf8").trim().split("\n");
    expect(log.map((l) => l.split(" | ")[0])).toEqual(["fresh", "holdout"]);
  });

  it("S3: measuring the same set again with the same vocabulary prints the RE-RUN note", () => {
    const r = run(dir, fresh);
    expect(r.stdout).toContain("fresh: RE-RUN: this set was already measured with this vocabulary on");
  });

  it("S4: a bad label stops the run without printing a name", () => {
    const bad = path.join(tmp, "bad.json");
    fs.writeFileSync(bad, JSON.stringify({ set: "fresh", names: { SecretName: "not-a-real-id" } }));
    const r = run(path.join(tmp, "out2"), bad);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("1 label(s) are not a skill id");
    expect(r.stderr + r.stdout).not.toContain("SecretName");
  });

  it("S5: no labels file: usage, exit 1", () => {
    expect(run(dir).status).toBe(1);
  });
});
