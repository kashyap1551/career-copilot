import { afterEach, describe, expect, it, vi } from "vitest";
import { jobs as fixtureJobs } from "@/fixtures/jobs";
import { profiles as fixtureProfiles } from "@/fixtures/profiles";
import { skills } from "@/fixtures/skills";
import { buildProfile, type ConfirmState } from "@/lib/cv/profile";
import { MAX_CV_LINES } from "@/lib/cv/limits";
import { buildJob } from "@/lib/engine/fromAd";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job } from "@/lib/engine/types";
import type { ExtractedAd } from "@/lib/schemas/job";
import { jobIdFor } from "@/lib/saved/jobId";
import { builtFromSaved, savedFromBuilt, sparseCvLines } from "@/lib/saved/profile";
import {
  deleteAll, deleteJob, listJobs, loadJob, loadProfile, saveJob, saveProfile, type SavedContext,
} from "@/lib/saved/saved";
import { MemoryStore, StoreError, type KeyValueStore } from "@/lib/saved/store";
import type { CurrentStamps } from "@/lib/saved/types";

// Step 6.1, part 1b: four fixes. The expectations below were worked out by hand BEFORE the code (comments say how).

afterEach(() => vi.unstubAllGlobals());

const STAMPS: CurrentStamps = { vocabularyHash: "vocab-1", readingVersion: "2", adRequestHash: "ad-1" };
const T1 = new Date("2026-11-16T10:00:00.000Z");
const ctxOf = (store: KeyValueStore): SavedContext => ({ store, stamps: STAMPS, now: () => T1 });

// ---- 1. a real-data round trip --------------------------------------------------------------------------------------

// A hand-written ad and the reading of it, chosen so that the checked reading has EVERY kind of thing a record can hold.
const AD = [
  "Senior Reporting Analyst at Rheinblick GmbH",
  "Berlin, hybrid, two days in the office",
  "Start on 1 March 2027.",
  "You have 3+ years of experience.",
  "Fluent German is required, English B2 is required, Klingon helps.",
  "A Master's degree is required.",
  "You know SQL or Python.",
  "You work with Experimenten.",
  "You are a team player.",
  "Knowledge of Zymurgy is a plus.",
].join("\n");

const KITCHEN_SINK: ExtractedAd = {
  title: "Senior Reporting Analyst",
  company: "Rheinblick GmbH",
  location: "Berlin",
  workMode: { value: "hybrid", quote: "hybrid, two days in the office" },
  minYears: { years: 3, quote: "3+ years of experience" },
  startDate: { date: "2027-03-01", quote: "Start on 1 March 2027" },
  languages: [
    { language: "German", levelWording: "Fluent", quote: "Fluent German is required" },
    { language: "English", levelWording: null, quote: "English B2 is required" },
    { language: "Klingon", levelWording: null, quote: "Klingon helps" },
  ],
  otherConditions: [{ quote: "A Master's degree is required" }],
  requirements: [
    { quote: "You know SQL or Python", importance: "must", skills: [{ name: "SQL" }, { name: "Python" }] },
    { quote: "You work with Experimenten", importance: "must", skills: [{ name: "Experimenten" }] },
    { quote: "You are a team player", importance: "must", skills: [{ name: "team player" }] },
    { quote: "Knowledge of Zymurgy is a plus", importance: "nice", skills: [{ name: "Zymurgy" }] },
    { quote: "Free coffee for everyone", importance: "nice", skills: [{ name: "Coffee" }] },
  ],
};

