STATUS: DRAFT v1 (2026-11-18). No code, no tests yet. Waiting for the owner's OK (careful lane). Branch step-8.2, cut from step-8.1 (3831e02).

# Plan for step 8.2: analytics across the saved ads

## 0. What 8.2 adds, honestly (the first question)

**What the sprint says** (docs/SPRINT.md:143-144): "**8.2** Analytics page: fit levels across saved jobs, the most-asked skills, your skills employers ask for most." Its check: "each chart has a table view that matches the data."

**What the page already shows after 7.1, 7.3 and 8.1** (all from the same saved ads and the same profile in use):
- the fit level of EACH saved ad, one row each (6.2, `rankedAdRows`, app/savedAdRows.ts:67);
- the skills you are MISSING, with the number of ads that ask for each, must-haves and nice-to-haves apart (the gap list of the box, 7.1);
- the ranking of skills to build and the jobs each unlocks, the blocked jobs, the "Already Strong" count and the timeline (box 7.1/7.3, report 8.1);
- the report repeats the ranking and adds one "Asked as ..." line per ranked skill (8.1).

**Honest answer: mostly the same numbers.** The "most-asked skills" the sprint wants are, for every skill you do NOT have, exactly the numbers of the gap list. Three things are genuinely new, and they are all that 8.2 adds:
1. **The spread of fit levels as counts.** The saved-ads list shows each ad's level, but nothing counts them: "Strong 1, Good 3, Stretch 0, Long shot 0". (The box's "Already Strong: N" is only the first of these numbers.)
2. **The asked counts for skills you already have.** The gap list counts only what you are missing. Nothing today says "SQL, which you have, is asked in 3 of your 4 saved ads". This is the sprint's third item, "your skills employers ask for most", and it needs new counting code.
3. **One list of every asked skill, with where you stand on each** (on your profile, learning it with its date, not on your profile). The box shows missing skills only; the new list shows all of them in one order.

**The smallest useful version** is therefore: one button under the report, `Show my analytics`, that opens (a) five count lines for the fit levels, with one plain bar each, and (b) two plain lists of skills with counts: all asked skills, and the ones you have. No ranking, no blocked jobs, no timeline, no job names (so no employer name is ever shown), no copy button. Everything else of the sprint line is already on the page. If the owner thinks level counts alone are enough, section 12 (Q1) names an even smaller version.

## 1. Status and scope

**What it needs from what exists** (every item read in this run, section 3).
- `roadmapInputs` and `ReadyInputs` (app/roadmap.ts:76-125): which ads count (M), the engine's view of each, the engine jobs with the SAVED-AD id (P0), the gap list, the name function.
- The gap rows `GapRow.mustAds/niceAds/learning/noCvLine` (lib/engine/gaps.ts:11-17) for the skills you are missing.
- `profileReport(...).level` (app/fitReport.ts:234): the level the saved-ads list already shows, with "no level" as `null`.
- The box's and report's own sentences and constants (`reportBasisLine`, `notCountedLine`, `gapRowText`, `learningNote`, `NO_CV_LINE_NOTE`, `ALTERNATIVES_NOTE`, `levelName`), reused, not retyped.
- The pattern of 8.1: a button that mounts a view only while the roadmap shows, starting closed.

**What 8.2 does NOT do.**
- It changes no existing rule: fit levels, gap counts, unlocks and their order stay as they are (CLAUDE.md rule 1). New counting code goes into a NEW file, lib/engine/analytics.ts (D3); no existing file of lib/engine changes.
- It predicts nothing: no probability, no "chance", no percentage shown (rule 6). A bar's length is a drawing of a count; the number printed is always the count.
- It uses no clock and no AI (D1). It makes no network call and writes no storage, no file, no clipboard (D8).
- It does not repeat the ranking, the blocked jobs, the timeline, or any job name (D2).
- It adds no dependency (D6).
- It does not show below the roadmap's own gate: 10 counted ads and a profile in use (D5).

## 2. What the screen shows

A new block under the roadmap report (app/page.tsx:253), mounted by the page **only while the report exists** (the same condition). It starts closed each time it is mounted.

1. Closed: one button `Show my analytics`.
2. Open: the button reads `Hide the analytics`; under it, in this order: the title; the basis line; the not-counted line when there is one; the fit-level block; the asked-skills block; the your-skills block.

The four-ad example of PLAN-7.1 section 1 / PLAN-8.1 case R1, gate set to 4 (hand case R1 of section 6; `|n of m|` marks the bar drawn under a line):

```
Your analytics
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Fit levels across your saved ads
(These are the levels shown on your saved ads, counted against the profile in use.)
Strong: 1 of your 4 saved ads            |1 of 4|
Good: 3 of your 4 saved ads              |3 of 4|
Stretch: 0 of your 4 saved ads           |0 of 4|
Long shot: 0 of your 4 saved ads         |0 of 4|
Skills asked across your 4 saved ads
SQL (on your profile): must-have in 3 ads
Python (not on your profile): must-have in 2 ads, nice-to-have in 1 ad
Tableau (you are learning it, expected 2027-03-01): must-have in 1 ad, nice-to-have in 2 ads
Excel (on your profile): must-have in 1 ad, nice-to-have in 1 ad
Power BI (not on your profile): nice-to-have in 1 ad
Skills of yours asked across your 4 saved ads
SQL (on your profile): must-have in 3 ads
Excel (on your profile): must-have in 1 ad, nice-to-have in 1 ad
```

### Every user-visible sentence, with its place and its source

