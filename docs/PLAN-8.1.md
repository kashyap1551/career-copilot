STATUS: DRAFT v2 for the reviewer, 2026-11-17. The reviewer's decisions D1 to D8 are applied (section 2). Careful lane (section 12, paragraph (b)). Nothing of 8.1 is built; stage 2 writes the red tests and stubs only. Branch `step-8.1`, cut from `step-7.3` (e8b8748). All data below is invented. The expected texts and number lists of section 6 were worked out by hand first; the engine was asked only to confirm counts (end of section 6).

# Plan for step 8.1: the roadmap report on request

## 0. Status and scope

**What step 8.1 is, according to the sprint** (docs/SPRINT.md:141): "**8.1** Roadmap report on request: skills in order, why each, the roles each unlocks; the AI writes only the words around numbers the code computed." Its check (docs/SPRINT.md:142): "a check confirms every number matches the engine."

**What it needs from what already exists.**
- The ranking, with the roles each skill unlocks: `rankMissingSkills` (lib/engine/unlock.ts:110-163) and its sentence `explainRankedSkill` (lib/engine/explain.ts:189-208), already drawn in the box (app/roadmap.ts:133-147).
- The "asked in" numbers: the gap list (`gapList`, lib/engine/gaps.ts:27-77, `GapRow.mustAds` and `niceAds`, gaps.ts:13-14).
- The blocked jobs and the timeline: `classifyJobs` (unlock.ts:42-63), `unlockTimeline` (unlock.ts:222-250), drawn since 7.3 (app/roadmap.ts:148-163).
- The ads the way the page hands them over: `roadmapAds(openedReadings(...))` (app/roadmap.ts:177-185, app/page.tsx:157), with the saved-ad id on each job (P0, app/roadmap.ts:99).

**What it does NOT do.**
- It does not change any rule: fit levels, counts, unlocks and the order of skills stay in lib/engine (rule 1 of CLAUDE.md). `lib/engine/*` is not touched.
- It does not predict anything: no chance, no percentage (rule 6).
- It does not write a CV bullet (8.3), draw a chart (8.2), save anything, send anything, or make a file: no download, no print styles.
- It does not show below the roadmap's own threshold (10 counted ads, `ROADMAP_FROM_JOBS`, lib/engine/roadmapJobs.ts:9).

**Is an AI call needed? No** (D1). The sprint's AI half ("the AI writes only the words around numbers the code computed") is a later step, **8.1b**, decided after Groq's training terms are read (docs/HANDOFF.md:159).

## 1. What the screen shows

A new block under the "What to learn" box (app/page.tsx:246), mounted by the page **only while a report exists** (roadmap shown: 10 counted ads and a profile in use). It starts closed each time it is mounted.

1. Closed: one button `Make my roadmap report`.
2. Open: the button reads `Hide the roadmap report`; under it the report: a title, then lines (a "sub" line is drawn indented under the line above it), then a button `Copy report as text`, then (only after a click) the status line.

The four-ad example of PLAN-7.1 section 1, threshold set to 4 (hand case R1 of section 6; `*` marks a sub line):

