import { createHash, timingSafeEqual } from "node:crypto";
import {
  ACCESS_DENIED_MESSAGE,
  ACCESS_DENIED_STATUS,
  ACCESS_HEADER,
  MAX_CODE_CHARS,
  MIN_CODE_CHARS,
  NOT_CONFIGURED_MESSAGE,
  NOT_CONFIGURED_STATUS,
} from "./accessMessages";
import { jsonNoStore } from "./noStore";

// The shared access code (docs/PLAN-ACCESS-CODE.md, section 2). SERVER ONLY: it uses node:crypto and reads ACCESS_CODE;
// nothing under app/ may import this file (a guard test). Called by both AI routes, right after the kill switch and before
// the body is parsed or the reading cache is asked.
//
// Never logged, never echoed: no console call and no answer ever holds the configured code or the value that was sent.

// Configured = after a trim it has 16 to 128 printable ASCII characters (no spaces inside). Unset, blank, too short, too
// long or other characters all mean "not configured". Read when called, never at load.
function configuredCode(): string | null {
  const raw = process.env.ACCESS_CODE?.trim();
  if (!raw) return null;
  if (raw.length < MIN_CODE_CHARS || raw.length > MAX_CODE_CHARS) return null;
  if (!/^[\x21-\x7e]+$/.test(raw)) return null;
  return raw;
}

// The check is skipped ONLY when NODE_ENV is exactly "development" or "test". Any other value, including unset, behaves
// like production (fail closed).
function openEnvironment(): boolean {
  const env = process.env.NODE_ENV as string | undefined;
  return env === "development" || env === "test";
}

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

// null = go on; a Response = the answer to return.
export function checkAccess(request: Request): Response | null {
  const code = configuredCode();
  if (code === null) {
    if (openEnvironment()) return null;
    return jsonNoStore({ error: NOT_CONFIGURED_MESSAGE }, { status: NOT_CONFIGURED_STATUS });
  }
  // Both sides are hashed first: two 32-byte values, so neither the length of the real code nor how many leading
  // characters were right can be read from the time taken. A missing header is the empty string, hashed the same way.
  const sent = request.headers.get(ACCESS_HEADER) ?? "";
  if (timingSafeEqual(digest(sent), digest(code))) return null;
  return jsonNoStore({ error: ACCESS_DENIED_MESSAGE }, { status: ACCESS_DENIED_STATUS });
}
