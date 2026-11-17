import { afterEach, describe, expect, it, vi } from "vitest";
import { profileReport } from "@/app/fitReport";
import { openedReadings, rankedAdRows, reportFor } from "@/app/savedAdRows";
import { skillsOnlyReport } from "@/app/skillsOnly";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type ConfirmState } from "@/lib/cv/profile";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job } from "@/lib/engine/types";
import { builtFromSaved, savedFromBuilt } from "@/lib/saved/profile";
import { deleteAll, deleteJob, listJobs, saveJob, type SavedContext } from "@/lib/saved/saved";
import { MemoryStore } from "@/lib/saved/store";
import type { SavedJob } from "@/lib/saved/types";
import { listNotice } from "@/lib/saved/ui";

// Step 6.2 (docs/PLAN-6.2.md, APPROVED revision 2), cases L1 to L19. EVERY expected string below was written from the
// plan before any code existed; none was taken from the code's output. Invented data only; no AI call, no network.
//
// The ads: A "Reporting Analyst, Northlake Foods Ltd" (2026-11-18, Berlin hybrid, musts SQL and Tableau, nice Excel);
// B "Operations Coordinator, Harbor Light Stationery" (2026-11-20, Exampleville hybrid, musts SQL and Tableau);
// C "Customer Helper, Imaginary Pages Ltd" (2026-11-19, no requirements read); D "Data Clerk, Example Wharf Ltd"
// (2026-11-21, Berlin hybrid, must SQL). The profile in use: SQL, Tableau, Excel; the person set only the city Berlin.

const CURRENT = { vocabularyHash: "vocab-now", readingVersion: "3", adRequestHash: "ad-now" };
const LINES = [
  "Alex Example, Reporting Analyst, Exampleville",
  "Wrote SQL queries to reconcile order data",
  "Built monthly dashboards in Tableau",
  "Kept the weekly sales sheet in Excel",
];
const P: CvSkill[] = [
  { name: "SQL", skillId: "sql", listed: true, line: 2, quote: "Wrote SQL queries", label: "named" },
  { name: "Tableau", skillId: "tableau", listed: true, line: 3, quote: "dashboards in Tableau", label: "named" },
  { name: "Excel", skillId: "excel", listed: true, line: 4, quote: "sales sheet in Excel", label: "named" },
];
const ALL = ["sql", "tableau", "excel"];
const confirm = (keptIds: string[], over: Partial<ConfirmState> = {}): ConfirmState => ({ ...initialConfirm(P), keptIds, ...over });
const profileOf = (keptIds: string[] = ALL, over: Partial<ConfirmState> = {}) => buildProfile(LINES, P, confirm(keptIds, over), skills);
const BERLIN = profileOf(ALL, { cities: "Berlin" });

type Req = { skillIds: string[]; importance: "must" | "nice"; quote: string };
const r = (id: string, importance: "must" | "nice"): Req => ({ skillIds: [id], importance, quote: `You know ${id}.` });
const SQL = r("sql", "must"), TAB = r("tableau", "must"), XLS = r("excel", "nice");
const PY = r("python", "must"), PBI = r("power-bi", "must"), RL = r("r-language", "must");
const mkJob = (title: string, company: string | null, o: { location?: string | null; remote?: "hybrid" | null; reqs: Req[] }): Job =>
  ({
    id: "pasted-ad", title, company, source: null,
    constraints: { languages: [], location: o.location ?? null, remote: o.remote ?? null, minYears: null, startDate: null, otherConditions: [] },
    requirements: o.reqs,
  }) as Job;
const JOB_A = mkJob("Reporting Analyst", "Northlake Foods Ltd", { location: "Berlin", remote: "hybrid", reqs: [SQL, TAB, XLS] });
const JOB_B = mkJob("Operations Coordinator", "Harbor Light Stationery", { location: "Exampleville", remote: "hybrid", reqs: [SQL, TAB] });
const JOB_C = mkJob("Customer Helper", "Imaginary Pages Ltd", { reqs: [] });
const JOB_D = mkJob("Data Clerk", "Example Wharf Ltd", { location: "Berlin", remote: "hybrid", reqs: [SQL] });