```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 1 job (Data Clerk, Example Wharf Ltd)
Skills to build, in order:
1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.
*  Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.
2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.
*  Asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2.
A skill can be asked in more ads than it unlocks: an ad may need more than one skill, may already be unlocked by a skill higher up this list, or may be held back by something other than skills.
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
| S3 | the title | `Your roadmap report` | new constant `REPORT_TITLE` |
| S4 | first line | `Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.` (`1 saved ad` for one) | new function `reportBasisLine(M)` |
| S5 | right after S4, only when not null | the box's own not-counted line, e.g. `1 saved ad is not counted: the AI found no requirements in it.` | `notCountedLine` (messages.ts:107-117), not retyped |
| S6 | Already Strong | the box's own line | `alreadyStrongLine` (messages.ts:122-125), not retyped |
| S7 | ranking header, or the "none" line | `Skills to build, in order:` / `Skills to build, in order: none. No other saved job can become a Strong match by skills alone.` | `RANKING_HEADER`, `rankingNoneLine` (messages.ts:126-128), not retyped |
| S8 | one line per ranked skill | `1. Python: unlocks 2 jobs (...). Total so far: 2 jobs.` or `1. Docker: together with Python, unlocks ... .` | `explainRankedSkill` (explain.ts:189) with `jobsBroughtCloser` (unlock.ts:184-205), the engine's own; never retyped |
| S9 | a sub line under each ranked skill | `Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.` / `Asked as a must-have in 2 of your 4 saved ads.` / `Asked as a nice-to-have in 1 of your 4 saved ads.` (singular: `1 of your 1 saved ad`); no line when the skill has no gap row | new function `reportAskedLine(must, nice, M)` (returns null when both are 0); the numbers are `GapRow.mustAds`, `niceAds` and `M` |
| S10 | after the ranking list, only when it is not empty | `A skill can be asked in more ads than it unlocks: an ad may need more than one skill, may already be unlocked by a skill higher up this list, or may be held back by something other than skills.` | new constant `REPORT_FOOTNOTE` |
| S11 | blocked jobs | `Blocked jobs: none`, or the count line and, per job, its header and its conflict lines | `BLOCKED_NONE`, `blockedCountLine`, `blockedHeader`, `conflictLine`, `YEARS_NOTE` (the box's own) |
| S12 | timeline | header, framing sentence, one `By DATE (...)` line per date, or the none line | `TIMELINE_HEADER`, `TIMELINE_FRAMING`, `TIMELINE_NONE` (messages.ts:134-136), `explainTimelineEntry` (explain.ts:210) |
| S13 | the copy button | `Copy report as text` | new constant `REPORT_COPY` |
| S14 | after a successful copy | `Copied.` | new constant `REPORT_COPIED` |
| S15 | after a refused copy | `Could not copy. Select the text and copy it by hand.` | new constant `REPORT_COPY_FAILED` |
| S16 | instead of the button, after a throw | `The roadmap report could not be worked out.` | new constant `REPORT_FAILED_LINE` |

**The three reasons in S10 are each shown by a hand case:** "may need more than one skill": R5 (Docker asked in 1 ad, unlocks 0 alone); "may already be unlocked by a skill higher up": R6 (SQL asked in 2 ads, unlocks 1 because Python, higher up, already unlocked the other); "held back by something other than skills": R2 (Python asked in 2 ads, unlocks 1, the other is blocked by its city).

**New constants and functions for lib/saved/messages.ts:** S1, S2, S3, S4, S9, S10, S13, S14, S15, S16. Everything else is imported. The view writes no sentence.

### The shape of the report, and how it is drawn

- `RoadmapReport = { title: string; lines: ReportLine[] }`, `ReportLine = { text: string; sub: boolean }`. The title is not among the lines.
- `reportAsText(report)`: the title first, then every line, a sub line indented four spaces, joined with `\n`, no trailing newline. It is the text the Copy button writes to the clipboard.
- `roadmapReportSafe(...)` returns `{ kind: "none" } | { kind: "ready"; report } | { kind: "failed"; line }`.
- Markup of the open report (tests read it with react-dom/server): one `<section aria-label="Your roadmap report">`; a `<p>` with the title; one `<ul>` of `<li>` per line, a sub line as `<li data-sub="true">`; the Copy `<button>`; and, when the status is not "idle", one `<p>` with S14 or S15. The closed shell draws one `<button>` with S1 and nothing else. The button text is the only place a sentence appears besides the lines, and it is a constant.

## 2. Decisions (reviewer, 2026-11-17), each with its reason

- **D1. No AI in 8.1;** the sprint's AI half is a later step 8.1b, decided after Groq's terms are read. *Reason:* every sentence here is a template over counted numbers or an engine sentence; an AI call would send skills, employers and dates to Groq before its training terms are settled (HANDOFF.md:159, DECISIONS.md:52-53) and would need a third route, a new pinned prompt, the access code and the kill switch.
- **D2. Yes:** the button only when the roadmap shows. *Reason:* below 10 ads the report would repeat the threshold line.
- **D3. Yes, the report is worth building,** because of the "asked in" lines and the Copy button. *Reason:* without a way to take it away the report is the box shown twice.
- **D4. CHANGED: no runtime self-check.** *Reason:* both sides come from the same engine calls, it would not have caught P0, and it could only show a false failure. The number checker (`reportNumbers`: removes labels longest-first, ISO dates and list markers, returns the remaining numbers) becomes a TEST helper in tests/support/reportNumbers.ts and moves into app/ only when AI-written words arrive (8.1b). T10, B8 and the check-failed line are withdrawn (numbers kept).
- **D5. CHANGED: a button `Copy report as text`:** click-only, plain text, local; NO download, no file, no print styles, no Blob. If the clipboard is refused, a line says so. *Reason:* copying is the person's own act and writes only to the clipboard; a file would put employer names on disk.
- **D6. Yes,** with the new wording (S9, S10). *Reason:* one constant footnote is honest in every case, and each reason it names is shown by a hand case (section 1).
- **D7. Yes:** extract `roadmapInputs(built, ads, skills)` from `roadmapBox`, as its own commit, first in the build stage, all 1,618 existing tests unedited and green; it must handle the zero-counted-ads case (`roadmapBox` returns early at app/roadmap.ts:89-91; the extraction must keep that result). *Reason:* two copies of the 20 lines is how P0 could have happened twice.
- **D8. Yes:** the open/closed state lives in the view; the page mounts the view only while a report exists, so a report that disappears and returns starts closed.

**Open questions, answered:** name "roadmap report"; no date line (it needs a clock); the report does not repeat the gap list; the "nice-to-have only" form of S9 is kept and tested as a function; the throw line is S16; 8.1 and 8.1b are two steps.

## 3. Facts (each read in this run)

- **F1. The CLI already prints a roadmap.** `renderProfileReport` (lib/engine/report-text.ts:28-156) prints "Already Strong", "Skills to build, in order", "Blocked jobs" and "Timeline from skills in progress" (report-text.ts:99-153). It is not changed (golden files and U10 stay). Known difference: it prints an unlisted alternative by its raw `new:` id; the box does not (`listedAlternatives`, roadmapJobs.ts:35-43). So the report is compared with the BOX, not the CLI (T13).
- **F2. The ranking.** `RankedSkill = { skillId, newlyUnlocked, totalUnlocked, closer, inProgress }` (unlock.ts:91-99). `closer` IS a field (unlock.ts:97) but only a COUNT (the greedy loop's tie-break, unlock.ts:135-143, 166-177); the "together with ..." sentence needs the list, which comes from `jobsBroughtCloser` (unlock.ts:184-205), called as in app/roadmap.ts:141-145. `newlyUnlocked` holds JOB IDS, and the labels come from a `labelOf` that looks a job up by id (roadmap.ts:127-132).
- **F3. Everything keys on `job.id`.** `classifyJobs` returns ids (unlock.ts:48, 54), `rankMissingSkills` keeps a `Set` of ids (unlock.ts:124, 133), `unlockTimeline` removes earlier ids with `before.includes` (unlock.ts:244), `labelOf` uses `findIndex` by id (roadmap.ts:128). Every opened reading carries the id `"pasted-ad"` (lib/ai/readJob.ts:65, lib/saved/openJob.ts:29), so `roadmapBox` gives each counted job the SAVED-AD id (roadmap.ts:99; P0, PLAN-7.1 Amendment 7).
- **F4. Which ads count.** `roadmapBasis(job)` (roadmapJobs.ts:19-30): an ad with no requirements, or no must-have we could judge, is not counted (roadmap.ts:82-87); `M` is the number counted, and the not-counted line is `notCountedLine(noRequirements, noMustHave)` (messages.ts:107-117).
- **F5. The "asked in" numbers.** `gapList(engineProfile, engineJobs, nameOf)` (gaps.ts:27) counts, per skill, the counted ads with an unmet must-have naming it (`mustAds`) and with an unmet nice-to-have (`niceAds`), each ad once, blocked ads included (gaps.ts:32-44; PLAN-7.1 G12); an unmet requirement with alternatives counts for each alternative (gaps.ts:41). Every skill the ranking can name has a row: the ranking's candidates are the unmet must-haves of the same engine jobs (unlock.ts:118-121).
- **F6. The engine's sentences.** `explainRankedSkill` (explain.ts:189-208), `explainTimelineEntry` (explain.ts:210-222), `blockedHeader` (explain.ts:176-185), `conflictLine` (explain.ts:172-174), `jobLabel` (explain.ts:35-37).
- **F7. Where the box is built and shown.** `roadmapBoxSafe(profile, roadmapAds(openedReadings(adList, { stamps, skills })), skills)` in a `useMemo` (app/page.tsx:156-159); `<RoadmapView box={roadmap} />` (page.tsx:246). `RoadmapView` has no button and the manual checks of 7.1 and 7.3 expect none (MANUAL-CHECK-7.1.md step 9, MANUAL-CHECK-7.3.md step 7), so the new button lives in a NEW component.
- **F8. The threshold.** `ROADMAP_FROM_JOBS = 10` (roadmapJobs.ts:9); the box shows the roadmap only from `M >= fromJobs` (roadmap.ts:125).
- **F9. The kill switch and the access code are in the routes** (`aiPaused`, lib/ai/enabled.ts:5-7; app/api/read/route.ts:11, 17). A report made without an AI call touches neither.
- **F10. Where the data lives.** Saved ads and the profile are in the browser's IndexedDB, read once at load (app/page.tsx:154-155); the profile in use is `savedBuilt ?? built` (page.tsx:136). Nothing is sent.
- **F11. The number checker (a test helper, D4).** `reportNumbers(lines, labels)` removes every label (longest first; job labels with their caveats, and skill names), every ISO date and every list marker (`1. ` at the start of a line), and returns the digits that remain, as numbers, in order. Labels must go first because a title may contain a digit ("Level 2 Analyst").
- **F12. Words live in messages.ts.** The 7.1 and 7.3 constants are at lib/saved/messages.ts:84-140; the guard that forbids a sentence in a view is in tests/roadmapGuards.test.ts.
- **F13. Test helpers.** `viaPage`, `openedAd`, `page` (tests/support/viaPage.ts) build ads the way the page does; the invented person and ads 1 to 4 are in tests/support/roadmapFixtures.ts; the ten ads are built with the real `buildJob` as in tests/roadmapIds.test.ts (P0c).
- **F14. Alternatives in the tests.** A requirement that accepts several skills is written `must("sql", "python")` (tests/support/roadmapFixtures.ts: `must(...skillIds)`), as the Amendment 6 tests do.

## 4. Edge cases

| Edge | What the report does | Case / test |
|---|---|---|
| no profile in use | no report, no button | T6 |
| no saved ads | no report, no button | T6 |
| fewer than 10 counted ads (9) | no report, no button; with exactly 10: the report | T6, T3a |
| zero counted ads (all excluded) | no report; `roadmapInputs` keeps the early return of `roadmapBox` | T6 |
| some saved ads not counted | the box's own not-counted line right after the basis line; `M` counts only the counted ads | R7 / T21 |
| every counted ad already Strong | `Already Strong: N jobs (...)`, the "none" ranking line, no sub lines, no footnote | R4 / T4 |
| a ranked skill that brings no job closer alone | the engine's "together with ..." sentence, then its asked line | R5 / T5 |
| blocked ads | listed with the engine's lines; their unmet skills still count in the asked numbers (hence the footnote) | R2 / T2 |
| an ad already unlocked by a skill higher up | the lower skill is asked in more ads than it unlocks | R6 / T20 |
| ads that share the id `pasted-ad` | every report test builds its ads that way; each counted job takes its saved-ad id | all, T19 |
| a skill in progress with no date | dropped from the profile with a red line on the confirm screen; the ranking line has no "(in progress ...)", the timeline says none | R3c / T3c |
| a date in the past | shown and counted as stored; no clock | R3b / T3b |
| a ranked skill with no gap row | no sub line, no crash (`reportAskedLine(0, 0, M)` is null; tested as a function) | T17 |
| the clipboard refused | the line S15; nothing else changes | T23 |
| the report disappears and returns | it comes back closed (the page unmounts the view) | manual step 7 |
| a very long title or company | the line wraps (`break-words`); no truncation | T12 |
| characters that need escaping (`<`, `&`, `'`) | React escapes text; the copy text is plain | T12 |
| a title with a digit ("Level 2 Analyst") | the checker removes labels before reading digits | R8 / T7 |
| a person with one counted ad | allowed with the threshold set to 1 in a test; singular grammar | R5, R8 |
| a throw while working out the report | `{ kind: "failed" }` and the line S16; no error page | T9 |

