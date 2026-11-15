# Handoff

Read this and docs/PLAN-3.1.md, then continue. Written at the end of the session of 2026-11-14.

## (a) Where we are

- **Done:** Day 1 (skeleton, live), Day 2 (rules engine, no AI) and **step 3.1** (the full job schema and extraction). Steps 1.1 to 1.5 and 2.1 to 2.4 are ticked. **3.1 and the build part of 3.2 are done and committed but not ticked**: per CLAUDE.md, ticks and log lines are written at the end of the day, so tick 3.1 to 3.4 and add the Day 3 log lines when Day 3 ends.
- **Latest commits (3.2):** `56306fa` preferred-years rule, `886a28c` heading rule and the very-good question, `3090b6f` ad sources, `25a30de` short-quote guard, `9e99d82` 3.2b eval matcher and script, `c8e02e5` 3.2a German wording endings. (Older:) the 3.1 commit is "3.1: full job schema and extraction" (latest in `git log`). Before it: `03c3add` handoff notes, `7318a7d` working lanes, `684a234` 2.4, `932ff08` 2.3, `89a34cb` 2.2, `f1f6dc2` 2.1.
- **Tests:** 596 pass, in 20 files.
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
6. Intensifiers in language wording ("very good German", ad-07): "very good" is not an entry in the wording table; it reads as B2 only because "good" is inside it, so the ad-07 key says German level null. If the eval returns B2 for it, choose in 3.3 between a "very good" table entry and ignoring intensifiers such as "very" (see docs/DECISIONS.md). RESOLVED 2026-11-15 (step 3.3 run 0): option B, intensified wording reads as not stated (null); see DECISIONS.

## (b) The next action

**Day 3, step 3.2, careful lane: the build and all ten answer keys are DONE. The first full eval waits for the owner's go.** (The plan is docs/PLAN-3.2.md.)

State at the end of the session of 2026-11-15:
- The ten real ads are in `fixtures/real-ads/ad-01.txt` to `ad-10.txt` and the ten keys, all `reviewed` and passing `checkKey`, in `fixtures/answer-keys/ad-01.ts` to `ad-10.ts`. **Both folders are gitignored: they exist only on the owner's machine, not in git** (SOURCES.md and `fixtures/known-cases/` are committed). `fixtures/real-ads/extra-talent-pool.txt` is a spare ad, ignored and not part of the set.
- The keys hold **128 must-haves** in total, so the 3.3 target is **116 or more found, with 0 invented**.
- `npm run eval` is built and tested and was run once, on the barista known case only (`--only barista-injection`): the AI resisted the injection.

Next:
1. **Wait for the owner's go.** Then run `npm run eval` once: 11 Groq calls (the ten ads and the barista known case), 3 seconds apart, about 2 minutes. Show only what the report prints. ad-09 and ad-10 appear as totals only. Never use `--reveal`, and never read their per-item output, until the owner says tuning is done.
2. The first run is a baseline. Expect NOT MET: the AI will probably return extra items (for example from responsibilities lines) that count as invented.
3. **Step 3.3:** tune the prompt (`INSTRUCTIONS` in `lib/ai/readJob.ts`) from the findings on the tuning set (ad-01 to ad-08 and the known case) until found is at least 116 of 128 and invented is 0, on two full runs in a row with the same fingerprint (prompt, model, keys). Keep ad content out of the prompt. Reading issues to consider are in (a) and in docs/DECISIONS.md. Careful lane: plan first, hand-worked expectations, deliberate breaks.
4. **Step 3.4:** the rough page with the fit report (note in SPRINT.md about unlisted skills).
5. Ticks and the Day 3 log lines happen at the end of Day 3, not before.

## (c) What the owner still has to do

- Say "go" for the first full eval.
- Later, in 3.3: say when tuning is done, so the holdout ads can be revealed.
- Consider backing up `fixtures/real-ads/` and `fixtures/answer-keys/` somewhere outside git: they are not in the repository and exist only on this machine.

## (d) Rules to remember