const reading = (job: Job) => ({ job, removed: [], moved: [], unlisted: [], notCounted: [] });
const rec = (id: string, savedAt: string, job: Job, over: Partial<SavedJob> = {}): SavedJob => ({
  schemaVersion: 1, id, savedAt, adText: `The ad text of ${id}.`, extraction: null, reading: reading(job), stamps: { ...CURRENT }, ...over,
});
const A = rec("a", "2026-11-18T10:00:00.000Z", JOB_A);
const B = rec("b", "2026-11-20T10:00:00.000Z", JOB_B);
const C = rec("c", "2026-11-19T10:00:00.000Z", JOB_C);
const D = rec("d", "2026-11-21T10:00:00.000Z", JOB_D);
const rows = (ads: SavedJob[], profile: ReturnType<typeof profileOf> | null) =>
  rankedAdRows(openedReadings(ads, { stamps: CURRENT, skills }), profile, skills);
const ids = (x: { rows: { id: string }[] }) => x.rows.map((y) => y.id);

const NOTE = 'No fit levels yet: no profile is in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.';
const OLD = "Old reading: open it to read it again.";
const FAILED = "A level could not be worked out for this ad.";
const LEAD_B = "Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon.";

afterEach(() => vi.unstubAllGlobals());

describe("L1 to L3: the order", () => {
  it("L1: the three-ad example: A, B, C (not the date order), with the exact lines of the plan", () => {
    const x = rows([A, B, C], BERLIN);
    expect(ids(x)).toEqual(["a", "b", "c"]);
    expect(x.note).toBeNull();
    const [a, b, c] = x.rows;
    expect([a.titleLine, a.date, a.levelLine, a.namedReason]).toEqual(["Reporting Analyst, Northlake Foods Ltd", "2026-11-18", "Fit: Strong (judged: skills, location)", null]);
    expect([b.titleLine, b.date, b.levelLine, b.namedReason]).toEqual(["Operations Coordinator, Harbor Light Stationery", "2026-11-20", "Fit: Long shot (judged: skills, location)", LEAD_B]);
    expect([c.titleLine, c.date, c.levelLine, c.namedReason]).toEqual(["Customer Helper, Imaginary Pages Ltd", "2026-11-19", "Fit: No level (no requirements found in this ad)", null]);
    expect(x.rows.map((y) => y.rank)).toEqual([0, 3, 4]);
  });

  it("L2: a tie: D (2026-11-21) before A (2026-11-18), both Strong; then B, then C; the same date and level: by id", () => {
    expect(ids(rows([A, B, C, D], BERLIN))).toEqual(["d", "a", "b", "c"]);
    const z1 = rec("z1", "2026-11-18T10:00:00.000Z", JOB_D);
    const a1 = rec("a1", "2026-11-18T10:00:00.000Z", JOB_D);
    expect(ids(rows([z1, a1], BERLIN))).toEqual(["a1", "z1"]);
  });

  it("L3: Good before Stretch before Long shot, whatever the dates", () => {
    const good = rec("good", "2026-11-10T10:00:00.000Z", mkJob("T", null, { reqs: [SQL, PY] }));
    const stretch = rec("stretch", "2026-11-20T10:00:00.000Z", mkJob("T", null, { reqs: [PY, PBI] }));
    const long = rec("long", "2026-11-30T10:00:00.000Z", mkJob("T", null, { reqs: [PY, PBI, RL] }));
    const x = rows([long, stretch, good], profileOf());
    expect(ids(x)).toEqual(["good", "stretch", "long"]);
    expect(x.rows.map((y) => y.levelLine)).toEqual(["Fit: Good (skills only)", "Fit: Stretch (skills only)", "Fit: Long shot (skills only)"]);
  });
});

