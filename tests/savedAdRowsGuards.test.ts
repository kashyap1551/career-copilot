import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Step 6.2 source guards (docs/PLAN-6.2.md section 6: L17 and the wiring guards). They read the source files.

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const rowsSrc = read("app/savedAdRows.ts");
const controls = read("app/SavedControls.tsx");
const listPart = controls.slice(controls.indexOf("export function SavedAdsList"));
const page = read("app/page.tsx");

describe("L17: 6.2 never writes its own label", () => {
  const LABEL_WORDS = ["Strong", "Good", "Stretch", "Long shot", "No level (", "not judged"];
  for (const [name, src] of [["app/savedAdRows.ts", rowsSrc], ["the list part of app/SavedControls.tsx", listPart]] as const) {
    it(`${name} contains no label string`, () => {
      for (const w of LABEL_WORDS) expect(src, `${name} must not contain "${w}"`).not.toContain(w);
    });
  }
});

describe("the list only reads: no save, delete, fetch or storage in the row code", () => {
  it("app/savedAdRows.ts calls no save or delete function, no fetch, no storage", () => {
    for (const w of ["saveJob", "saveProfile", "deleteJob", "deleteProfile", "deleteAll", "loadProfile", "loadJob", "listJobs", "fetch(", ".put(", ".delete(", "indexedDB", "localStorage", "sessionStorage", "useEffect"]) {
      expect(rowsSrc, `app/savedAdRows.ts must not contain "${w}"`).not.toContain(w);
    }
  });

  it("the list component has no effect, and deleteJob appears only in its click handler onDeleteAd", () => {
    expect(listPart).not.toContain("useEffect");
    const handler = listPart.slice(listPart.indexOf("async function onDeleteAd"), listPart.indexOf("return ("));
    expect(handler).toContain("deleteJob(");
    expect(listPart.split("deleteJob(").length - 1).toBe(1);
    for (const w of ["saveJob(", "saveProfile(", "deleteProfile(", "deleteAll("]) expect(listPart).not.toContain(w);
  });
});

describe("the list and the report get the SAME profile (docs/PLAN-6.2.md section 2)", () => {
  it("app/page.tsx has exactly one `profile = savedBuilt ?? built`, passes it to the list, and its report uses reportFor", () => {
    expect(page.split("const profile = savedBuilt ?? built;").length - 1).toBe(1);
    expect(page).toMatch(/<SavedAdsList[^>]*profile=\{profile\}/);
    expect(page).toContain("reportFor(");
    expect(page).toContain("skillsOnlyReport(result.job"); // with no profile in use the report is still the typed-list one
  });

  it("the list recomputes when the profile in use changes: its rows memo depends on `profile`", () => {
    expect(listPart).toMatch(/useMemo\(\(\) => rankedAdRows\([^)]*\), \[[^\]]*\bprofile\b[^\]]*\]\)/);
  });

  it("the list never reads the stored profile record", () => {
    expect(listPart).not.toContain("state.record");
    expect(listPart).not.toContain("loadProfile");
  });
});
