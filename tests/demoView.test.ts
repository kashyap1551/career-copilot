import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type * as MessagesModule from "@/lib/demo/messages";

// Step 9.1, demo mode (docs/PLAN-9.1.md, revision 2): tests V1 to V6 of section 6, written BEFORE any code (stage 2 of Day 9).
// Source guards, as tests/savedAdRowsGuards.test.ts does: vitest has no browser here and no new package is allowed (A8).
// Each test reads the files it needs inside the test, so a missing file fails that test alone.
const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const load = async <T>(spec: string): Promise<T> => (await import(/* @vite-ignore */ spec)) as T;

// The files the plan names for the demo (section 4). data.ts holds the ad texts, which may use any word.
const DEMO_FILES = ["app/demo/layout.tsx", "app/demo/page.tsx", "app/DemoEntry.tsx", "lib/demo/data.ts", "lib/demo/start.ts", "lib/demo/messages.ts"];
// Every file under app/demo and lib/demo, plus app/DemoEntry.tsx (a file the build stage adds is also guarded).
function demoSources(): { rel: string; src: string }[] {
  const out: string[] = ["app/DemoEntry.tsx"];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else out.push(rel);
    }
  };
  walk("app/demo");
  walk("lib/demo");
  return out.map((rel) => ({ rel, src: read(rel) }));
}

