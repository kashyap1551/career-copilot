import { z } from "zod";
import { proveAnswers, type SentEntry, type SentRequirement } from "../engine/evidenceProof";
import type { ViewAnswer } from "./engineView";

// EC-4a (EC-4 proposal, Part B f): the route's answer (/api/check: accepted answers, positions as sent, 1-based) becomes the answers the engine view
// takes (the requirement's place in the ad, the entry with its CV line). The page PROVES the answers again with the same code the route used
// (lib/engine/evidenceProof.ts), so a damaged or hostile reply can never put an unproven line on the screen. Pure code.

const routeAnswerSchema = z.object({
  answers: z.array(
    z.object({
      requirement: z.number(),
      verdict: z.enum(["met", "partly", "none"]),
      entry: z.number().nullable(),
      quote: z.string().nullable(),
    }),
  ),
  thrownAway: z.number().int().min(0), // never sent to the AI, so .int() is fine here (the ban is for the AI's schema)
});

export type CheckSent = { requirements: SentRequirement[]; entries: SentEntry[] };

export function toViewAnswers(sent: CheckSent, body: unknown): { ok: true; answers: ViewAnswer[]; thrownAway: number } | { ok: false } {
  const parsed = routeAnswerSchema.safeParse(body);
  if (!parsed.success) return { ok: false };
  const proof = proveAnswers(sent.requirements, sent.entries, parsed.data.answers);
  const answers: ViewAnswer[] = [];
  for (const a of proof.accepted) {
    const requirement = sent.requirements.find((r) => r.n === a.requirement);
    if (!requirement) continue;
    answers.push({
      index: requirement.index,
      verdict: a.verdict,
      entry: a.entry === null ? null : { name: a.entry.name, skillId: a.entry.skillId, evidence: { line: a.entry.line, text: a.entry.text }, inferred: a.entry.inferred },
      quote: a.quote,
    });
  }
  return { ok: true, answers, thrownAway: parsed.data.thrownAway + proof.thrownAway.length };
}
