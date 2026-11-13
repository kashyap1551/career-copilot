import { z } from "zod";

// The AI's answer: what a job ad says, in a fixed shape.
// Groq's strict mode needs every field present, so anything an ad might not
// state is .nullable() (the model writes null), never .optional().
export const requirementSchema = z.object({
  quote: z
    .string()
    .describe("The ad's own words for this requirement, copied exactly."),
  skill: z
    .string()
    .describe("A short name for the skill or qualification, 1 to 4 words."),
  importance: z
    .enum(["must", "nice"])
    .describe(
      '"must" if the ad requires it; "nice" if the ad calls it a plus or bonus.',
    ),
});

export const jobAdSchema = z.object({
  title: z.string().nullable().describe("The job title, or null if not stated."),
  company: z
    .string()
    .nullable()
    .describe("The hiring company, or null if not stated."),
  location: z
    .string()
    .nullable()
    .describe("The job's location, or null if not stated."),
  requirements: z.array(requirementSchema),
});

export type Requirement = z.infer<typeof requirementSchema>;
export type JobAd = z.infer<typeof jobAdSchema>;

// What the page sends to /api/read. This is not sent to the AI, so it can
// use length limits (Groq's strict mode does not support them).
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
