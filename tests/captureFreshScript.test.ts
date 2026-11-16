import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// `npm run capture-fresh` refuses before any AI call, on made-up files in a temporary folder (FRESH_DIR). Its real run
// needs fresh-*.txt ads that do not exist yet, so only the refusals are tested here.

const run = (dir: string, env: Record<string, string> = {}) =>
  spawnSync("npx", ["tsx", "scripts/captureFresh.ts"], {
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", FRESH_DIR: dir, ...env } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 90000,
  });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "capture-fresh-"));

describe("scripts/captureFresh.ts", () => {
  it("C1: no fresh-*.txt ads: says so, exit 0, nothing read", () => {
    const r = run(tmp());
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("No fresh ads");
  });

  it("C2: with an ad but without the two guard variables: refused, exit 1, nothing printed to stdout", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "fresh-a.txt"), "Some made-up ad text");
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refused: EXPECT_AD_HASH and EXPECT_AD_LEN must be set/);
    expect(r.stdout).toBe("");
  });

  it("C3: an existing fresh-labels-TODO.json or fresh-labels.json is never overwritten: refused even with the guards set", () => {
    for (const existing of ["fresh-labels-TODO.json", "fresh-labels.json"]) {
      const dir = tmp();
      fs.writeFileSync(path.join(dir, "fresh-a.txt"), "Some made-up ad text");
      fs.writeFileSync(path.join(dir, existing), "{}");
      const r = run(dir, { EXPECT_AD_HASH: "85357f8fac", EXPECT_AD_LEN: "3347", GROQ_API_KEY: "dummy", GROQ_MODEL: "dummy" });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain(`${existing} already exists`);
      expect(fs.readFileSync(path.join(dir, existing), "utf8")).toBe("{}"); // untouched
    }
  });

  it("C4: a wrong request hash or prompt size is refused before any text is sent", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "fresh-a.txt"), "Some made-up ad text");
    const r = run(dir, { EXPECT_AD_HASH: "0000000000", EXPECT_AD_LEN: "1", GROQ_API_KEY: "dummy", GROQ_MODEL: "dummy" });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Refused: ad request hash is/);
    expect(fs.readdirSync(dir)).toEqual(["fresh-a.txt"]); // nothing written
  });
});
