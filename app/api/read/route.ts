import { aiPaused, PAUSED_MESSAGE, PAUSED_STATUS } from "@/lib/ai/enabled";
import { readJobAd, ReadAdError } from "@/lib/ai/readJob";
import { readRequestSchema } from "@/lib/schemas/job";

// POST { text } -> { job } (schema-checked), or { error } with a plain message.
export async function POST(request: Request) {
  // The kill switch: AI_ENABLED=false pauses this route without calling the AI.
  if (aiPaused()) {
    return Response.json({ error: PAUSED_MESSAGE }, { status: PAUSED_STATUS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Send JSON like { "text": "the job ad" }.' },
      { status: 400 },
    );
  }

  const parsed = readRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    // { job, removed, moved, unlisted }: the checked job, what was dropped,
    // what moved to otherConditions, and skills not in the skill list yet.
    const { job, removed, moved, unlisted } = await readJobAd(parsed.data.text);
    return Response.json({ job, removed, moved, unlisted });
  } catch (error) {
    if (error instanceof ReadAdError) {
      return Response.json(
        {
          error: error.message,
          // Technical detail only on a developer's machine, never live.
          ...(process.env.NODE_ENV !== "production" && error.detail
            ? { detail: error.detail }
            : {}),
        },
        { status: error.status },
      );
    }
    console.error("read: unexpected error in route");
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