| # | Place | Text | Source |
|---|---|---|---|
| A1 | the button, closed | `Show my analytics` | new constant `ANALYTICS_BUTTON_OPEN` |
| A2 | the button, open | `Hide the analytics` | new constant `ANALYTICS_BUTTON_CLOSE` |
| A3 | the title | `Your analytics` | new constant `ANALYTICS_TITLE` |
| A4 | first line | `Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.` | `reportBasisLine(M)` (messages.ts:147), the report's own, not retyped |
| A5 | right after A4, only when not null | `1 saved ad is not counted: the AI found no requirements in it.` (and its forms) | `notCountedLine` (messages.ts:107), not retyped |
| A6 | fit-level heading | `Fit levels across your saved ads` | new constant `LEVELS_TITLE` |
| A7 | under A6 | `(These are the levels shown on your saved ads, counted against the profile in use.)` | new constant `LEVELS_NOTE` (a parenthesis, like `GAP_SUBTITLE`) |
| A8 | one line per level, always the four, in the order Strong, Good, Stretch, Long shot | `Strong: 1 of your 4 saved ads` (`1 of your 1 saved ad` for one) | the name is `levelName(level)` (explain.ts:23), not retyped; the line is new `levelCountLine(name, n, M)` |
| A9 | a fifth line, only when its count is above 0 | `No level: 3 of your 3 saved ads` | new constant `NO_LEVEL_NAME` = `No level`, same function as A8 |
| A10 | asked-skills heading | `Skills asked across your 4 saved ads` | new function `askedTitle(M)` (the pattern of `gapTitle`, messages.ts:88) |
| A11 | one line per skill | `Python (not on your profile): must-have in 2 ads, nice-to-have in 1 ad` | `gapRowText(name, note, must, nice)` (messages.ts:93), not retyped; the note is `learningNote(date)` (messages.ts:90) when learning, `NO_CV_LINE_NOTE` (messages.ts:91) when on the profile without a CV line, and two NEW constants ` (on your profile)` and ` (not on your profile)` |
| A12 | under the asked list, only when a counted requirement accepts several skills | `A requirement that accepts several skills is counted once for each of them.` | `ALTERNATIVES_NOTE` (messages.ts:100), not retyped |
| A13 | under a list, only when rows of that list were cut | `3 more skills are asked in your saved ads and are not shown.` (`1 more skill is asked ... and is not shown.`) | new function `moreSkillsLine(n)` |
| A14 | your-skills heading | `Skills of yours asked across your 4 saved ads` | new function `yoursTitle(M)` |
| A15 | the same, when there is none | `Skills of yours asked across your 3 saved ads: none.` | new function `yoursNoneLine(M)` |
| A16 | instead of the button, after a throw | `The analytics could not be worked out.` | new constant `ANALYTICS_FAILED_LINE` |

**New constants and functions for lib/saved/messages.ts:** A1, A2, A3, A6, A7, A8, A9, A10, A13, A14, A15, A16 and the two notes of A11. Everything else is imported. The view writes no sentence.

### The shape of the analytics, and how it is drawn

- `Analytics = { title: string; lines: AnalyticsLine[] }`, `AnalyticsLine = { text: string; kind: "basis" | "note" | "heading" | "level" | "skill" | "plain"; bar: { n: number; of: number } | null }`. The title is not among the lines. `bar` is not null only on the level lines (A8, A9).
- `analyticsSafe(...)` returns `{ kind: "none" } | { kind: "ready"; analytics } | { kind: "failed"; line }` (the shape of `ReportOutcome`, app/roadmapReport.ts:21).
- **Drawing.** One `<section aria-label="Your analytics">`; a `<p>` with the title; the lines as one `<ul>` of `<li>` in order, a heading line as `<li data-kind="heading">`. A level line carries a bar: a `<div aria-hidden="true">` track with an inner element whose width is `n/of`, drawn in plain CSS (Tailwind), one neutral colour, with its own dark-mode colour. **The bar is decoration; the printed line says the same thing in words and numbers**, so nothing is carried by colour or length alone (D6). The view prints no `%`.
- **No bar on the asked lists** (D7): each of their rows has two numbers (must-have and nice-to-have); one bar would hide one of them, and a two-colour bar would put meaning in colour.

## 3. Facts (each read in this run)

- **F1. The sprint's other lines.** 8.1 (SPRINT.md:141-142) and 8.3 (SPRINT.md:145-146) are separate steps; Day 9 starts at SPRINT.md:148 (9.1 demo mode, 9.2 limits, 9.3 privacy page, 9.4 usage events). Nothing in 8.2 is needed by Day 9 except that 9.1's demo must show "a full report and roadmap"; the analytics may be added to the demo then, not now.
- **F2. The page is one route.** There is no second page in app/ (app/page.tsx, app/api/cv, app/api/read). The "profile in use" is `savedBuilt ?? built` (app/page.tsx:136 area): `built` is the profile just read from a CV **in memory**, which may never have been saved. A second route cannot see it (D4).
- **F3. Where the box and the report are computed.** app/page.tsx:158-164: `roadmapAdList` is computed once; `roadmapBoxSafe(profile, roadmapAdList, skills)` and `roadmapReportSafe(profile, roadmapAdList, skills)` each call `roadmapInputs` again. The box is drawn at page.tsx:251, the report at page.tsx:253. So `roadmapInputs` already runs **twice** per change; a third call for the analytics would make three (D9).
- **F4. The inputs.** `roadmapInputs(built, ads, skills)` (app/roadmap.ts:99) returns `no-ads`, `no-profile`, `none-counted` or `ready` (`ReadyInputs`, app/roadmap.ts:76): `M`, `counted` (each with `ad = { id, job }`), `notCounted`, `nameOf`, `views`, `engineProfile`, `engineJobs` (with the saved-ad id, after `listedAlternatives`, roadmapJobs.ts:35), `labelOf`, `gaps`.
- **F5. The gap rows.** `gapList(profile, jobs, nameOf)` (gaps.ts:27) counts, per skill, the counted ads with an UNMET must-have (`mustAds`) or nice-to-have (`niceAds`) naming it, each ad once per importance, blocked ads included, an unmet requirement with alternatives counting for each alternative. Rows are sorted: most must-have asks, then most nice-to-have asks, then the lower-case display name, then the id. It never counts a requirement the person already meets.
- **F6. The fit level of an ad.** `fitLevel` (lib/engine/fit.ts:22-45): an unclosable conflict is "longShot"; else gaps = missing musts + conflicts: 3 or more "longShot", 2 "stretch", 1 "good" (a missing must) or "stretch" (a closable conflict), 0 "strong". `profileReport` (app/fitReport.ts:84) returns `level: noLevel === null ? result.level : null` (fitReport.ts:234): `null` when the ad has no requirements, no must-have we could judge, or the profile has no skills (`noLevelReason`, lib/engine/judgeable.ts:30). The saved-ads list ranks on exactly this value (`rankedAdRows`, savedAdRows.ts:62-97). The roadmap's `classifyJobs` (unlock.ts:42) puts an ad in "Already Strong" when it has no conflict and the engine's level is "strong".
- **F7. Which ads count.** `roadmapBasis` (roadmapJobs.ts:19): an ad with no requirements, or with no must-have we could judge, is not counted. An ad that counts can still have **no level** when the profile has no skills (the `no-skills` reason is not an exclusion: roadmapJobs.ts:19-30 returns `excluded: null`). So the level buckets need a fifth, "No level" (A9), or they would not add up to M.
- **F8. The gate.** `ROADMAP_FROM_JOBS = 10` (roadmapJobs.ts:9). The report mounts only when the box shows its roadmap (PLAN-8.1 D2).
- **F9. The saved-ad id (P0).** Every opened reading carries the job id `"pasted-ad"`; `roadmapInputs` gives each counted job its SAVED-AD id (app/roadmap.ts: the `engineJobs` line; PLAN-7.1 Amendment 7). Every new count in 8.2 reads `engineJobs` or `counted[i].ad.id`, never `job.id` of the reading.
- **F10. Test helpers.** `openedAd`, `pastedId`, `savedIdsFor`, `viaPage`, `page` (tests/support/viaPage.ts:15-39) build ads the way the page does and end in `roadmapBox`. `viaPage` returns the BOX; 8.2 needs the inputs, so tests/support/viaPage.ts gets ONE new export (`inputsViaPage`, D10) that runs the same `openedAd` then `roadmapAds` steps and then `roadmapInputs`. The ten ads are built with the real `buildJob` (tests/support/tenAds.ts: `tenJobs()`, `N10`). The invented person and ads 1 to 4 are in tests/support/roadmapFixtures.ts (`person`, `ad`, `must`, `nice`). The number checker is tests/support/reportNumbers.ts (`reportNumbers(lines, labels)`, line 7).
- **F11. The baseline.** step-8.1: 1,681 tests in 97 files, green with the 20 s per-test limit on X5 (chain rehearsal of 2026-11-18).