## 5. Files

| File | Change |
|---|---|
| `app/roadmap.ts` | stage 3, first commit alone: extract `roadmapInputs(built, ads, skills)` from `roadmapBox`; `roadmapBox` calls it; no text and no field changes; all existing tests unedited |
| `app/roadmapReport.ts` (new) | `roadmapReport(built, ads, skills, fromJobs)` -> `RoadmapReport \| null`; `roadmapReportSafe`; `reportAsText` |
| `app/RoadmapReportView.tsx` (new, client) | default export: the shell with `useState` (open, copy status) and the only clipboard call, inside a click handler; named export `RoadmapReportOpen`: the pure open-state component |
| `app/page.tsx` | one `useMemo` for the report next to the box's; the ads list computed once and given to both; the view mounted only while a report exists |
| `lib/saved/messages.ts` | the new constants and functions (section 1) |
| `tests/support/reportNumbers.ts` (new) | the checker (D4) |
| `tests/roadmapReport.test.ts`, `tests/roadmapReportView.test.ts` (new); `tests/roadmapGuards.test.ts` (a new `describe` appended) | section 7 |
| `lib/engine/*`, `lib/ai/*`, `app/api/*`, `app/RoadmapView.tsx` | **NOT changed** |
| `docs/MANUAL-CHECK-8.1.md` (later) | section 9 |

