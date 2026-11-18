// The first 10 characters of the hash of the request the bullets writer sends to the AI (the instructions, the answer schema, the settings, the model). A
// constant, like lib/ai/adRequestHash.ts. A test (tests/bulletsRequestHashPin.test.ts) computes the hash in Node from the real request, call-free, and fails if
// this differs: when the prompt, the answer schema or a setting changes, change this AND the literal of that test in the same commit.
export const BULLETS_REQUEST_HASH = "5e3da9fa30";
