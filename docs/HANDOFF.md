# Handoff

Read this and docs/PLAN-3.1.md, then continue. Written at the end of the session of 2026-11-14.

## (a) Where we are

- **Done:** Day 1 (skeleton, live), Day 2 (rules engine, no AI) and **step 3.1** (the full job schema and extraction). Steps 1.1 to 1.5 and 2.1 to 2.4 are ticked. **3.1 and the build part of 3.2 are done and committed but not ticked**: per CLAUDE.md, ticks and log lines are written at the end of the day, so tick 3.1 to 3.4 and add the Day 3 log lines when Day 3 ends.
- **Commits:** the 3.1 commit is "3.1: full job schema and extraction" (latest in `git log`). Before it: `03c3add` handoff notes, `7318a7d` working lanes, `684a234` 2.4, `932ff08` 2.3, `89a34cb` 2.2, `f1f6dc2` 2.1.
- **Tests:** 554 pass, in 19 files.
- **Live site:** https://career-copilot-theta-seven.vercel.app. Vercel redeploys on every push to `main`, so after the 3.1 push the live `/api/read` returns the new shape: `{ job, removed, moved, unlisted }`. The page shows the checked JSON, what was removed and why, what moved to "check this yourself", and skills not in our list. The fit report on the page comes in 3.4.
- **Repo:** https://github.com/kashyap1551/career-copilot, branch `main`.
- **Commands that work:** `npm test`; `npm run -s report -- <id>` (ids: `maya`, `jonas`, `ana`, `sam`, `ravi`, `lena`; `-- all`; no id lists them); `npm run build` (run before every push); `npm run lint`; `npx tsc --noEmit`; `npm run dev` (needs `.env.local` on the owner's machine).
- **What exists:**
  - `lib/engine/`: `types.ts`, `match.ts`, `fit.ts`, `rules.ts`, `unlock.ts`, `explain.ts`, `report-text.ts` (Day 2), and for 3.1: `fromAd.ts` (`buildJob`: the checks and the conversion), `text.ts` (the normaliser), `languageWording.ts` (level wording and language names), `dates.ts` (full dates out of a quote), `skillIds.ts` (names to ids).
  - `lib/ai/`: `model.ts`, `readJob.ts` (the prompt and the call, then `buildJob`). `lib/schemas/job.ts` (`extractedAdSchema`, the strict-mode schema; `readRequestSchema`).
  - `fixtures/`: 6 made-up profiles, 3 synthetic sample jobs, 17 skills, `synthetic-ad-texts.ts` (4 synthetic ad texts: Northwind, Brightwater, Fjordlight, and Lindenberg, a German and English stress ad).
  - `tests/`: the conversion table of docs/PLAN-3.1.md is tested in `fromAd`, `languageWording`, `dates`, `skillIds`, `text`, `schema` and `stressAd`. `scripts/report.ts`, `tests/golden/`.
  - For 3.2: `lib/engine/answerKey.ts` (the key type and `checkKey`), `evalMatch.ts` (pairs the AI's requirements with the key by quote), `evalScore.ts` (found, wrong importance, missed, invented, name differs, constraints, the count target, the injection verdict), `evalRun.ts` (the runner, with an injected reader and sleeper, rate-limit retries, `twoInARow`), `evalReport.ts` (the printed report, holdout hidden). `scripts/eval.ts` is the only part that reads files and calls the AI. `fixtures/known-cases/barista-injection.txt` and `.key.ts` (committed, synthetic). `fixtures/real-ads/SOURCES.md` (committed template). `fixtures/real-ads/*.txt`, `fixtures/answer-keys/` and `eval-runs/` are gitignored.
  - Eval commands: `npm run eval` (all ads that have a reviewed key; real Groq calls, 3 s apart, retrying rate limits after 5, 15 and 45 s), `npm run eval -- --only <ad id>` (one ad, no totals or target), `npm run eval -- --reveal` (only after the owner says tuning is done: shows the holdout ads' per-ad lines). The script loads `.env.local` itself with Node's `process.loadEnvFile` (the file is never printed).
- **How a reading becomes a job:** the AI returns names and quotes only (`extractedAdSchema`); `buildJob` checks every quote against the ad, maps level wording to CEFR, reads dates out of quotes, assigns skill ids (listed id, or provisional `new:<slug>`), and moves anything that failed a check into `otherConditions` when its quote is in the ad.
- **AI SDK 7 facts (still true):** `generateText({ model, instructions, output: Output.object({ schema }), prompt })` returns `output`. `system` is now `instructions`. Build the model with `createGroq`. Strict mode is on by default. A failed shape check throws `NoObjectGeneratedError`. Groq's strict mode accepted the nested nullable-object schema.
- **Tooling note:** the editor tools turn `\uXXXX` escape sequences in what I write into the real characters. When a file needs readable escapes (as `lib/engine/text.ts` does), generate it with a script that builds the backslash from `chr(92)`.
- **Dev dependencies added on Day 2:** `vitest`, `tsx`. `@types/node` was moved to 24 so Vitest would install.

**Reading-quality issues found on the first real run (for step 3.3, not fixed):**
1. (Fixed in step 3.2a: the German adjective endings e, em, en, er, es now work for gut, fließend, verhandlungssicher and muttersprachlich.)
2. Brightwater sample: the AI split "financial planning and analysis" into two skills and named "Advanced Excel financial modelling" as "Excel" rather than "Financial modelling".
3. Fjordlight sample: the AI made "pull-request reviews" its own skill and wrote "accessibility standards" in full (so an unlisted id).
4. Lindenberg: SQL and "Python or R" were given the same whole-line quote; skill names can come back in lower case ("product metrics"). Skill level words like "Sehr gute" are ignored (partly met is out of the model).
5. 7 of the 13 skills in the Lindenberg ad are not in the 17-skill list, so their requirements will count as not met until Day 5.

## (b) The next action

**Day 3, step 3.2, careful lane, in progress.** The matcher, scoring, runner, report and `npm run eval` are built, tested and committed, and the barista known case works end to end (the AI resisted the injection). The plan is in docs/PLAN-3.2.md.

1. **The owner saves ten real public ads** as `fixtures/real-ads/ad-01.txt` to `ad-10.txt` in VS Code (full text, each from a company other than his employer and not from Picnic, contact details removed) and fills in `fixtures/real-ads/SOURCES.md`. Claude never retypes or pastes ad text.
2. When the owner says they are saved, Claude **verifies**: ten files exist, none empty, no email addresses or phone numbers (grep), none from Picnic. Then Claude **drafts the keys from the files alone** (`fixtures/answer-keys/ad-NN.ts`, status "draft"), before the eval has run on them.
3. The owner **reviews the keys** in batches of 2 or 3 ads (every must-have and every constraint). Only then is a key set to "reviewed".
4. The first full `npm run eval`. **Holdout: ad-09 and ad-10.** Until the owner says tuning is done, the eval prints only totals for them, and Claude does not read their per-item output (never use `--reveal`).
5. Then step 3.3 (tune the prompt until at least 45 of 50 must-haves, or the equivalent count, are found and nothing is invented, on two runs in a row) and 3.4 (the rough page with the fit report). Remember the 3.4 note about unlisted skills.

## (c) What the owner still has to do

- Save the ten ads and fill in SOURCES.md; tell Claude when they are saved.
- Review each batch of keys: OK or corrections per ad.
- Say when tuning is done, so the holdout can be revealed.

## (d) Rules to remember

- **The two lanes** (in CLAUDE.md). Fast lane: pages, scripts, wiring, docs, formatting, display code. Build, check, commit, summarise in five lines. Careful lane: anything the AI reads or writes, rules and schemas in lib/engine and lib/schemas, prompts, the skill vocabulary, privacy, secrets, cost, anything that could invent facts. Plan first and wait for OK, work out expected values by hand first, then break the code on purpose. A step that mixes the lanes is careful lane. All of Day 3 touches what the AI reads, so treat it as careful lane unless it is purely display.
- **Expectations come from hand work, never from the code's output.** If a test fails, say whether the code or the hand count is wrong. Never change an expectation to make a test pass.
- **No secrets.** Never read, print or ask for `.env` files or keys. The owner puts keys only in `.env.local` and in Vercel. `.claude/settings.json` blocks reading `.env` files.
- **No real CVs** in the repository. Tests use made-up CVs and public ads only. Job ads must be public, apart from the recorded exception for the 3 synthetic samples.
- **No percentages.** Counts only.
- **The AI reads and writes; plain code decides and counts.** Never invent experience; every "met" cites a CV line; "not stated" beats a guess.
- **Free tiers only.** Ask before adding any paid service or any new dependency.
- **Working habits:** show the owner each result and wait for the OK when asked; commit messages end with the Co-Authored-By line given in the session; the repo-local git identity is already set.

## (e) Known cases and notes already recorded

**In docs/SPRINT.md, by name:**
- Step 2.2 note: years compared with total years.
- Step 2.3 note: requirements with several acceptable skills (`skillIds`) in `rolesUnlockedBy`.
- Step 3.1 notes: "and" splits and "or" stays together; constraints carry no quote yet; `JobLanguage` needs an optional flag and an "any of these" list; eligibility rules are constraints, not skills.
- Step 3.2 notes: the synthetic ads must be replaced by real public ads before the reading test; the known case, the barista ad with the "Google" injection line.
- Day 5 note: skill names are free text until the vocabulary exists.
- Day 7 note: later, treat closing a closable conflict as an unlock candidate.

**In docs/DECISIONS.md, by name (23 lines):**
- Scope; the 10-day sprint; rules in code, not the AI; Groq's free tier; data kept in the browser.
- Instructions hidden in an ad can't be fully prevented.
- Ad language wording to level mapping; `otherConditions` for eligibility text; skills by id, constraints apart from skills, no evidence means never met.
- The exception to rule 5 for the synthetic sample ads.
- "Or" means alternatives; one line is one requirement unless "and" or commas list separate skills; years map to `minYears`.
- The fit-level gap-count rule; the closable thresholds; hybrid counts as on-site for the city check; "not stated" is never a conflict.
- Unlock rules (blocked jobs, greedy ranking and its tie-break, "one step closer", the cumulative timeline).
- The report's explanation rules and printout display rules.

**Open and not yet decided:** the four questions in docs/PLAN-3.1.md. The DECISIONS lines for 3.1 are written after the code, not before.

## (f) Ideas for later

Not in the sprint. Each one that changes a schema goes through the careful lane.

- Employment type (full-time, part-time, working student) is not a field in the job schema. Ads state it (for example 'Vollzeit') and it matters for people who can only work part-time, such as students. Not in the sprint; needs a schema change, so it goes through the careful lane.
