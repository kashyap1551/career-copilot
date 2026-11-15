@AGENTS.md

# Career Co-pilot

A career co-pilot: a person uploads a CV once and confirms their skills, pastes any job description, and sees where they stand requirement by requirement. On request: a roadmap report and analytics across saved jobs. Plan: docs/SPRINT.md (10 build days to a live MVP), one step at a time, in order; run each step's check first. State: docs/HANDOFF.md. Decisions: docs/DECISIONS.md.

## Rules that never bend

1. The AI reads and writes; plain code decides and counts. Fit levels, gaps, counts and unlocks come only from lib/engine, never from a model.
2. Never invent experience. Every "met" cites a CV line. Suggested CV bullets use only cited lines; code rejects any new employer, title, number or tool.
3. "Not stated" beats a guess.
4. No secrets in code, logs or chat. Keys live only in .env.local and Vercel. Never read, print or log .env files. Never print or commit an API key (Groq keys start with gsk_).
5. No real CVs in the repo. Tests use made-up CVs and public job ads only.
6. Show counts, never invented percentages.
7. €0: free tiers only. Ask before adding any paid service or new dependency.
8. Never commit real ad text, the answer keys of real ads, anything in eval-runs/, or .env files (fixtures/real-ads/*.txt and fixtures/answer-keys/ are gitignored; keep their content out of docs, tests and prompts). Made-up fixtures may be committed: the barista known case, and made-up CV fixtures and their keys in fixtures/synthetic-cvs/ (they describe no real person).
9. The holdout ads (ad-09, ad-10) stay hidden: totals only, never --reveal or their per-item output, until I say tuning is done.

## Git, cost, reports

- Commit by named files only, never `git add -A`. Message starts with the step number ("3.3: ...").
- Push only when `npx tsc --noEmit`, `npm run lint`, `npm test` and `npm run build` are all green. A push deploys to Vercel.
- AI calls cost free-tier tokens (Groq: 8,000 tokens a minute, 1,000 requests a day). Ask before making one unless the step says to. Never retry a stopped real AI call by hand.
- Eval and tuning calls run behind the fingerprint guard (EXPECT_REQUEST_HASH, EXPECT_INSTRUCTIONS_LEN); a guard that stops a run stops it.
- Reports to me: at most 15 lines, tables and verdicts only. Save long logs to a file and name it.

## Stack

- Next.js (App Router), TypeScript, Vercel Hobby. Read node_modules/next/dist/docs/ before Next code (AGENTS.md).
- AI: Groq via the AI SDK (`ai`, `@ai-sdk/groq`); model from GROQ_MODEL (openai/gpt-oss-120b; -20b is the fallback). lib/ai is the only place that knows the provider.
- Structured output: generateText with Output.object and a Zod schema from lib/schemas. Strict mode: every field required (`.nullable()`, not `.optional()`), no streaming.
- MVP storage: the browser (IndexedDB). No database or accounts until after the MVP.
- Tests: Vitest.

## Folders and commands

- app/ pages and routes; lib/ai/ model and calls; lib/engine/ rules engine (pure, no AI, no network); lib/schemas/ Zod schemas; fixtures/ made-up profiles and public ads; tests/; docs/ (SPRINT, DECISIONS, HANDOFF, LEARNING-LOG, PLAN-*).
- `npm run dev` (localhost:3000); `npm run build`; `npm test`; `npm run report -- <profile id | all>`; `npm run eval` (real Groq calls; ask first).

## How to work with me

- I'm a product manager learning to code: I direct, you build. Don't quiz me; explain when I ask.
- Keep each change small. Work in one of two lanes, depending on what the step touches.
- **Fast lane** (pages, scripts, wiring, docs, formatting, display code): build directly, run the checks, commit with the step number, summary of five lines or fewer. Ask only if blocked or a product decision is needed. You may do consecutive fast-lane steps in one go.
- **Careful lane** (anything the AI reads or writes, lib/engine and lib/schemas rules, prompts, skill vocabulary, privacy, secrets, cost, anything that could invent facts): short plan first, wait for my OK. Work out expected values by hand; tests take expectations from that hand work, never from the code's output. If a test fails, say whether the code or the hand count is wrong; never change the expectation. Then break the code on purpose to check the tests fail. A mixed step is careful lane.
- Tick steps in docs/SPRINT.md and add docs/LEARNING-LOG.md lines at the end of each day. Product decisions go in docs/DECISIONS.md, one line each with the reason.
