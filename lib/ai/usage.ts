// Which parts of Groq's answer we keep for the eval's budget line: only the
// rate-limit headers (plain numbers and times). Nothing else from the answer.
export function pickRateLimitHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    const lower = name.toLowerCase();
    if (lower.startsWith("x-ratelimit")) kept[lower] = value;
  }
  return kept;
}
