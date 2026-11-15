import { z } from "zod";
import { MAX_CV_CHARS, MAX_CV_LINES, MAX_LINE_CHARS } from "../cv/limits";
import { containsContactDetails } from "../cv/redact";

// What the AI returns for a CV: skills, each tied to a line and a quote from
// that line. Plain code (lib/engine/fromCv.ts) checks it against the numbered
// lines. Groq's strict mode: every field required, no optional fields, no
// length limits in this schema (they are checked in code).

export const extractedCvSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string().describe("A short plain skill name, as people write it."),
      line: z.number().describe("The number of the one line that shows the skill."),
      quote: z.string().describe("The words from that line that show the skill, copied exactly."),
    }),
  ),
});

export type ExtractedCv = z.infer<typeof extractedCvSchema>;

// What the page sends to /api/cv: the CV as numbered-by-position lines. Not
// sent to the AI as a schema, so it can have limits. The server never edits a
// line: it only refuses, so the text is the one the person saw.
export const readCvRequestSchema = z.object({
  lines: z
    .array(
      z
        .string("Send each line as text.")
        .min(1, "Send the CV as non-empty lines.")
        .max(MAX_LINE_CHARS, `A line is too long. The limit is ${MAX_LINE_CHARS.toLocaleString("en-US")} characters.`)
        .refine((l) => !/[\r\n]/.test(l), "A line must not contain a line break.")
        .refine((l) => l.trim() !== "", "Send the CV as non-empty lines.")
        .refine((l) => !containsContactDetails(l), "Remove email addresses, phone numbers and links before sending."),
      "Send the CV as a list of lines.",
    )
    .min(1, "Add your CV text first.")
    .max(MAX_CV_LINES, `This CV has too many lines. The limit is ${MAX_CV_LINES}.`)
    .refine(
      (lines) => lines.reduce((n, l) => n + l.length, 0) <= MAX_CV_CHARS,
      `This CV is too long. The limit is ${MAX_CV_CHARS.toLocaleString("en-US")} characters.`,
    ),
});
