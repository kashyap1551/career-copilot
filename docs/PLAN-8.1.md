STATUS: DRAFT for the reviewer, 2026-11-17. Careful lane (section 12, paragraph (b)). Nothing is built, no test is written. Branch `step-8.1`, cut from `step-7.3` (e8b8748). All data below is invented. The numbers in the hand tables of section 6 were worked out by hand first; the engine was then asked (a temporary script, deleted, no AI call) only to confirm the counts they rest on; all agreed (end of section 6).

# Plan for step 8.1: the roadmap report on request

## 0. Status and scope

**What step 8.1 is, according to the sprint** (docs/SPRINT.md:141): "**8.1** Roadmap report on request: skills in order, why each, the roles each unlocks; the AI writes only the words around numbers the code computed." Its check (docs/SPRINT.md:142): "a check confirms every number matches the engine."

**What it needs from what already exists.**
- The ranking, with the roles each skill unlocks: `rankMissingSkills` (lib/engine/unlock.ts:110-163) and its sentence `explainRankedSkill` (lib/engine/explain.ts:189-208), already drawn in the box (app/roadmap.ts:133-147).
- The "why": the gap list, which says how many saved ads ask for each missing skill as a must-have and as a nice-to-have (`gapList`, lib/engine/gaps.ts:27-77, `GapRow.mustAds` and `niceAds`, gaps.ts:13-14).
- The blocked jobs and the timeline: `classifyJobs` (unlock.ts:42-63), `unlockTimeline` (unlock.ts:222-250), drawn since 7.3 (app/roadmap.ts:148-163).
- The ads the way the page hands them over: `roadmapAds(openedReadings(...))` (app/roadmap.ts:177-185, app/page.tsx:157), with the saved-ad id on each job (P0, app/roadmap.ts:99).

**What it does NOT do.**
- It does not change any rule: fit levels, counts, unlocks and the order of skills stay in lib/engine (rule 1 of CLAUDE.md). `lib/engine/*` is not touched.
- It does not predict anything: no chance, no percentage (rule 6), no "you will get the job".
- It does not write a CV bullet (that is 8.3), draw a chart (8.2), or store anything: the report is drawn from what is on the page and is not saved, sent or downloaded.
- It does not show below the roadmap's own threshold (10 counted ads, `ROADMAP_FROM_JOBS`, lib/engine/roadmapJobs.ts:9).

**Is an AI call needed?** My recommendation: **no, not in 8.1** (decision D1, section 2). The report is a fixed layout of sentences written by us (constants in lib/saved/messages.ts) and sentences the engine already writes; code can do all of it. The sprint's words "the AI writes only the words around numbers the code computed" describe an optional polish: if the reviewer wants it, the exact call is described in D1 and it needs a new route, a new prompt with a pinned hash, the access code, the kill switch AND the privacy answer the project does not have yet (Groq's training terms are still open, docs/HANDOFF.md:159). Until then the report works with the AI switched off, which also keeps the kill switch AI_ENABLED=false irrelevant to it.

## 1. What the screen shows

A new block under the "What to learn" box (app/page.tsx:246), in this order:

1. **Nothing**, until the roadmap itself is shown (10 counted ads and a profile in use). Below that, the report does not exist: no button, no hint (the box's threshold line already says how many more ads are needed).
2. **A button** `Make my roadmap report` (a new constant). Pressing it opens the report; the same button then reads `Hide the roadmap report`. The report is recomputed in the browser from the page's own state: no storage read, no network.
3. **The report**, one list of lines (a line marked "sub" is drawn indented under the line above it). Example: the four-ad example of PLAN-7.1 section 1 with the threshold set to 4 (hand case R1 of section 6):

```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 1 job (Data Clerk, Example Wharf Ltd)
Skills to build, in order:
1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.
     Why: asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.
2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.
     Why: asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2.
A skill can be asked in more ads than it unlocks: an ad may need more than one skill, or be held back by something other than skills.
Blocked jobs: none
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).
```

### Every user-visible sentence, with its place and its source

| # | Place | Text | Source |
|---|---|---|---|
| S1 | the button, closed | `Make my roadmap report` | new constant `REPORT_BUTTON_OPEN` |
| S2 | the button, open | `Hide the roadmap report` | new constant `REPORT_BUTTON_CLOSE` |
| S3 | first line | `Your roadmap report` | new constant `REPORT_TITLE` |
| S4 | second line | `Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.` (`1 saved ad` for one) | new function `reportBasisLine(M)` |
| S5 | `Already Strong: ...` | the box's own line | `alreadyStrongLine` (messages.ts:122), not retyped |
| S6 | ranking header, or the "none" line | `Skills to build, in order:` / `Skills to build, in order: none. No other saved job can become a Strong match by skills alone.` | `RANKING_HEADER`, `rankingNoneLine` (messages.ts:126-128), not retyped |
| S7 | one line per ranked skill | `1. Python: unlocks 2 jobs (...). Total so far: 2 jobs.` | `explainRankedSkill` (explain.ts:189), the engine's own; never retyped |
| S8 | a sub line under each ranked skill | `Why: asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.` / `Why: asked as a must-have in 2 of your 4 saved ads.` / `Why: asked as a nice-to-have in 1 of your 4 saved ads.` (`1 of your 1 saved ad` in the singular) | new function `reportWhyLine(must, nice, M)`; the numbers are `GapRow.mustAds`, `niceAds`, `M` |
| S9 | after the ranking, only when it is not empty | `A skill can be asked in more ads than it unlocks: an ad may need more than one skill, or be held back by something other than skills.` | new constant `REPORT_FOOTNOTE` |
| S10 | blocked jobs | `Blocked jobs: none`, or the count line and, per job, its header and its conflict lines | `BLOCKED_NONE`, `blockedCountLine`, `blockedHeader`, `conflictLine`, `YEARS_NOTE` (the box's own) |
| S11 | timeline | header, framing sentence, one `By DATE (...)` line per date, or the none line | `TIMELINE_HEADER`, `TIMELINE_FRAMING`, `TIMELINE_NONE` (messages.ts:134-136), `explainTimelineEntry` (explain.ts:210) |

**New constants for lib/saved/messages.ts:** S1, S2, S3, S4 (a function), S8 (a function), S9. Everything else is imported, so the report and the box cannot drift apart. The view maps lines and writes no sentence (the existing sentence guard style, tests/roadmapGuards.test.ts).

## 2. Decisions this plan needs (leave open; the reviewer decides)

**D1. Does the AI write any words in 8.1?** The sprint line says it writes "the words around numbers the code computed".
- *Recommendation: no.* Reason: (1) every sentence the report needs is a template over numbers, and the engine already writes the hard ones; (2) an AI call would send the person's skills, employer names and learning dates to Groq, whose training terms are still unread (HANDOFF.md:159, DECISIONS.md:52-53), and CLAUDE.md allows no real CV before that is settled; (3) it would cost free-tier tokens on every click and need a new prompt (hash-pinned like the two existing ones, HANDOFF.md:30), a third route with the kill switch (the pattern of app/api/read/route.ts:11) and the access code (route.ts:17); (4) the report stays correct when the AI is paused.
- *If the answer is yes,* the one call would be: a `generateText` with `Output.object` (strict, no streaming), input = a JSON of the report's facts (skill names, counts, labels), output = `{ intro: string, whys: { skillId: string, sentence: string }[] }`; the code would reject the whole answer, and fall back to the template text, when any digit in it is not in the facts, any skill id is not on the ranking, or any capitalised name is not one of the labels. That is an extra plan of its own (careful lane, new tests, the D2 privacy answer first). It would be step 8.1b, not part of this one.

**D2. Where does the button appear, and when?** *Recommendation:* under the box, only when the roadmap is shown (10 counted ads, a profile in use). Reason: the report is the roadmap in full; below 10 ads it would repeat the threshold line.

**D3. Is the report different enough from the box to be worth building?** The box already shows the ranking, the roles it unlocks, blocked jobs and the timeline. The report adds: the title and basis line, the "Why" line per skill (the demand counts of 7.1 placed next to the ranking), one footnote, and one place to read it all as a document. *Recommendation: yes,* because "why each" is the sprint's own wording and is not in the box today; but say so plainly: it is a small step, not a new engine.

**D4. A runtime self-check on the page.** Before drawing the report, run the same number check the tests use (section 3, fact F11) over the rendered lines; if it fails, draw `The roadmap report could not be checked, so it is not shown.` instead of numbers. *Recommendation: yes.* Reason: the sprint's check is "a check confirms every number matches the engine"; running it on the page too means a wrong number is never drawn.

**D5. A "Copy" button or a download.** *Recommendation: neither in 8.1.* Reason: the text can be selected and copied by hand; a download writes a file with employer names to the person's disk and needs its own privacy lines. A later step can add it.

**D6. The footnote (S9) always when the ranking is not empty, or only when some skill is asked in more ads than it unlocks?** *Recommendation: always.* Reason: the condition is a second rule to get wrong ("unlocks" counts differ from "asked" counts for three different reasons: blocked ad, ad needing two skills, ad already unlocked by an earlier skill), and one constant sentence is honest in every case.

**D7. Extract the shared inputs of `roadmapBox`.** The report needs the same counted ads, engine views, engine jobs and label function as the box (app/roadmap.ts:79-99, 127-132). *Recommendation:* move those lines into one exported function `roadmapInputs(built, ads, skills)` in app/roadmap.ts that both `roadmapBox` and the new `roadmapReport` call. The change is mechanical; every existing test (U1 to U12, P0a to P0c, T1 to T20) must stay green with no edit. The alternative, copying the 20 lines, is how the P0 defect could have happened twice.

**D8. Where does the open/closed state live?** *Recommendation:* in the new view component (`useState`), not in page.tsx; the report itself is computed in a `useMemo` with the box (cheap: a few `match` calls per ad).

## 3. Facts (each read in this run)

- **F1. The report to be built from already exists as text in the CLI.** `renderProfileReport` (lib/engine/report-text.ts:28-156) prints, per profile, "Already Strong", "Skills to build, in order", "Blocked jobs" and "Timeline from skills in progress" (report-text.ts:99-153). It is not changed (golden files and U10 stay as they are). 8.1 is the same roadmap on the page, plus the "Why" lines.
- **F2. The ranking.** `RankedSkill = { skillId, newlyUnlocked: string[], totalUnlocked, closer, inProgress }` (unlock.ts:91-99). `newlyUnlocked` holds JOB IDS; the labels come from a `labelOf` that looks a job up by id (app/roadmap.ts:127-132).
- **F3. Everything keys on `job.id`.** `classifyJobs` returns ids (unlock.ts:48, 54), `rankMissingSkills` keeps a `Set` of ids (unlock.ts:124-133), `unlockTimeline` removes earlier ids with `before.includes` (unlock.ts:244), `labelOf` uses `findIndex` by id (roadmap.ts:128). Every opened reading carries the id `"pasted-ad"` (lib/ai/readJob.ts:65, lib/saved/openJob.ts:29), so `roadmapBox` gives each counted job the SAVED-AD id (roadmap.ts:99; P0, PLAN-7.1 Amendment 7). The report must use the same engine jobs, not the raw ones.
- **F4. Which ads count.** `roadmapBasis(job)` (lib/engine/roadmapJobs.ts:19-30): an ad with no requirements, or with no must-have we could judge, is not counted (roadmap.ts:82-87). `M` is the number counted.
- **F5. The "why" numbers.** `gapList(engineProfile, engineJobs, nameOf)` (gaps.ts:27) counts, per skill, the counted ads with an unmet must-have naming it (`mustAds`) and with an unmet nice-to-have (`niceAds`), each ad once, blocked ads included (gaps.ts:32-44; PLAN-7.1 G12). Every skill the ranking can name appears as a row: the ranking's candidates are the unmet must-haves of the same engine jobs (unlock.ts:118-121), which `gapList` counts too.
- **F6. The engine's sentences.** `explainRankedSkill` (explain.ts:189-208), `explainTimelineEntry` (explain.ts:210-222), `blockedHeader` (explain.ts:176-185), `conflictLine` (explain.ts:172-174), `jobLabel` (explain.ts:35-37).
- **F7. Where the box is built and shown on the page.** `roadmapBoxSafe(profile, roadmapAds(openedReadings(adList, { stamps, skills })), skills)` in a `useMemo` (app/page.tsx:156-159); `<RoadmapView box={roadmap} />` (page.tsx:246). `RoadmapView` has no button and the manual checks of 7.1 and 7.3 expect none (docs/MANUAL-CHECK-7.1.md step 9, MANUAL-CHECK-7.3.md step 7); so the new button lives in a NEW component, not in `RoadmapView` (the view stays a pure map of lines, app/RoadmapView.tsx:9-43).
- **F8. The threshold.** `ROADMAP_FROM_JOBS = 10` (roadmapJobs.ts:9); the box shows the roadmap only from `M >= fromJobs` (roadmap.ts:125).
- **F9. The kill switch and the access code are in the routes, not in the page.** `aiPaused()` (lib/ai/enabled.ts:5-7), checked at the top of the read route (app/api/read/route.ts:11); `checkAccess` (route.ts:17). A report made without an AI call touches neither.
- **F10. Where the data lives.** Saved ads and the profile are in the browser's IndexedDB, read once at load (app/page.tsx:154-155 and `useSaved`); nothing is sent by the box or the report. The profile in use is `savedBuilt ?? built` (page.tsx:136).
- **F11. The number check (the sprint's "check").** To be built: a pure function `reportNumbers(lines)` that removes every known label (job labels with their caveats, skill names), every ISO date and the list markers (`1.`), then returns the digits that remain, in order; and `reportFacts` (the numbers the code computed, in the same order). The check passes when the two lists are equal. Labels must be removed first because a title may contain a digit ("Level 2 Analyst").
- **F12. Words live in messages.ts.** The 7.1 and 7.3 constants are at lib/saved/messages.ts:84-140; the view guard that forbids a sentence in the view is in tests/roadmapGuards.test.ts (the "no sentence literal" group).
- **F13. Test helpers.** `viaPage`, `openedAd`, `page` (tests/support/viaPage.ts) build ads the way the page does (id "pasted-ad", distinct saved ids, through `roadmapAds`); the invented person and ads 1 to 4 are in tests/support/roadmapFixtures.ts; the ten ads of docs/MANUAL-CHECK-TEN-ADS.md are built with the real `buildJob` in tests/roadmapIds.test.ts (P0c).

## 4. Edge cases

| Edge | What the report does | Case / test |
|---|---|---|
| no profile in use | no report, no button | T6 |
| no saved ads | no report, no button | T6 |
| fewer than 10 counted ads | no report, no button (the box's threshold line stays) | T6 |
| zero counted ads (all excluded) | no report | T6 |
| every counted ad already Strong | `Already Strong: N jobs (...)`, the "none" ranking line, no Why lines, no footnote, blocked none, timeline per profile | R4 / T4 |
| a ranked skill that brings no job closer alone ("together with ...") | its engine sentence, then its Why line | R5 / T5 |
| blocked ads | listed with the engine's lines; their unmet skills still count in the Why numbers (so a skill can be asked in more ads than it unlocks: the footnote) | R2 / T2 |
| ads that share the id `pasted-ad` | every report test builds its ads that way (F13); each counted job takes its saved-ad id | all |
| a skill in progress with no date | dropped from the profile with a red line on the confirm screen (PLAN-7.3 probe a); the report shows the ranking line without "(in progress ...)" and the timeline none line | T3 (variant) |
| a date in the past | shown and counted as stored; no clock | R3 variant / T3 |
| a very long title or company | the line wraps (`break-words`); no truncation, no rewriting | view class check (T12) |
| characters that need escaping (`<`, `&`, `'`) | React escapes text; no raw HTML is ever built | T12c |
| a title or company with a digit ("Level 2 Analyst") | labels are removed before the number check, so the check does not report a false mismatch | R8 / T7 |
| a person with one counted ad | allowed when the threshold is set to 1 in a test; singular grammar (`1 saved ad`, `1 of your 1 saved ad`, `1 job`) | R5 / T5 |
| the number check fails on the page | the report is not drawn; one line says so | T10 |
| a throw while working out the report | one line, no error page (like `roadmapBoxSafe`) | T9 |

## 5. Files

| File | Change |
|---|---|
| `app/roadmap.ts` | extract `roadmapInputs(built, ads, skills)` from `roadmapBox` (D7); `roadmapBox` calls it; no text and no field changes |
| `app/roadmapReport.ts` (new) | `roadmapReport(built, ads, skills, fromJobs)` -> `RoadmapReport | null`; `roadmapReportSafe`; `reportNumbers`, `reportFacts`, `checkReport` (F11) |
| `app/RoadmapReportView.tsx` (new, client) | the button, the open/closed state, and a pure body that maps the lines (no sentence literal, keys by position) |
| `app/page.tsx` | one `useMemo` for the report next to the box's; `<RoadmapReportView report={...} />` under `<RoadmapView />`; the ads list is computed once and given to both |
| `lib/saved/messages.ts` | new constants S1, S2, S3, S4, S8, S9 and the check-failed line |
| `lib/engine/*` | **NOT changed** |
| `lib/ai/*`, `app/api/*` | **NOT changed** (no AI call, D1) |
| `tests/roadmapReport.test.ts` (new), `tests/roadmapReportView.test.ts` (new), `tests/roadmapGuards.test.ts` (a new `describe` appended) | section 7 |
| `docs/MANUAL-CHECK-8.1.md` (later) | section 9 |

## 6. Hand-worked cases (written BEFORE any code)

Ads and person: the invented person of tests/support/roadmapFixtures.ts (SQL from CV line 2 and Excel from line 4 had; Tableau in progress 2027-03-01; city Berlin set; no other kind set) and its ads 1 to 4 (all Berlin, hybrid): a1 Reporting Analyst, Northlake Foods Ltd (must SQL, Tableau; nice Excel); a2 BI Developer, Harbor Light Stationery (must SQL, Python; nice Tableau); a3 Data Clerk, Example Wharf Ltd (must Excel; nice Python, Power BI); a4 Analytics Lead, Imaginary Pages Ltd (must SQL, Python and one must not in our list, set aside, so its label carries `(1 must-have not judged)`; nice Tableau). All ads below reach the code through `viaPage`: job id `pasted-ad`, distinct saved ids. "Sub" = a line drawn indented.

### R1: the four-ad example (threshold set to 4)

Hand count. a1: SQL met, Tableau in progress (not met): missing [Tableau]. a2: missing [Python]. a3: Excel met, no conflict: Already Strong. a4 (judged part): SQL met, Python missing: missing [Python]. Ranking (greedy): Python would unlock a2 and a4 (2 jobs); Tableau would unlock a1 (1); so Python first (2 newly, total 2), then Tableau (1 newly, total 3). "Why" counts (each ad once per importance, PLAN-7.1 section 1): Python must in a2 and a4 = 2, nice in a3 = 1; Tableau must in a1 = 1, nice in a2 and a4 = 2. Blocked: none. Timeline: Tableau 2027-03-01 covers a1: 1 more Strong match.

Expected lines (text; `*` marks a sub line):
```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 1 job (Data Clerk, Example Wharf Ltd)
Skills to build, in order:
1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.
* Why: asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.
2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.
* Why: asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2.
A skill can be asked in more ads than it unlocks: an ad may need more than one skill, or be held back by something other than skills.
Blocked jobs: none
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).
```
Numbers, left to right after removing labels, dates and list markers: 4; 1; 2, 2; 2, 4, 1; 1, 3; 1, 4, 2; 1 = `[4,1,2,2,2,4,1,1,3,1,4,2,1]` (13 numbers).

### R2: the same ads, ad 2 in Exampleville (blocked)

Ad 2 is hybrid in Exampleville and the person's only city is Berlin: an unclosable location conflict, so ad 2 is blocked (never reachable). Ranking: Python now unlocks a4 only (1); Tableau unlocks a1 (1); equal on jobs unlocked and on jobs brought closer (0), so the skill already in progress comes first (unlock.ts:169-177): Tableau (1, total 1), then Python (1, total 2). "Why" counts still include the blocked ad (PLAN-7.1 G12): Tableau must a1 = 1, nice a2 and a4 = 2; Python must a2 and a4 = 2, nice a3 = 1. So Python is "asked in 2 ads" but unlocks 1: the footnote covers it. Blocked: 1 (ad 2). Timeline: Tableau covers a1 only.
```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 1 job (Data Clerk, Example Wharf Ltd)
Skills to build, in order:
1. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 1 job.
* Why: asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2.
2. Python: unlocks 1 job (Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.
* Why: asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.
A skill can be asked in more ads than it unlocks: an ad may need more than one skill, or be held back by something other than skills.
Blocked jobs (skills alone can't make these Strong): 1
- BI Developer, Harbor Light Stationery: blocked by 1 thing; it can't be closed soon
(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin.
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).
```
(the blocked lines are the box's own, as in the P0b test; the report draws them as plain lines.) Numbers, left to right: basis 4; Already Strong 1; Tableau line 1, 1; its Why 1, 4, 2; Python line 1, 2; its Why 2, 4, 1; the blocked count 1; the header "blocked by 1 thing" 1; the timeline 1 = `[4,1,1,1,1,4,2,1,2,2,4,1,1,1,1]` (15 numbers). The conflict line has no number.

### R3: the ten SQL-only ads of docs/MANUAL-CHECK-TEN-ADS.md, SQL in progress (the manual-check profile of 7.3 step 3)

The ten ads are built with the real `buildJob` (id `pasted-ad`), ten saved ids; the profile has Tableau and Excel but NOT SQL; SQL in progress, expected 2027-06-01; Berlin. Hand count: every ad's one must-have, SQL, is missing (in progress), no conflict (Berlin, hybrid): ten reachable, none Strong. SQL covers all ten: 10 newly unlocked, total 10. Why: SQL must in 10 of 10 ads; nice 0 (left out). Blocked none. Timeline: 2027-06-01 covers all ten.
```
Your roadmap report
Based on 10 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: none
Skills to build, in order:
1. SQL (in progress, expected 2027-06-01): unlocks 10 jobs (Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd; Stock Analyst, Fern Dock Ltd; Billing Clerk, Gorse Lane Ltd; Order Analyst, Heath Row Ltd; Ledger Clerk, Ivy Gate Ltd; Survey Assistant, Juniper Hall Ltd; Tally Clerk, Larch Wharf Ltd). Total so far: 10 jobs.
* Why: asked as a must-have in 10 of your 10 saved ads.
A skill can be asked in more ads than it unlocks: an ad may need more than one skill, or be held back by something other than skills.
Blocked jobs: none
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-06-01 (SQL): 10 more Strong matches (the same ten names).
```
Numbers: 10; 10, 10; 10, 10; 10 = `[10,10,10,10,10,10]`. This is the real threshold (10), so no test-only setting.

### R4: every counted ad already Strong (threshold 4)

Person: SQL had (line 2), nothing in progress, Berlin. Ads s1 to s4: Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd (each must SQL only, Berlin, hybrid). All four Strong; nothing reachable; no ranking.
```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 4 jobs (Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd)
Skills to build, in order: none. No other saved job can become a Strong match by skills alone.
Blocked jobs: none
Timeline from skills in progress: none.
```
No Why line, no footnote. Numbers: `[4,4]`.

### R5: a skill that brings the job closer only together with another (threshold 1)

Person: no skills at all (nothing kept, nothing in progress), Berlin. One ad z1 "Platform Analyst, Invented Co One" (must Python, must Docker; Berlin, hybrid). Hand count: the ad is reachable, missing [Python, Docker]. Neither skill alone unlocks it (newly 0); each brings it one step closer (closer 1); the tie goes to the skill id: docker before python (unlock.ts:169-177). Docker first: it unlocks nothing, so its line is "together with Python, unlocks Platform Analyst, Invented Co One" (explain.ts:203-207). Then Python (with Docker chosen) unlocks z1: 1 job, total 1. Why: Docker must 1 of 1 ad; Python must 1 of 1 ad. Blocked none; timeline none.
```
Your roadmap report
Based on 1 saved ad we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: none
Skills to build, in order:
1. Docker: together with Python, unlocks Platform Analyst, Invented Co One.
* Why: asked as a must-have in 1 of your 1 saved ad.
2. Python: unlocks 1 job (Platform Analyst, Invented Co One). Total so far: 1 job.
* Why: asked as a must-have in 1 of your 1 saved ad.
A skill can be asked in more ads than it unlocks: an ad may need more than one skill, or be held back by something other than skills.
Blocked jobs: none
Timeline from skills in progress: none.
```
Numbers: basis 1; the Docker line has none; its Why 1, 1; the Python line 1, 1 (`1 job`, `Total so far: 1 job`); its Why 1, 1 = `[1,1,1,1,1,1,1]` (7 numbers).

### R8: digits in a title (the number check must not be fooled), threshold 1

Person: SQL not had; in progress SQL 2027-06-01; Berlin. One ad "Level 2 Analyst, Example 7 Ltd" (must SQL). Reachable; SQL unlocks it (1, total 1); Why: must 1 of 1; timeline: 1.
```
...
1. SQL (in progress, expected 2027-06-01): unlocks 1 job (Level 2 Analyst, Example 7 Ltd). Total so far: 1 job.
* Why: asked as a must-have in 1 of your 1 saved ad.
...
By 2027-06-01 (SQL): 1 more Strong match (Level 2 Analyst, Example 7 Ltd).
```
Numbers after removing labels and dates: basis 1; unlocks 1, total 1; why 1, 1; timeline 1 = `[1,1,1,1,1,1]`. Without removing the labels the check would also read 2, 7, 2, 7 and report a false mismatch.

**Counts confirmed against the engine (the only thing the engine was asked):** a temporary script (deleted; no AI call; no code of 8.1 exists) ran the engine's own `gapList`, `classifyJobs`, `rankMissingSkills` and `unlockTimeline` on R1, R2, R3 (the ten ads through the real `buildJob`), R4, R5 and R8, with saved-ad ids on the jobs. Every count in the tables agreed: R1 strong 1, Python unlocks 2 (total 2), Tableau 1 (total 3), why Python 2/1, Tableau 1/2, timeline 1; R2 blocked 1 (one conflict), Tableau then Python (1 and 1; totals 1, 2), why Python 2/1, Tableau 1/2, timeline 1; R3 SQL unlocks 10 (total 10), why 10/0, timeline 10; R4 strong 4, no ranking, no timeline; R5 Docker unlocks 0 then Python 1 (total 1), why 1/0 each; R8 SQL unlocks 1, why 1/0, timeline 1. No expectation was adjusted.

## 7. Tests, tests first

Expected texts come from section 6. Every test that builds ads uses `viaPage` (id `pasted-ad`, distinct saved ids, through `roadmapAds`) unless marked ENGINE.

| # | Test | File | Form |
|---|---|---|---|
| T1 | R1: the report's lines, with the sub flags | tests/roadmapReport.test.ts | page's way |
| T2 | R2: blocked ad, order Tableau then Python, the blocked lines, footnote | same | page's way |
| T3 | R3: the ten ads of MANUAL-CHECK-TEN-ADS built with the real `buildJob`, real threshold; plus a variant with the SQL date in the past (2026-01-15) and one with SQL given with no date (dropped: ranking without "(in progress ...)", timeline none) | same | page's way, real builder |
| T4 | R4: all Strong: no ranking, no Why, no footnote | same | page's way |
| T5 | R5: "together with" skill, singular grammar | same | page's way |
| T6 | no report (null): no profile; no saved ads; 9 counted ads at threshold 10; zero counted ads | same | page's way |
| T7 | R8: digits in labels; `reportNumbers` equals the hand list `[1,1,1,1,1,1]`; and R1's list equals `[4,1,2,2,2,4,1,1,3,1,4,2,1]`, R2's `[4,1,1,1,1,4,2,1,2,2,4,1,1,1,1]`, R3's, R4's `[4,4]`, R5's `[1,1,1,1,1,1,1]` | same | page's way |
| T8 | the checker can fail: R1's lines with one number changed ("unlocks 3 jobs") and one with a label's digit moved into a number are both rejected by `checkReport` | same | ENGINE-free (lines only) |
| T9 | `roadmapReportSafe` after a throw (a record with no requirements): one line, no throw | same | the S1 form of tests/roadmap.test.ts |
| T10 | the runtime self-check: a report whose numbers do not match its facts is replaced by the check-failed line | same | page's way, with a facts seam |
| T11 | property over invented profiles and ad sets (the fixtures of R1 to R5 with 8 combinations of person: kept skills x in progress): for each, `reportNumbers(lines)` equals the numbers computed directly by calling `gapList`, `rankMissingSkills`, `classifyJobs` and `unlockTimeline` in the test (this is the sprint's check; labelled a property, its expectation is not hand-worked) | same | ENGINE (direct calls) |
| T12 | the view: `RoadmapReportView` closed shows only the button; the body drawn from lines shows them as list items in order, sub lines marked; an apostrophe, `<` and `&` in a label are drawn as the same text; nothing drawn when the report is null | tests/roadmapReportView.test.ts (react-dom/server, no JSX) | markup only |
| T13 | U12g: the report's ranking, blocked and timeline lines equal the CLI's lines for the same engine inputs (after removing the Why lines, the footnote, the framing and the caveat) | tests/roadmapReport.test.ts | page's way vs `renderProfileReport` |
| T14 | guard (source): app/roadmapReport.ts and app/RoadmapReportView.tsx contain no `fetch(`, `localStorage`, `indexedDB`, `saveJob`, `deleteJob`, `useEffect`, no `@/lib/ai` import and no `Date.now` / `new Date`; the clipboard is not used (D5) | tests/roadmapGuards.test.ts (new `describe`) | source |
| T15 | guard (source): no sentence literal of four or more words in the two new files; the view maps lines with an index key and has no `<form` | same | source |
| T16 | guard (source): the box's `RoadmapView.tsx` still has no `onClick` (the button is in the new file) | same | source |
| T17 | the message constants and functions are exactly the texts of section 1 (S1 to S4, S8 in its three forms, S9, check-failed line) | tests/roadmapReport.test.ts | pure |
| T18 | `roadmapBox` is unchanged by the extraction: every existing test passes (no new test; the count before and after is reported) | all existing | page's way |
| T19 | P0 for the report: R1 built with every job id "pasted-ad" gives T1's lines; the same with distinct ids gives the same lines | tests/roadmapReport.test.ts | page's way vs distinct |

## 8. Deliberate breaks (each must make the NAMED test fail)

| # | Break | Named test |
|---|---|---|
| B1 | the report uses the jobs BEFORE `listedAlternatives` (a different list from the ranking) | T13 (and T1 if an unlisted alternative is present) |
| B2 | remove the saved-ad id line from `roadmapInputs` (P0 again) | T19, T1, T4 |
| B3 | swap `mustAds` and `niceAds` in the Why line | T1 |
| B4 | the Why numbers ignore blocked ads | T2 |
| B5 | show the report below the threshold | T6 |
| B6 | `reportNumbers` does not remove labels first | T7 |
| B7 | `checkReport` returns true always | T8 |
| B8 | the runtime self-check removed | T10 |
| B9 | import `@/lib/ai/...` into the report file | T14 |
| B10 | `new Date()` in the report | T14 |
| B11 | the plural wrong ("1 saved ads", "1 of your 1 saved ads") | T5 |
| B12 | the footnote dropped when the ranking is not empty | T1 |
| B13 | the footnote shown when the ranking is empty | T4 |
| B14 | a sentence typed into RoadmapReportView.tsx | T15 |
| B15 | the report lines keyed by their text alone | T15 |
| B16 | `roadmapBox` changed by the extraction (a field dropped) | the existing U3 and P0a, named in the report |
| B17 | a `fetch(` in the view | T14 |
| B18 | the date of a skill read from the clock instead of the profile | T14 |

## 9. Manual-check outline (for docs/MANUAL-CHECK-8.1.md; every step NOT RUN YET)

Needs **11 AI reads** on the new preview address (the CV once, the ten ads of docs/MANUAL-CHECK-TEN-ADS.md once each: a preview address has its own empty storage); everything after step 2 needs none. Invented data only.
1. Open the step-8.1 preview in a new private window; do the setup of MANUAL-CHECK-7.3 step 1 (the invented CV, the three skills ticked, Berlin, saved, the ten ads read and saved). **Expect:** ten rows; the box as in 7.3 step 1 (the roadmap is shown: ten counted ads and a profile in use).
2. Look under the box. **Expect:** one button `Make my roadmap report`, and no report text yet.
3. On the confirm screen untick SQL and add SQL in progress with the date 2027-06-01. Press the button. **Expect:** the lines of R3, exactly, with the ten different names, each once.
4. Press `Hide the roadmap report`. **Expect:** the lines vanish, the button reads `Make my roadmap report`.
5. Change the date to 2027-03-01 (remove and add). Press the button. **Expect:** `(in progress, expected 2027-03-01)` and `By 2027-03-01 (SQL): 10 ...`, the same ten.
6. Add a skill in progress with NO date. **Expect:** the red line of 7.3; the report shows no entry for it.
7. Delete one saved ad (nine left). **Expect:** the button and the report are gone; the box shows the threshold line.
8. Network tab, filter `api`, cleared before step 3, Preserve log ticked. **Expect:** no `/api/` request for steps 3 to 7.
9. Console: no red errors of ours.
Log table: nine rows, NOT RUN YET.

## 10. Privacy and safety

- **Where the text goes: nowhere but the person's own browser.** The report is built in the page from data already in the page; it is not sent, saved, logged, downloaded or put in a URL. There is no new route, so there is nothing for the server to log. No AI is called (D1), so nothing leaves the device (rule 4 of CLAUDE.md and decision D2 of docs/DECISIONS.md:52 are not engaged).
- **What could leak.** The report names employers and job titles from the person's saved ads, skills (some with learning dates), and the person's cities only through blocked-job lines ("the cities on your profile are: Berlin"). If the person copies it into a chat, an email or a screenshot, that is their own act; the page offers no copy, download or share button (D5), so nothing is prepared for it.
- **How the page avoids it.** No `fetch`, no storage, no clipboard, no clock in the new files (T14); the view maps text lines and React escapes them (T12); a failed check shows a line, never a number.
- **Printed or downloaded?** Browser printing prints what is on the screen; that is the person's choice, outside the app.
- **Tests and manual checks** use invented data only (CLAUDE.md rule 5, 8): the ads of R1 to R8 and docs/MANUAL-CHECK-TEN-ADS.md; no real CV; the access code is never typed anywhere but the app's code box.
- **If D1 is answered "yes"** the privacy analysis changes: employers, skills and dates would go to Groq. That needs the D2 answer first and a notice at the button; it is out of this plan.

## 11. Open questions for the reviewer (smaller; each with my recommendation)

1. **Name.** "Roadmap report" (the sprint's word) or "What to learn report"? *Recommend* "roadmap report": it matches the sprint and the CLI.
2. **A date or "made on ..." line.** *Recommend none:* it needs a clock, which every step so far kept out of the engine, the box and the tests.
3. **Should the report repeat the gap list** (every missing skill, not only the ranked ones)? *Recommend no:* the ranked skills are the ones that unlock or bring a job closer; the gap list stays in the box.
4. **The "Why" line for a skill that is ONLY asked as a nice-to-have.** Cannot happen in the ranking (candidates come from missing must-haves, F5), but the function has the form. *Recommend* keep the form and test the function alone.
5. **Runtime check (D4) failure line wording**: `The roadmap report could not be checked, so it is not shown.` *Recommend* this text.
6. **8.1 as one step or two** (8.1 code-only report; 8.1b the optional AI wording). *Recommend two,* with 8.1b decided after the Groq terms are read.

## 12. Two paragraphs (the reviewer asked for them here)

**(a) Does 8.1 depend on 7.3 or only on 7.1?** By content, only on 7.1 (and on its P0 fix): the report is the ranking, the "why" counts from the gap list, and the blocked jobs, all built in 7.1; the timeline lines, the one 7.3 piece, are a section the report can omit. By construction it depends on 7.3 as well: this branch is cut from `step-7.3`, the report uses the same `roadmapBox` inputs that 7.3 extended (the `timeline` field, app/roadmap.ts:64-67, 158-172), and the new button sits next to `RoadmapView` whose third list is the 7.3 timeline. So the merge order should be: 7.1 (carries P0), then 7.3, then 8.1. 8.1 must not merge before 7.3's manual check passes, because both touch app/roadmap.ts and app/page.tsx; a merge of 8.1 first would merge 7.3 with it. If the reviewer would rather drop the timeline section of the report, 8.1 can be rebased onto `step-7.1` with its commits cherry-picked, and the order stops mattering.

**(b) Careful lane or ordinary lane?** Careful lane. It tells a person what to learn first and how many jobs each skill "unlocks"; those are numbers a person may act on (what to study, which jobs to apply to), and CLAUDE.md puts "anything that could tell a person something about their chances or contains numbers they may act on" there. It also adds a new place where the rule "plain code decides and counts" could be broken (a text that disagrees with the engine), it changes shared code (`roadmapBox`, D7) that the P0 defect showed to be fragile, and, if D1 were answered "yes", it would add an AI that writes next to numbers. Hence: a short plan (this one), hand-worked expected texts, tests first, deliberate breaks with named tests, and a manual check before any tick.

## 13. For DECISIONS at merge time

(Not written to docs/DECISIONS.md; lines to add when the step merges, each with its reason.)

- 2026-11-17: Step 8.1: the roadmap report is built by code from the saved ads and the profile in use; no AI writes any word in it. Reason: every sentence is a template over counted numbers, the engine already writes the hard ones, and no text may leave the device before the Groq terms are settled (docs/HANDOFF.md:159).
- 2026-11-17: The report shows only when the roadmap shows (10 counted ads and a profile in use), as a button under the "What to learn" box; the state is open or closed in the page, nothing is stored. Reason: below 10 ads it would repeat the threshold line.
- 2026-11-17: Each ranked skill carries a "Why" line made of the 7.1 gap counts (asked as a must-have in N of M ads, as a nice-to-have in K), and one fixed footnote says a skill can be asked in more ads than it unlocks. Reason: the sprint asks "why each"; the counts exist; the two numbers differ for three different reasons, so one honest sentence beats a condition.
- 2026-11-17: Every number in the report is checked against the engine's own numbers (labels, dates and list markers removed first), in tests and on the page before the report is drawn. Reason: the sprint's check; a wrong number must never be drawn.
- 2026-11-17: `roadmapBox` and `roadmapReport` share one function for the counted ads, the engine views, the engine jobs (with the saved-ad id) and the label function. Reason: two copies of that code is how the P0 defect could have happened twice.
- 2026-11-17: The report has no copy, download or share button and no date. Reason: a file or a clipboard write carries employer names off the page, and a date needs a clock.
