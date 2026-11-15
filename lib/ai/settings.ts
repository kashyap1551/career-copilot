// How the model is asked to read an ad: the settings that decide how much the
// answer varies from one call to the next. They live in ONE object so the eval
// can put them in its fingerprint (a changed setting is a different run) and
// readJob cannot use different ones.
//
// - temperature 0: always pick the most likely word (Groq allows 0 to 2).
// - seed: Groq documents this as a best effort to repeat, not a guarantee.
// - reasoningEffort "medium": gpt-oss accepts low, medium or high; medium is
//   Groq's own default, so this pins today's behaviour instead of changing it.
export const GENERATION_SETTINGS = {
  temperature: 0,
  seed: 20261115,
  providerOptions: { groq: { reasoningEffort: "medium" } },
} as const;
