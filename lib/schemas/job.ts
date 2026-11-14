import { z } from "zod";

// What the AI returns for a job ad: a reading, with the ad's own words as
// proof for every claim. Plain code (lib/engine/fromAd.ts) checks it against
// the ad and turns it into the engine's Job type.
//
// Groq's strict mode: every field is required, so anything an ad might not
// state is .nullable(), never .optional(). No length limits (not documented
// for strict mode). Nested nullable objects and arrays of objects are fine.
// tests/schema.test.ts checks this against the JSON schema actually sent.

export const extractedAdSchema = z.object({
  title: z.string().nullable().describe("The job title as the ad writes it, or null."),
  company: z.string().nullable().describe("The hiring company as the ad writes it, or null."),
  location: z
    .string()
    .nullable()
    .describe("The city only, as written in the ad. Null if none, or if the ad names several cities."),
  workMode: z
    .object({
      value: z.enum(["onsite", "hybrid", "remote"]),
      quote: z.string().describe("The ad's own words for this."),
    })
    .nullable(),
  minYears: z
    .object({
      years: z.number().describe("The lowest number of years of experience asked."),
      quote: z.string().describe("The ad's own words for this."),
    })
    .nullable(),
  startDate: z
    .object({
      date: z.string().describe("YYYY-MM-DD, only if the ad gives an exact calendar date."),
      quote: z.string().describe("The ad's own words, containing that date."),
    })
    .nullable(),
  languages: z.array(
    z.object({
      language: z.string().describe("The language's name as the ad writes it."),
      levelWording: z
        .string()
        .nullable()
        .describe('The ad\'s own words for the level ("fluent", "C1", "Muttersprache"), or null if none.'),
      quote: z.string().describe("The ad's own words for this."),
    }),
  ),
  otherConditions: z.array(
    z.object({
      quote: z.string().describe("A condition that cannot be judged from skills, in the ad's own words."),
    }),
  ),
  requirements: z.array(
    z.object({
      quote: z.string().describe("The ad's own words for this requirement."),
      importance: z.enum(["must", "nice"]),
      skills: z
        .array(z.object({ name: z.string().describe("A short plain skill name.") }))
        .describe("Alternatives: any one of these satisfies the requirement."),
    }),
  ),
});

export type ExtractedAd = z.infer<typeof extractedAdSchema>;

// What the page sends to /api/read. This is not sent to the AI, so it can
// use length limits (Groq's strict mode does not document them).
// 20,000 characters keeps one request inside the free tier's limits.
export const MAX_AD_CHARS = 20_000;

export const readRequestSchema = z.object({
  text: z
    .string("Send the ad as text.")
    .trim()
    .min(1, "Paste a job ad first.")
    .max(
      MAX_AD_CHARS,
      `This ad is too long. The limit is ${MAX_AD_CHARS.toLocaleString("en-US")} characters.`,
    ),
});
