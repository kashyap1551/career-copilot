import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// `npm run map-measure` end to end on a made-up labels file (no real name, no AI call). The expected counts are worked
// out by hand with the real vocabulary:
//   Excel (exact, label excel) right | Tableu (close, 6 letters, label tableau) right | Pyhton (close, label python) right
//   Team player (flagged, label not-a-skill) right | Origami (none, label none) right | Zymurgy (none) right
//   MSSQL labelled mysql: stage 1 maps it to sql-server (an exact alias): a wrong merge AND a must-not-merge hit
// So |L| 7, |M| 4, right 6 (of M: 3), wrong 1, must-not-merge 1. The wrong line allows floor(5 x 7 / 100) = 0: FAIL.
// Recall 4 x 3 >= 3 x 4 (12 >= 12): PASS. Must-not-merge 0: FAIL. Verdict FAIL.

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
      names: { Excel: "excel", Tableu: "tableau", Pyhton: "python", "Team player": "not-a-skill", Origami: "none", Zymurgy: "none", MSSQL: "mysql" },
    }),
  );
  fs.writeFileSync(other, JSON.stringify({ set: "holdout", names: { Excel: "excel", Origami: "none" } }));
  const dir = path.join(tmp, "out");

  it("S1: counts only, hand-worked, no name in the output; the holdout is informational", () => {
    const r = run(dir, fresh, other);
    expect(r.status).toBe(0);
    const text = r.stdout;
    for (const secret of ["Excel", "Tableu", "Pyhton", "Team player", "Origami", "Zymurgy", "MSSQL"]) expect(text).not.toContain(secret);
    expect(text).toContain("|L| 7 | |M| 4 | right 6 (of M: 3) | wrong 1 (wrong merges 1, wrongly flagged 0)");
    expect(text).toContain("must-not-merge 1");
    expect(text).toContain("wrong <= floor(5 x 7 / 100) = 0 (|L| 7, trait not flagged 0, size used 7): wrong 1: FAIL");
    expect(text).toContain("recall 4 x 3 >= 3 x 4: PASS");
    expect(text).toContain("must-not-merge 0: 1: FAIL");
    expect(text).toContain("VERDICT: FAIL");
    expect(text).toMatch(/SET holdout \(not judged/);
    expect(text.match(/VERDICT/g)?.length).toBe(1); // only the fresh set has a verdict
    expect(text).toMatch(/vocab [0-9a-f]{10}/);
    expect(text).not.toContain("%");
  });

  it("S2: the names of the wrong item went to the detail file and the run to the log", () => {
    const detail = JSON.parse(fs.readFileSync(path.join(dir, "map-measure-detail.json"), "utf8"));
    expect(detail.rows.map((x: { name: string; kind: string }) => [x.name, x.kind])).toEqual([["MSSQL", "wrong"]]);
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

  it("S6: a trait name left neither flagged nor mapped is in |L| but not in the size used for the limit, and the line shows both", () => {
    const names: Record<string, string> = {};
    const ids: [string, string][] = [
      ["SQL", "sql"], ["Excel", "excel"], ["Python", "python"], ["Tableau", "tableau"], ["Git", "git"], ["React", "react"],
      ["Jest", "jest"], ["Vitest", "vitest"], ["Docker", "docker"], ["Kubernetes", "kubernetes"], ["Scrum", "scrum"],
      ["Agile", "agile"], ["Kanban", "kanban"], ["Jira", "jira"], ["Figma", "figma"], ["Rust", "rust"], ["Java", "java"],
      ["Linux", "linux"], ["Angular", "angular"],
    ];
    for (const [n, id] of ids) names[n] = id; // 19 exact names, all right
    names["Curious soul"] = "not-a-skill"; // not on the list, maps to nothing: a trait that was not flagged
    const f = path.join(tmp, "traits.json");
    fs.writeFileSync(f, JSON.stringify({ set: "fresh", names }));
    const r = run(path.join(tmp, "out3"), f);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("|L| 20 | |M| 19 | right 19 (of M: 19) | wrong 0 (wrong merges 0, wrongly flagged 0) | not mapped 0 (ties 0, none 0) | trait not flagged 1 | must-not-merge 0");
    expect(r.stdout).toContain("wrong <= floor(5 x 19 / 100) = 0 (|L| 20, trait not flagged 1, size used 19): wrong 0: PASS");
    expect(r.stdout).toContain("VERDICT: PASS");
    expect(r.stdout).not.toContain("Curious soul");
  });

  it("S7: a labels file that still contains TODO is refused, and no name is printed", () => {
    const todo = path.join(tmp, "todo.json");
    fs.writeFileSync(todo, JSON.stringify({ set: "fresh", names: { SecretName: "TODO", Excel: "excel", Another: "TODO" } }));
    const r = run(path.join(tmp, "out4"), todo);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("2 name(s) are still labelled TODO");
    expect(r.stderr + r.stdout).not.toContain("SecretName");
    expect(r.stderr + r.stdout).not.toContain("Another");
    expect(fs.existsSync(path.join(tmp, "out4"))).toBe(false); // nothing measured, nothing logged
  });

  it("S5: no labels file: usage, exit 1", () => {
    expect(run(dir).status).toBe(1);
  });
});
