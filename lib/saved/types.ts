import type { Kind } from "../cv/profile";
import type { BuildResult, NotCounted, RemovedItem } from "../engine/fromAd";
import type { Evidence, Job, ProfileConstraints, ProfileSkill, Skill } from "../engine/types";
import type { ExtractedAd } from "../schemas/job";

// The shapes of what is kept on this device (docs/PLAN-6.1.md, approved 2026-11-16). Pure types and one constant: no
// browser API, no node API, so the logic runs in the browser and in the tests.

// Bumped only by a change that is not additive (a new optional field needs no bump; see migrate.ts).
export const SCHEMA_VERSION = 1;

export type StoreName = "profile" | "jobs";

// The stamps of the code that is running now. The logic takes them as parameters, so it does not depend on how a
// caller finds them (part 2 of 6.1 adds the constants and the browser-safe vocabulary hash).
export type CurrentStamps = { vocabularyHash: string; readingVersion: string; adRequestHash: string };

// The confirmed profile only: the kept skills with the cited line number and that line's text, in-progress skills with
// dates, the constraints, and which constraint kinds the person set. NOT the CV text, NOT the AI's proposals.
export type SavedProfile = {
  schemaVersion: number;
  savedAt: string; // ISO date-time, set when the person clicks Save
  skills: ProfileSkill[];
  constraints: ProfileConstraints;
  set: Record<Kind, boolean>;
  stamps: { vocabularyHash: string; readingVersion: string };
  // EC-2 (docs/PLAN-EVERY-CV.md 4.6): the confirmed skills that are not in our skill list yet, each with its CV line (word for word). OPTIONAL, so no
  // schema bump: a profile saved before has no such field (absent = "saved before unlisted skills were kept"), a newer app's record keeps it (loose
  // object). `inferred` absent means false.
  unlistedKept?: { name: string; skillId: string; evidence: Evidence; inferred?: boolean }[];
};

// The checked reading, as shown when the job was saved.
export type SavedReading = {
  job: Job;
  removed: RemovedItem[];
  moved: BuildResult["moved"];
  unlisted: Skill[];
  notCounted: NotCounted[];
};

export type SavedJob = {
  schemaVersion: number;
  id: string; // first 16 hex characters of SHA-256 of the trimmed ad text: one record per ad text
  savedAt: string;
  adText: string; // the trimmed ad text, exactly what was sent to the AI
  extraction: ExtractedAd | null; // the AI's raw reading (the names as the AI wrote them); null if unavailable
  reading: SavedReading;
  stamps: { vocabularyHash: string; readingVersion: string; adRequestHash: string };
  // Reserved, NOT built in 6.1: removedByYou?: { quote: string }[]  (a remove-only list of requirements). A reader
  // treats an absent field as empty; an app that does not know it keeps it (records are read "loose").
};

export type FailureReason = "unavailable" | "quota" | "failed" | "corrupted" | "newer-version";
export type Failed = { ok: false; reason: FailureReason };