## 6. Hand-worked cases (written BEFORE any code)

Ads and person: the invented person of tests/support/roadmapFixtures.ts (SQL from CV line 2 and Excel from line 4 had; Tableau in progress 2027-03-01; city Berlin set; no other kind set) and its ads 1 to 4 (all Berlin, hybrid): a1 Reporting Analyst, Northlake Foods Ltd (must SQL, Tableau; nice Excel); a2 BI Developer, Harbor Light Stationery (must SQL, Python; nice Tableau); a3 Data Clerk, Example Wharf Ltd (must Excel; nice Python, Power BI); a4 Analytics Lead, Imaginary Pages Ltd (must SQL, Python and one must not in our list, set aside, so its label carries ` (1 must-have not judged)`; nice Tableau). All ads reach the code through `viaPage`: job id `pasted-ad`, distinct saved ids. The title and the lines are written below as one text; in the tests the title is `report.title` and the rest `report.lines`. `*` marks a sub line. A "numbers list" is what `reportNumbers` must return: left to right, after removing labels (with caveats), skill names, ISO dates and list markers.

The footnote used in every case where the ranking is not empty is F = `A skill can be asked in more ads than it unlocks: an ad may need more than one skill, may already be unlocked by a skill higher up this list, or may be held back by something other than skills.`; the framing is `These counts assume you learn each skill by its expected date.`

### R1: the four-ad example (threshold set to 4)

Hand count. a1: SQL met, Tableau in progress (not met): missing [Tableau]. a2: missing [Python]. a3: Excel met, no conflict: Already Strong. a4 (judged part): SQL met, Python missing: missing [Python]. Ranking: Python would unlock a2 and a4 (2); Tableau a1 (1); Python first (2 newly, total 2), then Tableau (1 newly, total 3). Asked counts (each ad once per importance): Python must a2, a4 = 2, nice a3 = 1; Tableau must a1 = 1, nice a2, a4 = 2. Blocked none. Timeline: Tableau 2027-03-01 covers a1: 1.
```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 1 job (Data Clerk, Example Wharf Ltd)
Skills to build, in order:
1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.
* Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.
2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.
* Asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2.
F
Blocked jobs: none
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).
```
Numbers: basis 4; Already Strong 1; Python line 2, 2; asked 2, 4, 1; Tableau line 1, 3; asked 1, 4, 2; timeline 1 = `[4,1,2,2,2,4,1,1,3,1,4,2,1]` (13).

### R1c: the exact copied text of R1 (`reportAsText`)

The title, then every line, a sub line indented four spaces, joined with a newline, no trailing newline (F written out in full in the test):
```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 1 job (Data Clerk, Example Wharf Ltd)
Skills to build, in order:
1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.
    Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.
2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.
    Asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2.
F
Blocked jobs: none
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).
```
That is 15 lines joined by 14 newlines; the last character is the full stop of the last line.

### R2: the same ads, ad 2 in Exampleville (blocked)

Ad 2 is hybrid in Exampleville and the person's only city is Berlin: an unclosable location conflict, so a2 is blocked. Ranking: Python now unlocks a4 only (1); Tableau unlocks a1 (1); equal on jobs unlocked and brought closer (0), so the skill already in progress comes first (unlock.ts:165-177): Tableau (1, total 1), then Python (1, total 2). Asked counts still include the blocked ad (PLAN-7.1 G12): Tableau must a1 = 1, nice a2, a4 = 2; Python must a2, a4 = 2, nice a3 = 1. Python is asked in 2 ads and unlocks 1: the footnote's "held back" reason. Blocked: 1 job, 1 conflict. Timeline: Tableau covers a1 only.
```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 1 job (Data Clerk, Example Wharf Ltd)
Skills to build, in order:
1. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 1 job.
* Asked as a must-have in 1 of your 4 saved ads, and as a nice-to-have in 2.
2. Python: unlocks 1 job (Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.
* Asked as a must-have in 2 of your 4 saved ads, and as a nice-to-have in 1.
F
Blocked jobs (skills alone can't make these Strong): 1
- BI Developer, Harbor Light Stationery: blocked by 1 thing; it can't be closed soon
(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin.
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).
```
Numbers: basis 4; Already Strong 1; Tableau line 1, 1; asked 1, 4, 2; Python line 1, 2; asked 2, 4, 1; blocked count 1; header "blocked by 1 thing" 1; timeline 1 = `[4,1,1,1,1,4,2,1,2,2,4,1,1,1,1]` (15).

### R3: the ten SQL-only ads, SQL in progress 2027-06-01 (the manual-check profile of 7.3 step 3; real threshold)