describe("R: a job saved with everything in it comes back equal", () => {
  const built = buildJob(KITCHEN_SINK, AD, skills, { id: "pasted-ad", source: null });
  const reading = { job: built.job, removed: built.removed, moved: built.moved, unlisted: built.unlisted, notCounted: built.notCounted };

  it("R0: the reading really holds one of everything (hand-worked, so the round trip below is not a round trip of nothing)", () => {
    // By hand, from the rules of buildJob: 'Free coffee...' is not in the ad -> removed (requirement, not-in-ad); 'Klingon'
    // is not in the language table -> moved to otherConditions (from "language"); 'team player' is a flagged name ->
    // notCounted; 'Zymurgy' is in no list -> unlisted new:zymurgy; 'Experimenten' is 2 letters from the alias
    // 'experiments' -> experimentation with a close match; 'SQL or Python' is ONE requirement with two ids.
    expect(reading.removed).toEqual([{ what: "requirement", why: "not-in-ad", text: "Free coffee for everyone" }]);
    expect(reading.moved).toEqual([{ from: "language", quote: "Klingon helps" }]);
    expect(reading.notCounted).toEqual([{ quote: "You are a team player", importance: "must" }]);
    expect(reading.unlisted).toEqual([{ id: "new:zymurgy", name: "Zymurgy" }]);
    expect(reading.job.requirements).toEqual([
      { skillIds: ["sql", "python"], importance: "must", quote: "You know SQL or Python" },
      {
        skillIds: ["experimentation"], importance: "must", quote: "You work with Experimenten",
        closeMatches: [{ name: "Experimenten", skillId: "experimentation", via: "experiments" }],
      },
      { skillIds: ["new:zymurgy"], importance: "nice", quote: "Knowledge of Zymurgy is a plus" },
    ]);
    expect(reading.job.constraints).toEqual({
      languages: [{ code: "de", level: "C1" }, { code: "en", level: null }], // one with a level, one with a null level
      location: "Berlin", remote: "hybrid", minYears: 3, startDate: "2027-03-01",
      otherConditions: [{ quote: "A Master's degree is required" }, { quote: "Klingon helps" }],
    });
    expect(reading.job.title).toBe("Senior Reporting Analyst");
    expect(reading.job.company).toBe("Rheinblick GmbH");
  });

  it("R1: saveJob, listJobs and loadJob: ok, corrupted 0, and the loaded reading and extraction deep-equal what was saved", async () => {
    const store = new MemoryStore();
    const saved = await saveJob(ctxOf(store), { adText: AD, extraction: KITCHEN_SINK, reading });
    expect(saved.ok).toBe(true);
    const list = await listJobs(ctxOf(store));
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.corrupted).toBe(0);
    expect(list.newer).toBe(0);
    expect(list.jobs).toHaveLength(1);
    expect(list.jobs[0].reading).toEqual(reading);
    expect(list.jobs[0].extraction).toEqual(KITCHEN_SINK);
    const loaded = await loadJob(ctxOf(store), list.jobs[0].id);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.job === null) throw new Error("not loaded");
    expect(loaded.job.reading).toEqual(reading);
    expect(loaded.job.extraction).toEqual(KITCHEN_SINK);
    expect(loaded.job.adText).toBe(AD);
  });

  it("R2: the made-up sample jobs of the fixtures (3 jobs) also round-trip, in one loop", async () => {
    expect(fixtureJobs.length).toBe(3);
    const store = new MemoryStore();
    for (const job of fixtureJobs) {
      const r = { job, removed: [], moved: [], unlisted: [], notCounted: [] };
      expect((await saveJob(ctxOf(store), { adText: `Ad text of ${job.id}`, extraction: null, reading: r })).ok).toBe(true);
    }
    const list = await listJobs(ctxOf(store));
    if (!list.ok) throw new Error("list failed");
    expect(list.corrupted).toBe(0);
    expect(list.jobs).toHaveLength(3);
    for (const job of fixtureJobs) expect(list.jobs.find((j) => j.reading.job.id === job.id)?.reading.job).toEqual(job);
  });
});

