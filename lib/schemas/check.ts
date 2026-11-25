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