describe("the demo screens and what the source may contain (PLAN-9.1 sections 2.4, 2.5, 6; A1 to A3)", () => {
  // V1 (section 6, section 2.5): the banner is rendered by the demo layout, so every demo page has it.
  it("V1: app/demo/layout.tsx renders DEMO_BANNER and the exit link; app/demo/page.tsx renders DEMO_PREPARED", () => {
    const layout = read("app/demo/layout.tsx");
    expect(layout).toContain("DEMO_BANNER");
    expect(layout).toContain("DEMO_EXIT");
    expect(layout).toContain("{children}");
    expect(read("app/demo/page.tsx")).toContain("DEMO_PREPARED");
  });

  // V2 (section 6, A3): the exact words.
  it("V2: the labels are the exact words of section 2.5 and A3", async () => {
    const m = await load<typeof MessagesModule>("@/lib/demo/messages");
    expect(m.DEMO_BANNER).toBe("Demo: invented data. The person, the CV and the ten job ads are made up. Nothing you do here is saved or sent anywhere.");
    expect(m.DEMO_PREPARED).toBe(
      "The AI readings in this demo were prepared in advance and are part of this page. No AI is used here, and nothing you do in the demo is sent anywhere. The live version reads your own CV and ads with AI.",
    );
    expect(m.DEMO_ENTRY).toBe("Try a demo with invented data");
    expect(m.DEMO_ENTRY_HINT).toBe("No upload and no access code. About one minute.");
    expect(m.DEMO_EXIT).toBe("Leave the demo");
    expect(m.DEMO_TRY).toBe("Untick a skill below and watch the fit levels change.");
    expect(m.DEMO_LOADING).toBe("Preparing the demo ...");
    // A3: no label claims that no request is made for the page as a whole.
    for (const text of [m.DEMO_BANNER, m.DEMO_PREPARED, m.DEMO_ENTRY_HINT, m.DEMO_TRY]) expect(text).not.toMatch(/no request is made/i);
  });

  // V3 (section 6, section 2.4): one entry link with prefetch off, shown whatever the state; one exit link.
  it("V3: DemoEntry.tsx has exactly one href=\"/demo\" with prefetch={false}; app/page.tsx renders <DemoEntry /> once, not inside a condition; the demo layout has exactly one href=\"/\"", () => {
    const entry = read("app/DemoEntry.tsx");
    expect(entry.split('href="/demo"').length - 1).toBe(1);
    expect(entry).toContain("prefetch={false}");
    expect(entry).toContain("DEMO_ENTRY");
    const page = read("app/page.tsx");
    const lines = page.split("\n");
    const at = lines.map((l, i) => (l.includes("<DemoEntry") ? i : -1)).filter((i) => i >= 0);
    expect(at.length).toBe(1);
    expect(page).toContain('import DemoEntry from "./DemoEntry"');
    const before = lines[at[0]].slice(0, lines[at[0]].indexOf("<DemoEntry"));
    const previous = lines.slice(0, at[0]).reverse().find((l) => l.trim() !== "") ?? "";
    expect(before).not.toMatch(/&&|\?/);
    expect(previous).not.toMatch(/&&\s*\(?\s*$|\?\s*\(?\s*$/);
    const layout = read("app/demo/layout.tsx");
    expect(layout.split('href="/"').length - 1).toBe(1);
  });

  // V4 (section 6): no save, no storage, no network, no AI library in the source of the demo.
  it("V4: no demo file contains fetch(, XMLHttpRequest, sendBeacon, indexedDB, sessionStorage, localStorage, a save or delete function, a save button, postJson, or an import of lib/ai, useSaved (as a value) or accessFetch", () => {
    for (const f of DEMO_FILES) expect(existsSync(join(root, f)), `${f} exists`).toBe(true);
    const FORBIDDEN = [
      "fetch(", "XMLHttpRequest", "sendBeacon", "indexedDB", "sessionStorage", "localStorage",
      "saveProfile", "deleteProfile", "deleteAll", "createIdbStore", "postJson",
      "SaveAdButton", "SaveProfileButton", "SavedDeleteAll", "SavedOffer",
    ];
    for (const { rel, src } of demoSources()) {
      for (const w of FORBIDDEN) expect(src, `${rel} must not contain "${w}"`).not.toContain(w);
      expect(src, `${rel} must not import lib/ai`).not.toMatch(/lib\/ai\//);
      expect(src, `${rel} must not import accessFetch`).not.toMatch(/accessFetch/);
      for (const line of src.split("\n").filter((l) => l.includes("useSaved"))) {
        expect(line.trimStart().startsWith("import type"), `${rel}: useSaved only as a type: ${line}`).toBe(true);
      }
    }
  });

  // V5 (section 6, section 2.3): the demo owns no counting or labelling code; it calls the page's own functions.
  it("V5: the demo screens contain no level word and import none of the counting engine modules, and the page calls reportFor, roadmapBoxSafe, roadmapAds, openedReadings and buildProfile", () => {
    const screens = demoSources().filter((s) => s.rel !== "lib/demo/data.ts" && s.rel !== "lib/demo/messages.ts");
    expect(screens.length).toBeGreaterThanOrEqual(4);
    for (const { rel, src } of screens) {
      for (const w of ["Strong", "Good", "Stretch", "Long shot", "ROADMAP_FROM_JOBS", "KIND_WORDS"]) {
        expect(src, `${rel} must not contain "${w}"`).not.toContain(w);
      }
      for (const m of ["engine/match", "engine/unlock", "engine/gaps", "engine/fit", "engine/rules", "engine/explain"]) {
        expect(src, `${rel} must not import ${m}`).not.toContain(m);
      }
    }
    const page = read("app/demo/page.tsx");
    for (const fn of ["reportFor", "roadmapBoxSafe", "roadmapAds", "openedReadings", "buildProfile"]) {
      expect(page, `app/demo/page.tsx calls ${fn}`).toContain(fn);
    }
  });

  // V6 (section 6, decision 6): the list can be read-only; the real page does not pass the prop.
  it("V6: SavedAdsList takes readOnly (default false) and guards its Delete button with it; app/page.tsx does not pass readOnly; the demo page does", () => {
    const controls = read("app/SavedControls.tsx");
    const list = controls.slice(controls.indexOf("export function SavedAdsList"));
    expect(list).toMatch(/readOnly\s*=\s*false/);
    const del = list.indexOf("onDeleteAd(r.id)");
    expect(del).toBeGreaterThan(0);
    expect(list.slice(Math.max(0, del - 300), del)).toContain("readOnly");
    expect(read("app/page.tsx")).not.toContain("readOnly");
    expect(read("app/demo/page.tsx")).toMatch(/readOnly/);
  });
});
