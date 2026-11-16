import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { profileReport } from "@/app/fitReport";
import { skills } from "@/fixtures/skills";
import { buildProfile, type ConfirmState } from "@/lib/cv/profile";
import { match } from "@/lib/engine/match";
import { buildJob } from "@/lib/engine/fromAd";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job, Requirement } from "@/lib/engine/types";
import type { ExtractedAd } from "@/lib/schemas/job";
import { jobIdFor } from "@/lib/saved/jobId";
import { migrateRecord } from "@/lib/saved/migrate";
import { openJob } from "@/lib/saved/openJob";
import { builtFromSaved, savedFromBuilt, sparseCvLines, summarizeProfile, unknownSkillIds } from "@/lib/saved/profile";
import {
  deleteAll, deleteJob, listJobs, loadJob, loadProfile, saveJob, saveProfile, type SavedContext,
} from "@/lib/saved/saved";
import { MemoryStore, StoreError, type KeyValueStore } from "@/lib/saved/store";
import { SCHEMA_VERSION, type CurrentStamps, type SavedJob } from "@/lib/saved/types";

// Step 6.1, part 1 (docs/PLAN-6.1.md, approved 2026-11-16): the logic of keeping the confirmed profile and saved jobs on
// this device, tested on an in-memory double. No UI, no route, no IndexedDB adapter, no AI call. Every expectation was
// worked out by hand BEFORE the code; the hand work is in the comments next to each test.

afterEach(() => vi.unstubAllGlobals());

// ---- the made-up material --------------------------------------------------------------------------------------------

const CV_LINES = [
  "Robin Sample, Reporting Analyst", // 1 (not cited)
  "Wrote SQL queries to reconcile order data", // 2 (cited by SQL)
  "Built monthly dashboards in Tableau", // 3 (cited by Tableau)
  "Skills: Excel", // 4 (cited by Excel)
  "Led weekly reporting for the sales team", // 5 (not cited)
  "Languages: English, fluent", // 6 (not cited)
];
const proposal = (name: string, skillId: string, line: number, quote: string): CvSkill => ({ name, skillId, listed: true, line, quote, label: "named" });
const PROPOSALS = [
  proposal("SQL", "sql", 2, "Wrote SQL queries"),
  proposal("Tableau", "tableau", 3, "dashboards in Tableau"),
  proposal("Excel", "excel", 4, "Skills: Excel"),
];
const CONFIRM: ConfirmState = {
  keptIds: ["sql", "tableau", "excel"],
  added: ["Python"], // by hand: no CV line, so it is never met
  inProgress: [],
  languages: [{ code: "en", level: "C1" }],
  cities: "Berlin",
  workModes: ["hybrid"],
  years: "3",
  availableFrom: "",
};
const built = () => buildProfile(CV_LINES, PROPOSALS, CONFIRM, skills);

const req = (id: string, importance: "must" | "nice", quote: string): Requirement => ({ skillIds: [id], importance, quote });
const JOB: Job = {
  id: "j", title: "Analyst", company: null, source: null,
  constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
  requirements: [req("sql", "must", "SQL needed"), req("python", "must", "Python needed"), req("excel", "nice", "Excel is a plus"), req("tableau", "nice", "Tableau is a plus")],
};

const STAMPS: CurrentStamps = { vocabularyHash: "vocab-1", readingVersion: "2", adRequestHash: "ad-1" };
const T1 = new Date("2026-11-16T10:00:00.000Z");
const T2 = new Date("2026-11-16T11:30:00.000Z");
const ctxOf = (store: KeyValueStore, now = () => T1, stamps = STAMPS): SavedContext => ({ store, stamps, now });

const EMPTY_AD: ExtractedAd = {
  title: null, company: null, location: null, workMode: null, minYears: null, startDate: null,
  languages: [], otherConditions: [], requirements: [],
};
const AD_TEXT = "Erfahrung mit Experimenten ist wichtig.";
const EXTRACTION: ExtractedAd = {
  ...EMPTY_AD,
  requirements: [{ quote: "Erfahrung mit Experimenten ist wichtig.", importance: "must", skills: [{ name: "Experimenten" }] }],
};
// The reading as an OLD vocabulary made it: the name was not found, so it stayed unlisted.
const OLD_READING = {
  job: { ...JOB, id: "pasted-ad", requirements: [req("new:experimenten", "must", "Erfahrung mit Experimenten ist wichtig.")] },
  removed: [], moved: [], unlisted: [{ id: "new:experimenten", name: "Experimenten" }], notCounted: [],
};
const jobInput = (adText = AD_TEXT, extraction: ExtractedAd | null = EXTRACTION) => ({ adText, extraction, reading: OLD_READING });