The ten ads (Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd; Stock Analyst, Fern Dock Ltd; Billing Clerk, Gorse Lane Ltd; Order Analyst, Heath Row Ltd; Ledger Clerk, Ivy Gate Ltd; Survey Assistant, Juniper Hall Ltd; Tally Clerk, Larch Wharf Ltd) are built with the real `buildJob` (id `pasted-ad`), ten saved ids; the profile has Tableau and Excel but not SQL; SQL in progress; Berlin. Every ad's one must-have, SQL, is missing (in progress), no conflict: ten reachable, none Strong. SQL covers all ten: newly 10, total 10. Asked: SQL must in 10 of 10 ads, nice 0 (left out). Blocked none. Timeline: 2027-06-01 covers all ten. Let N10 = `Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd; Stock Analyst, Fern Dock Ltd; Billing Clerk, Gorse Lane Ltd; Order Analyst, Heath Row Ltd; Ledger Clerk, Ivy Gate Ltd; Survey Assistant, Juniper Hall Ltd; Tally Clerk, Larch Wharf Ltd`.
```
Your roadmap report
Based on 10 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: none
Skills to build, in order:
1. SQL (in progress, expected 2027-06-01): unlocks 10 jobs (N10). Total so far: 10 jobs.
* Asked as a must-have in 10 of your 10 saved ads.
F
Blocked jobs: none
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-06-01 (SQL): 10 more Strong matches (N10).
```
Numbers: basis 10; SQL line 10, 10; asked 10, 10; timeline 10 = `[10,10,10,10,10,10]` (6).

### R3b: R3 with SQL in progress 2026-01-15 (a date before today)

There is no clock, so the date is shown and counted as stored (a past date is gained at that date, DECISIONS 2026-11-14). Everything as in R3 with the date replaced: `1. SQL (in progress, expected 2026-01-15): unlocks 10 jobs (N10). Total so far: 10 jobs.` and `By 2026-01-15 (SQL): 10 more Strong matches (N10).` Numbers: `[10,10,10,10,10,10]` (dates are removed).

### R3c: R3 with SQL added with NO date

The person unticked SQL and added SQL under "Skills you are learning" without a date. The build drops it (a red line on the confirm screen, `Add a valid expected date for SQL.`): the profile has no SQL and nothing in progress. Hand count: every ad misses SQL; SQL covers all ten: newly 10, total 10, not in progress. Asked: 10 of 10. No dated skill: the timeline is the none line.
```
Your roadmap report
Based on 10 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: none
Skills to build, in order:
1. SQL: unlocks 10 jobs (N10). Total so far: 10 jobs.
* Asked as a must-have in 10 of your 10 saved ads.
F
Blocked jobs: none
Timeline from skills in progress: none.
```
Numbers: basis 10; SQL line 10, 10; asked 10, 10 = `[10,10,10,10,10]` (5).

### R4: every counted ad already Strong (threshold 4)

Person: SQL had, nothing in progress, Berlin. Ads s1 to s4: Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd (each must SQL only, Berlin, hybrid). All four Strong; nothing reachable; no ranking.
```
Your roadmap report
Based on 4 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: 4 jobs (Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd)
Skills to build, in order: none. No other saved job can become a Strong match by skills alone.
Blocked jobs: none
Timeline from skills in progress: none.
```
No sub line, no footnote. Numbers `[4,4]`.

### R5: a skill that brings the job closer only together with another (threshold 1)

Person: no skills at all, nothing in progress, Berlin. One ad z1 "Platform Analyst, Invented Co One" (must Python, must Docker; Berlin, hybrid). Reachable, missing [Python, Docker]. Neither alone unlocks it (newly 0); each brings it one step closer; the tie goes to the skill id: docker before python (unlock.ts:165-177). Docker first: "together with Python, unlocks Platform Analyst, Invented Co One" (explain.ts:203-207). Then Python (with Docker chosen) unlocks z1: 1 job, total 1. Asked: Docker must 1 of 1; Python must 1 of 1. This case shows the footnote's reason "an ad may need more than one skill" (Docker is asked in 1 ad and unlocks 0 alone).
```
Your roadmap report
Based on 1 saved ad we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: none
Skills to build, in order:
1. Docker: together with Python, unlocks Platform Analyst, Invented Co One.
* Asked as a must-have in 1 of your 1 saved ad.
2. Python: unlocks 1 job (Platform Analyst, Invented Co One). Total so far: 1 job.
* Asked as a must-have in 1 of your 1 saved ad.
F
Blocked jobs: none
Timeline from skills in progress: none.
```
Numbers: basis 1; Docker asked 1, 1; Python line 1, 1; asked 1, 1 = `[1,1,1,1,1,1,1]` (7).

### R6: unlocked higher up (threshold 3)