- **The two lanes** (in CLAUDE.md). Fast lane: pages, scripts, wiring, docs, formatting, display code. Build, check, commit, summarise in five lines. Careful lane: anything the AI reads or writes, rules and schemas in lib/engine and lib/schemas, prompts, the skill vocabulary, privacy, secrets, cost, anything that could invent facts. Plan first and wait for OK, work out expected values by hand first, then break the code on purpose. A step that mixes the lanes is careful lane. All of Day 3 touches what the AI reads, so treat it as careful lane unless it is purely display.
- **Expectations come from hand work, never from the code's output.** If a test fails, say whether the code or the hand count is wrong. Never change an expectation to make a test pass.
- **No secrets.** Never read, print or ask for `.env` files or keys. The deny rule in `.claude/settings.json` blocks even `ls` on `.env.local`; `test -f` (existence only) is allowed. `npm run eval` loads `.env.local` itself. The owner puts keys only in `.env.local` and in Vercel. `.claude/settings.json` blocks reading `.env` files.
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
- Years per skill (for example 'at least 2 years in growth') cannot be expressed: the schema has one years field per job, and ads state per-skill years often. Not in the sprint; needs a schema change, so it goes through the careful lane.
- Personal-quality lines in an ad (for example "a team player", "a positive attitude", "a curious mind") cannot be proven by a CV, so they probably should not count against the fit verdict. Decide this in the product step (3.4 onward); it also changes what "must-have found" should mean for these lines.
- Stability: the same ad gives different readings on repeat; consider reading three times and keeping the items found at least twice (plain code decides), at three times the cost. Decide after the rules.
- Check the sprint check "invented 0 on two full runs" against the measured noise (a single ad swung from 0 to 5 invented on identical input). Decide after the rules.
- Narrowed counts a correct split reading as narrowed when the first paired item has fewer skills than the key (several AI items share the quote, the rest are accepted extras). Information only; fix the scorer if it keeps misleading.
- Duties by structure instead of wording: each requirement item gets a "section" label from the AI (for example "requirements", "duties", "company", "benefits") and plain code drops the duty ones (the AI reads, the code decides). Use it only if the R4 wording fails twice.
- Protocol: a candidate prompt first runs only on the ads that carry its targets (the screen); the full two runs of the tuning set happen only after the screen passes.
- Error mapping in lib/ai/readJob.ts: the AI SDK retries a retryable error twice and then throws a retry error, which toReadAdError reports as a generic 500 ("Failed after 3 attempts..."). So a 429 or a 5xx that outlasts the SDK's retries has no code on the way out, and the runner's 429 backoff cannot fire on the real path. Fix: unwrap the retry error's last error in toReadAdError (and then the runner's 5xx retry can use the real code). Do it when readJob.ts is next committed.

## (g) Eval run log

Counts only. Holdout (ad-09, ad-10) is included in the totals as numbers; its per-item output has not been read.

- 2026-11-15, first full run, a baseline with nothing tuned (complete: 0 failed, 0 skipped; barista known case: resisted):
  - TOTALS (10 ads, known cases left out): must-haves found 91 of 128 | wrong importance 1 | missed 36 must, 1 nice | invented 10 | name differs 46 | removed 1
  - TARGET: found 91 of 128; target 116 or more; invented 10 -> NOT MET
- 2026-11-15, run 0, prompt unchanged (commit 7c2ac32; complete: 0 failed, 0 skipped; barista known case: resisted):
  - TOTALS (10 ads, known cases left out): must-haves found 83 of 128 | wrong importance 3 | missed 42 must, 2 nice | invented 16 | name differs 44 | widened 8 | narrowed 6 | removed 3
  - TARGET: found 83 of 128; target 116 or more; invented 16 -> NOT MET
  - Tuning set (ad-01 to ad-08) summed: found 66 of 100, invented 16, widened 6, narrowed 6. The first run had found 74 of 100 with 9 invented. The prompt was identical, so the difference (8 found, 7 invented on the tuning set; 8 found, 6 invented on all ten ads) is the model's own variation.
  - Tokens: 48,261 in total for 11 calls (27,567 in, 20,694 out), about 4,400 a call. Groq limits seen: 8,000 tokens a minute, 1,000 requests a day.
- 2026-11-15, noise test, prompt unchanged, temperature 0, fixed seed, medium effort (ad-02, ad-04, ad-06, ad-08 read three times; 12 calls, 0 failed). Criterion "repeatable": failed.
  - ad-02: found 12, 12, 12 of 13; invented 0, 0, 0
  - ad-04: found 11, 12, 7 of 13; invented 2, 5, 0
  - ad-06: found 4, 6, 6 of 8; invented 0, 0, 3 (wrong importance 1 each time)
  - ad-08: found 5, 3, 5 of 5; invented 5, 5, 6
  - Tokens about 19,000 per repeat of the four ads; identical input tokens each time.
- 2026-11-15, baseline reading 2 (ad-01, 03, 05, 07, old prompt, request hash 85357f8fac): found 6, 14, 15, 8; 8-ad found 76 of 100, invented 13, R4 items 5, R3+R3b 7 of 11, outside 1. Run 1 run A (run 1 prompt, request hash 0306366684, INSTRUCTIONS 4,000): found 65 of 100, R4 items 11 (lines 5), R3+R3b 4 of 11, R8 0, invented 11, outside 0. Details in PLAN-3.3 section 17.
- 2026-11-15, screen of candidate 1b-A (request hash 4d3d2f6710, INSTRUCTIONS 4,199) on ad-02, 03, 04, 05, 08: S1 PASS (ad-08 duty lines 0, found 5 of 5), S2 FAIL (ad-05 found 9 of 23), S3 PASS, S4 PASS, S5 FAIL (ad-04 found 8 of 13, R3+R3b defect lines 3 of 3). One call failed (ad-05, generic status 500) and was rerun after the runner change. Details in PLAN-3.3 section 18.
