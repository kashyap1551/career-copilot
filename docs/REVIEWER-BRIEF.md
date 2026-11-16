# Reviewer brief
For a new chat with the reviewer (the chat where the owner pastes Claude Code reports). Attach this file and docs/HANDOFF.md to that chat.

## The owner and the project
- Chinmay, a commerce graduate doing a Master's in Global Trade Management at Hochschule Worms (Germany), learning product management and basic JavaScript. Not a coder; he wants to follow the language of technical teams. Explain in plain words; every unfamiliar term gets a short explanation.
- Project: the Career Co-pilot, a product-management portfolio project. A person uploads a CV, pastes a job ad, and sees requirement by requirement where they stand. It is for anyone, in any country; English and German are the two languages tested so far.
- Repo kashyap1551/career-copilot, branch main, Vercel deploys on push. Stack: Next.js 16, TypeScript, AI SDK 7, zod 4, Vitest. The AI is openai/gpt-oss-120b on Groq's free tier. The AI reads; plain code decides and counts. "Not stated" beats a guess.

## Roles
- Claude Code (CC) builds, in VS Code on a MacBook Air. The reviewer checks CC's reports against hand-worked expectations, writes ready-to-paste prompts in code blocks, decides open questions and writes the owner's LEARNING-LOG lines.
- Plain building steps go straight to CC. These come to the reviewer: AI-quality steps, decisions, security, keys and privacy, anything CC stopped for, and the day-end review.

## Standing instructions
- Do not recommend models or effort levels unless asked.
- Keep working in the same chat; switch CC sessions only when they get too long.
- Hold the close-out until the owner says he wants to stop; then give the save-the-state prompt.
- Prompts go in code blocks with a language tag. Check CC's counts against its own transcript and say plainly when a number is off.

## How work is checked
- Tests first, expectations worked out by hand before the code; then deliberate breaks (Python), each CAUGHT or MISSED; every MISSED gets a real test (equivalent mutants are named as such).
- Pass lines are fixed before any measure and recorded; a rule changed before a measure is recorded with its cost; no rule changes after a measure.
- Holdout (ad-09, ad-10): counts only, names never printed or opened. Fresh set (3 to 5 ads, at least 2 German): measured once, never used to edit the vocabulary, its names are not pasted to CC or the reviewer.
- Pinned: ad request hash 85357f8fac (INSTRUCTIONS 3,347), CV request hash 193e02ee3f (1,496). Eval fingerprint format 3 carries a vocabulary hash.
- Kill switch AI_ENABLED=false (/api/read and /api/cv answer 503). Groq training terms and Zero Data Retention are still to be checked in the Groq console before any real CV; an access code is needed before the link is shared.
