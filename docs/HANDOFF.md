Scope: the Career Co-pilot is for anyone, in any country. English and German are the two languages tested so far (German because the owner can check it, not because the product targets Germany).

# Handoff

Read this and docs/PLAN-3.1.md, then continue. Written at the end of the session of 2026-11-14.

## Where we are now (updated 2026-11-16, end of Day 5)

Scope and roles: see the first line of this file and docs/REVIEWER-BRIEF.md. Sections (a) to (g) below are older and partly out of date; this block is the current state.

**Status**
- **Done and ticked:** Day 1 to Day 4, **5.1** (vocabulary v0 in `lib/vocab/`, exact name matching, trait handling, eval fingerprint format 3) and **5.3** (the reading cache: `lib/ai/readCache.ts`, `readingVersion.ts`; ad route only, memory only, 20 entries, header `x-reading-cache`; DECISIONS 2026-11-16).
- **5.2 is ticked (2026-11-16).** Stage 1 (exact, three tries) and **stage 2 (close spelling) are LIVE** (wired 2026-11-16 through `lib/engine/readName.ts` into `fromAd` and `fromCv`; order: not-a-skill flag, stage 1, stage 2; READING_VERSION is "2"). **5.3 is done (see above).**
- **Day 6, step 6.1 (plan APPROVED 2026-11-16, docs/PLAN-6.1.md, three parts):** part 1 DONE: `lib/saved/` (types, `KeyValueStore` and `MemoryStore`, the logic layer with results instead of throws, the sparse profile rebuild, `jobIdFor`, `openJob`, migration), no UI, no route change, no adapter; tests S1 to S10, S2b and S13, 10 deliberate breaks all caught. Part 1b done: round trip with real data, line cap, saveJob never throws, saveProfile never overwrites a newer record. Part 2 DONE: extraction on /api/read, version 3, AD_REQUEST_HASH, web vocabulary hash, openJob safety net (READING_VERSION "3"; hashes unchanged: ad 85357f8fac, CV 193e02ee3f, vocabulary e96370fe4c). Part 3a DONE: IndexedDB adapter (failure path tested in Node, success path only by hand), mapIdbError, currentStamps. Part 3b DONE: profile controls (a saved profile is offered on load and used only after a click, read-only; "Save on this device" with the notice; delete this profile; delete everything with an inline second step; a 10-second timeout around every store call; `deleteProfile`; every message and decision is a plain function with a test). 3b fixes: status cleared when the profile on screen changes (a message about a profile is tied to its key and shown only while the same profile is on screen). Part 3c DONE: jobs controls (Save this ad, the Saved ads list, Open, Delete, a re-check never written back), no-store header on every answer of /api/read and /api/cv, manual checklist docs/MANUAL-CHECK-6.1.md; 6.1 NOT ticked until the manual check passes. 3c fixes: profileKey order-insensitive, shared-computer sentence in the notice, checklist tweaks. NEXT: the 6.1 manual check passed 25 of 25 on 2026-11-17 (log at the end of docs/MANUAL-CHECK-6.1.md; 6.1 is ticked in docs/SPRINT.md together with the merge). The owner runs the three manual checks on the Vercel preview of the branch `step-6.2` (it contains 6.1b, the fit levels and 6.2; docs/MANUAL-CHECK-ORDER.md lists docs/MANUAL-CHECK-6.1b.md, docs/MANUAL-CHECK-FIT.md and docs/MANUAL-CHECK-6.2.md), then ONE merge of `step-6.2` into main; `integration-check` is superseded by it.
- **Tests:** 1,468 pass in 84 files on the branch step-6.2 (it includes integration-check: 6.1b, the fit levels and 6.2; not merged); main is 1,311 in 77. `npx tsc --noEmit`, `npm run lint`, `npm run build` are green. Live site: https://career-copilot-theta-seven.vercel.app (deploys on push to `main`).