// A store that fails the way a browser store can: a typed error or a plain one, on a chosen call.
function failing(base: KeyValueStore, on: Partial<Record<"get" | "put" | "delete" | "list" | "clear", unknown>>): KeyValueStore {
  const wrap = <K extends keyof KeyValueStore>(name: K): KeyValueStore[K] =>
    (async (...args: unknown[]) => {
      if (on[name] !== undefined) throw on[name];
      return (base[name] as (...a: unknown[]) => unknown)(...args);
    }) as KeyValueStore[K];
  return { get: wrap("get"), put: wrap("put"), delete: wrap("delete"), list: wrap("list"), clear: wrap("clear") };
}

// ---- S1, S1b: the store and the 15 jobs -------------------------------------------------------------------------------

describe("S1: the store interface, on the in-memory double", () => {
  it("S1: put 3, get each, list 3, delete 1 leaves 2, clear leaves 0; a missing key is undefined; stores are apart", async () => {
    const s = new MemoryStore();
    await s.put("jobs", "a", { n: 1 });
    await s.put("jobs", "b", { n: 2 });
    await s.put("profile", "current", { n: 3 });
    expect(await s.get("jobs", "a")).toEqual({ n: 1 });
    expect(await s.get("jobs", "zzz")).toBeUndefined();
    expect(await s.get("profile", "a")).toBeUndefined(); // same key in another store is another record
    expect((await s.list("jobs")).map((e) => e.key).sort()).toEqual(["a", "b"]);
    await s.delete("jobs", "a");
    expect((await s.list("jobs")).map((e) => e.key)).toEqual(["b"]);
    await s.clear();
    expect(await s.list("jobs")).toEqual([]);
    expect(await s.get("profile", "current")).toBeUndefined();
  });

  it("S1b: 15 saved jobs survive a 'reload' (a new context over the same stored data): 15 saved, 15 listed, 15 different ids", async () => {
    const s = new MemoryStore();
    for (let i = 1; i <= 15; i++) expect((await saveJob(ctxOf(s), jobInput(`Ad number ${i}`))).ok).toBe(true);
    const reloaded = await listJobs(ctxOf(s)); // a fresh context: nothing carried in memory
    expect(reloaded.ok).toBe(true);
    if (!reloaded.ok) return;
    expect(reloaded.jobs).toHaveLength(15);
    expect(new Set(reloaded.jobs.map((j) => j.id)).size).toBe(15);
    expect(reloaded.corrupted).toBe(0);
  });
});

// ---- S2 .. S3: the profile ---------------------------------------------------------------------------------------------

describe("the sparse cvLines", () => {
  it("D1: cited lines 4 and 2 give ['', L2, '', L4]: length is the highest cited line, an uncited line is empty, no cited line gives []", () => {
    const sk = [
      { kind: "have" as const, skillId: "excel", evidence: { line: 4, text: "Skills: Excel" } },
      { kind: "have" as const, skillId: "sql", evidence: { line: 2, text: "Wrote SQL queries" } },
      { kind: "have" as const, skillId: "python", evidence: null },
      { kind: "inProgress" as const, skillId: "react", expectedDate: "2027-01-01" },
    ];
    expect(sparseCvLines(sk)).toEqual(["", "Wrote SQL queries", "", "Skills: Excel"]);
    expect(sparseCvLines([])).toEqual([]);
    expect(sparseCvLines([sk[2], sk[3]])).toEqual([]);
  });
});

