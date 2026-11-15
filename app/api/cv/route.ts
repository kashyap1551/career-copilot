import { aiPaused, PAUSED_MESSAGE, PAUSED_STATUS } from "@/lib/ai/enabled";
import { ReadAdError } from "@/lib/ai/errors";
import { readCvLines } from "@/lib/ai/readCv";
import { readCvRequestSchema } from "@/lib/schemas/cv";

// POST { lines } -> { skills, removed, duplicates, unlisted }, or { error }.
// The lines are the CV as the person saw it, with contact details already
// removed in the browser. This route never edits a line: it only refuses a
// request that is too big or still holds contact details. It stores nothing
// and logs nothing about the CV (docs/PLAN-4.2.md).
export async function POST(request: Request) {
  if (aiPaused()) {
    return Response.json({ error: PAUSED_MESSAGE }, { status: PAUSED_STATUS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Send JSON like { "lines": ["first line", "second line"] }.' },
      { status: 400 },
    );
  }

  const parsed = readCvRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const { skills, removed, duplicates, unlisted } = await readCvLines(parsed.data.lines);
    return Response.json({ skills, removed, duplicates, unlisted });
  } catch (error) {
    if (error instanceof ReadAdError) {
      return Response.json(
        {
          error: error.message,
          ...(process.env.NODE_ENV !== "production" && error.detail ? { detail: error.detail } : {}),
        },
        { status: error.status },
      );
    }
    console.error("cv: unexpected error in route");
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