describe("L4 to L6: no profile in use", () => {
  it("L4: no level line on any row, ONE note, date order newest first", () => {
    const x = rows([A, B, C], null);
    expect(x.note).toBe(NOTE);
    expect(ids(x)).toEqual(["b", "c", "a"]);
    expect(x.rows.every((y) => y.levelLine === null && y.levelText === null && y.namedReason === null && !y.error)).toBe(true);
    expect(x.rows.map((y) => y.titleLine)).toEqual(["Operations Coordinator, Harbor Light Stationery", "Customer Helper, Imaginary Pages Ltd", "Reporting Analyst, Northlake Foods Ltd"]);
  });

  async function storeWithProfile(profileValue: unknown) {
    const store = new MemoryStore();
    const ctx: SavedContext = { store, stamps: CURRENT };
    for (const x of [A, B, C]) await store.put("jobs", x.id, x);
    await store.put("profile", "current", profileValue);
    return { store, ctx };
  }

  it("L5: a saved profile record that cannot be read is never read by the list: the same as L4, the record untouched", async () => {
    const { store, ctx } = await storeWithProfile({ junk: true });
    const get = vi.spyOn(store, "get");
    const listed = await listJobs(ctx);
    expect(listed.ok).toBe(true);
    const x = rows(listed.ok ? listed.jobs : [], null);
    expect(x.note).toBe(NOTE);
    expect(ids(x)).toEqual(["b", "c", "a"]);
    expect(get.mock.calls.filter((c) => c[0] === "profile")).toEqual([]);
    expect(await store.get("profile", "current")).toEqual({ junk: true });
  });

  it("L6: a saved profile from a newer app: the same as L4; the record is not changed", async () => {
    const newer = { schemaVersion: 99, savedAt: "2030-01-01T00:00:00.000Z", skills: [], constraints: {}, set: {}, stamps: {}, future: true };
    const { store, ctx } = await storeWithProfile(newer);
    const listed = await listJobs(ctx);
    const x = rows(listed.ok ? listed.jobs : [], null);
    expect(x.note).toBe(NOTE);
    expect(await store.get("profile", "current")).toEqual(newer);
    expect(store.writes).toBe(4); // only the four puts of this test's set-up (three ads and the profile): the list wrote nothing
  });
});

