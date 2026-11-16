import type { BuiltProfile } from "../cv/profile";
import type { ExtractedAd } from "../schemas/job";
import { jobIdFor } from "./jobId";
import { isNewerRecord, migrateRecord, type Migrations } from "./migrate";
import { savedFromBuilt } from "./profile";
import { savedJobSchema, savedProfileSchema } from "./schemas";
import { StoreError, type KeyValueStore } from "./store";
import { SCHEMA_VERSION, type CurrentStamps, type Failed, type FailureReason, type SavedJob, type SavedProfile, type SavedReading } from "./types";

// The logic layer (docs/PLAN-6.1.md, sections 3 to 6): everything the app does with the store. A storage problem is a
// RESULT ({ ok: false, reason }), never a throw, so the app always works without saving. Nothing here writes unless a
// caller calls a save, delete or clear function (the caller is a click).

export type SavedContext = { store: KeyValueStore; stamps: CurrentStamps; now?: () => Date };

// Empty today: version 1 is the only version. A change that is not additive adds `1: (r) => ...` here.
export const MIGRATIONS: Migrations = {};

const PROFILE_KEY = "current";
const fail = (reason: FailureReason): Failed => ({ ok: false, reason });
const problemOf = (e: unknown): "unavailable" | "quota" | "failed" => (e instanceof StoreError ? e.reason : "failed");
const nowOf = (ctx: SavedContext) => (ctx.now ?? (() => new Date()))();

type Read<T> = { ok: true; value: T } | Failed;
function readRecord<T>(raw: unknown, schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } }): Read<T> {
  try {
    const migrated = migrateRecord(raw, SCHEMA_VERSION, MIGRATIONS);
    if (!migrated.ok) return fail(migrated.reason);
    const parsed = schema.safeParse(migrated.record);
    // `as T` is safe because schemas.ts checks at compile time that what the schema parses is assignable to the type.
    return parsed.success ? { ok: true, value: parsed.data as T } : fail("corrupted");
  } catch {
    return fail("corrupted"); // a migration step that throws on a record it cannot handle
  }
}

// ---- the profile -----------------------------------------------------------------------------------------------------

export async function saveProfile(ctx: SavedContext, built: BuiltProfile): Promise<{ ok: true } | Failed> {
  try {
    // A profile a NEWER app wrote is never overwritten (like saveJob).
    const existing = await ctx.store.get("profile", PROFILE_KEY);
    if (existing !== undefined && isNewerRecord(existing, SCHEMA_VERSION)) return fail("newer-version");
    await ctx.store.put("profile", PROFILE_KEY, savedFromBuilt(built, ctx.stamps, nowOf(ctx)));
    return { ok: true };
  } catch (e) {
    return fail(problemOf(e));
  }
}

export async function loadProfile(ctx: SavedContext): Promise<{ ok: true; saved: SavedProfile | null } | Failed> {
  try {
    const raw = await ctx.store.get("profile", PROFILE_KEY);
    if (raw === undefined) return { ok: true, saved: null };
    const r = readRecord<SavedProfile>(raw, savedProfileSchema);
    return r.ok ? { ok: true, saved: r.value } : r;
  } catch (e) {
    return fail(problemOf(e));
  }
}

// ---- saved jobs ------------------------------------------------------------------------------------------------------

export type JobInput = { adText: string; extraction: ExtractedAd | null; reading: SavedReading };

// One record per ad text: saving the same ad again replaces it and updates savedAt. A record a NEWER app wrote under the
// same id is never overwritten.
export async function saveJob(ctx: SavedContext, input: JobInput): Promise<{ ok: true; id: string } | Failed> {
  try {
    // Everything that can fail is inside the try: the trim (a caller mistake), the hash (crypto missing) and the store.
    const adText = input.adText.trim();
    const id = await jobIdFor(adText);
    const existing = await ctx.store.get("jobs", id);
    if (existing !== undefined && isNewerRecord(existing, SCHEMA_VERSION)) return fail("newer-version");
    const record: SavedJob = {
      schemaVersion: SCHEMA_VERSION,
      id,
      savedAt: nowOf(ctx).toISOString(),
      adText,
      extraction: input.extraction,
      reading: input.reading,
      stamps: { ...ctx.stamps },
    };
    await ctx.store.put("jobs", id, record);
    return { ok: true, id };
  } catch (e) {
    return fail(problemOf(e));
  }
}

// The saved jobs, newest first. A record that cannot be read does not stop the list: it is counted (corrupted, or newer
// when a newer app wrote it) and left where it is.
export async function listJobs(
  ctx: SavedContext,
): Promise<{ ok: true; jobs: SavedJob[]; corrupted: number; newer: number } | Failed> {
  try {
    const entries = await ctx.store.list("jobs");
    const jobs: SavedJob[] = [];
    let corrupted = 0;
    let newer = 0;
    for (const { value } of entries) {
      const r = readRecord<SavedJob>(value, savedJobSchema);
      if (r.ok) jobs.push(r.value);
      else if (r.reason === "newer-version") newer++;
      else corrupted++;
    }
    jobs.sort((a, b) => (a.savedAt === b.savedAt ? a.id.localeCompare(b.id) : a.savedAt < b.savedAt ? 1 : -1));
    return { ok: true, jobs, corrupted, newer };
  } catch (e) {
    return fail(problemOf(e));
  }
}

export async function loadJob(ctx: SavedContext, id: string): Promise<{ ok: true; job: SavedJob | null } | Failed> {
  try {
    const raw = await ctx.store.get("jobs", id);
    if (raw === undefined) return { ok: true, job: null };
    const r = readRecord<SavedJob>(raw, savedJobSchema);
    return r.ok ? { ok: true, job: r.value } : r;
  } catch (e) {
    return fail(problemOf(e));
  }
}

export async function deleteJob(ctx: SavedContext, id: string): Promise<{ ok: true } | Failed> {
  try {
    await ctx.store.delete("jobs", id);
    return { ok: true };
  } catch (e) {
    return fail(problemOf(e));
  }
}

// "Delete everything saved on this device": the profile and all saved jobs.
export async function deleteAll(ctx: SavedContext): Promise<{ ok: true } | Failed> {
  try {
    await ctx.store.clear();
    return { ok: true };
  } catch (e) {
    return fail(problemOf(e));
  }
}
