// Every answer of /api/read and /api/cv says `Cache-Control: no-store` (6.1 part 3c). Without it Vercel's default,
// "public, max-age=0, must-revalidate", applies; the CV answer holds a person's data, so no copy of an answer may be kept
// by a cache. One helper, so no answer of the two routes can forget it. No node: import.
export function jsonNoStore(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return Response.json(body, { status: init.status, headers: { ...init.headers, "Cache-Control": "no-store" } });
}
