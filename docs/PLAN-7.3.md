STATUS: DRAFT for the reviewer, 2026-11-17. Careful lane (it tells a person when jobs open up). Nothing is built. Branch `step-7.3`, cut from `step-7.1` (eb52036). All data below is invented. The hand tables in section 6 were worked out from the engine's rules (docs/DECISIONS.md 2026-11-14) before any code was run.

# Plan for step 7.3: the dated timeline in the "What to learn" box

Step text (docs/SPRINT.md line 134): "7.3 Dated timeline from skills in progress ("by 20 December: 6 more strong matches")."

Builds on: docs/PLAN-7.1.md (the box, Amendments 1 to 6), docs/DECISIONS.md 2026-11-14 (the timeline is cumulative; dates that unlock nothing stay with 0; the engine does not know today's date). The reviewer's seven design decisions for this step are taken as given (section 2).

## 0. A defect found while reading the code (affects 7.1 as well; needs the reviewer first)

Every saved ad, once opened, has `job.id = "pasted-ad"`: `lib/ai/readJob.ts:65` and `lib/saved/openJob.ts:29` both build the job with `{ id: "pasted-ad" }`, and `roadmapAds` (`app/roadmap.ts:164-172`) passes that job on unchanged. The engine keys on `job.id`: `unlockedIds` and `classifyJobs` return ids, `rankMissingSkills` keeps its running total in a `Set` of ids (`lib/engine/unlock.ts:124`), `unlockTimeline` removes earlier ids with `before.includes(id)` (`unlock.ts:244`), and the box's `labelOf` finds a job by id (`app/roadmap.ts:121-126`). The 7.1 tests use distinct ids (`a1` to `a4`), so none of them can see it.

Probe (a temporary script, deleted; no AI call): the four-ad example with the four jobs given the id `pasted-ad` and four distinct saved-ad ids gave

```
Already Strong: 1 job (Reporting Analyst, Northlake Foods Ltd)        <- wrong ad: the hand count says Data Clerk, Example Wharf Ltd
Skills to build, in order:
1. Python: unlocks 2 jobs (Reporting Analyst, Northlake Foods Ltd; Reporting Analyst, Northlake Foods Ltd)   <- two ads, one label
Blocked jobs: none                                                     <- and the Tableau line is missing
strong ids: [ 'saved-0', 'saved-1', 'saved-2', 'saved-3' ]             <- all four flagged, hand count: only saved-2
```

So on the live page, from 10 saved ads, "Already Strong", the ranking and its totals are wrong whenever two ads share the id, which is every real ad. The gap list (Part A) does not use ids (lib/engine/gaps.ts has no `.id`), so the required steps of MANUAL-CHECK-7.1 are unaffected; its OPTIONAL step 10 would show it (ten identical labels). `alreadyStrongIds` is not read by the page yet.

The timeline would inherit the defect (its `jobs` and `newlyUnlocked` are lists of ids). The plan therefore makes the fix a prerequisite, **P0**: in `roadmapBox`, each counted ad's engine job gets the SAVED-AD id (`{ ...engineJob, id: counted[i].ad.id }`, applied where `listedAlternatives` is applied). Saved-ad ids are unique (they are the store keys). With distinct ids the texts of 7.1 do not change (tests with ids `a1` to `a4` stay as they are: `asSaved` uses `job.id`). Open question Q1 asks where P0 lands.

## 1. What the screen shows

Part B of the box, from `ROADMAP_FROM_JOBS` (10) counted ads, gets a third list after the three it has: **the timeline**. Below 10 counted ads nothing about it is shown (the threshold line stays as it is).

With skills in progress (the four-ad example of section 6, H1, threshold set to 4):

```
What to learn
  ... Part A as before ...
  Already Strong: 1 job (Data Clerk, Example Wharf Ltd)
  Skills to build, in order:
  1. Python: unlocks 2 jobs (...). Total so far: 2 jobs.
  2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.
  Blocked jobs: none
  Timeline from skills in progress:
  These counts assume you learn each skill by its expected date.
  By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).
```

With no skill in progress, one line: `Timeline from skills in progress: none.`

Every `By DATE (...)` line is the engine's own sentence (`explainTimelineEntry`, lib/engine/explain.ts:210-228), the same one the command-line report prints (lib/engine/report-text.ts:146-153). Dates are shown as stored (YYYY-MM-DD). No "in 5 weeks" wording.

### Every user-visible sentence, with its place

| # | Place in the box | Text | Where the words live |
|---|---|---|---|
| S1 | timeline, first line, when at least one skill is in progress | `Timeline from skills in progress:` | new constant `TIMELINE_HEADER` in lib/saved/messages.ts (the same words as report-text.ts:149) |
| S2 | second line, right under S1 (page only; the command-line report has no such line) | `These counts assume you learn each skill by its expected date.` | new constant `TIMELINE_FRAMING` |
| S3 | one line per date, in date order | `By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).` and its forms: `2 more Strong matches (A; B)`; `0 more Strong matches. Tableau doesn't unlock a job yet.` for one skill, `These skills don't unlock a job yet.` for several | `explainTimelineEntry` (engine; imported, never copied). The job labels carry the page's caveat `(n must-have(s) not judged)` like the ranking does |
| S4 | instead of S1 to S3 when no skill is in progress | `Timeline from skills in progress: none.` | new constant `TIMELINE_NONE` (same words as report-text.ts:147) |

Nothing else is added: no threshold line of its own (the box's threshold line already covers it), no date arithmetic, no "today".

## 2. The seven decisions of the reviewer, and how this plan keeps each

1. Part B, from `ROADMAP_FROM_JOBS` counted ads, after the ranking. Kept: the timeline is the LAST list, after "Blocked jobs", the order of the command-line report (section 8, Q2).
2. `unlockTimeline(engineProfile, engineJobs)` with the very same two values that `rankMissingSkills(engineProfile, engineJobs)` gets (app/roadmap.ts:128). Kept; guard test T14.
3. The box's timeline lines equal the CLI's. Kept; U12e and U12f (T10, T11) compare line by line, after the existing `stripCaveat`. The two literals (S1, S4) and the page-only S2 go to lib/saved/messages.ts.
4. Dates as the engine has them. Kept.
5. One plain sentence of framing: S2 (Q3).
6. Empty timeline: one line, the CLI's words, S4 (Q4).
7. `roadmapBoxSafe` stays the only entry; keys by position; `RoadmapView` stays a pure view. Kept; the existing guards in tests/roadmapGuards.test.ts still apply to the new list, and T15 adds a check that the view maps `box.timeline` with an index key.

I do not think any decision is wrong. One thing to know: "N more Strong matches" in the timeline is cumulative over the skills IN PROGRESS only, while the ranking's "Total so far" also counts skills not yet started. They are different numbers by design (H2: ranking total 3 after Excel, timeline 2 at the first date). Neither contradicts the other, and the last timeline entry's jobs are always a subset of the ranking's unlocked jobs (T12).

## 3. Facts from the code (file:line)

**a. The engine.**
- `unlockTimeline(profile, jobs)` is lib/engine/unlock.ts:222-250. It runs `classifyJobs` once (223), collects every `inProgress` skill with its `expectedDate` (225-227), takes the distinct dates sorted as text (228), and for each date assumes the person has every skill dated ON OR BEFORE it (233-235: `l.date <= date`, a string comparison, so it is chronological only for YYYY-MM-DD). Skills sharing a date are added together (one entry; `skills` sorted, 239-242). `moreStrong` is the number of reachable jobs whose missing must-haves are all covered by the gained skills (`unlockedIds`, 70-74); `newlyUnlocked` are those not in the previous entry (244); `jobs` are all of them, cumulative, in the order the jobs were given.
- Jobs already Strong and blocked jobs never appear (`classifyJobs`, 42-63). A job with ANY conflict is blocked, closable or not (46-52; the file comment 15-18 says so). Nice-to-haves play no part.
- No comparison with an ad's start date, and no use of today's date: the file comment (11-13) says "no clock"; grep finds no `Date.now` or `new Date` in unlock.ts, explain.ts, roadmap.ts or RoadmapView.tsx (a date in the past is therefore kept and counted as gained; line 221).
- A date that unlocks nothing stays with 0 (the comment 219-220; `moreStrong` 0).
- `TimelineEntry` is unlock.ts:209-215. `explainTimelineEntry` is explain.ts:210-228: `By ${date} (${skill names}): ${moreStrong} more Strong ${match|matches}` then ` (${labels joined "; "}).` when `moreStrong` > 0, else `. ${Skill doesn't|These skills don't} unlock a job yet.` (skill names via `nameOf`, one skill gives "X doesn't", several "These skills don't").
- The CLI lines (lib/engine/report-text.ts:146-153), run through `npm run report` (no AI call):
  - non-empty (profile `maya`): `Timeline from skills in progress:` then `  By 2026-12-20 (Python): 0 more Strong matches. Python doesn't unlock a job yet.`
  - non-empty (profile `ana`): `  By 2027-01-31 (SQL): 0 more Strong matches. SQL doesn't unlock a job yet.`
  - empty (profiles `jonas`, `sam`, `ravi`, `lena`): `Timeline from skills in progress: none.`

**b. The saved profile and the box.**
- A skill in progress is `{ kind: "inProgress", skillId, expectedDate }` (lib/engine/types.ts:99; the stored schema, lib/saved/schemas.ts:71, takes `expectedDate` as any string).
- `buildProfile` (lib/cv/profile.ts:133-154) accepts an in-progress skill only with a real calendar date (`isRealDate`, 69-76; "2027-02-30" is refused with a problem line) and only if the skill is not already taken from the CV (`fromCv`, 143); duplicates are dropped (`progressIds`, 150). A name not in our skill list gets `new:<slug>` from `skillIdFor` (lib/engine/skillIds.ts:131-139, `listed: false`); line 153 pushes an in-progress skill ONLY when `id.listed`, otherwise the name goes to `unmatchable` with `where: "progress"` (154). So **an in-progress id never starts with `new:` when the profile is built from the confirm screen.**
- `toSaved` copies `built.profile.skills` (lib/saved/profile.ts:30-38). `builtFromSaved` (lib/saved/profile.ts:53-72) keeps only skills whose id is in the vocabulary (`known`), so a stored `new:` id (a damaged or hand-edited record) is dropped. The vocabulary has no id starting with `new:` (lib/vocab/data.ts: no entry; `grep` finds none; nothing pins it yet: test T17 does).
- `engineView` (lib/cv/engineView.ts:29-35) spreads `...profile`, so `engineProfile.skills` keeps every in-progress skill. `roadmapBox` takes `views[0].engineProfile` (app/roadmap.ts:90). So the timeline needs no new plumbing: the dates reach `unlockTimeline` already.
- A hand-added skill ("have" with no CV line) that is also in progress is possible (`buildProfile` checks `fromCv` only): the engine treats it as not met and in progress, so it behaves like any in-progress skill (no special case).
- Not checked anywhere after the build: a stored `expectedDate` that is not a real date (a damaged record) would sort and print as text. Q7.

**c. What `rankMissingSkills` receives in `roadmapBox` today** (app/roadmap.ts:89-128):
`counted` = the saved ads for which `roadmapBasis(job).excluded === null` (78-79); `views = counted.map(engineView)` (89); `engineProfile = views[0].engineProfile` (90); `engineJobs = views.map(v => listedAlternatives(v.engineJob))` (93). `classifyJobs(engineProfile, engineJobs)` (127) and `rankMissingSkills(engineProfile, engineJobs)` (128) get exactly that: the judgeable jobs of the counted ads, with the person's unset kinds blanked and unlisted alternatives dropped, ads blocked by a conflict included (they land in `blocked`). The timeline gets the same pair. After P0 the jobs carry saved-ad ids.

## 4. Edge cases (each has a hand case in section 6 or a named test)

| Edge | What happens | Case / test |
|---|---|---|
| no skill in progress | `Timeline from skills in progress: none.`; no framing line | H4 / T4 |
| two skills on one date | one entry, skills together, alphabetical by id; a job needing both counts at that date; counted once | H2 / T2 |
| a date that unlocks 0 | its line stays: `0 more Strong matches. X doesn't unlock a job yet.` (or `These skills don't`) | H3, H6 / T3, T5 |
| every counted ad already Strong | `reachable` is empty; every date shows 0; the ranking line is `... none. No other saved job ...` | H3 / T3 |
| an ad blocked by a conflict that can't be closed | never counted in any entry | H2 (ad 2) / T2 |
| an ad blocked by a conflict that CAN be closed (one year short) | also never counted (the engine's rule: any conflict blocks) | H7 / T6 |
| fewer than 10 counted ads | the timeline list is empty; only the threshold line shows | H5 / T7 |
| an ad not counted (no requirements) | no effect on any entry | T9 |
| no profile in use; no saved ad; zero counted ads | timeline `[]` | T7 |
| a date in the past | shown and counted as gained; the page does not know today | H3 (2026-01-15) / T3; Q6 |
| dates entered in reverse order | entries are in date order, not entry order | H6 / T5 |
| ads that share an id | P0: each counted ad gets its saved-ad id | T16 |
| an in-progress skill not in our skill list | never on the profile (b above) | T17 |
| a stored profile with a `new:` in-progress id | dropped by `builtFromSaved` | T17 |
| a throw while working out the box | `roadmapBoxSafe`: one line, timeline `[]` | T18 |

## 5. Files and callers

| File | Change |
|---|---|
| `app/roadmap.ts` | P0 id line; `RoadmapBox` gets a field `timeline: string[]` (in `EMPTY`, in every early return, and in `roadmapBoxSafe`'s failure value); after the ranking and blocked lists, `unlockTimeline(engineProfile, engineJobs)` and the lines from S1 to S4 |
| `app/RoadmapView.tsx` | a third `<ul>` mapping `box.timeline`, keyed `${i}-${line}`; no sentence in the view |
| `lib/saved/messages.ts` | `TIMELINE_HEADER`, `TIMELINE_FRAMING`, `TIMELINE_NONE` |
| `lib/engine/*` | **not changed** (unlock.ts, explain.ts, report-text.ts stay as they are; the CLI output and the golden files do not change) |

Why a new field and not more lines at the end of `partB`: 20 existing tests compare `partB` with exact lists (U3, U12a to U12d, the frozen-input test). Appending to `partB` would turn them red and force edits to existing expectations, which is not allowed. A separate field leaves every existing expectation true. Q5.

The view's "nothing to show" test (`!hasNote && !hasPartA && !hasPartB`) is unchanged: a non-empty timeline implies a non-empty `partB`.

## 6. Hand-worked cases (written BEFORE any code; tests copy these texts)

Common material: the invented person and ads 1 to 4 of tests/support/roadmapFixtures.ts (all in Berlin, hybrid; the person sets only a city, `Berlin`, so only the location kind is judged and the work modes default to all three). A "view" of an ad is the engine's judgeable job. Labels are `title, company`.

| Ad | Label | Must-haves | Nice-to-haves |
|---|---|---|---|
| a1 | Reporting Analyst, Northlake Foods Ltd | SQL, Tableau | Excel |
| a2 | BI Developer, Harbor Light Stationery | SQL, Python | Tableau |
| a3 | Data Clerk, Example Wharf Ltd | Excel | Python, Power BI |
| a4 | Analytics Lead, Imaginary Pages Ltd | SQL, Python, + one must not in our skill list (set aside; the page adds "(1 must-have not judged)" to its label) | Tableau |

Extra invented ads for H3, H6, H7 (Berlin, hybrid, must SQL only, so Strong for anyone with SQL from the CV): s1 `Report Clerk, Alder Works Ltd`; s2 `Data Assistant, Birch Yard Ltd`; s3 `Sales Analyst, Cedar Mill Ltd`; s4 `Finance Clerk, Elm Court Ltd`.

### H1: the four-ad example (threshold set to 4)

Profile: SQL (CV line 2) and Excel (line 4) had; Tableau in progress, 2027-03-01. Skills asked and met: a1 SQL met, Tableau not (in progress); a2 SQL met, Python not; a3 Excel met; a4 (judged) SQL met, Python not.

- classify: a1 reachable, missing [Tableau]; a2 reachable, missing [Python]; a3 has no missing must-have and no conflict: Already Strong; a4 reachable, missing [Python]. No conflict anywhere.
- dates: one, 2027-03-01 (Tableau). gained {Tableau}. a1 covered (its only missing is Tableau): yes. a2 (needs Python): no. a4 (needs Python): no. So 1 job: a1.
- entry: date 2027-03-01, skills [tableau], moreStrong 1, newly [a1], jobs [a1].

`timeline` =
```
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-03-01 (Tableau): 1 more Strong match (Reporting Analyst, Northlake Foods Ltd).
```
Cross-check with the ranking of PLAN-7.1 section 4: Tableau unlocks 1 job (Reporting Analyst) as the second skill; the timeline gets the same job. `partB` is unchanged (the five lines of SECTION_4).

### H2: two skills on one date, a later date, a blocked ad (threshold 4)

Profile: SQL (line 2) had; in progress: Tableau 2027-03-01, Python 2027-03-01, Excel 2027-09-01; city Berlin. Ad a2 is in Exampleville (hybrid), the rest as in the table.

- classify: a1: SQL met, Tableau not: reachable [Tableau]. a2: the city Exampleville is not on the profile (unclosable): blocked (never reachable). a3: Excel not met: reachable [Excel]. a4: SQL met, Python not: reachable [Python].
- dates: 2027-03-01 (python, tableau), 2027-09-01 (excel).
- date 1: gained {python, tableau}. a1 covered (Tableau): yes. a3 (needs Excel): no. a4 (Python): yes. moreStrong 2; jobs [a1, a4] in the order given; newly [a1, a4].
- date 2: gained {python, tableau, excel}. a1 yes, a3 yes, a4 yes: moreStrong 3; jobs [a1, a3, a4]; newly [a3].
- a2 never appears: it is blocked.

`timeline` =
```
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-03-01 (Python, Tableau): 2 more Strong matches (Reporting Analyst, Northlake Foods Ltd; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)).
By 2027-09-01 (Excel): 3 more Strong matches (Reporting Analyst, Northlake Foods Ltd; Data Clerk, Example Wharf Ltd; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)).
```
The command-line report for the same engine inputs prints the same two `By` lines without the caveat (U12 strips it; hand count of removals: 2, one in each line).
Ranking cross-check (hand): all three skills are in progress, each unlocks exactly one job and none brings another closer; the tie is broken by the earlier date, then the id: Python (2027-03-01), Tableau (2027-03-01), Excel (2027-09-01), totals 1, 2, 3. The ranking's unlocked set {a4, a1, a3} equals the last timeline entry's jobs {a1, a3, a4} (T12).

### H3: every counted ad already Strong, a date in the past, two skills on one date (threshold 4)

Profile: SQL (line 2) had; in progress: Tableau 2026-01-15, Docker 2027-02-01, Python 2027-02-01; city Berlin. Ads s1 to s4 (must SQL only).

- classify: all four have SQL met, no conflict: Already Strong. reachable empty.
- dates: 2026-01-15 (tableau), 2027-02-01 (docker, python). Nothing is reachable, so moreStrong is 0 at both.
- date 1: skills [tableau]: `By 2026-01-15 (Tableau): 0 more Strong matches. Tableau doesn't unlock a job yet.`
- date 2: skills [docker, python] (alphabetical): `By 2027-02-01 (Docker, Python): 0 more Strong matches. These skills don't unlock a job yet.`

`timeline` =
```
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2026-01-15 (Tableau): 0 more Strong matches. Tableau doesn't unlock a job yet.
By 2027-02-01 (Docker, Python): 0 more Strong matches. These skills don't unlock a job yet.
```
`partB` starts `Already Strong: 4 jobs (Report Clerk, Alder Works Ltd; Data Assistant, Birch Yard Ltd; Sales Analyst, Cedar Mill Ltd; Finance Clerk, Elm Court Ltd)`, then `Skills to build, in order: none. No other saved job can become a Strong match by skills alone.`, then `Blocked jobs: none`.

### H4: no skill in progress (threshold 4)

The person of PLAN-7.1 with the in-progress list empty (SQL and Excel had), ads a1 to a4. `timeline` = `["Timeline from skills in progress: none."]` (no framing line). `partB` is the roadmap of that profile and not the subject of this case.

### H5: below the threshold

H1's profile and ads with the threshold at 5 (4 counted): `partB` = `["The roadmap shows from 5 saved ads we could judge. You have 4. Save 1 more to see it."]` and `timeline` = `[]`. Also `[]`: no profile in use, no saved ads, and zero counted ads.

### H6: a date with 0 first, then an unlock; dates entered in reverse order (threshold 2)

Profile: SQL (line 2) had; in progress entered in this order: Excel 2027-01-10, Docker 2026-12-20; city Berlin. Ads: s1 (Strong), a3 (must Excel).
- classify: s1 Already Strong; a3 reachable, missing [Excel].
- dates sorted: 2026-12-20 (docker), 2027-01-10 (excel).
- date 1: gained {docker}: a3 needs Excel: no. moreStrong 0.
- date 2: gained {docker, excel}: a3 covered. moreStrong 1; jobs [a3].

`timeline` =
```
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2026-12-20 (Docker): 0 more Strong matches. Docker doesn't unlock a job yet.
By 2027-01-10 (Excel): 1 more Strong match (Data Clerk, Example Wharf Ltd).
```

### H7: an ad blocked by a conflict that could be closed (threshold 2)

Profile: SQL (line 2) had; Excel in progress, 2027-01-10; years of experience 2; city Berlin. Ads: s1 (Strong, no years asked) and a3 with "3 years" asked (1 year short: a conflict that could be closed).
- classify: s1 Already Strong. a3: Excel missing AND a years conflict (closable, 1 short): blocked (any conflict blocks).
- dates: 2027-01-10 (excel). reachable empty, so moreStrong 0.

`timeline` =
```
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-01-10 (Excel): 0 more Strong matches. Excel doesn't unlock a job yet.
```

### Manual-check counts (the 10-ad batch, section 9)

Ten short ads, each asking SQL only; profile: SQL NOT ticked, SQL in progress 2027-03-01 (no other skill needed). Every ad: SQL missing (in progress). All ten reachable; none Strong; no conflict.
- timeline: date 2027-03-01, gained {SQL}: all ten covered: `By 2027-03-01 (SQL): 10 more Strong matches (ten labels).`
- change the date to 2027-06-01: the same ten, the line `By 2027-06-01 (SQL): 10 more Strong matches (...)`.
- add Excel in progress 2027-01-10 (no ad asks Excel): first line `By 2027-01-10 (Excel): 0 more Strong matches. Excel doesn't unlock a job yet.`, then the SQL line (gained {Excel, SQL}: ten).

## 7. Tests, tests first

New file **tests/timeline.test.ts** (the box's timeline field), a new `describe` appended to **tests/roadmap.test.ts** (U12e and U12f; no existing case touched), a new `describe` appended to **tests/roadmapGuards.test.ts**, and **tests/roadmapIds.test.ts** (P0). Expected texts come from section 6.

| # | Test | Expected (from) |
|---|---|---|
| T1 | H1: the box's `timeline` | the three lines of H1 |
| T2 | H2: two skills on one date, cumulative, ad 2 blocked and absent | the three lines of H2 |
| T3 | H3: every counted ad Strong, a past date, two skills on one date | the four lines of H3; and `partB` ends with `Blocked jobs: none` (the timeline is NOT in `partB`) |
| T4 | H4: no skill in progress | exactly `["Timeline from skills in progress: none."]`; the framing sentence appears nowhere in the box |
| T5 | H6: a 0 date first, then an unlock; dates entered in reverse | the four lines of H6 |
| T6 | H7: an ad blocked by a closable conflict is never counted | the three lines of H7 |
| T7 | H5: below the threshold; no profile; no saved ad; zero counted ads | `timeline` is `[]` in each |
| T8 | the timeline is its own list | in H1, H2, H3: no line of `partA` or `partB` starts with `Timeline` or contains the framing sentence |
| T9 | an uncounted ad (no requirements) added to H1 | `timeline` is the same three lines as T1 (hand count: that ad is left out before any engine call) |
| T10 | U12e: the box's timeline against the command-line report, H1 and H2 | after the existing `stripCaveat`, the box's lines minus the framing line equal the lines the report prints from `Timeline from skills in progress` to the end, trimmed and without blank lines; removals: H1 0, H2 2 |
| T11 | U12f: the page-only and shared literals | the framing sentence is absent from the report's text (`renderProfileReport` for H1); the header and the "none" line equal the report's literals (H4 against the report) |
| T12 | the timeline and the ranking agree | H2: the last entry's jobs (by the ids of H2) are exactly `["a1","a3","a4"]`, and the ranking's unlocked set is the same three ids (hand constants); H1: `["a1"]` is inside the ranking's `["a2","a4","a1"]` |
| T13 | the box makes no call: `fetch` not called, frozen inputs untouched | H1 with deep-frozen inputs gives the T1 lines (the 7.1 test pattern) |
| T14 | guard (source): in app/roadmap.ts the call `unlockTimeline(...)` has the same two arguments as `rankMissingSkills(...)` | the two argument lists are equal text |
| T15 | guard (source): no clock | app/roadmap.ts, app/RoadmapView.tsx and lib/engine/unlock.ts contain no `Date.now`, `new Date`, `performance.now` (code only, comments removed). And the view maps `box.timeline` with an index in its key and has no `onClick`, no sentence literal (the existing guards also run on it) |
| T16 | P0: four ads that all carry the id `pasted-ad`, with four distinct saved ids (the fixtures of H1) | `partB` equals SECTION_4 (Data Clerk is the one Already Strong; Python unlocks BI Developer and Analytics Lead; Tableau unlocks Reporting Analyst); `alreadyStrongIds` is exactly the saved id of ad 3; `timeline` equals T1's |
| T17 | in-progress ids: the vocabulary has no id that starts with `new:`; `buildProfile` with an in-progress name not in our list ("Kombucha brewing", a real date) puts no `inProgress` skill on the profile (it goes to `unmatchable`, `where: "progress"`); `builtFromSaved` drops a stored in-progress skill with id `new:kombucha-brewing`; the box for such a profile says `Timeline from skills in progress: none.` | hand count: 0 in-progress skills each time |
| T18 | `roadmapBoxSafe` after a throw (the existing way of forcing one) | `timeline` is `[]` and the ROADMAP_FAILED_LINE is unchanged |
| T19 | the message constants | `TIMELINE_HEADER`, `TIMELINE_FRAMING`, `TIMELINE_NONE` are exactly the three texts of section 1 |

Counts: 19 named tests; the number of `it` blocks will be reported when they are written.

## 8. Deliberate breaks (each must make the NAMED test fail; restored after)

| # | Break | Must fail |
|---|---|---|
| B1 | give `unlockTimeline` all the ads' jobs, including ads not counted, instead of the counted ones | T9 |
| B2 | give it the unfiltered profile (`built.profile`) instead of `engineProfile` (the hybrid ads then conflict with the empty work-mode list) | T1 |
| B3 | give it a different job list from the ranking (the jobs before `listedAlternatives`) | T14 (and nothing else: the numbers happen to agree, which is why the guard exists) |
| B4 | drop the framing line | T1, T19 |
| B5 | show the framing line also when the timeline is empty | T4 |
| B6 | append the timeline lines to `partB` instead of their own field | T8, T3 (and the existing U3) |
| B7 | show the timeline below the threshold | T7 |
| B8 | reverse the order of the entries | T5, T2 |
| B9 | drop entries whose date is before a fixed "today" (a clock) | T3, T15 |
| B10 | remove the P0 id line | T16 |
| B11 | in lib/engine/unlock.ts, let a job with only closable conflicts count as reachable (restored at once; the engine is not changed by this step) | T6 (and the existing unlock tests) |
| B12 | a sentence typed into RoadmapView.tsx | the existing sentence guards (the JSX text scan) |
| B13 | label timeline jobs without the caveat | T2 (hand text has it) and U12e's removal count (H2: 2) |
| B14 | print `box.timeline` keyed by the line text alone | the existing key guard (T15) |

## 9. Manual check (outline, for docs/MANUAL-CHECK-7.3.md when built; every step NOT RUN YET)

Reuses the OPTIONAL step 10 batch of MANUAL-CHECK-7.1 (ten short invented ads, each asking SQL only). **No extra AI read**: the ads are read once, as for 7.1 step 10 (10 reads); the CV once (1 read). Only the profile on the confirm screen changes, and the box recomputes in the browser.

1. With the 7.1 profile and the ten ads saved: **Expect** `Already Strong: 10 jobs (...)` and `Timeline from skills in progress: none.` (no skill in progress), and no framing sentence.
2. On the confirm screen untick SQL, then add SQL as in progress with the date 2027-03-01. **Expect** `Already Strong: none`, the ranking `1. SQL (in progress, expected 2027-03-01): unlocks 10 jobs (...). Total so far: 10 jobs.`, then `Timeline from skills in progress:`, `These counts assume you learn each skill by its expected date.`, and `By 2027-03-01 (SQL): 10 more Strong matches (the ten labels).`
3. **Change the date**: remove SQL from the in-progress list and add it again with 2027-06-01. **Expect** the `By` line moves to `By 2027-06-01 (SQL): 10 more Strong matches (...)` and the count stays 10.
4. Press **Save on this device**, reload, press **Use this profile**. **Expect** the same timeline (the date is stored, not computed).
5. Add Excel in progress, 2027-01-10. **Expect** two lines in date order: `By 2027-01-10 (Excel): 0 more Strong matches. Excel doesn't unlock a job yet.` then the SQL line with 10.
6. Remove both in-progress skills. **Expect** `Timeline from skills in progress: none.`
7. Network tab, filter `api`, cleared before steps 2 to 6. **Expect** no `/api/` request for any change.
8. Console: no red errors of ours.
9. Delete one ad (9 left). **Expect** the ranking and the timeline vanish and the threshold line shows `You have 9. Save 1 more to see it.`
Log table: nine rows, all NOT RUN YET. (This also gives 7.2's "Part B seen on a real page with 10 usable ads".)

## 10. Open questions for the reviewer, each with my recommendation

1. **P0, where does the id fix land?** It changes what 7.1 shows from 10 ads (it fixes labels and totals; no text of any existing test changes). Options: (a) a separate careful-lane commit on `step-7.1` BEFORE the merge, then `step-7.3` takes it by `git merge step-7.1` (b) the first commit of `step-7.3`, so main carries the defect from the 7.1 merge until 7.3 merges. **Recommend (a):** the defect is in 7.1's code, and a live page with wrong "Already Strong" labels from the tenth ad should not ship. The owner's sitting on the pinned preview (b5beb0e) stays valid for its required steps (the gap list uses no ids; only the optional step 10 of MANUAL-CHECK-7.1 shows the defect); I would not repeat the sitting for P0 alone, only run 7.3's check on the merged live address. Your call: this run does not touch `step-7.1`.
2. **Order in the box.** After "Blocked jobs" (the CLI's order) or right after the ranking and before "Blocked jobs"? **Recommend after Blocked jobs:** it is "after the ranking" and equals the CLI line order, so U12 can compare one block.
3. **The framing sentence.** Proposed: `These counts assume you learn each skill by its expected date.` Alternative with the cumulative point: `This assumes you learn each skill by its expected date; each count includes the skills dated before it.` **Recommend the short one:** "By DATE" already says cumulative, and a longer sentence is one more line to read.
4. **Empty timeline.** The CLI's `Timeline from skills in progress: none.` reads as a heading with a value, like `Blocked jobs: none`. **Recommend keeping it** (no page-only wording, U12f compares it with the CLI).
5. **A new field `timeline` on the box, not more lines in `partB`.** Because 20 existing tests pin `partB`. **Recommend yes** (section 5).
6. **A date in the past.** The engine counts it as gained and the page does not know today, so the line reads as any other. Showing "(date has passed)" needs a clock, which must be a parameter given to a pure function so tests stay deterministic. **Recommend: not in this step**; one DECISIONS line records it, and a later step may add a `today` parameter.
7. **A stored date that is not a real date, or a duplicated skill** (a damaged or hand-edited IndexedDB record; the stored schema takes any string). The build step refuses such dates; a stored record is not re-checked. **Recommend: no change now.** The worst case is an odd line, not a wrong count of ads, and `roadmapBoxSafe` covers throws. A later step could drop invalid stored dates in `builtFromSaved`.
8. **The 10-ad manual check needs the 7.1 step 10 batch** (10 reads, optional there, needed here). **Recommend yes**, since 7.2's own check ("Part B seen on a real page with 10 usable ads") needs the same batch; one batch serves both.
9. **Stage 2 now?** Q3 and Q4 change an expected text (the framing sentence, the empty line) and Q1 changes where P0 lands, so under the brief's own rule this run stops after this plan. If you answer Q1 to Q5 as recommended, the red tests of stage 2 are ready to write from sections 6 and 7.

## For DECISIONS at merge time

(Not written to docs/DECISIONS.md in this run; lines to add when the step merges.)

- 2026-11-17: Step 7.3: the timeline is the last list of Part B of the "What to learn" box, shown from `ROADMAP_FROM_JOBS` counted ads; below that count only the threshold line shows. Reason: it needs the same count as the ranking and must not appear where the ranking does not.
- 2026-11-17: The timeline is computed by `unlockTimeline` with the same engine profile and the same judged jobs that `rankMissingSkills` receives; its lines are the engine's `explainTimelineEntry` sentences, equal to the command-line report's (guarded by U12e and U12f). Reason: the ranking and the timeline cannot disagree, and no rule is written twice.
- 2026-11-17: The page shows one framing line of its own, `These counts assume you learn each skill by its expected date.`, and no date arithmetic; dates are shown as stored. Reason: the count is a promise about the person's plan, and the page has no clock.
- 2026-11-17: A date in the past is shown and counted like any other (the engine does not know today). Reason: determinism (no `Date.now` in the engine, the box or the tests).
- 2026-11-17: The box result has a separate field `timeline`; `partB` keeps its exact lines. Reason: the existing tests pin `partB`.
- 2026-11-17: In the box, every counted ad's engine job takes the SAVED-AD id (all opened readings share the id `pasted-ad`, which collapsed ads in the ranking, the labels and the totals). Reason: the engine keys on job id.
