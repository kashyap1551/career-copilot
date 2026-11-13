# Decisions

One line per decision: date, decision, reason.

- 2026-11-13: Scope is anyone with a CV and a target job, not only international students.
- 2026-11-13: A 10-day sprint to a live MVP first, optimised afterwards. Reason: a long plan risks being dropped.
- 2026-11-13: Fit levels, gaps and counts come from rules in code, never from the AI. Reason: the same input always gives the same answer, and every answer can be tested.
- 2026-11-13: Groq's free tier for the AI, in testing and live, starting with openai/gpt-oss-120b. Reason: €0, strict JSON-schema output, and tests run on the model we ship. Not chosen: Gemini's free tier (its terms require paid services for apps offered to users in the EEA) and Mistral's free plan (its requests may be used for training).
- 2026-11-13: The MVP keeps each person's data in their own browser; accounts and a database come after the MVP. Reason: faster to build, and no personal data stored on a server.
- 2026-11-13: Instructions hidden inside a pasted ad can't be fully prevented. The output only affects the person who pasted it. We guard against invented facts by checking quotes against the ad.
- 2026-11-14: An ad's language wording maps to a level once, here: a stated level (B2, "C1-Niveau") is used as written; native, mother tongue or "Muttersprache" is C2; fluent, business fluent, "fließend" or "verhandlungssicher" is C1; good, advanced or "gut" is B2; conversational or intermediate is B1; basic or "Grundkenntnisse" is A2; a language named with no level wording is null (not stated). Reason: the same words always give the same level, and "not stated" beats a guess. A first version; change it here and in the tests together.
- 2026-11-14: Eligibility conditions code can't judge (education level, graduation year, work permit) are kept as exact quotes in `otherConditions` on the job, listed in the report as "check this yourself" and never scored. Reason: scoring them would be a guess, and a wrong score on eligibility is worse than none.
- 2026-11-14: A skill is identified by an id, never free text, in every engine type; constraints are stored apart from skills; a skill the person added with no CV line is never counted as met. Reason: counts must be exact, and every "met" needs a CV line.
