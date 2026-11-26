import { z } from "zod";

// What the AI returns for the evidence check (docs/PLAN-EVERY-CV.md 4.3): one answer for each requirement it was given. Plain code
// (lib/engine/evidenceProof.ts) checks every answer against what was sent. Groq's strict mode: every field required, `.nullable()` and never
// `.optional()`, no length limits in this schema, and plain numbers (no `.int()`: it would add minimum and maximum keywords that Groq's strict-mode
// documentation does not list; a number that is not whole matches no requirement or entry and is thrown away by the proof; AM11). No `.describe()` texts: the instruction text (lib/ai/checkEvidence.ts) is the only guidance.

export const checkAnswerSchema = z.object({
  answers: z.array(
    z.object({
      requirement: z.number(),
      verdict: z.enum(["met", "partly", "none"]),
      entry: z.number().nullable(),
      quote: z.string().nullable(),
    }),
  ),
});

export type CheckAnswers = z.infer<typeof checkAnswerSchema>;

// What the page sends to /api/check (docs/PLAN-EVERY-CV.md 4.3): the requirement texts of the ad and the CV entries. EC-8a: each entry is one line of the
// person's CV, named "CV line <n>", with the line's text. Not sent to the AI as a schema, so it can have limits; nothing else is read from the body. The route refuses contact details in the entries
// (the same check /api/cv uses); the requirement texts come from the ad and are not cleaned.
export const checkRequestSchema = z.object({
  requirements: z.array(z.string().min(1).max(1000)).min(1).max(30),
  entries: z.array(z.object({ name: z.string().min(1).max(120), text: z.string().min(1).max(1000) })).min(1).max(120),
});

export type CheckRequest = z.infer<typeof checkRequestSchema>;
