// The version of the ad reading, part of every reading-cache key (lib/ai/readCache.ts). Change it, together with the
// pin in tests/readingVersionPin.test.ts, whenever the request to the AI changes (the prompt, the schema, the settings,
// the model) or the code that turns the AI's answer into a job changes in a way that changes a reading. The cache lives
// in server memory only, so a deploy empties it anyway; this constant keeps a long-running server honest too.
export const READING_VERSION = "2";
// History: "1" the first cache (5.3); "2" stage 2, close spelling, went live (5.2): the same ad text can now read differently.
