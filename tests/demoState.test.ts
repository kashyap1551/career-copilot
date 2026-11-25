import { afterEach, describe, expect, it, vi } from "vitest";
import { roadmapAds, roadmapBoxSafe } from "@/app/roadmap";
import { openedReadings } from "@/app/savedAdRows";
import { skills } from "@/fixtures/skills";
import { buildProfile, type ConfirmState } from "@/lib/cv/profile";
import { buildJob } from "@/lib/engine/fromAd";
import { fromCv } from "@/lib/engine/fromCv";
import { openJob } from "@/lib/saved/openJob";
import { listJobs, loadJob, loadProfile, saveJob, saveProfile, type SavedContext } from "@/lib/saved/saved";
import { MemoryStore } from "@/lib/saved/store";
import { ad1, ad2, person } from "./support/roadmapFixtures";
import type * as DataModule from "@/lib/demo/data";
import type * as StartModule from "@/lib/demo/start";

// Step 9.1, demo mode (docs/PLAN-9.1.md, revision 2): tests S1 to S5 of section 6, written BEFORE any code (stage 2 of Day 9).
// The modules lib/demo/data and lib/demo/start do not exist yet: they are loaded inside each test, so a missing module fails
// that test alone. The interface used here (proposed to the build stage):
//   startDemo(): Promise<{ cv: { lines: string[]; result: CvBuildResult }; ctx: SavedContext; ads: SavedJob[] }>   (no argument)
//   DEMO_CV_LINES, DEMO_EXTRACTED_CV, DEMO_ADS: { title; company; text; extraction }[]   (see tests/demoData.test.ts)
const load = async <T>(spec: string): Promise<T> => (await import(/* @vite-ignore */ spec)) as T;
const data = () => load<typeof DataModule>("@/lib/demo/data");
const start = () => load<typeof StartModule>("@/lib/demo/start");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const confirmWith = (keptIds: string[]): ConfirmState => ({
  keptIds, added: [], inProgress: [], languages: [], cities: "Berlin", workModes: [], years: "", availableFrom: "",
});

// What a visitor can do in the demo: tick and untick a skill, open every ad, see the box. Everything runs in the browser.
async function exercise(demo: Awaited<ReturnType<typeof StartModule.startDemo>>) {
  for (const kept of [["sql", "tableau", "excel"], ["sql", "excel"], ["sql", "tableau", "excel"]]) {
    const built = buildProfile(demo.cv.lines, demo.cv.result.skills, confirmWith(kept), skills);
    roadmapBoxSafe(built, roadmapAds(openedReadings(demo.ads, { stamps: demo.ctx.stamps, skills })), skills);
  }
  for (const ad of demo.ads) {
    const loaded = await loadJob(demo.ctx, ad.id);
    if (loaded.ok && loaded.job) openJob(loaded.job, { stamps: demo.ctx.stamps, skills });
  }
}

// An object that counts every property read on it (a stand-in for indexedDB, sessionStorage, localStorage).
function counting(hits: string[], name: string) {
  return new Proxy({}, { get: (_t, p) => (hits.push(`${name}.${String(p)}`), undefined) });
}

describe("what the demo does with the network and the browser's storage (PLAN-9.1 sections 2.3, 6; A1, A2)", () => {
  // S1 (section 6, A1): no call by our code to fetch, XMLHttpRequest or sendBeacon.
  it("S1: after startDemo, an untick, an open of every ad and the box, fetch, XMLHttpRequest and sendBeacon were called 0 times", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    let xhr = 0;
    let beacon = 0;
    vi.stubGlobal("XMLHttpRequest", class { constructor() { xhr++; } });
    vi.stubGlobal("navigator", { sendBeacon: () => (beacon++, true) });
    const { startDemo } = await start();
    const demo = await startDemo();
    await exercise(demo);
    expect([fetchSpy.mock.calls.length, xhr, beacon]).toEqual([0, 0, 0]);
  });

  // S2 (section 6, A2): no read of indexedDB, sessionStorage or localStorage.
  it("S2: over the same run, indexedDB, sessionStorage and localStorage were touched 0 times", async () => {
    const hits: string[] = [];
    for (const name of ["indexedDB", "sessionStorage", "localStorage"]) vi.stubGlobal(name, counting(hits, name));
    const { startDemo } = await start();
    const demo = await startDemo();
    await exercise(demo);
    expect(hits).toEqual([]);
  });

  // S3 (section 6, section 2.3): only its own memory store; ten writes by hand count; no profile.
  it("S3: the context's store is a MemoryStore with 10 writes (the ten saveJob puts), still 10 after every untick and open, and no profile", async () => {
    const { startDemo } = await start();
    const demo = await startDemo();
    expect(demo.ctx.store).toBeInstanceOf(MemoryStore);
    const store = demo.ctx.store as MemoryStore;
    expect(store.writes).toBe(10);
    await exercise(demo);
    expect(store.writes).toBe(10);
    expect(await store.list("profile")).toEqual([]);
    expect((await store.list("jobs")).length).toBe(10);
  });

  // S4 (section 6, section 2.3 "takes NO argument"): the person's own data is untouched.
  it("S4: a second store standing for the person's own (a profile and two ads) is unchanged after startDemo, and startDemo takes no argument", async () => {
    const own: SavedContext = {
      store: new MemoryStore(),
      stamps: { vocabularyHash: "own-vocab", readingVersion: "own-reading", adRequestHash: "own-ad" },
      now: () => new Date("2026-11-20T09:00:00Z"),
    };
    const reading = (job: ReturnType<typeof ad1>) => ({ job, removed: [], moved: [], unlisted: [], notCounted: [] });
    expect((await saveProfile(own, person())).ok).toBe(true);
    expect((await saveJob(own, { adText: "own ad one", extraction: null, reading: reading(ad1()) })).ok).toBe(true);
    expect((await saveJob(own, { adText: "own ad two", extraction: null, reading: reading(ad2()) })).ok).toBe(true);
    const store = own.store as MemoryStore;
    const before = { writes: store.writes, jobs: await listJobs(own), profile: await loadProfile(own) };
    expect(before.writes).toBe(3); // hand count: one profile and two ads
    const { startDemo } = await start();
    expect(startDemo.length).toBe(0);
    await exercise(await startDemo());
    expect(store.writes).toBe(3);
    expect(await listJobs(own)).toEqual(before.jobs);
    expect(await loadProfile(own)).toEqual(before.profile);
  });

  // S5 (section 6, section 2.1 "The seam is the engine's"): the demo readings are what buildJob and fromCv give.
  it("S5: each stored reading equals buildJob on the bundled extraction, and the CV result equals fromCv", async () => {
    const d = await data();
    const { startDemo } = await start();
    const demo = await startDemo();
    expect(demo.ads.length).toBe(10);
    d.DEMO_ADS.forEach((ad, i) => {
      const r = buildJob(ad.extraction, ad.text, skills, { id: "pasted-ad", source: null });
      expect(demo.ads[i].reading, `ad ${i + 1}`).toEqual({ job: r.job, removed: r.removed, moved: r.moved, unlisted: r.unlisted, notCounted: r.notCounted });
      expect(demo.ads[i].extraction, `ad ${i + 1} extraction`).toEqual(ad.extraction);
      expect(demo.ads[i].adText, `ad ${i + 1} text`).toBe(ad.text.trim());
    });
    expect(demo.cv.lines).toEqual(d.DEMO_CV_LINES);
    expect(demo.cv.result).toEqual(fromCv(d.DEMO_EXTRACTED_CV, d.DEMO_CV_LINES, skills));
  });
});