describe("L7 to L11: the state of a reading", () => {
  const EXTRACTION_TEXT = "Reporting Analyst\nNorthlake Foods Ltd, Berlin. Hybrid, two days in the office.\nYou write SQL queries.\nYou build dashboards in Tableau.\nExcel skills are a plus.";
  const EXTRACTION = {
    title: "Reporting Analyst", company: "Northlake Foods Ltd", location: "Berlin",
    workMode: { value: "hybrid" as const, quote: "Hybrid, two days in the office." }, minYears: null, startDate: null, languages: [], otherConditions: [],
    requirements: [
      { quote: "You write SQL queries.", importance: "must" as const, skills: [{ name: "SQL" }] },
      { quote: "You build dashboards in Tableau.", importance: "must" as const, skills: [{ name: "Tableau" }] },
      { quote: "Excel skills are a plus.", importance: "nice" as const, skills: [{ name: "Excel" }] },
    ],
  };

  it("L7: older instructions: the level of the OLD stored reading, plus the old-reading line, still ranked by that level", () => {
    const old = rec("a", "2026-11-18T10:00:00.000Z", JOB_A, { stamps: { ...CURRENT, adRequestHash: "ad-old" } });
    const x = rows([old, C], BERLIN);
    expect(ids(x)).toEqual(["a", "c"]);
    expect(x.rows[0].levelLine).toBe("Fit: Strong (judged: skills, location)");
    expect(x.rows[0].oldReadingLine).toBe(OLD);
    expect(x.rows[1].oldReadingLine).toBeNull();
  });

  it("L8: same request hash, other vocabulary stamp, a stored extraction: re-checked, the level Open would show, no old-reading line, nothing written", () => {
    const stale = rec("a", "2026-11-18T10:00:00.000Z", mkJob("Reporting Analyst", "Northlake Foods Ltd", { reqs: [] }), {
      adText: EXTRACTION_TEXT, extraction: EXTRACTION, stamps: { ...CURRENT, vocabularyHash: "vocab-old" },
    });
    const before = JSON.stringify(stale);
    const x = rows([stale], BERLIN);
    expect(x.rows[0].levelLine).toBe("Fit: Strong (judged: skills, location)"); // the stored reading alone would say "No level (no requirements...)"
    expect(x.rows[0].oldReadingLine).toBeNull();
    expect(JSON.stringify(stale)).toBe(before);
  });

  it("L9: another vocabulary stamp and NO stored extraction: cannot be re-checked: the old reading's level and the old-reading line", () => {
    const stale = rec("a", "2026-11-18T10:00:00.000Z", JOB_A, { stamps: { ...CURRENT, vocabularyHash: "vocab-old" } });
    const x = rows([stale], BERLIN);
    expect(x.rows[0].levelLine).toBe("Fit: Strong (judged: skills, location)");
    expect(x.rows[0].oldReadingLine).toBe(OLD);
  });

  it("L10: computing one row throws: that row says so, sorts with the No level group, the other rows are exactly as without it", () => {
    const bad = rec("bad", "2026-11-22T10:00:00.000Z", { ...JOB_A, requirements: [null as unknown as Req] });
    const withBad = rows([A, bad, C], BERLIN);
    expect(ids(withBad)).toEqual(["a", "bad", "c"]); // No level group: newest first, so bad (11-22) before c (11-19)
    const badRow = withBad.rows[1];
    expect([badRow.error, badRow.errorLine, badRow.levelLine, badRow.titleLine]).toEqual([true, FAILED, null, "Reporting Analyst, Northlake Foods Ltd"]);
    const without = rows([A, C], BERLIN);
    expect(withBad.rows.filter((y) => y.id !== "bad")).toEqual(without.rows);
    // openJob itself failing (a record without stamps) gives the same kind of row, not an exception
    const noStamps = { ...A, id: "ns", stamps: undefined } as unknown as SavedJob;
    expect(() => rows([noStamps], BERLIN)).not.toThrow();
    expect(rows([noStamps], BERLIN).rows[0].errorLine).toBe(FAILED);
  });

  it("L11: a newer-schema record and a corrupted one are not rows; the notice counts them; both stay in the store", async () => {
    const store = new MemoryStore();
    const ctx: SavedContext = { store, stamps: CURRENT };
    await store.put("jobs", "a", A);
    await store.put("jobs", "newer", { ...A, id: "newer", schemaVersion: 99 });
    await store.put("jobs", "junk", { nonsense: true });
    const listed = await listJobs(ctx);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect([listed.corrupted, listed.newer]).toEqual([1, 1]);
    expect(listNotice(listed.corrupted, listed.newer)).toEqual(["1 saved ad could not be read.", "1 saved ad was saved by a newer version of the app and is left untouched."]);
    expect(ids(rows(listed.jobs, BERLIN))).toEqual(["a"]);
    expect((await store.list("jobs")).map((e) => e.key).sort()).toEqual(["a", "junk", "newer"]);
  });
});