### Which numbers the engine can already produce, and which need new code

| Number | Already produced by | New code? |
|---|---|---|
| M, the not-counted line | `roadmapInputs` | none |
| "Already Strong" count (for the cross-check) | `classifyJobs` / `alreadyStrongIds` | none |
| the fit level of each counted ad | `profileReport(...).level`, the value the saved-ads list already shows | none |
| how many counted ads have each level | nothing | **new** `tallyLevels` (lib/engine/analytics.ts, counting only) |
| asked counts of skills you do NOT meet | `gapList` rows | none |
| asked counts of ALL skills asked, met or not | nothing | **new** `askedSkills` (lib/engine/analytics.ts) |
| where you stand on a skill (profile, learning with date, no CV line, none) | `GapRow.learning/noCvLine` for missing skills only | **new**, read from `engineProfile.skills` inside `askedSkills` |
| ranking, unlocks, blocked jobs, timeline | existing | none, and not repeated |

## 4. Decisions (reviewer, to confirm), each with its reason

- **D1. No AI, no clock.** *Reason:* every line is a count or an engine sentence; AI-written words wait for the Groq retention terms and the owner's D2 privacy answer (HANDOFF.md:159, DECISIONS.md:52-53).
- **D2. What 8.2 shows: the three new things of section 0 and nothing else.** No ranking, no blocked jobs, no timeline, no job names. *Reason:* the report already holds them; repeating them is "the box shown a third time" (PLAN-8.1 D3), and leaving out job names means no employer name is on this block at all.
- **D3. New counting code goes into a new file, lib/engine/analytics.ts, with two pure functions:** `tallyLevels(levels: (FitLevel | null)[])` returning `{ strong, good, stretch, longShot, none }`, and `askedSkills(profile, jobs, nameOf)` returning one row per skill asked, with `mustAds`, `niceAds` and `standing` (`"have" | "learning:<date>" | "no-cv-line" | "none"`), sorted as the gap rows are. The file imports nothing from app/. *Reason:* CLAUDE.md rule 1 says counts come from lib/engine; the level itself is still produced by `profileReport` (app/), which the function receives as plain values, so lib/engine never imports app/. No existing file of lib/engine changes.
- **D4. A section of the SAME page, not a new route.** *Reason:* browser storage is per address, not per route, so a second route could read the saved ads. But the profile in use can be one that was read and confirmed in memory and never saved (F2); a second route would not see it and would disagree with the box. A route would also need an empty-state page, a way to open the saved profile, and navigation on a one-page app. The sprint's word "page" is met by the block on the page; the deviation goes to DECISIONS (section 14).
- **D5. The same gate as the report** (10 counted ads and a profile in use); below it, nothing is drawn. *Reason:* one gate to explain; the box's own line already says how many ads are missing (`thresholdLine`) or that a profile is needed. Open question Q2.
- **D6. No chart library, no new dependency (rule 7); plain HTML bars only, and only for the fit levels.** *Reason:* five numbers that add up to M are a fair bar chart; a list of skills with two numbers each is clearer as lines than as bars. A sentence is clearer than a chart for the asked lists, so they are lines. Each bar is `aria-hidden` with the number printed in the line beside it; one neutral colour with a dark-mode colour; a track so a zero still shows an empty bar; text wraps (`break-words`) at phone width. Contrast of bar against track is estimated by hand at about 3.7 to 1 in light and about 6 to 1 in dark (zinc-500 on zinc-200; zinc-400 on zinc-800); to be confirmed in the manual check, not asserted here.
- **D7. Bars only on the level lines.** *Reason:* see D6; each asked row has two numbers (must-have, nice-to-have), and a union count (ads asking either way) is a third number the engine does not produce.
- **D8. Nothing leaves the device and nothing is stored or copied.** No `fetch`, no storage, no clipboard, no file, no `useEffect`, no clock, no `@/lib/ai`. *Reason:* the same as D1 and PLAN-8.1 section 10. Proved by a source guard (T19) and by the Network step of the manual check.
- **D9. The page computes `roadmapInputs` ONCE per change and gives it to the box, the report and the analytics.** A first commit alone ("refactor: compute the roadmap inputs once"): new `roadmapBoxFrom(inputs, fromJobs)`, `roadmapReportFrom(inputs, fromJobs)` and a safe wrapper that catches a throw in `roadmapInputs`; the old `roadmapBox`, `roadmapReport`, `roadmapBoxSafe` and `roadmapReportSafe` keep their signatures and become thin wrappers (call `roadmapInputs`, then the `From` function), so **all 1,681 existing tests pass unedited**. This also closes the "twice per change" point of 8.1 (STATE-2026-11-18 section E; PLAN-8.1 section 13, last line). *Reason:* a third call would be the same duplication that allowed P0; the wrappers avoid changing a signature any test uses.
- **D10. Every number test builds ads the way the page does** (P0 lesson): new helper `inputsViaPage(built, jobs, savedIds, jobIdOf)` in tests/support/viaPage.ts (one new export; nothing existing changes), used by every test that builds ads, with one test (T13) proving ids `"pasted-ad"` and distinct ids give the same lines.
- **D11. A level that cannot be worked out fails the whole block** (the line A16), not a silent "No level". *Reason:* the saved-ads list marks such a row with its own error line; counting it as "No level" would hide an error behind a number. "No level" means only what the list already says: the engine had nothing to judge.
- **D12. The lists show at most 10 rows, but never split a tie:** show the first 10 rows, plus any following rows whose (must-have, nice-to-have) counts equal the tenth row's; then A13 says how many more skills there are. *Reason:* an arbitrary cut among equal counts would depend on alphabetical order and look like a ranking. The number 10 is a constant (`ANALYTICS_TOP`), a parameter in tests. The your-skills list is cut from its OWN full list, so a skill of yours ranked 15th overall still appears there.
- **D13. No copy button.** *Reason:* nothing in the sprint asks for it; it would add a clipboard surface and its tests (T24 of 8.1). A later step can add it.
- **D14. Statuses.** `have` (a skill with a CV line) shows ` (on your profile)`; `inProgress` shows the box's `learningNote(date)`; a skill on the profile with no CV line shows the box's `NO_CV_LINE_NOTE`; any other shows ` (not on your profile)`. The your-skills list holds only `have` rows (those the engine counts as met). *Reason:* these are the engine's own distinctions (`ProfileSkill`, types.ts:95-99); the notes reuse the box's words.

