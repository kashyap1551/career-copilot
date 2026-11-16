import { buildJob } from "../engine/fromAd";
import type { Skill } from "../engine/types";
import { SCHEMA_VERSION, type CurrentStamps, type SavedJob, type SavedReading } from "./types";

// How an old saved job is opened (docs/PLAN-6.1.md, section 3): by comparing its stamps with the current ones. Plain
// code only: this function never calls the AI and never writes anything. A re-read (an AI call) is only OFFERED.

export type OpenedJob =
  | { kind: "newer-version" } // saved by a newer app: not opened, never changed or deleted
  | { kind: "as-stored"; reading: SavedReading }
  | { kind: "older-instructions"; reading: SavedReading; offerReread: true } // the ad request hash differs
  | { kind: "rechecked"; reading: SavedReading } // plain code re-run on the stored extraction, current vocabulary
  | { kind: "cannot-recheck"; reading: SavedReading; offerReread: true }; // no stored extraction

export function openJob(record: SavedJob, current: { stamps: CurrentStamps; skills: Skill[] }): OpenedJob {
  if (record.schemaVersion > SCHEMA_VERSION) return { kind: "newer-version" };
  const was = record.stamps;
  const now = current.stamps;
  if (was.adRequestHash !== now.adRequestHash) {
    return { kind: "older-instructions", reading: record.reading, offerReread: true };
  }
  if (was.vocabularyHash === now.vocabularyHash && was.readingVersion === now.readingVersion) {
    return { kind: "as-stored", reading: record.reading };
  }
  if (record.extraction === null) return { kind: "cannot-recheck", reading: record.reading, offerReread: true };
  // A saved record is read on every visit, so nothing here may throw: if the re-check fails for any reason, the outcome is
  // the same as "no extraction": the old reading stays on screen and a re-read is offered.
  try {
    const fresh = buildJob(record.extraction, record.adText, current.skills, { id: "pasted-ad", source: null });
    return {
      kind: "rechecked",
      reading: { job: fresh.job, removed: fresh.removed, moved: fresh.moved, unlisted: fresh.unlisted, notCounted: fresh.notCounted },
    };
  } catch {
    return { kind: "cannot-recheck", reading: record.reading, offerReread: true };
  }
}
