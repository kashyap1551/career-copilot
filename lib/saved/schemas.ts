import { z } from "zod";
import { LANGUAGE_LEVELS } from "../engine/types";
import { extractedAdSchema } from "../schemas/job";

// Records are validated when they are READ (a corrupted record is skipped with a count, never trusted). Objects are
// "loose": a field this app does not know (a later optional one, such as removedByYou) is kept, not stripped.

const str = z.string();
const level = z.enum(LANGUAGE_LEVELS);
const importance = z.enum(["must", "nice"]);
const mode = z.enum(["onsite", "hybrid", "remote"]);

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
  removed: z.array(z.looseObject({ what: str, why: str, text: str })),
  moved: z.array(z.looseObject({ from: str, quote: str })),
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
    evidence: z.object({ line: z.number().int().min(1), text: str }).nullable(),
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
});