## 5. Edge cases

| Edge | What 8.2 does | Case / test |
|---|---|---|
| no profile in use | no block, no button | T6 |
| no saved ads | no block, no button | T6 |
| 9 counted ads at the real gate | no block; exactly 10: the block | T6, T3 |
| zero counted ads (all excluded) | no block | T6 |
| some saved ads not counted | A5 after the basis line; levels and asked counts are over the counted ads only; M in every line is the counted number | T1 variant in T10 |
| a profile with no skills | every counted ad has "no level"; the line `No level: 3 of your 3 saved ads`; the asked list still works; the your-skills list says none | R6 / T4 |
| every counted ad Strong | `Strong: M of your M saved ads`, other lines 0, no "No level" line | R3d / T3 |
| a Long shot caused by an unclosable conflict | counted under Long shot (a blocked ad has a level) | R2 / T2 |
| a blocked ad's skills | still counted in the asked lists (as in the gap list) | R2 / T2 |
| the same skill named twice in one ad | counted once per ad and importance | R9 / T5 |
| a requirement with alternatives | counted once for each skill it names, met or not; A12 shown when any counted requirement has more than one skill id | R6, R9 / T4, T5 |
| a skill you have that no ad asks | not listed (a row exists only for an asked skill) | R3 / T3 |
| nothing of yours is asked | A15, a one-line "none" | R3, R6 / T3, T4 |
| more than 10 asked skills | the first 10 and any ties, then A13 | R1 with a limit of 2, 3, 4 and R6 with 1 / T7 |
| a skill in progress with a past date | the date is shown as stored (no clock) | as R3b of 8.1, shown by T3 variant |
| ads sharing the id `pasted-ad` | every test builds ads that way; counts read the saved-ad ids | T13 |
| numbers change while the block is open (a date edited) | the block redraws; it has no state beyond open/closed | manual step 6 |
| the block disappears and returns | it returns closed (the page unmounts it) | manual step 9 |
| a throw while working out the block | `{ kind: "failed" }` and A16; no error page | T9 |
| a skill name with `<`, `&` or a very long word | React escapes it; the line wraps | T17 |

## 6. Files

| File | Change |
|---|---|
| `app/roadmap.ts` | commit 1 alone (D9): add `roadmapBoxFrom(inputs, fromJobs)` and a safe inputs wrapper; `roadmapBox` and `roadmapBoxSafe` call them; no text and no field changes |
| `app/roadmapReport.ts` | commit 1 alone: add `roadmapReportFrom(inputs, fromJobs)`; `roadmapReport` and `roadmapReportSafe` call it; no text changes |
| `lib/engine/analytics.ts` (new) | `tallyLevels`, `askedSkills` (D3); imports only `lib/engine` types; no `app/`, no clock |
| `app/analytics.ts` (new) | `analyticsFrom(inputs, built, skills, top)` -> `Analytics \| null`; `analyticsSafe`; gets each counted ad's level from `profileReport(ad.job, built, skills, []).level` (the unlisted names are not needed for a level) and calls the two engine functions; writes lines only with the messages constants |
| `app/AnalyticsView.tsx` (new, client) | the shell (open/closed only) and the pure open component; draws the bars |
| `app/page.tsx` | one `useMemo` for the inputs; the box, the report and the analytics are made from it; the view mounted only while the report exists |
| `lib/saved/messages.ts` | the new constants and functions (section 2) |
| `tests/support/viaPage.ts` | one new export, `inputsViaPage` (D10) |
| `tests/analytics.test.ts`, `tests/analyticsEngine.test.ts`, `tests/analyticsView.test.ts` (new); `tests/roadmapGuards.test.ts` (a new `describe` appended) | section 8 |
| `lib/engine/*` (existing files), `lib/ai/*`, `app/api/*`, `app/RoadmapView.tsx`, `app/RoadmapReportView.tsx`, `app/fitReport.ts`, `app/savedAdRows.ts` | **NOT changed** |
| `docs/MANUAL-CHECK-8.2.md` (later) | section 10 |

## 7. Hand-worked cases (written BEFORE any code)

Ads and person are those of PLAN-8.1 section 6 (the invented person of tests/support/roadmapFixtures.ts and its ads 1 to 4; the ten ads of docs/MANUAL-CHECK-TEN-ADS.md), so every number can be checked against the box and the report. All ads reach the code through `inputsViaPage`: job id `pasted-ad`, distinct saved ids. Title and lines are written as one text; in the tests the title is `analytics.title` and the rest `analytics.lines`. A "numbers list" is what `reportNumbers` must return: left to right, after removing skill names, ISO dates and list markers (job names do not appear here). **Counting rules used by hand:** each ad counts once per skill and importance, whether or not the skill is met; a requirement with alternatives counts for each alternative; blocked ads count. **Level rules used by hand** (fit.ts:22-45): no conflict and no missing must = Strong; one missing must = Good; an unclosable conflict = Long shot; no skills on the profile = no level.

The person: SQL (CV line 2) and Excel (line 4) had, Tableau in progress 2027-03-01, city Berlin. The ads (all Berlin, hybrid): a1 Reporting Analyst (must SQL, Tableau; nice Excel); a2 BI Developer (must SQL, Python; nice Tableau); a3 Data Clerk (must Excel; nice Python, Power BI); a4 Analytics Lead (must SQL, Python and one must not in our list, set aside; nice Tableau).

### R1: the four-ad example (gate set to 4)

Levels. a1: SQL met, Tableau in progress (not met): one missing must, no conflict: **Good**. a2: Python missing: **Good**. a3: Excel met, nothing missing: **Strong**. a4: SQL met, Python missing; the set-aside must is not judged and the ad still has judged musts, so it keeps a level: **Good**. Tally: Strong 1, Good 3, Stretch 0, Long shot 0, no level 0 (sum 4 = M). Cross-check: Already Strong in the box and the report is 1 (Data Clerk) = Strong 1.
Asked (all counted ads, each ad once per skill and importance): SQL must a1, a2, a4 = 3, nice 0. Python must a2, a4 = 2, nice a3 = 1. Tableau must a1 = 1, nice a2, a4 = 2. Excel must a3 = 1, nice a1 = 1. Power BI must 0, nice a3 = 1. Order (must, then nice, then name): SQL (3,0), Python (2,1), Tableau (1,2), Excel (1,1), Power BI (0,1). Standing: SQL have; Python none; Tableau learning 2027-03-01; Excel have; Power BI none. Your-skills list (have only): SQL, Excel. No requirement accepts several skills: no A12.
Cross-check with the report of 8.1 (R1): Python "must-have in 2 ..., nice-to-have in 1" and Tableau "must-have in 1 ..., nice-to-have in 2": the same numbers as the asked rows.