**Stage 2 rules (all fixed BEFORE any measure; docs/PLAN-5.1.md "5.2 stage 2 rules" and "Changes before any measure", docs/DECISIONS.md)**
- Allowance by the SHORTER folded string: up to 5 letters 0, 6 to 8 letters 1, 9 or more 2. A swap of two neighbouring letters counts 1.
- A distance of 2 only at the very end of a long word (common prefix at least shorter minus 3); one shared function `acceptsDistance`.
- A tie goes to the review list. Targets never include undecided aliases, exactOnly entries (R, C, Go) or the not-a-skill phrases.
- Never-map list (never mapped BY SPELLING; stage 1 unaffected): confluent, commerce, market, markets, personal, typoscript.
- Guard (item 6, PLAN-5.1): `closeMatch` gives none for any name that `isNotASkill` flags; stage 1 unaffected. "personal development" is now a not-a-skill phrase (55 in all).
- Pass lines (fresh set only): wrong <= floor(5 x (|L| - traitNotFlagged) / 100); recall 4 x right_M >= 3 x |M| (|M| = 0 is not passed); must-not-merge 0. The holdout is printed beside it, not judged; one-shot log in `eval-runs/map-measure-log.txt`.
- Tools (no AI call): `npm run vocab-check`, `vocab-pairs` (0 pairs), `neighbours` (113 pairs across 39 skills, English only), `map-measure`, `skill-ids`, and `capture-fresh` (run once, 2026-11-16).

**Hashes:** request 85357f8fac (ad, INSTRUCTIONS 3,347) and 193e02ee3f (CV, 1,496), both pinned by tests. Vocabulary hash **e96370fe4c** (was cf3e44da32 before item 6; skills, 55 not-a-skill phrases, left-unlisted names AND the never-map list, from one helper `vocabHash()`). Eval fingerprint format 3. Earlier eval numbers were measured on the 17-skill list and are not comparable.

**Next steps, in order**
0. DONE 2026-11-16: the step 0 check found "Personal development" mapping close to Persona development (distance 1, three casings) and two flagged phrases mapping at distance 2; fixed by the guard and one entry (item 6), tests first, six breaks all caught, nothing else changed (neighbours 113 pairs, vocab-pairs 0, vocab-check unchanged on ad-01 to ad-08).
1. DONE 2026-11-16: the owner saved 5 fresh ads (at least 2 German) as `fixtures/real-ads/fresh-01.txt` to `fresh-05.txt` (gitignored; never pasted into a chat).
2. DONE 2026-11-16: `capture-fresh` ran once: 5 calls, 23,412 tokens, 62 distinct names (19, 14, 13, 9, 12 per ad), written to `fresh-labels-TODO.json`.
3. DONE 2026-11-16: the fresh set is labelled and checked (62 entries, 26 skill ids on 25 distinct ids, 26 none, 10 not-a-skill, 0 invalid, 0 TODO; `fresh-labels.json` sha256 starts bd1086d9ad; vocabulary hash e96370fe4c; DECISIONS 2026-11-16). No measure has been run.
4. DONE 2026-11-16: the one-shot map-measure on the fresh set passed all three lines (|L| 62, |M| 26, right_M 25, wrong 2 at the limit of 2, traitNotFlagged 9, must-not-merge 0; stage 1 gave 24 of the 25 right, stage 2 one; both wrong merges were stage 1 aliases). DECISIONS 2026-11-16. The fresh set is spent.
5. DONE 2026-11-16: stage 2 wired into `fromAd` and `fromCv` (DECISIONS "5.2 wired: stage 2 live"): one shared path, close-match fields carried and shown on the page, READING_VERSION 2, tests and breaks all caught. 5.2 ticked 2026-11-16. NEXT: Day 6 (saved jobs); the trait-flagging step with a new fresh set (item 7) is open and is scheduled by the owner and reviewer.
6. DONE 2026-11-16: the eval scorer knows `notCounted` (scorer v2: hits, not counted, missed, strict and adjusted recall; DECISIONS 2026-11-16). `npm run eval -- --not-counted` lists the not-counted key items of ad-01 to ad-08 (real AI calls, one per ad: ask first). No counted ad eval has been run since.
7. DONE 2026-11-16: 5.3, the reading cache. Next after the fresh-set sequence (steps 1 to 5): Day 6 (saved jobs). Open items below.