Person: no skills, nothing in progress, Berlin. Three ads (Berlin, hybrid): p1 "Alpha Analyst, Invented Co Two": ONE must-have that accepts SQL or Python, written `must("sql", "python")`; p2 "Beta Analyst, Invented Co Three": must Python; p3 "Gamma Analyst, Invented Co Four": must SQL. Hand count: all three reachable (the person has neither skill): missing p1 [SQL or Python], p2 [Python], p3 [SQL]. Round 1: with Python alone, p1 (any alternative covers it) and p2 are covered: newly 2; with SQL alone, p1 and p3: newly 2; closer 0 for both; neither is in progress; the tie goes to the skill id: python before sql (unlock.ts:165-177). Python first: unlocks p1 and p2 (in ad order), total 2. Round 2: SQL alone now covers only p3, because p1 is already unlocked: newly 1, total 3. Asked counts (an unmet alternative counts for each skill it accepts, gaps.ts:41): Python must in p1 and p2 = 2; SQL must in p1 and p3 = 2. So SQL is asked in 2 of 3 ads and unlocks 1: p1 was already unlocked by Python, higher up (the footnote's second reason).
```
Your roadmap report
Based on 3 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: none
Skills to build, in order:
1. Python: unlocks 2 jobs (Alpha Analyst, Invented Co Two; Beta Analyst, Invented Co Three). Total so far: 2 jobs.
* Asked as a must-have in 2 of your 3 saved ads.
2. SQL: unlocks 1 job (Gamma Analyst, Invented Co Four). Total so far: 3 jobs.
* Asked as a must-have in 2 of your 3 saved ads.
F
Blocked jobs: none
Timeline from skills in progress: none.
```
Numbers: basis 3; Python line 2, 2; asked 2, 3; SQL line 1, 3; asked 2, 3 = `[3,2,2,2,3,1,3,2,3]` (9).

### R7: some saved ads are not counted (threshold 2)

Person: SQL had, nothing in progress, Berlin. Three saved ads: q1 "Report Clerk, Alder Works Ltd" (must SQL; Strong); q2 "Data Assistant, Birch Yard Ltd" (must Python; reachable); q3 "Empty Ad, Invented Co Five" with no requirements at all. Hand count: q3 is excluded (no requirements): M = 2 and the not-counted line is `1 saved ad is not counted: the AI found no requirements in it.` Already Strong: q1. Python unlocks q2: 1, total 1; asked: Python must 1 of 2 counted ads (the denominator is M, not 3).
```
Your roadmap report
Based on 2 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
1 saved ad is not counted: the AI found no requirements in it.
Already Strong: 1 job (Report Clerk, Alder Works Ltd)
Skills to build, in order:
1. Python: unlocks 1 job (Data Assistant, Birch Yard Ltd). Total so far: 1 job.
* Asked as a must-have in 1 of your 2 saved ads.
F
Blocked jobs: none
Timeline from skills in progress: none.
```
Numbers: basis 2; not-counted 1; Already Strong 1; Python line 1, 1; asked 1, 2 = `[2,1,1,1,1,1,2]` (7: the number inside the not-counted line is included).

### R8: digits in a title (the checker must not be fooled; threshold 1)

Person: SQL not had; in progress SQL 2027-06-01; Berlin. One ad "Level 2 Analyst, Example 7 Ltd" (must SQL). Reachable; SQL unlocks it (1, total 1); asked 1 of 1; timeline 1.
```
...
1. SQL (in progress, expected 2027-06-01): unlocks 1 job (Level 2 Analyst, Example 7 Ltd). Total so far: 1 job.
* Asked as a must-have in 1 of your 1 saved ad.
...
By 2027-06-01 (SQL): 1 more Strong match (Level 2 Analyst, Example 7 Ltd).
```
Numbers: basis 1; line 1, 1; asked 1, 1; timeline 1 = `[1,1,1,1,1,1]`. Without removing the labels the checker would also read 2, 7, 2, 7.

**Counts confirmed against the engine (the only thing the engine was asked)** are listed at the end of the stage-2 run in the report; see section 14.

## 7. Tests, tests first

Expected texts and number lists are literal strings from section 6, never imported from the code. Every test that builds ads uses `viaPage` (id `pasted-ad`, distinct saved ids, through `roadmapAds`) unless marked ENGINE or SOURCE.

| # | Test | File | Form |
|---|---|---|---|
| T1 | R1: title, the lines and their sub flags | tests/roadmapReport.test.ts | page's way |
| T2 | R2: blocked ad, Tableau then Python, the blocked lines, footnote | same | page's way |
| T3 | T3a R3 (real `buildJob`, real threshold 10); T3b R3b (past date); T3c R3c (no date: ranking without "in progress", timeline none) | same | page's way, real builder |
| T4 | R4: no ranking, no sub lines, no footnote | same | page's way |
| T5 | R5: "together with" skill, singular grammar | same | page's way |
| T6 | `null` for: no profile; no saved ads; 9 counted ads at threshold 10; zero counted ads; and NOT null with exactly 10 (the boundary) | same | page's way |
| T7 | the checker on the hand lists: `reportNumbers` of R1, R2, R3, R3b, R3c, R4, R5, R6, R7, R8 (literal lines from section 6) equals the hand numbers lists | same | helper only (literal lines) |
| T8 | the checker can fail: R1's lines with "unlocks 3 jobs" instead of 2, and with a label's digit left in, give lists different from the hand list | same | helper only |
| T9 | `roadmapReportSafe` after a throw (a record with no requirements): `{ kind: "failed", line: "The roadmap report could not be worked out." }`; for a healthy input `{ kind: "ready" }`; for none `{ kind: "none" }` | same | the S1 form of tests/roadmap.test.ts |
| T10 | **withdrawn** (runtime self-check, D4) | | |
| T11 | property over 8 combinations (4 invented people x the ads of R1 and R2): `reportNumbers` of the report's lines equals the numbers taken from DIRECT engine calls (`classifyJobs`, `rankMissingSkills`, `gapList`, `unlockTimeline`) on the same saved-id jobs; labelled a property, its expectation is not hand-worked | same | ENGINE (direct calls) |
| T12 | the closed shell draws one button with `Make my roadmap report` and nothing else; the open body draws its lines as list items in order, sub lines marked `data-sub="true"`; `<`, `&` and `'` in a label are drawn as the same text; nothing drawn for `{ kind: "none" }`; the failed line for `{ kind: "failed" }` | tests/roadmapReportView.test.ts (react-dom/server, no JSX) | markup only |
| T13 | the report's Already Strong, ranking, blocked and timeline lines (without basis, not-counted, sub lines and footnote) equal the BOX's `partB` and `timeline` for the same inputs, for R1, R2, R4, R5 | tests/roadmapReport.test.ts | page's way, both sides |
| T14 | guard (SOURCE): app/roadmapReport.ts and app/RoadmapReportView.tsx contain no `fetch(`, `localStorage`, `sessionStorage`, `indexedDB`, `saveJob`, `deleteJob`, `useEffect`, no `@/lib/ai` import and no `Date.now` / `new Date` | tests/roadmapGuards.test.ts (new `describe`) | source |
| T15 | guard (SOURCE): no sentence literal of four or more words in the two new files; the view maps lines with an index key (at least one `key=` line, each mentioning an index); no `<form` | same | source |
| T16 | guard (SOURCE): `app/RoadmapView.tsx` still has no `onClick` | same | source |
| T17 | the constants and functions are exactly the texts of section 1: S1 to S4 (both grammars), S9 (three forms, the singular, and `null` for 0 and 0), S10, S13 to S16 | tests/roadmapReport.test.ts | pure |
| T18 | `roadmapBox` is unchanged by the extraction: the existing 1,618 tests pass unedited (no new test; the count is reported) | all existing | page's way |
| T19 | P0 for the report: R1 built with every job id "pasted-ad" and with distinct job ids gives the same lines, equal to T1's | tests/roadmapReport.test.ts | page's way vs distinct |
| T20 | R6 | same | page's way |
| T21 | R7 (the not-counted line after the basis line; the number inside it is in the numbers list) | same | page's way |
| T22 | `reportAsText` of R1 equals R1c exactly (indent of four spaces, `\n`, no trailing newline) | same | page's way |
| T23 | the pure open-state component `RoadmapReportOpen`: shows the title, the lines, the Copy button `Copy report as text`; with status "copied" the line `Copied.`; with "failed" the line `Could not copy. Select the text and copy it by hand.`; with "idle" neither | tests/roadmapReportView.test.ts | markup only |
| T24 | guard (SOURCE): the clipboard is written in exactly one place, `navigator.clipboard.writeText`, inside a click handler of RoadmapReportView.tsx; never in app/roadmapReport.ts; no `Blob`, no `createObjectURL`, no `download` attribute, no `document.execCommand` anywhere in the two new files | tests/roadmapGuards.test.ts | source |

## 8. Deliberate breaks (each must make the NAMED test fail)

| # | Break | Named test |
|---|---|---|
| B1 | `roadmapInputs` keeps the jobs BEFORE `listedAlternatives` | the existing Amendment 6 tests (G15, U4; to be named after the break has been RUN in stage 4) |
| B2 | remove the saved-ad id line from `roadmapInputs` (P0 again) | T19, T1, T4 |
| B3 | swap `mustAds` and `niceAds` in the asked line | T1 |
| B4 | the asked numbers ignore blocked ads | T2 |
| B5 | the report built below the threshold | T6 |
| B6 | `reportNumbers` does not remove labels first | T7 |
| B7 | the checker accepts any list | T8 |
| B8 | **withdrawn** (the runtime self-check, D4) | |
| B9 | import `@/lib/ai/...` into the report file | T14 |
| B10 | `new Date()` in the report | T14 |
| B11 | the plural wrong ("1 saved ads", "1 of your 1 saved ads") | T5 |
| B12 | the footnote dropped when the ranking is not empty | T1 |
| B13 | the footnote shown when the ranking is empty | T4 |
| B14 | a sentence typed into RoadmapReportView.tsx | T15 |
| B15 | the report lines keyed by their text alone | T15 |
| B16 | `roadmapBox` changed by the extraction (a field dropped) | the existing U3 and P0a (to be named after the run) |
| B17 | a `fetch(` in the view | T14 |
| B18 | a skill's date read from the clock instead of the profile | T14 |
| B19 | the asked numbers looked up by position in the gap list instead of by skill id | T2 |
| B20 | the copy text without the indent of the sub lines | T22 |
| B21 | the clipboard written at render, or outside a click handler | T24 |
| B22 | the not-counted line dropped from the report | T21 |

## 9. Manual-check outline (for docs/MANUAL-CHECK-8.1.md; every step NOT RUN YET)

Needs **11 AI reads** on the new preview address (the CV once, the ten ads of docs/MANUAL-CHECK-TEN-ADS.md once each; a preview address has its own empty storage); everything after step 2 needs none. Invented data only.
1. Open the step-8.1 preview in a new private window; do the setup of MANUAL-CHECK-7.3 step 1 (the invented CV, the three skills ticked, Berlin, saved, the ten ads read and saved). **Expect:** ten rows; the box as in 7.3 step 1.
2. Look under the box. **Expect:** one button `Make my roadmap report`, and no report text yet.
3. On the confirm screen untick SQL and add SQL in progress with the date 2027-06-01. Press the button. **Expect:** the lines of R3, exactly, with the ten different names, each once, the asked line under SQL, the footnote.
4. Press `Hide the roadmap report`. **Expect:** the lines vanish; the button reads `Make my roadmap report`.
5. Open it again and press `Copy report as text`. **Expect:** `Copied.` Paste into any notes app. **Expect:** the same text as on the screen: the title first, the asked line indented four spaces, no extra empty line at the end.
6. Change the date to 2027-03-01 (remove and add). **Expect:** the report shows `(in progress, expected 2027-03-01)` and `By 2027-03-01 (SQL): 10 ...`, the same ten.
7. Delete one saved ad (nine left). **Expect:** the button and the report are gone; the box shows the threshold line. Save the ad again by reading it (or skip). **Expect** (if done): the button is back and the report is closed.
8. Network tab, filter `api`, cleared before step 3, Preserve log ticked. **Expect:** no `/api/` request for steps 3 to 7.
9. Console: no red errors of ours.
The not-counted line is not exercised by hand (covered by R7 / T21). Log table: nine rows, NOT RUN YET.

## 10. Privacy and safety

- **Where the text goes: nowhere but the person's own browser,** and, only when the person presses `Copy report as text`, to the operating system's clipboard. No file is written (no download, no Blob, no print styles); nothing is sent, saved in the app, logged, or put in a URL. There is no new route, so the server cannot log it. No AI is called (D1): nothing leaves the device (CLAUDE.md rule 4; DECISIONS D2, DECISIONS.md:52).
- **What could leak.** The report names employers and job titles from the person's saved ads, skills (some with learning dates), and, through blocked-job lines, the cities on the profile. After a copy, other programs on the person's computer can read the clipboard; the app cannot control that, and says nothing it does not know. The copy is the person's own click and plain text (T24).
- **How the page avoids the rest.** No `fetch`, storage, clock or AI import in the new files (T14); the clipboard is written in one place only, in a click handler (T24); React escapes text in the view (T12).
- **Printed or downloaded?** The app prepares neither. Browser printing prints the screen; that is outside the app.
- **Tests and manual checks use invented data only** (CLAUDE.md rules 5 and 8): the ads of R1 to R8 and docs/MANUAL-CHECK-TEN-ADS.md; no real CV; the access code is never typed anywhere but the app's code box.
- **If 8.1b adds AI-written words,** employers, skills and dates would go to Groq: that needs the D2 privacy answer first and a notice at the button; it is out of this plan.

## 11. Open questions for the reviewer

None open from v1 (all answered, section 2). New in v2:
1. **Copy of an open report only.** The Copy button exists only while the report is open. *Recommend* yes: the text on screen is the text copied.
2. **Does `Copied.` need to go away?** *Recommend* no: it stays until the report is closed or the page reloaded; a timer needs a clock or an effect, which the new files forbid (T14).

## 12. Two paragraphs

**(a) Does 8.1 depend on 7.3 or only on 7.1?** By content, only on 7.1 and its P0 fix: the report is the ranking, the "asked in" counts from the gap list, and the blocked jobs, all built in 7.1; the timeline lines, the one 7.3 piece, are a section it can omit. By construction it depends on 7.3 as well: this branch is cut from `step-7.3`, the report uses the same `roadmapBox` inputs that 7.3 extended (the `timeline` field, app/roadmap.ts:64-67, 158-172), and the new view sits next to `RoadmapView`, whose third list is the 7.3 timeline. The merge order is therefore 7.1 (carries P0), then 7.3, then 8.1; 8.1 must not merge before 7.3's manual check passes, because both touch app/roadmap.ts and app/page.tsx and a merge of 8.1 first would carry 7.3 with it. If the reviewer dropped the timeline section, 8.1 could be rebased onto `step-7.1` and the order would stop mattering.

**(b) Careful lane or ordinary lane?** Careful lane. The report tells a person what to learn first and how many jobs each skill "unlocks": numbers a person may act on, which CLAUDE.md puts in the careful lane. It also changes shared code (`roadmapBox`, D7) that the P0 defect showed to be fragile, and it adds a place where "plain code decides and counts" could be broken by a text that disagrees with the engine. Hence a short plan, hand-worked expected texts, tests first, deliberate breaks with named tests, and a manual check before any tick.

## 13. For DECISIONS at merge time

(Not written to docs/DECISIONS.md; lines to add when the step merges, each with its reason.)

- 2026-11-17: Step 8.1: the roadmap report is built by code from the saved ads and the profile in use; no AI writes any word in it; the AI half of the sprint line becomes a later step 8.1b, decided after Groq's terms are read. Reason: every sentence is a template over counted numbers or an engine sentence, and no text may leave the device before the terms are settled (docs/HANDOFF.md:159).
- 2026-11-17: The report shows only when the roadmap shows (10 counted ads and a profile in use), as a button under the "What to learn" box; the open/closed state lives in the view and a returning report starts closed. Reason: below 10 ads it would repeat the threshold line.
- 2026-11-17: Each ranked skill carries an "Asked as a must-have in N of your M saved ads ..." line (the 7.1 gap counts), and one fixed footnote names the three reasons a skill can be asked in more ads than it unlocks (needs more than one skill; already unlocked higher up the list; held back by something other than skills). Reason: the sprint asks "why each"; each reason is shown by a hand case.
- 2026-11-17: The report has a click-only button "Copy report as text" (plain text, clipboard only) and NO download, file, Blob or print style; if the clipboard is refused a line says so. Reason: copying is the person's act; a file would put employer names on disk.
- 2026-11-17: No runtime self-check of the report's numbers; the number checker is a test helper (tests/support/reportNumbers.ts) and moves into app/ only when AI-written words arrive. Reason: both sides come from the same engine calls, it would not have caught P0, and it could only show a false failure.
- 2026-11-17: `roadmapBox` and `roadmapReport` share one function for the counted ads, the engine views, the engine jobs (with the saved-ad id) and the label function. Reason: two copies of that code is how the P0 defect could have happened twice.
- 2026-11-17: The report has no date line. Reason: a date needs a clock, which the engine, the box and the tests keep out.

## 14. Engine confirmation of the counts (stage 2)

A temporary script (deleted; no AI call; no code of 8.1 exists) ran the engine's own `roadmapBasis`, `classifyJobs`, `rankMissingSkills`, `gapList` and `unlockTimeline` on the cases that are new in v2, with saved-ad ids on the jobs. Every count agreed with the hand work, and no expectation was adjusted:
- **R3b** (SQL in progress 2026-01-15): M 10, strong 0; SQL unlocks 10 (total 10); asked must 10, nice 0; timeline `2026-01-15` 10.
- **R3c** (SQL with no date): the build gave the problem `Add a valid expected date for SQL.` and no in-progress skill on the profile; M 10, strong 0; SQL unlocks 10 (total 10), not in progress; asked 10/0; timeline none.
- **R6**: M 3, strong 0; Python first, unlocks Alpha Analyst and Beta Analyst (total 2); then SQL, unlocks Gamma Analyst only (total 3); asked: Python must 2, SQL must 2 (so SQL is asked in 2 and unlocks 1: p1 already unlocked higher up); timeline none.
- **R7**: three saved ads, M 2 (the ad with no requirements is not counted); strong 1; Python unlocks Data Assistant (total 1); asked must 1; timeline none.
R1, R2, R3, R4, R5 and R8 were confirmed in the stage-1 run (same counts).
