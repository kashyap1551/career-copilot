import type { FailureReason } from "./types";

// Versioning (docs/PLAN-6.1.md, section 5). A new OPTIONAL field needs no migration (a reader treats an absent field as
// empty). A change that is not additive bumps SCHEMA_VERSION and adds one function `vN -> vN+1` to the map; the chain runs
// in memory on opening and is written back only when the person saves again. A record of a NEWER version than the app
// knows is refused untouched (never repaired, never deleted); a record with no usable version is corrupted.

export type Migration = (record: Record<string, unknown>) => Record<string, unknown>;
export type Migrations = Record<number, Migration>;

export type Migrated =
  | { ok: true; record: Record<string, unknown> }
  | { ok: false; reason: Extract<FailureReason, "newer-version" | "corrupted"> };

export function migrateRecord(raw: unknown, current: number, migrations: Migrations): Migrated {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, reason: "corrupted" };
  let record = raw as Record<string, unknown>;
  const version = record.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return { ok: false, reason: "corrupted" };
  if (version > current) return { ok: false, reason: "newer-version" };
  let at = version;
  while (at < current) {
    const step = migrations[at];
    if (step === undefined) return { ok: false, reason: "corrupted" };
    record = step(record);
    if (record.schemaVersion !== at + 1) return { ok: false, reason: "corrupted" };
    at++;
  }
  return { ok: true, record };
}

// True for a record that a NEWER app wrote (so this app must neither read it nor overwrite it).
export function isNewerRecord(raw: unknown, current: number): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const v = (raw as Record<string, unknown>).schemaVersion;
  return typeof v === "number" && v > current;
}
