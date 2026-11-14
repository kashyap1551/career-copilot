@AGENTS.md

# Career Co-pilot

A general-purpose career co-pilot. A person uploads a CV once and confirms their skills, pastes any job description, and sees where they stand, requirement by requirement. On request they get a roadmap report (which skills to build, in what order, by when) and analytics across all their saved jobs, such as "after SQL (expected 20 December), 6 more roles become strong matches".

The plan is docs/SPRINT.md: 10 build days to a live MVP. Work one step at a time, in order, and run each step's check before moving on.

## Rules that never bend

1. The AI reads and writes; plain code decides and counts. Fit levels, gaps, counts and unlocks come only from the rules engine in lib/engine, never from a model.
2. Never invent experience. Every "met" cites a CV line. Suggested CV bullets use only cited lines, and code rejects any new employer, title, number or tool.
3. "Not stated" beats a guess when an ad or a CV doesn't say something.
4. No secrets in code, logs or chat. Keys live only in .env.local (never committed) and in Vercel's settings. Never read, print or log .env files.
5. No real CVs in the repository. Tests use made-up CVs and public job ads only.
6. Show counts, never invented percentages.
7. €0: free tiers only. Ask before adding any paid service or any new dependency.

## Stack

- Next.js (App Router) with TypeScript, deployed on Vercel's free Hobby plan.
- AI: Groq through the AI SDK (packages `ai` and `@ai-sdk/groq`). The model name comes from GROQ_MODEL (start with openai/gpt-oss-120b; openai/gpt-oss-20b is the faster fallback). lib/ai is the only place that knows the provider.
- Structured output: generateText with Output.object and a Zod schema from lib/schemas. Groq's strict mode needs every field listed as required (use .nullable(), not .optional()) and doesn't support streaming.
- MVP storage: the browser (IndexedDB). No database and no accounts until after the MVP.
- Tests: Vitest (added on Day 2).

## Folders

- app/: pages and server routes
- lib/ai/: model setup and calls
- lib/engine/: the rules engine; pure functions, no AI, no network
- lib/schemas/: Zod schemas shared by routes and tests
- fixtures/: made-up profiles and public job ads for tests
- tests/: Vitest tests
- docs/: SPRINT.md (the plan), DECISIONS.md (what we chose and why), LEARNING-LOG.md (one line per step)

## Commands

- `npm run dev`: the app at http://localhost:3000
- `npm run build`: production build; run it before every push
- `npm test`: the tests (from Day 2)
- `npm run report -- <profile id | all>`: prints a person's fit reports and roadmap from the fixtures (from Day 2)

## How to work with me

- I'm a product manager learning to code: I direct, you build. Don't quiz me; explain when I ask.
- Keep each change small. Work in one of two lanes, depending on what the step touches.
- **Fast lane**: pages, scripts, wiring, docs, formatting and display code. Build directly, run the checks, commit with the step number (for example "2.4: report") and give me a summary of five lines or fewer. Ask only if you're blocked or a product decision is needed. You may do consecutive fast-lane steps in one go.
- **Careful lane**: anything the AI reads or writes, rules and schemas in lib/engine and lib/schemas, prompts, the skill vocabulary, privacy, secrets, cost, and anything that could invent facts. For these, show me a short plan and wait for my OK. Work out the expected values by hand before writing the code; tests take their expectations from that hand work, never from the code's output, and if a test fails, say whether the code or the hand count is wrong instead of changing the expectation. Then break the code on purpose in a few ways to check the tests fail.
- If a step mixes the lanes, treat the whole step as careful lane.
- Tick steps in docs/SPRINT.md and add lines to docs/LEARNING-LOG.md at the end of each day, not at the end of each step.
- Product decisions go in docs/DECISIONS.md: one line each, with the reason.