describe("S2: save, load and match give the answer of the profile just built", () => {
  // By hand. The profile has SQL (line 2), Tableau (line 3), Excel (line 4) from the CV and Python added by hand (no
  // CV line). The job asks SQL (must), Python (must), Excel (nice), Tableau (nice). SQL is met (line 2); Python is on the
  // profile but ties to no CV line, so it is NOT met (reason "no-cv-line"); Excel and Tableau are met. One must-have
  // missing and no conflict: "good" (decided by "one-must-missing"); counts: musts 1 of 2, nices 2 of 2.
  it("S2a: for the made-up CV, save then load then match equals the full-CV match, and equals the hand-worked values", async () => {
    const b = built();
    const store = new MemoryStore();
    expect((await saveProfile(ctxOf(store), b)).ok).toBe(true);
    const loaded = await loadProfile(ctxOf(store));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.saved === null) throw new Error("no saved profile");
    const rebuilt = builtFromSaved(loaded.saved);
    const full = match(b.profile, JOB);
    const fromSaved = match(rebuilt.profile, JOB);
    expect(fromSaved).toEqual(full);
    expect(fromSaved.level).toBe("good");
    expect(fromSaved.decidedBy).toBe("one-must-missing");
    expect(fromSaved.counts).toEqual({ mustsMet: 1, mustsTotal: 2, nicesMet: 2, nicesTotal: 2 });
    expect(fromSaved.musts.map((m) => [m.requirement.skillIds[0], m.met, m.reason])).toEqual([["sql", true, null], ["python", false, "no-cv-line"]]);
  });

  it("S2b-report: profileReport for the saved profile equals the one for the profile just built", async () => {
    const b = built();
    const saved = savedFromBuilt(b, STAMPS, T1);
    expect(profileReport(JOB, builtFromSaved(saved), skills, [])).toEqual(profileReport(JOB, b, skills, []));
  });

  it("S2c: a skill added by hand (evidence null) is still not met after saving and loading", async () => {
    const saved = savedFromBuilt(built(), STAMPS, T1);
    const python = saved.skills.find((s) => s.skillId === "python");
    expect(python).toEqual({ kind: "have", skillId: "python", evidence: null });
    const result = match(builtFromSaved(saved).profile, { ...JOB, requirements: [req("python", "must", "Python needed")] });
    expect(result.musts[0].met).toBe(false);
    expect(result.level).toBe("good");
  });

  it("S2d: the loaded profile has empty problems, notes, handAdded and unmatchable, and keeps which kinds were set", () => {
    const b = built();
    const r = builtFromSaved(savedFromBuilt(b, STAMPS, T1));
    expect([r.problems, r.notes, r.handAdded, r.unmatchable]).toEqual([[], [], [], []]);
    expect(r.set).toEqual({ location: true, language: true, workMode: true, years: true, startDate: false });
    expect(r.profile.constraints).toEqual(b.profile.constraints);
    expect(r.profile.cvLines).toEqual(["", CV_LINES[1], CV_LINES[2], CV_LINES[3]]); // the sparse rebuild: lines 2, 3, 4 only
  });
});

describe("S2b: the limit, documented", () => {
  it("S2b: a stored profile whose evidence text was edited still counts as met (the cited-line check is satisfied by construction after saving; the real guard is at build time)", () => {
    const saved = savedFromBuilt(built(), STAMPS, T1);
    const edited = {
      ...saved,
      skills: saved.skills.map((s) => (s.kind === "have" && s.skillId === "sql" && s.evidence ? { ...s, evidence: { ...s.evidence, text: "Completely different words" } } : s)),
    };
    const result = match(builtFromSaved(edited).profile, { ...JOB, requirements: [req("sql", "must", "SQL needed")] });
    expect(result.musts[0].met).toBe(true);
    expect(result.musts[0].metBy?.evidence.text).toBe("Completely different words");
  });
});

describe("S2e: a skill that is no longer in our list is shown, never counted as met", () => {
  it("S2e: 'ghost-skill' is listed as unknown, left out of what the engine gets, and a job asking for it is not met", () => {
    const saved = savedFromBuilt(built(), STAMPS, T1);
    saved.skills.push({ kind: "have", skillId: "ghost-skill", evidence: { line: 2, text: CV_LINES[1] } });
    expect(unknownSkillIds(saved, skills)).toEqual(["ghost-skill"]);
    const rebuilt = builtFromSaved(saved, skills);
    expect(rebuilt.profile.skills.some((s) => s.skillId === "ghost-skill")).toBe(false);
    const result = match(rebuilt.profile, { ...JOB, requirements: [req("ghost-skill", "must", "Ghost needed")] });
    expect(result.musts[0].met).toBe(false);
    const summary = summarizeProfile(saved, skills);
    expect(summary.have.find((h) => h.skillId === "ghost-skill")).toMatchObject({ known: false, name: "ghost-skill", text: CV_LINES[1] });
    expect(summary.have.find((h) => h.skillId === "sql")).toMatchObject({ known: true, name: "SQL", line: 2, text: CV_LINES[1] });
    expect(summary.have.find((h) => h.skillId === "python")).toMatchObject({ known: true, text: null }); // added by hand: no line
    expect(summary.set).toEqual({ location: true, language: true, workMode: true, years: true, startDate: false });
  });
});

