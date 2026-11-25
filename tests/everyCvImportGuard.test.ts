import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// EC-2 part 0 (docs/PLAN-EVERY-CV.md section 10): the accuracy-test modules (lib/engine/evalEveryCv*) are tooling. No file under app/ or lib/ outside
// lib/engine/eval*, and no route, imports one; they are imported only by scripts/, tests/ and each other. Source guard, plain text.

const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(join(root, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(n) ? [rel] : [];
  });

// An import, an export-from or a dynamic import that names an evalEveryCv module (comment lines are skipped).
export const importsEveryCv = (src: string): boolean =>
  src.split("\n").some((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && /(\bfrom\s+["'][^"']*evalEveryCv|\bimport\s*\(\s*["'][^"']*evalEveryCv|^\s*import\s+["'][^"']*evalEveryCv)/.test(l));

describe("EC-2 part 0: nothing in the product imports the accuracy-test modules", () => {
  it("G1: the checker itself: it sees a static import, a dynamic import and an export-from, and it ignores a comment", () => {
    expect(importsEveryCv('import { x } from "@/lib/engine/evalEveryCvKey";')).toBe(true);
    expect(importsEveryCv('const m = await import("../lib/engine/evalEveryCvRun");')).toBe(true);
    expect(importsEveryCv('export { y } from "./evalEveryCvSave";')).toBe(true);
    expect(importsEveryCv('import "./evalEveryCvGuard";')).toBe(true);
    expect(importsEveryCv("// see lib/engine/evalEveryCvKey.ts and import from it later")).toBe(false);
    expect(importsEveryCv('import { z } from "@/lib/engine/fit";')).toBe(false);
  });

  it("G2: no file under app/ or lib/ outside lib/engine/eval*, and no route, imports an evalEveryCv module", () => {
    const files = [...walk("app"), ...walk("lib")].filter((f) => !/^lib\/engine\/eval[A-Za-z]*\.ts$/.test(f));
    expect(files.length).toBeGreaterThan(50);
    const bad = files.filter((f) => importsEveryCv(readFileSync(join(root, f), "utf8")));
    expect(bad).toEqual([]);
    // the one place the plan names: a route
    for (const f of files.filter((x) => /^app\/api\/.*route\.ts$/.test(x))) expect(readFileSync(join(root, f), "utf8"), f).not.toMatch(/evalEveryCv/);
  });
});
