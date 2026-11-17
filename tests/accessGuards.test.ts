import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Step 6.1b source guards (docs/PLAN-ACCESS-CODE.md, section 5: P6 wiring, P7, P8). They read the source files.

const root = process.cwd();
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("P7: the code stays on the server and in the tab", () => {
  it("no client file under app/ imports lib/ai/accessCode (it uses node:crypto and is server only); only the routes under app/api/ may", () => {
    const bad = walk("app").filter((f) => !f.startsWith("app/api/") && /\.(ts|tsx)$/.test(f) && /ai\/accessCode/.test(read(f)));
    expect(bad).toEqual([]);
  });

  it("no source file mentions a NEXT_PUBLIC access variable", () => {
    const bad = [...walk("app"), ...walk("lib"), ...walk("scripts")].filter((f) => /NEXT_PUBLIC_ACCESS/.test(read(f)));
    expect(bad).toEqual([]);
  });

  it("app/accessFetch.ts uses neither localStorage nor indexedDB", () => {
    const src = read("app/accessFetch.ts");
    expect(src).not.toMatch(/localStorage/);
    expect(src).not.toMatch(/indexedDB/);
    expect(src).toMatch(/sessionStorage/);
  });
});

describe("P8: every route checks access", () => {
  it("every app/api/**/route.ts calls checkAccess( (the allow-list is empty)", () => {
    const routes = walk("app/api").filter((f) => /\/route\.ts$/.test(f));
    expect(routes.length).toBeGreaterThanOrEqual(2);
    const missing = routes.filter((f) => !read(f).includes("checkAccess("));
    expect(missing).toEqual([]);
  });
});

describe("P6 (wiring): the delete-everything click forgets the code", () => {
  it("app/SavedControls.tsx calls afterDeleteAll(", () => {
    expect(read("app/SavedControls.tsx")).toContain("afterDeleteAll(");
  });
});
