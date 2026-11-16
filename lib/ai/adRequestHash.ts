// The first 10 characters of the hash of the request the ad reader sends to the AI (the instructions, the schema, the
// settings, the model). A constant, so the browser can stamp a saved job with it without shipping the prompt text. No
// node: import. A test computes the hash in Node from the real request and fails if this differs: when the instructions
// change, update this AND bump READING_VERSION (lib/ai/readingVersion.ts) in the same commit.
export const AD_REQUEST_HASH = "85357f8fac";