describe("R3: a profile saved with every kind of thing comes back equal", () => {
  const LINES = ["Robin Sample", "Wrote SQL queries to reconcile order data", "Built dashboards in Tableau", "Skills: Excel"];
  const p = (name: string, skillId: string, line: number, quote: string): CvSkill => ({ name, skillId, listed: true, line, quote, label: "named" });
  const CONFIRM: ConfirmState = {
    keptIds: ["sql", "tableau"],
    added: ["Python"], // have, no evidence
    inProgress: [{ name: "React", date: "2027-06-01" }], // inProgress
    languages: [{ code: "en", level: "C1" }, { code: "de", level: "B2" }],
    cities: "Berlin, Hamburg",
    workModes: ["hybrid", "remote"],
    years: "5",
    availableFrom: "2027-01-15",
  };

  it("R3: have (with evidence and without), inProgress, and every constraint kind set: save, load, deep-equal; every kind of 'set' is true", async () => {
    const b = buildProfile(LINES, [p("SQL", "sql", 2, "Wrote SQL queries"), p("Tableau", "tableau", 3, "dashboards in Tableau")], CONFIRM, skills);
    // By hand: SQL (line 2) and Tableau (line 3) are have-with-evidence, Python is have with evidence null, React is
    // in progress with its date; five constraint kinds were set.
    expect(b.profile.skills.map((s) => [s.kind, s.skillId])).toEqual([["have", "sql"], ["have", "tableau"], ["have", "python"], ["inProgress", "react"]]);
    expect(b.set).toEqual({ location: true, language: true, workMode: true, years: true, startDate: true });
    const store = new MemoryStore();
    expect((await saveProfile(ctxOf(store), b)).ok).toBe(true);
    const loaded = await loadProfile(ctxOf(store));
    expect(loaded).toEqual({ ok: true, saved: savedFromBuilt(b, STAMPS, T1) });
  });

  it("R4: the 6 made-up profiles of the fixtures round-trip, in one loop (the record equals what was saved)", async () => {
    expect(fixtureProfiles.length).toBe(6);
    for (const profile of fixtureProfiles) {
      const built = { profile, set: { location: true, language: true, workMode: true, years: true, startDate: true }, problems: [], notes: [], handAdded: [], unmatchable: [] };
      const store = new MemoryStore();
      expect((await saveProfile(ctxOf(store), built)).ok).toBe(true);
      const loaded = await loadProfile(ctxOf(store));
      expect(loaded).toEqual({ ok: true, saved: savedFromBuilt(built, STAMPS, T1) });
      if (loaded.ok && loaded.saved) expect(builtFromSaved(loaded.saved).profile.skills).toEqual(profile.skills);
    }
  });
});

// ---- 2. the cap on the cited line number ----------------------------------------------------------------------------

