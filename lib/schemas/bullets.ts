import { z } from "zod";
import { MAX_LINE_CHARS } from "../cv/limits";
import { containsContactDetails } from "../cv/redact";
import { MAX_PAIRS } from "../engine/bulletPairs";

// Step 8.3 (docs/PLAN-8.3.md v2, section 4): what the page sends to /api/bullets and what the AI answers. Groq's strict mode for the answer: every field
// required, no optional or nullable fields, no length limits in the answer schema (the plain code checks every bullet, lib/engine/bulletCheck.ts).

export const MAX_REQUIREMENT_CHARS = 300;

// A CV line, as in lib/schemas/cv.ts: one line, up to 1,000 characters, no contact details (the page removed them; the server only refuses).
const lineSchema = z
  .string("Send each CV line as text.")
  .min(1, "Send each CV line as non-empty text.")
  .max(MAX_LINE_CHARS, `A line is too long. The limit is ${MAX_LINE_CHARS.toLocaleString("en-US")} characters.`)
  .refine((l) => !/[\r\n]/.test(l), "A line must not contain a line break.")
  .refine((l) => l.trim() !== "", "Send each CV line as non-empty text.")
  .refine((l) => !containsContactDetails(l), "Remove email addresses, phone numbers and links before sending.");

const requirementSchema = z
  .string("Send each requirement as text.")
  .min(1, "Send each requirement as non-empty text.")
  .max(MAX_REQUIREMENT_CHARS, `A requirement is too long. The limit is ${MAX_REQUIREMENT_CHARS} characters.`);

// One pair: the ad's own words for one requirement and ONE of the person's CV lines. Nothing else is sent: no line number, no skill.
export const bulletRequestPairSchema = z.object({
  id: z.number("Number each pair.").int("Number each pair with a whole number."),
  requirement: requirementSchema,
  line: lineSchema,
});

export const writeBulletsRequestSchema = z.object({
  pairs: z
    .array(bulletRequestPairSchema, "Send the pairs as a list.")
    .min(1, "Send at least one pair.")
    .max(MAX_PAIRS, `Send at most ${MAX_PAIRS} pairs.`)
    .refine((pairs) => pairs.every((p, i) => p.id === i + 1), "Number the pairs 1, 2, 3 ... in order."),
});

export type BulletRequestPair = z.infer<typeof bulletRequestPairSchema>;

// What the AI returns: one bullet for each pair, with the pair's number.
export const bulletsAnswerSchema = z.object({
  bullets: z.array(
    z.object({
      pair: z.number().describe("The number of the pair, as given."),
      text: z.string().describe("The bullet: one short line built only from the words of that pair's CV line."),
    }),
  ),
});

export type BulletsAnswer = z.infer<typeof bulletsAnswerSchema>;

// What /api/bullets answers (the page checks the shape before it trusts a word of it).
export const bulletsResponseSchema = z.object({
  bullets: z.array(z.object({ pair: z.number(), text: z.string() })),
  asked: z.number(),
  dropped: z.array(z.object({ pair: z.number(), reason: z.string() })),
});