describe("S3: the stored profile holds only the cited lines", () => {
  it("S3: lines 2, 3, 4 are in the stored record; lines 1, 5, 6 (not cited) are not", async () => {
    const store = new MemoryStore();
    await saveProfile(ctxOf(store), built());
    const raw = JSON.stringify(await store.get("profile", "current"));
    for (const i of [1, 2, 3]) expect(raw).toContain(CV_LINES[i]);
    for (const i of [0, 4, 5]) expect(raw).not.toContain(CV_LINES[i]);
    expect(raw).not.toContain("Robin Sample");
    expect(raw).not.toContain("cvLines");
  });
});

// ---- S4: explicit saving, nothing sent ----------------------------------------------------------------------------------

describe("S4: nothing is written without a click, and saving sends nothing anywhere", () => {
  it("S4: building, loading, listing and opening write 0 times; one saveProfile writes once; fetch is never called", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const store = new MemoryStore();
    const b = built(); // building a profile
    builtFromSaved(savedFromBuilt(b, STAMPS, T1)); // rebuilding one
    expect(store.writes).toBe(0);
    await loadProfile(ctxOf(store));
    await listJobs(ctxOf(store));
    await loadJob(ctxOf(store), "nothing");
    expect(store.writes).toBe(0);
    await saveProfile(ctxOf(store), b);
    expect(store.writes).toBe(1);
    await saveJob(ctxOf(store), jobInput());
    expect(store.writes).toBe(2);
    const stored = await store.get("jobs", await jobIdFor(AD_TEXT));
    openJob(stored as SavedJob, { stamps: { ...STAMPS, vocabularyHash: "other" }, skills }); // opening a re-checked job
    expect(store.writes).toBe(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---- S5: versions ------------------------------------------------------------------------------------------------------

describe("S5: versions and migration", () => {
  it("S5a: a record of a NEWER version is reported, left untouched, not deleted, and never overwritten by a save of the same ad", async () => {
    const store = new MemoryStore();
    const id = await jobIdFor(AD_TEXT);
    const future = { schemaVersion: 99, id, mystery: "from a newer app", adText: "x" };
    await store.put("jobs", id, future);
    store.writes = 0;
    expect(await loadJob(ctxOf(store), id)).toEqual({ ok: false, reason: "newer-version" });
    const list = await listJobs(ctxOf(store));
    expect(list).toMatchObject({ ok: true, jobs: [], newer: 1, corrupted: 0 });
    expect(await saveJob(ctxOf(store), jobInput())).toEqual({ ok: false, reason: "newer-version" }); // same ad, same key
    expect(await store.get("jobs", id)).toEqual(future);
    expect(store.writes).toBe(0);
  });

  it("S5b: a version-1 record opens; a field it does not know (the reserved removedByYou) is kept; a missing optional field reads as absent", async () => {
    const store = new MemoryStore();
    await saveJob(ctxOf(store), jobInput());
    const id = await jobIdFor(AD_TEXT);
    const raw = (await store.get("jobs", id)) as Record<string, unknown>;
    expect(raw.removedByYou).toBeUndefined();
    await store.put("jobs", id, { ...raw, removedByYou: [{ quote: "Python needed" }] });
    const loaded = await loadJob(ctxOf(store), id);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok || loaded.job === null) throw new Error("not loaded");
    expect((loaded.job as unknown as Record<string, unknown>).removedByYou).toEqual([{ quote: "Python needed" }]);
  });

  // By hand: a v1 record {schemaVersion 1, a 1, b 2} with a migration 1 -> 2 that adds c: 3 gives {2, a 1, b 2, c 3}.
  it("S5c: a migration chain adds a field without losing any saved data; a future version and a missing version are refused", () => {
    const v1 = { schemaVersion: 1, a: 1, b: 2 };
    const migrations = { 1: (r: Record<string, unknown>) => ({ ...r, schemaVersion: 2, c: 3 }) };
    expect(migrateRecord(v1, 2, migrations)).toEqual({ ok: true, record: { schemaVersion: 2, a: 1, b: 2, c: 3 } });
    expect(migrateRecord(v1, 1, {})).toEqual({ ok: true, record: v1 });
    expect(migrateRecord({ schemaVersion: 3, a: 1 }, 2, migrations)).toEqual({ ok: false, reason: "newer-version" });
    expect(migrateRecord({ a: 1 }, 2, migrations)).toEqual({ ok: false, reason: "corrupted" });
    expect(migrateRecord("text", 2, migrations)).toEqual({ ok: false, reason: "corrupted" });
    expect(SCHEMA_VERSION).toBe(1);
  });
});

// ---- S6, S7: opening an old record -------------------------------------------------------------------------------------

describe("S6: the stamp table (plan section 3), every row", () => {
  const record = (over: Partial<SavedJob> = {}, version = 1) =>
    ({
      schemaVersion: version, id: "x", savedAt: T1.toISOString(), adText: AD_TEXT, extraction: EXTRACTION, reading: OLD_READING,
      stamps: { vocabularyHash: "vocab-1", readingVersion: "2", adRequestHash: "ad-1" }, ...over,
    }) as SavedJob;
  const open = (r: SavedJob, over: Partial<CurrentStamps> = {}) => openJob(r, { stamps: { ...STAMPS, ...over }, skills });

  it("S6-1: a newer schema version is not opened", () => {
    expect(open(record({}, 99)).kind).toBe("newer-version");
  });
  it("S6-2: everything equal: shown as stored", () => {
    const o = open(record());
    expect(o.kind).toBe("as-stored");
    if (o.kind === "as-stored") expect(o.reading).toEqual(OLD_READING);
  });
  it("S6-3: the ad request hash differs: shown as stored, 'older instructions', a re-read is OFFERED (never done)", () => {
    const o = open(record(), { adRequestHash: "ad-2" });
    expect(o.kind).toBe("older-instructions");
    if (o.kind === "older-instructions") {
      expect(o.offerReread).toBe(true);
      expect(o.reading).toEqual(OLD_READING);
    }
  });
  it("S6-4: the vocabulary differs, the extraction is there: re-checked in plain code (no AI)", () => {
    expect(open(record(), { vocabularyHash: "vocab-2" }).kind).toBe("rechecked");
  });
  it("S6-5: only the reading version differs: re-checked", () => {
    expect(open(record(), { readingVersion: "3" }).kind).toBe("rechecked");
  });
  it("S6-6: the vocabulary differs and there is no extraction: it cannot be re-checked; the old reading is shown and a re-read is offered", () => {
    const o = open(record({ extraction: null }), { vocabularyHash: "vocab-2" });
    expect(o.kind).toBe("cannot-recheck");
    if (o.kind === "cannot-recheck") {
      expect(o.offerReread).toBe(true);
      expect(o.reading).toEqual(OLD_READING);
    }
  });
  it("S6-7: the ad request hash AND the vocabulary differ: the instructions row wins (the old reading is not re-checked)", () => {
    expect(open(record(), { adRequestHash: "ad-2", vocabularyHash: "vocab-2" }).kind).toBe("older-instructions");
  });
  it("S6-8: everything equal and no extraction: shown as stored (nothing to re-check)", () => {
    expect(open(record({ extraction: null })).kind).toBe("as-stored");
  });
});

describe("S7: a re-check is the plain-code reading under the current vocabulary, with no AI call", () => {
  // By hand: 'Experimenten' is 2 letters from the alias 'experiments' of Experimentation, at the end of a long word, so
  // stage 2 (live) maps it to experimentation, via 'experiments'. The old reading had it unlisted ('new:experimenten').
  it("S7: the re-checked reading equals a fresh buildJob of the stored extraction; the close match is there; the unlisted list is empty; fetch is not called", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const record = {
      schemaVersion: 1, id: "x", savedAt: T1.toISOString(), adText: AD_TEXT, extraction: EXTRACTION, reading: OLD_READING,
      stamps: { vocabularyHash: "vocab-OLD", readingVersion: "2", adRequestHash: "ad-1" },
    } as SavedJob;
    const o = openJob(record, { stamps: STAMPS, skills });
    expect(o.kind).toBe("rechecked");
    if (o.kind !== "rechecked") return;
    const fresh = buildJob(EXTRACTION, AD_TEXT, skills, { id: "pasted-ad", source: null });
    expect(o.reading).toEqual({ job: fresh.job, removed: fresh.removed, moved: fresh.moved, unlisted: fresh.unlisted, notCounted: fresh.notCounted });
    expect(o.reading.job.requirements).toEqual([
      {
        skillIds: ["experimentation"], importance: "must", quote: "Erfahrung mit Experimenten ist wichtig.",
        closeMatches: [{ name: "Experimenten", skillId: "experimentation", via: "experiments" }],
      },
    ]);
    expect(o.reading.unlisted).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ---- S8: failures ------------------------------------------------------------------------------------------------------

describe("S8: a storage problem is a result, never a throw", () => {
  it("S8a: a write that fails gives quota, unavailable or failed, for the profile and for a job", async () => {
    for (const [thrown, reason] of [
      [new StoreError("quota"), "quota"], [new StoreError("unavailable"), "unavailable"], [new StoreError("failed"), "failed"], [new Error("boom"), "failed"],
    ] as const) {
      const store = failing(new MemoryStore(), { put: thrown });
      expect(await saveProfile(ctxOf(store), built())).toEqual({ ok: false, reason });
      expect(await saveJob(ctxOf(store), jobInput())).toEqual({ ok: false, reason });
    }
  });

  it("S8b: a read that fails is a result too (get, list), and so is a failed delete or clear", async () => {
    const base = new MemoryStore();
    expect(await loadProfile(ctxOf(failing(base, { get: new StoreError("unavailable") })))).toEqual({ ok: false, reason: "unavailable" });
    expect(await loadJob(ctxOf(failing(base, { get: new StoreError("failed") })), "x")).toEqual({ ok: false, reason: "failed" });
    expect(await listJobs(ctxOf(failing(base, { list: new StoreError("unavailable") })))).toEqual({ ok: false, reason: "unavailable" });
    expect(await deleteJob(ctxOf(failing(base, { delete: new StoreError("failed") })), "x")).toEqual({ ok: false, reason: "failed" });
    expect(await deleteAll(ctxOf(failing(base, { clear: new StoreError("failed") })))).toEqual({ ok: false, reason: "failed" });
  });

  it("S8c: one corrupted record among three: the list gives the 2 good ones and a corrupted count of 1; the bad one can be deleted", async () => {
    const store = new MemoryStore();
    await saveJob(ctxOf(store), jobInput("Ad one"));
    await saveJob(ctxOf(store), jobInput("Ad two"));
    await store.put("jobs", "bad", { schemaVersion: 1, id: "bad", nonsense: true }); // fails validation
    const list = await listJobs(ctxOf(store));
    expect(list).toMatchObject({ ok: true, newer: 0, corrupted: 1 });
    if (!list.ok) return;
    expect(list.jobs).toHaveLength(2);
    expect(await loadJob(ctxOf(store), "bad")).toEqual({ ok: false, reason: "corrupted" });
    expect((await deleteJob(ctxOf(store), "bad")).ok).toBe(true);
    expect(await listJobs(ctxOf(store))).toMatchObject({ ok: true, corrupted: 0 });
  });

  it("S8d: a corrupted profile is reported as corrupted (not thrown, not treated as 'none saved')", async () => {
    const store = new MemoryStore();
    await store.put("profile", "current", { schemaVersion: 1, skills: "not a list" });
    expect(await loadProfile(ctxOf(store))).toEqual({ ok: false, reason: "corrupted" });
    expect(await loadProfile(ctxOf(new MemoryStore()))).toEqual({ ok: true, saved: null });
  });
});

// ---- S9, S10 ------------------------------------------------------------------------------------------------------------

describe("S9: delete everything", () => {
  it("S9: a profile and 3 jobs, then deleteAll: no profile, no jobs", async () => {
    const store = new MemoryStore();
    await saveProfile(ctxOf(store), built());
    for (const t of ["A", "B", "C"]) await saveJob(ctxOf(store), jobInput(`Ad ${t}`));
    expect(((await listJobs(ctxOf(store))) as { jobs: unknown[] }).jobs).toHaveLength(3);
    expect(await deleteAll(ctxOf(store))).toEqual({ ok: true });
    expect(await loadProfile(ctxOf(store))).toEqual({ ok: true, saved: null });
    expect(await listJobs(ctxOf(store))).toMatchObject({ ok: true, jobs: [], corrupted: 0, newer: 0 });
  });
});

describe("S10: one record per ad text", () => {
  it("S10a: the job id is the first 16 hex characters of SHA-256 of the trimmed ad text ('abc' is the known vector ba7816bf8f01cfea)", async () => {
    expect(await jobIdFor("abc")).toBe("ba7816bf8f01cfea");
    expect(await jobIdFor("  abc \n")).toBe("ba7816bf8f01cfea");
    expect(await jobIdFor("abd")).not.toBe("ba7816bf8f01cfea");
  });

  it("S10b: the same ad saved twice (even with outer spaces) is one record and savedAt is the second time; a different ad is a second record", async () => {
    const store = new MemoryStore();
    await saveJob(ctxOf(store, () => T1), jobInput("An ad about SQL."));
    await saveJob(ctxOf(store, () => T2), jobInput("  An ad about SQL.  \n"));
    let list = await listJobs(ctxOf(store));
    if (!list.ok) throw new Error("list failed");
    expect(list.jobs).toHaveLength(1);
    expect(list.jobs[0].savedAt).toBe(T2.toISOString());
    expect(list.jobs[0].adText).toBe("An ad about SQL.");
    await saveJob(ctxOf(store, () => T2), jobInput("An ad about Excel."));
    list = await listJobs(ctxOf(store));
    if (!list.ok) throw new Error("list failed");
    expect(list.jobs).toHaveLength(2);
  });

  it("S10c: a saved job carries the stamps it was saved with and the schema version", async () => {
    const store = new MemoryStore();
    await saveJob(ctxOf(store), jobInput());
    const loaded = await loadJob(ctxOf(store), await jobIdFor(AD_TEXT));
    if (!loaded.ok || loaded.job === null) throw new Error("not loaded");
    expect(loaded.job.schemaVersion).toBe(1);
    expect(loaded.job.stamps).toEqual(STAMPS);
    expect(loaded.job.extraction).toEqual(EXTRACTION);
  });
});

// ---- S13: no node imports -----------------------------------------------------------------------------------------------

describe("S13: the logic runs in the browser: nothing under lib/saved, nor anything it imports, uses node:, fs, path or crypto", () => {
  const root = process.cwd();
  const exts = [".ts", ".tsx", "/index.ts"];
  const resolve = (from: string, spec: string): string | null => {
    const base = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
    if (base === null) return null;
    for (const e of ["", ...exts]) {
      const f = base + e;
      if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
    }
    return null;
  };
  const importsOf = (file: string) =>
    [...fs.readFileSync(file, "utf8").matchAll(/(?:import|export)\s[^'"`]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3]);

  it("N1: every module reachable from lib/saved is free of node-only imports", () => {
    const start = [
      ...fs.readdirSync(path.join(root, "lib/saved")).filter((f) => f.endsWith(".ts")).map((f) => path.join(root, "lib/saved", f)),
      // 6.1 part 2: the files the browser also imports (stamps and the web vocabulary hash)
      path.join(root, "lib/ai/readingVersion.ts"), path.join(root, "lib/ai/adRequestHash.ts"),
      path.join(root, "lib/vocab/webHash.ts"), path.join(root, "lib/vocab/canonical.ts"), path.join(root, "lib/engine/stableStringify.ts"),
    ];
    expect(start.length).toBeGreaterThan(6);
    const seen = new Set<string>();
    const queue = [...start];
    const offenders: string[] = [];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of importsOf(file)) {
        if (/^(node:|fs$|fs\/|path$|crypto$|os$|child_process$)/.test(spec)) offenders.push(`${path.relative(root, file)} imports ${spec}`);
        const next = resolve(file, spec);
        if (next) queue.push(next);
      }
    }
    expect(offenders).toEqual([]);
    expect(seen.size).toBeGreaterThan(start.length); // it really followed imports (fromAd, the vocabulary, ...)
  });
});