describe("C: the cited line number is capped at what the app can ever produce", () => {
  // By hand: a CV may have at most MAX_CV_LINES = 400 lines (lib/cv/limits.ts), so a cited line is 1..400.
  const stored = (line: number) => ({
    schemaVersion: 1, savedAt: T1.toISOString(),
    skills: [{ kind: "have", skillId: "sql", evidence: { line, text: "Wrote SQL queries" } }],
    constraints: { languages: [], locations: [], workModes: [], years: null, availableFrom: null },
    set: { location: false, language: false, workMode: false, years: false, startDate: false },
    stamps: { vocabularyHash: "v", readingVersion: "2" },
  });

  it("C1: the limit is 400; line 400 is accepted, line 401 and 0 and 2,000,000,000 are corrupted; the huge one allocates nothing and finishes fast", async () => {
    expect(MAX_CV_LINES).toBe(400);
    const t0 = Date.now();
    for (const [line, ok] of [[1, true], [400, true], [401, false], [0, false], [2_000_000_000, false]] as const) {
      const store = new MemoryStore();
      await store.put("profile", "current", stored(line));
      const r = await loadProfile(ctxOf(store));
      expect(r.ok).toBe(ok);
      if (!r.ok) expect(r.reason).toBe("corrupted");
    }
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("C2: sparseCvLines is safe against a larger number too: a cited line beyond 400 is ignored, nothing is allocated, line 400 gives 400 entries", () => {
    const t0 = Date.now();
    const huge = [{ kind: "have" as const, skillId: "sql", evidence: { line: 2_000_000_000, text: "x" } }];
    expect(sparseCvLines(huge)).toEqual([]);
    const at400 = sparseCvLines([{ kind: "have" as const, skillId: "sql", evidence: { line: 400, text: "last line" } }]);
    expect(at400).toHaveLength(400);
    expect(at400[399]).toBe("last line");
    expect(sparseCvLines([{ kind: "have" as const, skillId: "sql", evidence: { line: 401, text: "x" } }])).toEqual([]);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});

// ---- 3. saveJob and the other functions never throw -------------------------------------------------------------------

describe("T: a storage or crypto problem is a result, never a throw", () => {
  const input = { adText: "An ad.", extraction: null, reading: { job: fixtureJobs[0] as Job, removed: [], moved: [], unlisted: [], notCounted: [] } };

  it("T1: with crypto.subtle missing, saveJob returns { ok: false, reason: 'unavailable' } and writes nothing", async () => {
    for (const fake of [undefined, {}]) {
      vi.stubGlobal("crypto", fake);
      const store = new MemoryStore();
      expect(await saveJob(ctxOf(store), input)).toEqual({ ok: false, reason: "unavailable" });
      expect(store.writes).toBe(0);
      vi.unstubAllGlobals();
    }
  });

  it("T2: a caller mistake (ad text that is not a string) is 'failed', not a throw", async () => {
    const store = new MemoryStore();
    expect(await saveJob(ctxOf(store), { ...input, adText: undefined as unknown as string })).toEqual({ ok: false, reason: "failed" });
  });

  it("T3: every exported logic function answers with a result when the store and crypto both fail", async () => {
    vi.stubGlobal("crypto", undefined);
    const boom = new StoreError("unavailable");
    const broken: KeyValueStore = {
      get: async () => { throw boom; }, put: async () => { throw boom; }, delete: async () => { throw boom; },
      list: async () => { throw boom; }, clear: async () => { throw boom; },
    };
    const ctx = ctxOf(broken);
    const b = buildProfile(["Wrote SQL"], [], { keptIds: [], added: [], inProgress: [], languages: [], cities: "", workModes: [], years: "", availableFrom: "" }, skills);
    const results = [
      await saveProfile(ctx, b), await loadProfile(ctx), await saveJob(ctx, input), await listJobs(ctx),
      await loadJob(ctx, "x"), await deleteJob(ctx, "x"), await deleteAll(ctx),
    ];
    for (const r of results) expect(r).toEqual({ ok: false, reason: "unavailable" });
  });

  it("T4: jobIdFor itself reports a missing crypto.subtle as a StoreError('unavailable') (the one exported function that throws, and saveJob catches it)", async () => {
    vi.stubGlobal("crypto", undefined);
    await expect(jobIdFor("x")).rejects.toMatchObject({ name: "StoreError", reason: "unavailable" });
  });
});

// ---- 4. saveProfile never overwrites a newer record ------------------------------------------------------------------

describe("P: saveProfile leaves a newer record alone", () => {
  it("P1: a stored profile with schemaVersion 99 is unchanged after saveProfile, and nothing was written", async () => {
    const store = new MemoryStore();
    const future = { schemaVersion: 99, mystery: "written by a newer app" };
    await store.put("profile", "current", future);
    store.writes = 0;
    const b = buildProfile(["Wrote SQL"], [], { keptIds: [], added: [], inProgress: [], languages: [], cities: "", workModes: [], years: "", availableFrom: "" }, skills);
    expect(await saveProfile(ctxOf(store), b)).toEqual({ ok: false, reason: "newer-version" });
    expect(await store.get("profile", "current")).toEqual(future);
    expect(store.writes).toBe(0);
  });

  it("P2: with no record, or with one of the current version, saveProfile still works (the check is not a blanket refusal)", async () => {
    const store = new MemoryStore();
    const b = buildProfile(["Wrote SQL"], [], { keptIds: [], added: [], inProgress: [], languages: [], cities: "", workModes: [], years: "", availableFrom: "" }, skills);
    expect((await saveProfile(ctxOf(store), b)).ok).toBe(true);
    expect((await saveProfile(ctxOf(store), b)).ok).toBe(true);
    expect(store.writes).toBe(2);
  });
});