**Rules for the next session:** no vocabulary edit after seeing fresh or holdout names; fresh names are not pasted into the chat; the holdout is counts only; do not run `map-measure` before labelling is complete.

**Open items:** the owner confirms whether ad-03 is partly German; optional owner check of "German names to check" in docs/VOCAB-REVIEW.md (28 entries); Groq training terms and Zero Data Retention unverified; Vercel Firewall rate-limit rule unverified; an access code before the link is shared; the kill switch `AI_ENABLED=false` (both routes answer 503) exists; thin CV reader recall; re-reading the CV resets the confirm screen; a stopwatch-timed run by a second person; accuracy backlog a to e; the Groq upgrade question (CLAUDE.md rule 7 must be edited first); composite names split at reading time.
- Open (2026-11-16, after the 8-ad scorer runs; details in DECISIONS and the scratchpad analysis):
  1. Scorer, coverage view: in the 8-ad run 18 of 26 misses were lines the AI had read (the key splits a line into several items, the AI merges them, the scorer pairs one-to-one). Add a "skill-level coverage" line printed BESIDE strict recall (a key item is covered when an AI requirement whose quote overlaps it carries that skill's id): informational only, never replacing it; define it before any run is compared. The 3.3 gate stays strict; its first reading with coverage is the holdout ad-09 and ad-10. The same pairing problem runs the other way: ad-03's three extras are one key item with four alternative names that the AI split into four items, so the coverage view must also stop counting an AI item as invented when its quote overlaps a key item that lists that skill. When the holdout gate is written, its denominator may exclude by-design not-counted must items only when ALL of their key names are on the not-a-skill list, and the rule is written down before the holdout is read.
  2. Scorer: a key item with any key name not on the not-a-skill list must never count as "not counted" (the ad-05 composite hid Growth product management; ad-08 Teamwork). It becomes a miss.
  3. Answer keys. ad-08: its 12 extras are duty lines read as requirements (all on ad lines 9 to 14, inside the duty range 9-15 that PLAN-3.3 defines; the key has no item on a duty line and its two accepted extras are on lines 18 and 20). This is a known reader behaviour tracked in PLAN-3.3 (category d, rule R4: a candidate prompt rule that failed twice and was parked, so it is not in the shipped prompt). They must NOT be added to acceptedExtras. ad-03: the key holds the "5+ years in Ocean Freight, Trade Management, Procurement or Product Management" line as ONE must item with four alternative names (and minYears 5 with the same quote); the AI returned one item per name, the matcher pairs one-to-one, so three are extras. Handled by the coverage view (item 1), not by acceptedExtras.
  4. Vocabulary: Teamwork is a listed skill (flag BORDERLINE) while "team player" is not-a-skill; decide in the vocabulary review.
  5. Composite names split at reading time: the ad-05 example (the reader returned only the first half of "...or you're a seasoned Growth PM...").
  6. Run-to-run spread is not something we set: the ad request carries temperature 0, seed 20261115 and reasoning_effort medium (no max output tokens), all inside the pinned request hash (set in `lib/ai/settings.ts`). Groq documents the seed as best effort, and the 2026-11-15 noise test with these exact settings still varied (ad-04 found 11, 12, 7), so the spread is not from our settings; the cause is not verified.
  7. Trait flagging does not generalise: 1 of 10 not-a-skill labels flagged on the fresh set; the NOT_A_SKILL list was built from tuning ads; expand it only from a NEW fresh set. Seen live 2026-11-16: 'structured way' leaked and counted as a missing must-have.
  8. Two wrong merges are stage 1 aliases: 'acceptance criteria' -> User stories and 'financial analysis' -> Financial planning and analysis. Decide in the vocabulary review together with the Teamwork borderline (item 4). Any vocabulary change changes the vocabulary hash and needs a new fresh set to be verified.
  9. Names the person types (skill list, hand-added, in-progress) are exact-only; the same word read from a CV gets close matching. Decide later whether typed names get stage 2 (needs a 'Read as' line there too).
  10. The eval stamp covers the vocabulary but not the matching code: add READING_VERSION to it at the next eval session; until then eval numbers from before the stage 2 wiring are a different baseline.
  11. For an ad, the 'Read as...' line sits under 'What the AI read', not next to the requirement row; move it next to the row if close matches turn out common.
  12. DONE on the branch step-fit-levels (not merged yet): unlisted requirements are 'could not judge', out of the level and the counts, named in the label, the sentence and a row (DECISIONS 2026-11-17, docs/PLAN-FIT-LEVEL.md (a)).
  13. When DB_VERSION in `lib/saved/idbStore.ts` goes to 2, revisit `onblocked` (it rejects now; a pending upgrade would be better waited out).
  14. If `listJobs` fails while `loadProfile` works, the page shows no saved-ads list and no message (the person may think nothing is saved).
  15. DONE on the branch step-fit-levels (not merged yet): each judged constraint without a conflict gets one 'Checked and fine' line (plan (c)).
  16. After "Delete this profile" the report already on screen stays and still says "on your profile" until the page is reloaded (manual check 2026-11-16, step 9, O-2). Decide whether the report should be cleared or relabelled.
  17. DONE on the branch step-fit-levels (not merged yet): a Long shot set by a conflict that can't be closed soon names it ('Long shot because of location: ...', plan (b)); the rule is unchanged. The empty-skills observation O-4 is closed too (plan (d): no level without skills; Amendment 4: no level for an ad with no requirements).
  18. Two saved ads with different text can have the same title and the Saved ads list shows only title and date, so they cannot be told apart (manual check 2026-11-17, steps 12 and 14, O-5). For the 6.2 list screen (add the first line of the ad, the company or the fit level); nothing to fix in 6.1.
  19. Roadmap (step 7.1) choice: pass the roadmap the judgeable job (`splitJudgeable(job).judged`, so it agrees with the report) or the whole job (stricter than the report); a job with no judgeable must-have must never count as Strong. `unlock.ts` is unchanged.
  20. The remove-only "check its requirements" list (the reserved `removedByYou` of PLAN-6.1 section 3) is NOT built in 6.2, although docs/SPRINT.md 6.2 says "check its requirements" (docs/PLAN-6.2.md note 12). Decide whether and when it is built.
- Before the repo goes public or the link is shared: build the access code and confirm the Vercel rate-limit rule (the two AI routes are open to anyone today), read the Groq terms, and settle the owner decisions in the local pre-public report `eval-runs/PUBLIC-REPO-CHECK.md` (git-ignored on purpose: it describes weak spots, never commit it).

**Still true:** macOS gotchas (`sed -i` fails silently, use python; no `timeout` command; zsh does not split an unquoted variable of file names, use arrays; tsx top-level await needs `.mts`). Scratch tools: `eval-runs/tuning-tools/` (gitignored). The readJob 429 / RetryError bug is fixed (`lib/ai/errors.ts`). `docs/REVIEWER-BRIEF.md` is the brief for a new reviewer chat.

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
- Backlog after 3.3 closed on the baseline prompt (PLAN-3.3 section 20): (a) R8 alone, tested in isolation (a city written twice gives a null location); (b) R6 alone; (c) another Groq-hosted model through GROQ_MODEL, after checking it supports the strict structured-output mode this app uses; (d) read the ad twice and compare (code keeps what both readings agree on); (e) personal-quality lines a CV cannot prove: decide in step 3.4 how to show them (see also the personal-quality idea above).
- Day 4 privacy, open: Groq's terms (read 2026-11-15, see DECISIONS) do not state whether API inputs are used for training, and the services agreement and DPA have not been read. Before any real CV goes through the live page: read the DPA, consider enabling Zero Data Retention in the Groq console (Data Controls), and the owner agrees. Also unverified: whether Vercel's runtime logs keep request bodies, and the region the functions run in (privacy page, step 9.3).
- Before the link is shared publicly: an access code (an env var the page asks for once and both routes check) is still to be built; today only the AI_ENABLED=false kill switch exists (set it in Vercel to pause both routes). Also open: Groq training terms and the Vercel rate-limit rule (see the Day 4 privacy note above).
- CV reader is thin: it returns named tools but only about a third of the inferred skills, and recall varies run to run; revisit after Day 5, when inferred skills can match ads.
- Confirm screen: reading the CV again resets everything on it, including cities, years, languages, work modes, available from and the in-progress entries. Consider keeping those and resetting only the skill ticks.
- A stopwatch-timed run of the confirm step by a second person on the made-up CV (the 4.3 check is "under 3 minutes"; so far only the owner's estimate). Also useful as portfolio evidence.
- Composite names (two skills in one name, such as "Systems thinking and prioritization" or "Analytical and quantitative skills") map to their first skill in vocabulary v0; split them at reading time later (the reader or `fromAd` should return one requirement per skill).
- Eval scorer and traits: done 2026-11-16 (scorer v2, see Next steps 6). The 3.3 target line is still strict (found of must-haves); decide with the reviewer whether it should use the adjusted count before the next counted ad eval.
- Stage 2 findings (2026-11-16), resolved by the rule changes of the same day: "shift" no longer maps to Swift (allowance 0 up to 5 letters); MySQL ~ MSSQL accepted. Open: whether to add a never-map list after reading the neighbour audit (201 pairs).

## (g) Eval run log

**Note (2026-11-16, Day 5):** every number in this log was measured on the 17-skill list (fingerprint format 1 or 2). From format 3 the fingerprint carries a vocabulary hash, and earlier numbers are NOT comparable with later ones: the ad eval (75 and 76 of 100 and the others) and the CV eval (found 25 and 23 of 42). No counted eval run has been made since the vocabulary.

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
- 2026-11-15, screen of candidate run 2 (R8 + R6 + R2 on the baseline prompt; request hash 69e383137b, INSTRUCTIONS 3,776) on ad-07, ad-05, ad-03: C1 PASS (4 of 8 target items found), C2 FAIL (lost ad-05 3, ad-03 7), C3 FAIL (ad-07 invented 3, ad-03 found 7 of 14 with widened 7). 15,990 tokens, 3 calls, 0 failed. The tuning scripts and saved reports now live in `eval-runs/tuning-tools/` (gitignored). Details in PLAN-3.3 section 19.
- 2026-11-15, step 3.3 closed on the baseline prompt (request 85357f8fac, INSTRUCTIONS 3,347; committed files clean): target not met, step closed at 75 and 76 of 100 found. Table of every version and the decision: PLAN-3.3 section 20. Not ticked in SPRINT.md yet (owner decides).
- 2026-11-16, CV eval (`npm run eval-cv`, five made-up CVs, 42 key items in all three runs (29 was only the first draft of the plan, never run; the calibration run already used 42, and 596abbc after it widened two accepted-name lists only); request hash 193e02ee3f, INSTRUCTIONS 1,496). Counts only:
  - Calibration run (not counted; full 322b69ed44, before the two name lists were widened): 5 calls, 7,720 tokens, complete. Kept 25, all tied to a line; invented (a) 0; unmatched inferred (b) 3; injected 0; found 26 of 42.
  - Counted run 1 (full 75c0a4668c): 5 calls, 6,905 tokens, complete. Kept 22, tied 22; invented 0; unmatched 1; injected 0; found 25 of 42. TWO IN A ROW: no (the previous run used other keys).
  - Counted run 2 (full 75c0a4668c): 5 calls, 7,110 tokens, complete. Kept 21, tied 21; invented 0; unmatched 1; injected 0; found 23 of 42. TWO IN A ROW: yes. Step 4.2 passed its check.