```
Your analytics
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Fit levels across your saved ads
(These are the levels shown on your saved ads, counted against the profile in use.)
Strong: 1 of your 4 saved ads
Good: 3 of your 4 saved ads
Stretch: 0 of your 4 saved ads
Long shot: 0 of your 4 saved ads
Skills asked across your 4 saved ads
SQL (on your profile): must-have in 3 ads
Python (not on your profile): must-have in 2 ads, nice-to-have in 1 ad
Tableau (you are learning it, expected 2027-03-01): must-have in 1 ad, nice-to-have in 2 ads
Excel (on your profile): must-have in 1 ad, nice-to-have in 1 ad
Power BI (not on your profile): nice-to-have in 1 ad
Skills of yours asked across your 4 saved ads
SQL (on your profile): must-have in 3 ads
Excel (on your profile): must-have in 1 ad, nice-to-have in 1 ad
```
Bars: Strong 1 of 4, Good 3 of 4, Stretch 0 of 4, Long shot 0 of 4 (width one quarter, three quarters, none, none). Numbers list (22): `[4,1,4,3,4,0,4,0,4,4,3,2,1,1,2,1,1,1,4,3,1,1]` (basis 4; the four level lines; the asked heading 4; SQL 3; Python 2,1; Tableau 1,2; Excel 1,1; Power BI 1; the yours heading 4; SQL 3; Excel 1,1).

### R2: R1 with ad 2 in Exampleville (a blocked ad)

The city conflict can't be closed soon: a2 is **Long shot** (fit.ts:26-32). Levels: a1 Good, a2 Long shot, a3 Strong, a4 Good: Strong 1, Good 2, Stretch 0, Long shot 1. Asked: unchanged from R1 (the ad still asks for SQL, Python, Tableau; blocked ads count). Cross-check: Already Strong 1 = Strong 1. The level lines become `Strong: 1 of your 4 saved ads`, `Good: 2 of your 4 saved ads`, `Stretch: 0 of your 4 saved ads`, `Long shot: 1 of your 4 saved ads`; every other line as R1. Numbers list (22): `[4,1,4,2,4,0,4,1,4,4,3,2,1,1,2,1,1,1,4,3,1,1]`.

### R3: the ten SQL-only ads, SQL in progress 2027-06-01 (the manual-check profile of 7.3 step 3; real gate 10)

The person has Tableau and Excel, not SQL; SQL in progress 2027-06-01. Every ad's one must-have is SQL, missing: one missing must, no conflict: **Good** in all ten. Tally Good 10, others 0. Asked: SQL must 10, nice 0, standing learning 2027-06-01. Tableau and Excel are on the profile and asked by no ad: no rows. Your-skills list: none. Cross-check: Already Strong 0 = Strong 0; the report's line "Asked as a must-have in 10 of your 10 saved ads" = SQL must 10.
```
Your analytics
Based on 10 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Fit levels across your saved ads
(These are the levels shown on your saved ads, counted against the profile in use.)
Strong: 0 of your 10 saved ads
Good: 10 of your 10 saved ads
Stretch: 0 of your 10 saved ads
Long shot: 0 of your 10 saved ads
Skills asked across your 10 saved ads
SQL (you are learning it, expected 2027-06-01): must-have in 10 ads
Skills of yours asked across your 10 saved ads: none.
```
Numbers list (12): `[10,0,10,10,10,0,10,0,10,10,10,10]` (basis 10; Strong 0,10; Good 10,10; Stretch 0,10; Long shot 0,10; asked heading 10; SQL 10; yours line 10).

### R3d: R3 with SQL, Tableau and Excel all had (the profile of 7.3 step 1)

All ten ads: no missing must: **Strong** 10, others 0. Asked: SQL must 10 (standing have). Tableau, Excel: asked by none. Your-skills list: SQL. Cross-check: the box says `Already Strong: 10 jobs (...)` = Strong 10.
```
Your analytics
Based on 10 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Fit levels across your saved ads
(These are the levels shown on your saved ads, counted against the profile in use.)
Strong: 10 of your 10 saved ads
Good: 0 of your 10 saved ads
Stretch: 0 of your 10 saved ads
Long shot: 0 of your 10 saved ads
Skills asked across your 10 saved ads
SQL (on your profile): must-have in 10 ads
Skills of yours asked across your 10 saved ads
SQL (on your profile): must-have in 10 ads
```
Numbers list (13): `[10,10,10,0,10,0,10,0,10,10,10,10,10]`.

### R6: no skills on the profile; a tie; alternatives (gate 3)

