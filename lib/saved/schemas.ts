import { z } from "zod";
import { MAX_CV_LINES } from "../cv/limits";
import type { RemovalReason, RemovedWhat } from "../engine/fromAd";
import { LANGUAGE_LEVELS } from "../engine/types";
import { extractedAdSchema } from "../schemas/job";
import type { SavedJob, SavedProfile } from "./types";

// Records are validated when they are READ (a corrupted record is skipped with a count, never trusted). Objects are
// "loose": a field this app does not know (a later optional one, such as removedByYou) is kept, not stripped.

const str = z.string();
const level = z.enum(LANGUAGE_LEVELS);
const importance = z.enum(["must", "nice"]);
const mode = z.enum(["onsite", "hybrid", "remote"]);

// The real unions of lib/engine/fromAd.ts, written out so a record is checked against them (not against "any string").
// The two `satisfies` lines and the two Exhaustive types below make tsc fail if fromAd.ts gains a member that is not here.
const REMOVED_WHAT = ["title", "company", "location", "workMode", "minYears", "startDate", "language", "languageLevel", "otherCondition", "requirement"] as const satisfies readonly RemovedWhat[];
const REMOVAL_REASON = ["not-in-ad", "no-skill", "number-not-in-quote", "number-out-of-range", "no-full-date", "date-mismatch", "level-not-in-quote", "several-cities", "tag-not-sentence"] as const satisfies readonly RemovalReason[];
export type RemovedWhatIsExhaustive = [Exclude<RemovedWhat, (typeof REMOVED_WHAT)[number]>] extends [never] ? true : never;
export type RemovalReasonIsExhaustive = [Exclude<RemovalReason, (typeof REMOVAL_REASON)[number]>] extends [never] ? true : never;

const requirement = z.looseObject({
  skillIds: z.array(str).min(1),
  importance,
  quote: str,
  closeMatches: z.array(z.looseObject({ name: str, skillId: str, via: str })).optional(),
});

const job = z.looseObject({
  id: str,
  title: str,
  company: str.nullable(),
  source: str.nullable(),
  constraints: z.looseObject({
    languages: z.array(z.looseObject({ code: str, level: level.nullable() })),
    location: str.nullable(),
    remote: mode.nullable(),
    minYears: z.number().nullable(),
    startDate: str.nullable(),
    otherConditions: z.array(z.looseObject({ quote: str })),
  }),
  requirements: z.array(requirement),
});

const reading = z.looseObject({
  job,
  removed: z.array(z.looseObject({ what: z.enum(REMOVED_WHAT), why: z.enum(REMOVAL_REASON), text: str })),
  moved: z.array(z.looseObject({ from: z.enum(REMOVED_WHAT), quote: str })),
  unlisted: z.array(z.looseObject({ id: str, name: str })),
  notCounted: z.array(z.looseObject({ quote: str, importance })),
});

export const savedJobSchema = z.looseObject({
  schemaVersion: z.number().int(),
  id: str,
  savedAt: str,
  adText: str,
  extraction: extractedAdSchema.nullable(),
  reading,
  stamps: z.looseObject({ vocabularyHash: str, readingVersion: str, adRequestHash: str }),
});

const profileSkill = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("have"),
    skillId: str,
    // A cited line is 1..MAX_CV_LINES: the most lines a CV can have in this app (lib/cv/limits.ts).
    evidence: z.object({ line: z.number().int().min(1).max(MAX_CV_LINES), text: str }).nullable(),
  }),
  z.object({ kind: z.literal("inProgress"), skillId: str, expectedDate: str }),
]);

export const savedProfileSchema = z.looseObject({
  schemaVersion: z.number().int(),
  savedAt: str,
  skills: z.array(profileSkill),
  constraints: z.looseObject({
    languages: z.array(z.looseObject({ code: str, level })),
    locations: z.array(str),
    workModes: z.array(mode),
    years: z.number().nullable(),
    availableFrom: str.nullable(),
  }),
  set: z.object({ location: z.boolean(), language: z.boolean(), workMode: z.boolean(), years: z.boolean(), startDate: z.boolean() }),
  stamps: z.looseObject({ vocabularyHash: str, readingVersion: str }),
  // EC-2: optional; a cited line is 1..MAX_CV_LINES like the other cited lines.
  unlistedKept: z
    .array(z.object({ name: str, skillId: str, evidence: z.object({ line: z.number().int().min(1).max(MAX_CV_LINES), text: str }), inferred: z.boolean().optional() }))
    .optional(),
});

// Compile-time checks: what a schema parses must be assignable to the type the rest of the app uses, so the cast in
// saved.ts (`as T`) cannot hide a mismatch. If a schema drifts from its type, tsc fails here.
export const _jobSchemaMatchesType = (x: z.infer<typeof savedJobSchema>): SavedJob => x;
export const _profileSchemaMatchesType = (x: z.infer<typeof savedProfileSchema>): SavedProfile => x;