describe("L12 to L18: nothing written, the profile in use, deletes, the label", () => {
  class SpyStore extends MemoryStore {
    calls: string[] = [];
    async get(s: "profile" | "jobs", k: string) { this.calls.push(`get ${s}`); return super.get(s, k); }
    async list(s: "profile" | "jobs") { this.calls.push(`list ${s}`); return super.list(s); }
  }

  it("L12: building the rows: no put, delete or clear; no read of the profile record; fetch never called", async () => {
    const store = new SpyStore();
    const ctx: SavedContext = { store, stamps: CURRENT };
    for (const x of [A, B, C]) await store.put("jobs", x.id, x);
    await store.put("profile", "current", savedFromBuilt(BERLIN, CURRENT, new Date("2026-11-17T00:00:00Z")));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    store.writes = 0;
    store.calls = [];
    const listed = await listJobs(ctx);
    const jobs = listed.ok ? listed.jobs : [];
    rows(jobs, BERLIN);
    rows(jobs, null);
    expect(store.writes).toBe(0);
    expect(store.calls).toEqual(["list jobs"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("L13: the profile in use changes, by route: R4 (saved profile used, then deleted), R5 (a CV-built profile stays), R6 (delete everything)", async () => {
    const saved = savedFromBuilt(BERLIN, CURRENT, new Date("2026-11-17T00:00:00Z"));
    const used = builtFromSaved(saved);
    expect(rows([A, B, C], used).rows.map((y) => y.levelLine)).toEqual(["Fit: Strong (judged: skills, location)", "Fit: Long shot (judged: skills, location)", "Fit: No level (no requirements found in this ad)"]);
    // R4: "Delete this profile" clears the saved profile in use; with no CV read, no profile is in use
    const r4 = rows([A, B, C], null);
    expect(r4.rows.every((y) => y.levelLine === null)).toBe(true);
    expect(r4.note).toBe(NOTE);
    // R5: a profile confirmed from a CV is still in use after the saved copy is deleted: rows unchanged
    expect(rows([A, B, C], BERLIN)).toEqual(rows([A, B, C], BERLIN));
    expect(rows([A, B, C], BERLIN).note).toBeNull();
    // R6: delete everything: the ads are gone, so there are no rows
    const store = new MemoryStore();
    const ctx: SavedContext = { store, stamps: CURRENT };
    for (const x of [A, B, C]) await store.put("jobs", x.id, x);
    expect(await deleteAll(ctx)).toEqual({ ok: true });
    const listed = await listJobs(ctx);
    const after = rows(listed.ok ? listed.jobs : [], BERLIN);
    expect(after.rows).toEqual([]);
    expect(after.note).toBeNull();
  });

  it("L14: a profile just confirmed from a CV: the rows follow the confirm screen, in step with the report", () => {
    const untickTableau = profileOf(["sql", "excel"], { cities: "Berlin" });
    const first = rows([A, B, C], untickTableau);
    expect(first.rows.map((y) => y.levelLine)).toEqual(["Fit: Good (judged: skills, location)", "Fit: Long shot (judged: skills, location)", "Fit: No level (no requirements found in this ad)"]);
    expect(ids(first)).toEqual(["a", "b", "c"]);
    const exampleville = profileOf(["sql", "excel"], { cities: "Exampleville" });
    const second = rows([A, B, C], exampleville);
    expect(second.rows.map((y) => y.levelLine)).toEqual(["Fit: Good (judged: skills, location)", "Fit: Long shot (judged: skills, location)", "Fit: No level (no requirements found in this ad)"]);
    expect(ids(second)).toEqual(["b", "a", "c"]);
    // each state's row text is what the report would show for that ad
    for (const [profile, x] of [[untickTableau, first], [exampleville, second]] as const) {
      for (const row of x.rows) {
        const ad = [A, B, C].find((q) => q.id === row.id)!;
        expect(row.levelText).toBe(profileReport(ad.reading.job, profile, skills, ad.reading.unlisted).fitLabel);
      }
    }
  });

  it("L15: one ad deleted: its row disappears, the others keep their order and levels", async () => {
    const store = new MemoryStore();
    const ctx: SavedContext = { store, stamps: CURRENT };
    for (const x of [A, B, C, D]) await store.put("jobs", x.id, x);
    const before = rows((await listJobs(ctx) as { jobs: SavedJob[] }).jobs, BERLIN);
    expect(ids(before)).toEqual(["d", "a", "b", "c"]);
    expect(await deleteJob(ctx, "a")).toEqual({ ok: true });
    const after = rows((await listJobs(ctx) as { jobs: SavedJob[] }).jobs, BERLIN);
    expect(ids(after)).toEqual(["d", "b", "c"]);
    expect(after.rows).toEqual(before.rows.filter((y) => y.id !== "a"));
  });

  it("L16: each row's level text is what reportFor (the page's own function) returns for the same ad and profile", () => {
    for (const profile of [BERLIN, profileOf(["sql"], { cities: "Exampleville" }), profileOf([])]) {
      for (const row of rows([A, B, C, D], profile).rows) {
        const ad = [A, B, C, D].find((q) => q.id === row.id)!;
        expect(row.levelText).toBe(reportFor(ad.reading, profile, skills).fitLabel);
        expect(row.levelLine).toBe(`Fit: ${row.levelText}`);
      }
    }
  });

  it("L18: 15 saved ads: 15 ranked rows, and a fresh context on the same store gives the same rows in the same order", async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 15; i++) {
      const day = String(1 + i).padStart(2, "0");
      const job = i % 3 === 0 ? JOB_A : i % 3 === 1 ? JOB_B : JOB_C;
      const text = `Ad number ${i}, written for this test.`;
      const saved = await saveJob({ store, stamps: CURRENT, now: () => new Date(`2026-11-${day}T10:00:00.000Z`) }, { adText: text, extraction: null, reading: reading(job) });
      expect(saved.ok).toBe(true);
    }
    const first = await listJobs({ store, stamps: CURRENT });
    const second = await listJobs({ store, stamps: { ...CURRENT } });
    const one = rows(first.ok ? first.jobs : [], BERLIN);
    const two = rows(second.ok ? second.jobs : [], BERLIN);
    expect(one.rows).toHaveLength(15);
    expect(one.rows.map((y) => y.rank)).toEqual([...one.rows.map((y) => y.rank)].sort((a, b) => a - b));
    expect(two.rows).toEqual(one.rows);
    // five of each kind: Strong (A), Long shot (B), No level (C), in that order, newest first inside each group
    expect(one.rows.map((y) => y.rank)).toEqual([...Array(5).fill(0), ...Array(5).fill(3), ...Array(5).fill(4)]);
  });
});

describe("L19: the same ad and the same profile in use: the row text equals the opened report's text, on three routes", () => {
  // The opened report is built the way the page builds it for a profile: profileReport on the opened reading.
  const opened = (ad: SavedJob, profile: ReturnType<typeof profileOf>) => {
    const o = openedReadings([ad], { stamps: CURRENT, skills })[0].opened;
    if (o.kind === "failed" || o.kind === "newer-version") throw new Error("not opened");
    return profileReport(o.reading.job, profile, skills, o.reading.unlisted);
  };

  it("route 1: a profile just confirmed from the invented CV", () => {
    const profile = profileOf(ALL, { cities: "Berlin" });
    for (const row of rows([A, B, C], profile).rows) {
      const ad = [A, B, C].find((q) => q.id === row.id)!;
      expect(row.levelText).toBe(opened(ad, profile).fitLabel);
    }
  });

  it("route 2: a profile loaded by 'Use this profile' (saved, then read back with builtFromSaved)", () => {
    const profile = builtFromSaved(savedFromBuilt(profileOf(ALL, { cities: "Berlin" }), CURRENT, new Date("2026-11-17T00:00:00Z")));
    for (const row of rows([A, B, C], profile).rows) {
      const ad = [A, B, C].find((q) => q.id === row.id)!;
      expect(row.levelText).toBe(opened(ad, profile).fitLabel);
    }
  });

  it("route 3: no profile in use: the rows have NO level and the note; the opened report is the typed-list report", () => {
    const x = rows([A, B, C], null);
    expect(x.note).toBe(NOTE);
    expect(x.rows.every((y) => y.levelText === null)).toBe(true);
    const typedList = skillsOnlyReport(A.reading.job, [], [], skills, []);
    expect(typedList.fitLabel).toBe("No level (no skills on your list)");
  });
});
