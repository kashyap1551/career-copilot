// Step 8.3 (docs/PLAN-8.3.md v2, D12 and 0.26): the same browser call with an abort signal added, so a request can be given up after 30 seconds. It is not a sender of its
// own: it is handed to `postJson` (app/accessFetch.ts), which stays the one place that sends a request.
export function fetchWithSignal(signal: AbortSignal, base: typeof fetch = fetch): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => base(input, { ...init, signal })) as typeof fetch;
}