The person has no skills, nothing in progress, Berlin. Three ads (Berlin, hybrid): p1 one must that accepts SQL or Python; p2 must Python; p3 must SQL (the ads of PLAN-8.1 R6). With no skills on the profile every counted ad has **no level** (judgeable.ts:38), though each is counted. Tally: no level 3, the four levels 0 (sum 3 = M). Asked: Python must p1, p2 = 2; SQL must p1, p3 = 2 (p1's alternatives count for each); both (2,0); tie broken by name: Python, then SQL. Standing: none for both. A requirement accepts several skills: A12 shown. Your-skills: none. Cross-check with the report of 8.1 (R6): "Asked as a must-have in 2 of your 3 saved ads" for Python and for SQL = these rows.
```
Your analytics
Based on 3 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Fit levels across your saved ads
(These are the levels shown on your saved ads, counted against the profile in use.)
Strong: 0 of your 3 saved ads
Good: 0 of your 3 saved ads
Stretch: 0 of your 3 saved ads
Long shot: 0 of your 3 saved ads
No level: 3 of your 3 saved ads
Skills asked across your 3 saved ads
Python (not on your profile): must-have in 2 ads
SQL (not on your profile): must-have in 2 ads
A requirement that accepts several skills is counted once for each of them.
Skills of yours asked across your 3 saved ads: none.
```
Numbers list (15): `[3,0,3,0,3,0,3,0,3,3,3,3,2,2,3]` (basis 3; four level lines 0,3; No level 3,3; asked heading 3; Python 2; SQL 2; yours line 3).

### R9: one name twice in one ad (gate 1)

The person has no skills. One ad "Solo Analyst, Invented Co Six" (Berlin, hybrid) with three requirements: must SQL-or-Python, must Python, nice Python. Counted (it has judgeable musts); level: no skills, so **no level** 1. Asked: Python: must in this ad once (it is named by two must-haves, the ad counts once) = 1; nice 1. SQL: must 1 (from the alternatives), nice 0. Order: Python (1,1), SQL (1,0). A12 shown. Your-skills: none.
```
Your analytics
Based on 1 saved ad we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Fit levels across your saved ads
(These are the levels shown on your saved ads, counted against the profile in use.)
Strong: 0 of your 1 saved ad
Good: 0 of your 1 saved ad
Stretch: 0 of your 1 saved ad
Long shot: 0 of your 1 saved ad
No level: 1 of your 1 saved ad
Skills asked across your 1 saved ad
Python (not on your profile): must-have in 1 ad, nice-to-have in 1 ad
SQL (not on your profile): must-have in 1 ad
A requirement that accepts several skills is counted once for each of them.
Skills of yours asked across your 1 saved ad: none.
```
Numbers list (16): `[1,0,1,0,1,0,1,0,1,1,1,1,1,1,1,1]` (basis 1; four level lines 0,1; No level 1,1; asked heading 1; Python 1,1; SQL 1; yours line 1).

### The cut cases (D12), from R1 and R6

R1's asked order is SQL (3,0), Python (2,1), Tableau (1,2), Excel (1,1), Power BI (0,1).
- limit 2: rows SQL, Python (the third, Tableau (1,2), differs from Python (2,1)); then `3 more skills are asked in your saved ads and are not shown.`
- limit 3: SQL, Python, Tableau; then `2 more skills are asked in your saved ads and are not shown.`
- limit 4: SQL, Python, Tableau, Excel; then `1 more skill is asked in your saved ads and is not shown.`
- limit 5 (and the real 10): all five rows, no more-line.
- R6 with limit 1: Python is the first row; SQL has the same counts (2,0), so it is shown too (the tie rule); two rows, no more-line.
- R1's your-skills list with limit 1: SQL; Excel (1,1) differs from SQL (3,0): `1 more skill is asked in your saved ads and is not shown.` (the more-line also exists under the your-skills list, with its own count of that list).

## 8. Tests, tests first

Expected texts and number lists are literal strings from section 7, never imported from code. Every test that builds ads uses `inputsViaPage` (id `pasted-ad`, distinct saved ids, through `roadmapAds`) unless marked ENGINE or SOURCE.

| # | Test | File | Form |
|---|---|---|---|
| T1 | R1: the title, every line, each line's kind and bar (`{n:1,of:4}` on Strong, `{n:3,of:4}` on Good, 0 on the other two) | tests/analytics.test.ts | page's way |
| T2 | R2: Long shot 1 from an unclosable city conflict; asked rows unchanged | same | page's way |
| T3 | T3a R3 (real `buildJob`, real gate 10); T3b R3d (all three skills had: Strong 10, SQL "on your profile") | same | page's way, real builder |
| T4 | R6: no level 3; tie order Python before SQL; A12 shown; your-skills none | same | page's way |
| T5 | R9: Python named twice as must and once as nice in one ad counts must 1, nice 1; SQL must 1 | same | page's way |
| T6 | `null` for: no profile; no saved ads; 9 counted ads at the real gate; zero counted ads; and NOT null with exactly 10 (the boundary) | same | page's way |
| T7 | the cut cases of section 7 (limits 2, 3, 4, 5 on R1; limit 1 on R6; limit 1 on R1's your-skills list) | same | page's way, `top` as parameter |
| T8 | the number checker on the hand lists: `reportNumbers` of R1, R2, R3, R3d, R6, R9 (literal lines) equals the hand numbers lists | same | helper only |
| T9 | `analyticsSafe`: after a throw (a record the level cannot be worked out for): `{ kind: "failed", line: "The analytics could not be worked out." }`; healthy: `{ kind: "ready" }`; none: `{ kind: "none" }` | same | the S1 form of tests/roadmap.test.ts |
| T10 | overlap with the BOX: for R1, R2, R3, R3d, R6, R9: `M` of the analytics basis line = the box's `counted`; the Strong bucket = `alreadyStrongIds.length` of the box (1, 1, 0, 10, 0, 0); the five buckets sum to M | same | page's way, both sides |
| T11 | overlap with the REPORT and the gap list: for every ranked skill of the report of R1, R2, R3, R6 the numbers of its "Asked as ..." line equal the must and nice numbers of its asked row (R1 Python 2/1, Tableau 1/2; R3 SQL 10/0; R6 Python 2/0, SQL 2/0); and for every gap row of the box's gap list the asked row has the same two numbers (R1, R2, R3, R6) | same | page's way, both sides |
| T12 | overlap with the SAVED-ADS LIST: the tally equals the counts of `rankedAdRows` levels (the list's own ranks 0 to 3 and 4) for the same ads, for R1, R2, R3, R6 | same | page's way, list side |
| T13 | P0: R1 built with every job id "pasted-ad" and with distinct job ids gives the same lines, equal to T1's | same | page's way vs distinct |
| T14 | property over 8 combinations (4 invented people x the ads of R1 and R2): the analytics numbers equal an independent naive count written in the test (a plain loop over each counted job's requirements, and `profileReport` levels), and every asked row is at least the gap row for the same skill; labelled a property, its expectation is not hand-worked | same | ENGINE (direct calls) |
| T15 | `tallyLevels` and `askedSkills` on literal inputs: sums, sort order (must, nice, name, id), alternatives counted for each, one ad once per skill and importance, `standing` of each kind (have, learning with date, no CV line, none) | tests/analyticsEngine.test.ts | ENGINE |
| T16 | the constants and functions are exactly the texts of section 2: A1 to A3, A6 to A10, A13 to A16 (both grammars; `1 of your 1 saved ad`; one more skill / more skills), and the two new notes | tests/analytics.test.ts | pure |
| T17 | the closed shell draws one button with `Show my analytics` and nothing else; the open body draws the lines as list items in order; a level line carries `data-bar="1/4"`-style attributes and an `aria-hidden` bar; asked lines carry no bar; `<`, `&` and `'` in a skill name come out as the same text; nothing for `{ kind: "none" }`; A16 for `{ kind: "failed" }` | tests/analyticsView.test.ts (react-dom/server) | markup only |
| T18 | the bar matches its line: for every level line the bar's `n` and `of` equal the two numbers printed in the line; the drawn width is `n/of`; no printed text contains `%` | same | markup only |
| T19 | guard (SOURCE): app/analytics.ts, app/AnalyticsView.tsx and lib/engine/analytics.ts contain no `fetch(`, `localStorage`, `sessionStorage`, `indexedDB`, `saveJob`, `deleteJob`, `useEffect`, `clipboard`, `Blob`, `createObjectURL`, no `@/lib/ai` import, no `Date.now` / `new Date`; lib/engine/analytics.ts imports nothing from `app/` | tests/roadmapGuards.test.ts (new `describe`) | source |
| T20 | guard (SOURCE): no sentence literal of four or more words in the two new app files; the view maps lines with an index key; no `<form`; the view has exactly one `onClick` | same | source |
| T21 | guard (SOURCE): app/RoadmapView.tsx still has no `onClick`; the existing report-view tests pass unedited | same | source |
| T22 | guard (SOURCE) for D9: app/page.tsx makes ONE call that works out the inputs, and no longer calls `roadmapBoxSafe` or `roadmapReportSafe`; plus T23 | same | source |
| T23 | wrapper equivalence (commit 1): `roadmapBoxFrom(inputs, g)` equals `roadmapBox(...)` and `roadmapReportFrom` equals `roadmapReport(...)` for R1, R2, R3, R6; and all 1,681 existing tests pass unedited (the count is reported) | tests/analytics.test.ts and all existing | page's way |

## 9. Deliberate breaks, to run at stage 4 (each must fail the NAMED test)

| # | Break | Must fail |
|---|---|---|
| B1 | count an ad twice for a skill named by two of its requirements (drop the per-ad set) | T5 (R9), T15 |
| B2 | skip blocked ads in the asked counts | T2 (R2), T11 |
| B3 | count only UNMET requirements in the asked lists (the gap list's rule) | T1 (R1: SQL and Excel rows missing, your-skills empty), T15 |
| B4 | take the level straight from `match().level` and ignore the "no level" cases | T4 (R6), T12 |
| B5 | cut exactly at the limit, splitting a tie | T7 (R6, limit 1) |
| B6 | sort nice-to-have asks before must-have asks | T1, T15 |
| B7 | read `job.id` (the reading's `pasted-ad`) instead of the saved-ad id when counting levels or asks | T13 (P0), T1 |
| B8 | swap the notes of a skill you have and a skill you are learning | T1 (Tableau row), T3 |
| B9 | add a `new Date()` or a `fetch(` to the new files | T19 |
| B10 | draw a level bar as `n/(M-n)` | T18 |
| B11 | change the gate `>=` to `>` | T6 (boundary) |
| B12 | let the page call `roadmapBoxSafe` and `roadmapReportSafe` again beside the shared inputs | T22 |
| B13 | put a sentence of four words in the view | T20 |
| B14 | count the Good bucket into Strong | T10, T1 |
| B15 | drop the your-skills filter (show "not on your profile" rows too) | T1, T3 (R3d) |

## 10. Manual-check outline (for docs/MANUAL-CHECK-8.2.md; every step NOT RUN YET)

Needs **no extra AI reads** when run in the sitting of 7.3 and 8.1 (same profile, same ten saved ads: 11 reads in all); on its own, 11 reads on a new preview address. Invented data only. It is a third part of the one-sitting order, after 8.1 step 5 and before the single deletion.
1. Look under the report. **Expect:** next to the report's button, one more button `Show my analytics`, no analytics text yet.
2. With SQL in progress at 2027-06-01 (the profile of 8.1 step 3), press it. **Expect:** the lines of R3, exactly (no job names anywhere), with the bar of `Good` full-length and the other three empty.
3. **Compare:** the first sentence with the first sentence of the report: the same words. `Good: 10 of your 10 saved ads` with the ten rows of the "Saved ads" list, each `Fit: Good ...`.
4. With the block open, change the date to 2027-03-01 on the confirm screen. **Expect:** the SQL line reads `(you are learning it, expected 2027-03-01)`; nothing else changes.
5. Tick SQL again and remove SQL in progress (the profile of 7.3 step 1). **Expect:** the lines of R3d: `Strong: 10 of your 10 saved ads`, `SQL (on your profile): must-have in 10 ads` in both lists; and the box says `Already Strong: 10 jobs`.
6. Press `Hide the analytics`. **Expect:** the lines vanish; the button reads `Show my analytics`.
7. Make the browser window phone-narrow (about 375 px wide) and, separately, switch the computer to dark appearance. **Expect:** lines wrap, no sideways scrolling, the bars are visible against their track in both.
8. After the single deletion of the sitting (nine ads left). **Expect:** both buttons and the analytics are gone.
9. Network (filter `api`, cleared before step 1, Preserve log ticked). **Expect:** no `/api/` request for any step.
10. Console. **Expect:** no red errors of ours.
Log table: ten rows, NOT RUN YET. The order of the one sitting is extended in `docs/MANUAL-CHECK-8.1.md` or in a new order file at merge time (the owner decides).

## 11. Privacy and safety

- **Where the numbers go: nowhere.** They are drawn on the page from what the box and the report already read. No network call, no storage, no new route, no file, no clipboard, no log (D8). Proved by T19 and by the Network step.
- **What could leak.** Skill names and learning dates from the profile (the same as the box) and counts. No employer name, no job title, no ad text appears in the block (D2).
- **If AI-written words are added later** (a step after the Groq terms are recorded), skills and dates would go to Groq: out of this plan.
- **Invented data only** in tests and manual checks (rules 5 and 8): the ads of R1 to R9 and docs/MANUAL-CHECK-TEN-ADS.md; the access code is never typed anywhere but the app's code box.

## 12. Open questions for the reviewer, each with a recommendation

1. **Q1. Is the fit-level spread alone enough?** The smallest possible 8.2 would be the level lines only (section 0 item 1). *Recommend* the full version of this plan: items 2 and 3 are the only way to see skills you already have, which the sprint names.
2. **Q2. The gate.** Same as the report (10 counted ads), or show the level lines from the first ad? *Recommend* the same gate: one rule, and "most-asked" from three ads says little. Level counts alone could show earlier; that would split the block in two gates, which is more to test and explain.
3. **Q3. Lists as sentences or as real table columns?** *Recommend* sentences (the box's words reused, so the numbers cannot differ from the box by construction). The sprint's "table view" is met by the lines under each bar; real columns would need new wording and a new overlap test.
4. **Q4. Where the level comes from.** `profileReport(...).level` (the saved-ads list's own value, D3 / F6) or the roadmap's engine jobs? *Recommend* `profileReport`, so the tally equals the list by construction (T12) and equals the box's Strong count (T10). **Open risk, to settle at stage 2:** the box drops an unlisted alternative from a requirement before counting (`listedAlternatives`, roadmapJobs.ts:35) while the saved-ad level does not; for an ad with one listed and one unlisted alternative the box's "Already Strong" could differ from the list's "Strong". A stage-2 probe (section 15) must show whether any case differs; if one does, STOP and report; do not change an expectation.
5. **Q5. The top-10 cut and its tie rule** (D12). *Recommend* yes; 10 is a constant.
6. **Q6. Grammar of the your-skills heading** (settled in v1). The heading was reworded to `Skills of yours asked across your 4 saved ads`, the same noun phrase as A10, so it needs no verb agreement for one ad. *Recommend* keep.
7. **Q7. A count of your skills that no ad asks** ("2 skills on your profile are asked in none of your saved ads"). *Recommend* not now: it is a new number and a new sentence; leave to a later step.
8. **Q8. Copy button.** *Recommend* no (D13).
9. **Q9. Cost.** The block calls `profileReport` once per counted ad per change, as the saved-ads list already does. *Recommend* accept (by reasoning, not measured); if a later step wants it, the list's levels can be shared.

## 13. Two paragraphs

**(a) What 8.2 depends on, and what happens if the manual checks find a defect.** By content 8.2 needs: from **7.1** the inputs, the gap list, the P0 saved-id fix, the gate and the not-counted line (all through `roadmapInputs`); from **6.2** the level of each ad (`profileReport`, `rankedAdRows`) and the saved-ads list that T12 compares with; from **8.1** `roadmapInputs`/`ReadyInputs` as extracted, the button-and-view pattern, `reportBasisLine`, the number checker and the T14 guard form; from **7.3** nothing except being in the same chain (no timeline is used). By construction the branch is cut from step-8.1, so it carries all of them. If a manual check finds a defect: **in 7.1** (a wrong gap or ranking number) the 8.2 tests cannot see it, because they take their numbers from the same inputs; 8.2 must not merge until it is fixed on the chain, and the hand cases of section 7 are the independent check; **in 6.2** (a wrong level) the tally inherits it and T12 would not catch it for the same reason; the fix goes to step-6.2 and 8.2 follows; **in 8.1** (the page wiring, the extraction of `roadmapInputs`) the refactor commit of D9 sits on exactly that code, so 8.2 is rebased after the fix; **in 7.3** nothing changes for 8.2. Order of merges stays 7.1, then 7.3, then 8.1, then 8.2, each after its own manual check; stage 1 (tests red) can be written meanwhile, but no code of stage 3 starts before 8.1's sitting has passed.

**(b) Careful lane or fast lane?** **Careful lane.** 8.2 adds new counting code in lib/engine (D3), changes shared page code that P0 showed to be fragile (D9), and puts a count of "Strong / Good / Stretch / Long shot" in front of a person, which is wording about their chances; CLAUDE.md puts all three in the careful lane. The sentences of the page that are wording about a person's chances, each named so that none is changed without the owner: **A7** (`These are the levels shown on your saved ads, counted against the profile in use.`: it says the levels are the list's own); **A8** (the four level lines, `Strong: n of your M saved ads`, `Good: ...`, `Stretch: ...`, `Long shot: ...`, whose level names are the engine's `levelName`, never retyped); **A9** (`No level: n of your M saved ads`: it says the engine had nothing to judge, not that the person has no chance); **A6** (the heading `Fit levels across your saved ads`); **A14/A15** (the your-skills heading and its none line, which must not say a skill is "worth", "best" or "will help you get" anything: it says only that ads ask for it); **A4** (reused: `none is a prediction`). The asked rows (A11) say only how many ads ask for a skill and the profile's own state; they say nothing about chances. Neither the box's nor the report's sentences ("Already Strong", "can become a Strong match by skills alone", "Blocked jobs") nor the saved-ads list's `Long shot because of ...` reasons change. A step that mixes lanes is careful lane (CLAUDE.md), so the refactor of D9, though mechanical, goes through the same plan, tests and breaks.

## 14. For DECISIONS at merge time

(Not written to docs/DECISIONS.md; lines to add when the step merges, each with its reason.)

- 2026-11-18: Step 8.2: the analytics are a block of the same page, behind a button under the roadmap report, not a separate route. Reason: the profile in use can be one read in memory and never saved, which a second route cannot see; the sprint's word "page" is met by the block.
- 2026-11-18: The block shows three things the page did not show: the count of saved ads per fit level, the asked counts of all skills (met or not) with where the person stands on each, and the person's own skills that ads ask for; it repeats no ranking, blocked job, timeline or job name. Reason: the rest of the sprint line is already shown (the gap list, the report); no employer name appears.
- 2026-11-18: New counting code lives in lib/engine/analytics.ts (`tallyLevels`, `askedSkills`) and takes the level as a plain value from `profileReport`, the same value the saved-ads list shows. Reason: counts come from lib/engine (rule 1); the tally equals the list by construction and is cross-checked with the box's Already Strong count.
- 2026-11-18: Bars are drawn only for the fit levels, in plain HTML with no new dependency; the asked lists are lines. Each bar is decoration and the printed line carries the same numbers. Reason: five counts that add up to M make an honest bar; a skill row has two numbers, and meaning must not sit in length or colour alone.
- 2026-11-18: The lists show the first 10 skills and every later skill that ties the tenth; a line says how many more exist. Reason: a cut inside a tie would look like a ranking decided by the alphabet.
- 2026-11-18: The page computes the roadmap inputs once per change and gives them to the box, the report and the analytics; the older functions stay as wrappers. Reason: a third call would repeat the duplication behind P0; this also settles the "twice per change" point of 8.1.
- 2026-11-18: A level that cannot be worked out fails the whole analytics block with its own line; it is not counted as "No level". Reason: counting it would hide an error behind a number.
- (If answered as recommended) 2026-11-18: The analytics show under the same gate as the report (10 counted ads and a profile in use). Reason: one rule to explain.

## 15. Engine confirmation of the counts (stage 2, to be done before any code)

A temporary script (deleted afterwards; no AI call; no code of 8.2 exists) will run the engine's own `roadmapInputs`, `profileReport` and `gapList` on R1, R2, R3, R3d, R6 and R9 with saved-ad ids and report: the level of each ad, the tally, the asked counts by a plain loop, and whether the box's Already Strong count equals the Strong bucket. It must also probe the open risk of Q4: an ad with one listed and one unlisted alternative in one must-have, with and without `listedAlternatives`. It must also confirm that the list's no-level label starts with the words `No level` (fitLabelText, used at app/fitReport.ts:233), since A9 reuses those words without retyping the reason. Every disagreement with the hand work is reported; **no expectation is changed to fit the engine** (CLAUDE.md careful lane).

## 16. For HANDOFF at merge time

(A later list; not written to docs/HANDOFF.md.)
1. What the page shows after 8.2: under the report, `Show my analytics` opens the level counts, the asked skills and the person's own skills that ads ask for; counts only, no job names.
2. The inputs are computed once per change (the 8.1 "twice per change" tidy is closed).
3. The wording-about-chances sentences are A6 to A9, A14 and A15 (section 13 (b)); change none without the owner.
4. Ideas, not planned: a count of the person's skills that no saved ad asks for (Q7); a copy button for the analytics; sharing the saved-ads list's levels instead of recomputing (Q9); an AI-written reading of the analytics only after the Groq retention terms are recorded and the owner agrees to the D2 privacy answer.
