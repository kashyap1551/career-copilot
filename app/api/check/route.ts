import { checkAccess } from "@/lib/ai/accessCode";
import { checkEvidence } from "@/lib/ai/checkEvidence";
import { aiPaused, PAUSED_MESSAGE, PAUSED_STATUS } from "@/lib/ai/enabled";
import { jsonNoStore } from "@/lib/ai/noStore";
import { ReadAdError } from "@/lib/ai/errors";
import { containsContactDetails } from "@/lib/cv/redact";
import type { SentEntry, SentRequirement } from "@/lib/engine/evidenceProof";
import { checkRequestSchema } from "@/lib/schemas/check";

// POST { requirements, entries } -> { answers, thrownAway }, or { error }. The requirements are the ad's own words for what could not be judged by
// the skill list; the entries are the CV skills the person confirmed, each with its name and its CV line. The AI says which line shows which requirement;
// lib/engine/evidenceProof.ts checks every answer. The answer holds only the accepted answers (positions as the AI saw them, 1-based) and how many were
// thrown away: no entry name, no CV line, no usage, no rate-limit header. The same order as /api/cv. It stores nothing and logs nothing about the CV
// or the ad (docs/PLAN-EVERY-CV.md 4.3).

const SEND_JSON = 'Send JSON like { "requirements": ["first requirement"], "entries": [{ "name": "skill name", "text": "the CV line" }] }.';
const WRONG_FIELDS = "Send 1 to 30 requirements as texts, and 1 to 60 CV entries, each with a name and the CV line text.";
// DRAFT: the owner approves this sentence at EC-4.
const CONTACT_REFUSAL = "Some CV lines still contain an email address, a phone number or a web link, so nothing was sent. Take it out and try again.";

export async function POST(request: Request) {
  if (aiPaused()) {
    return jsonNoStore({ error: PAUSED_MESSAGE }, { status: PAUSED_STATUS });
  }

  // The access code: after the kill switch, before the body is parsed.
  const denied = checkAccess(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: SEND_JSON }, { status: 400 });
  }

  const parsed = checkRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // A JSON value that is not an object: Zod's own sentence, as /api/cv answers. Wrong fields or limits: the fixed sentence.
    return jsonNoStore({ error: issue && issue.path.length === 0 ? issue.message : WRONG_FIELDS }, { status: 400 });
  }

  // The CV lines are checked again for email addresses, phone numbers and links, with the same function /api/cv uses (a line saved under older rules
  // cannot go out unchanged). The ad's requirement texts are not cleaned.
  if (parsed.data.entries.some((e) => containsContactDetails(e.name) || containsContactDetails(e.text))) {
    return jsonNoStore({ error: CONTACT_REFUSAL }, { status: 400 });
  }

  const requirements: SentRequirement[] = parsed.data.requirements.map((quote, i) => ({ n: i + 1, index: i, quote, importance: "must" }));
  const entries: SentEntry[] = parsed.data.entries.map((e, i) => ({ n: i + 1, name: e.name, skillId: `entry:${i + 1}`, line: i + 1, text: e.text, inferred: false }));

  try {
    const result = await checkEvidence(requirements, entries);
    return jsonNoStore({
      answers: result.accepted.map((a) => ({ requirement: a.requirement, verdict: a.verdict, entry: a.entry === null ? null : a.entry.n, quote: a.quote })),
      thrownAway: result.thrownAwayCount,
    });
  } catch (error) {
    if (error instanceof ReadAdError) {
      return jsonNoStore(
        {
          error: error.message,
          ...(process.env.NODE_ENV !== "production" && error.detail ? { detail: error.detail } : {}),
        },
        { status: error.status },
      );
    }
    console.error("check: unexpected error in route");
    return jsonNoStore({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
