import { APICallError, NoObjectGeneratedError, RetryError } from "ai";
import { MissingSettingError } from "./model";

// Turns anything that can go wrong in a read (an ad or a CV) into a message a
// person can act on, shared by both routes.

// An error with a plain-language message that is safe to show the person,
// plus the HTTP status the route should answer with.
export class ReadAdError extends Error {
  status: number;
  // Technical detail for local development only. Never sent in production.
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ReadAdError";
    this.status = status;
    this.detail = detail;
  }
}

export type ReadSubject = "ad" | "cv";

// Logs only the kind of error and the status code: never the ad or CV text,
// never the key, never the error's own message (it could echo the text).
export function toReadError(raw: unknown, subject: ReadSubject): ReadAdError {
  const detail = raw instanceof Error ? raw.message : undefined;
  const tag = subject === "cv" ? "cv" : "read";
  const what = subject === "cv" ? "CV" : "ad";

  // The AI SDK retries a retryable error twice and then throws a RetryError
  // around the last one. Look at what was wrapped, so a 429 or a 5xx keeps its
  // status instead of becoming a generic 500.
  const error = RetryError.isInstance(raw) && raw.lastError !== undefined ? raw.lastError : raw;

  if (error instanceof MissingSettingError) {
    console.error(`${tag}: missing setting`);
    return new ReadAdError(
      "The server is missing its AI settings. Check GROQ_API_KEY and GROQ_MODEL.",
      500,
      detail,
    );
  }

  if (NoObjectGeneratedError.isInstance(error)) {
    console.error(`${tag}: the model's answer did not match the schema`);
    return new ReadAdError(
      "The AI answered, but not in the expected shape. Please try again.",
      502,
      detail,
    );
  }

  if (APICallError.isInstance(error)) {
    const code = error.statusCode;
    console.error(`${tag}: AI service error, status ${code ?? "unknown"}`);
    if (code === 429) {
      return new ReadAdError(
        "The AI service is busy right now. Please try again in a minute.",
        429,
        detail,
      );
    }
    if (code === 401 || code === 403) {
      return new ReadAdError(
        "The AI service refused the server's key. Check GROQ_API_KEY.",
        500,
        detail,
      );
    }
    if (code === 404) {
      return new ReadAdError(
        "The AI service does not know this model. Check GROQ_MODEL.",
        500,
        detail,
      );
    }
    return new ReadAdError(
      `The AI service had a problem (status ${code ?? "unknown"}). Please try again.`,
      502,
      detail,
    );
  }

  console.error(`${tag}: unexpected error`);
  return new ReadAdError(
    `Something went wrong while reading the ${what}. Please try again.`,
    500,
    detail,
  );
}
