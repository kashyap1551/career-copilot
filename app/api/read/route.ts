import { aiPaused, PAUSED_MESSAGE, PAUSED_STATUS } from "@/lib/ai/enabled";
import { jsonNoStore } from "@/lib/ai/noStore";
import { readThroughCache } from "@/lib/ai/readCache";
import { readJobAd, ReadAdError } from "@/lib/ai/readJob";
import { readRequestSchema } from "@/lib/schemas/job";

// POST { text } -> { job } (schema-checked), or { error } with a plain message.
export async function POST(request: Request) {
  // The kill switch: AI_ENABLED=false pauses this route without calling the AI.
  if (aiPaused()) {
    return jsonNoStore({ error: PAUSED_MESSAGE }, { status: PAUSED_STATUS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: 'Send JSON like { "text": "the job ad" }.' }, { status: 400 });
  }

  const parsed = readRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  try {
    // { job, removed, moved, unlisted, notCounted }: the checked job, what was dropped,
    // what moved to otherConditions, skills not in the skill list yet, and requirements
    // that are not skills a CV can show (not counted, still listed).
    // The reading cache sits here: after the kill switch and the input checks, before the AI call. The same ad twice is
    // one call; x-reading-cache says hit or miss (docs/DECISIONS.md, "the reading cache"). A copy is stored, never the
    // object returned, and a failed read is never stored.
    const { reading, source } = await readThroughCache(parsed.data.text, readJobAd);
    return jsonNoStore(reading, { headers: { "x-reading-cache": source } });
  } catch (error) {
    if (error instanceof ReadAdError) {
      return jsonNoStore(
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
    return jsonNoStore({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
