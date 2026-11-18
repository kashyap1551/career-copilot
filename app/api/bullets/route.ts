import { checkAccess } from "@/lib/ai/accessCode";
import { aiPaused, PAUSED_MESSAGE, PAUSED_STATUS } from "@/lib/ai/enabled";
import { ReadAdError } from "@/lib/ai/errors";
import { jsonNoStore } from "@/lib/ai/noStore";
import { writeBullets } from "@/lib/ai/writeBullets";
import { writeBulletsRequestSchema } from "@/lib/schemas/bullets";

// POST { pairs: [{ id, requirement, line }] } -> { bullets: [{ pair, text }], asked, dropped: [{ pair, reason }] }, or { error }.
// The order is the order of /api/cv (docs/PLAN-8.3.md 0.23): kill switch, access code, body, schema, the AI call (which checks every bullet in plain code).
// The pairs are up to 5 requirement quotes and 5 CV lines the page already cleaned of contact details; this route never edits a line, stores nothing and logs
// nothing about the text. The answer holds only bullets that passed every check, the count asked and the dropped pairs with their reasons.
export async function POST(request: Request) {
  if (aiPaused()) {
    return jsonNoStore({ error: PAUSED_MESSAGE }, { status: PAUSED_STATUS });
  }

  const denied = checkAccess(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: 'Send JSON like { "pairs": [ { "id": 1, "requirement": "...", "line": "..." } ] }.' }, { status: 400 });
  }

  const parsed = writeBulletsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  try {
    const written = await writeBullets(parsed.data.pairs);
    return jsonNoStore({
      bullets: written.bullets.map((b) => ({ pair: b.pair, text: b.text })),
      asked: written.asked,
      dropped: written.dropped,
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
    console.error("bullets: unexpected error in route");
    return jsonNoStore({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
