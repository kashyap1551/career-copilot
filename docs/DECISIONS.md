# Decisions

One line per decision: date, decision, reason.

- 2026-11-13: Scope is anyone with a CV and a target job, not only international students.
- 2026-11-13: A 10-day sprint to a live MVP first, optimised afterwards. Reason: a long plan risks being dropped.
- 2026-11-13: Fit levels, gaps and counts come from rules in code, never from the AI. Reason: the same input always gives the same answer, and every answer can be tested.
- 2026-11-13: Groq's free tier for the AI, in testing and live, starting with openai/gpt-oss-120b. Reason: €0, strict JSON-schema output, and tests run on the model we ship. Not chosen: Gemini's free tier (its terms require paid services for apps offered to users in the EEA) and Mistral's free plan (its requests may be used for training).
- 2026-11-13: The MVP keeps each person's data in their own browser; accounts and a database come after the MVP. Reason: faster to build, and no personal data stored on a server.
