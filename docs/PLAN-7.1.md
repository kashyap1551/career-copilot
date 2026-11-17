STATUS: APPROVED 2026-11-17; the build runs on the branch `step-7.1`, cut from `step-6.2` (5a52739), because the 6.2 merge waits for the owner's hand checks (see section 10). Reviewer answers: Q1 to Q14 as proposed, with ONE AMENDMENT (held-back ads in the gap list, below). Careful lane (it tells a person what to learn). Nothing is built. All data below is invented.

# Plan for steps 7.1 and 7.2: the gap list and the unlock ranking

Step text (docs/SPRINT.md, Day 7, read in full):
- "Later: treat closing a closable conflict (language one level, one year of experience) as an unlock candidate, so the roadmap can say 'reach C1 English and N more jobs open up'." **Stays NOT built** (section 10, Q11).
- "7.1 Gap list across saved jobs: each missing skill with how many jobs ask for it, must and nice counted apart. Check: the counts match a hand count for one test profile."
- "7.2 Unlock ranking, shown once 10 jobs are saved, as counts. Check: the page agrees with the engine."
- 7.3 (the dated timeline from skills in progress) is NOT in this plan. `unlockTimeline` is described in section 3 because it is one of the engine's functions, but the page does not show it until 7.3.

What exists on main (read in the code, commit 1149195): the engine functions `classifyJobs`, `rankMissingSkills`, `unlockTimeline` and `jobsBroughtCloser` (lib/engine/unlock.ts), the sentences `explainRankedSkill` and `explainTimelineEntry` (lib/engine/explain.ts:186-221), and a command-line roadmap in `renderProfileReport` (lib/engine/report-text.ts:102-157) that already uses the 10-ad threshold (`ROADMAP_FROM_JOBS = 10`, report-text.ts:27). The page shows none of it. There is no function that counts gaps across jobs: 7.1 needs a new pure one.

Builds on: docs/PLAN-6.2.md (APPROVED, revision 2: the list uses the profile in use and the same `reportFor` path), docs/PLAN-FIT-LEVEL.md (`splitJudgeable`, the no-level reasons), docs/DECISIONS.md 2026-11-14 (unlock rules: "a job counts as unlocked only if it becomes Strong by gaining skills; any conflict blocks it; nice-to-haves play no part").

**Amendment (reviewer, 2026-11-17): the gap list says when ads are held back by something other than skills.** The gap list counts every counted ad (Q1: ads blocked by a conflict still count). Under the list, when at least one counted ad has a conflict that can't be closed soon (for example a city out of reach, a work mode the profile does not accept, a language the profile does not list), the box adds ONE line, written by code from the conflicts the engine already found, and nothing it does not know:
- one ad: `1 of your 4 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.`
- several: `2 of your 4 counted saved ads are held back by something other than skills (location, work mode), so learning the skills above may not open them.`
The words in brackets are the kinds of conflict found, taken from the engine's conflicts, in the order location, language, work mode, years, start date (the words of `KIND_WORDS`), each once. "N of your M counted saved ads": M is the number of ads counted in the gap list, N the number with at least one conflict that can't be closed soon. A conflict that could be closed (one year short, one language level short, up to 30 days late) does NOT trigger the line: the code does not know that the person cannot close it. The line says only that the ad is held back and that the skills "may not" open it; it does not say which ads, and does not say that any listed skill belongs to a held-back ad. Case G14 and a manual-check line cover it.

**Amendment 2 (reviewer, 2026-11-17 evening: re-derivation of G14).** It sharpens the amendment above; where they differ, this one rules.
1. The kinds in the held-back line are the kinds of the conflicts that can't be closed soon ONLY, taken from the ads counted in M, each once, in the order of `KINDS`, written with `KIND_WORDS`. A closable conflict in the same ad is not listed.
2. An ad counts once in N, however many unclosable conflicts it has.
3. `ConflictKind` (language, years, city, workMode, startDate) is mapped to `Kind` by the table `CONFLICT_KIND`, now private in app/fitReport.ts. It MOVES to lib/cv/profile.ts (exported, beside `Kind` and `KIND_WORDS`) and app/fitReport.ts imports it. One table, no copy.
4. Grammar: the noun follows M ("ad" when M is 1, else "ads"); the verb and the pronoun follow N ("is ... it" when N is 1, else "are ... them").
5. When no gap row exists (G10, nothing unmet) and at least one counted ad is held back, the line is still shown WITHOUT the words after the brackets (there are no skills above): `1 of your 4 counted saved ads is held back by something other than skills (location).` and, for several: `2 of your 4 counted saved ads are held back by something other than skills (location, work mode).`
6. The G14 rows test the DATA (`gapList(...).heldBack`: ads, of, kinds) in tests/gaps.test.ts and the SENTENCE (a pure function `heldBackLine(heldBack, hasRows)` in app/roadmap.ts, constant words in lib/saved/messages.ts) in tests/heldBackLine.test.ts. Each row is written once for each file.

## 1. What the screen shows

A new box on the page, below the "Saved ads" list, called **"What to learn"**, with two parts. It uses the saved ads and the profile in use (section 2); it has no button that saves, deletes or calls the AI.

**Part A, the gap list (7.1):** shown from the first saved ad.

```
What to learn
Skills you are missing across your 4 saved ads
(Counted against the profile in use. Must-haves and nice-to-haves are counted apart.)

  Python: must-have in 2 ads, nice-to-have in 1 ad
  Tableau (you are learning it, expected 2027-03-01): must-have in 1 ad, nice-to-have in 2 ads
  Power BI: nice-to-have in 1 ad

1 requirement in your saved ads is not in our skill list yet, so we could not judge it. It is not counted.
```

**Part B, the roadmap (7.2):** below 10 saved ads it shows one line instead of the ranking (section 4). From 10 it shows "Already Strong", "Skills to build, in order" and "Blocked jobs" as counts, in the sentences the engine already writes.

### The worked example (hand count written BEFORE any code)

Profile in use (invented): skills SQL (CV line 2) and Excel (CV line 4) as have skills; Tableau in progress, expected 2027-03-01; the person set only a city, `Berlin`. Four saved ads (invented), every one in Berlin, hybrid, so no conflict anywhere:

| # | Saved ad | Must-haves | Nice-to-haves |
|---|---|---|---|
| 1 | Reporting Analyst, Northlake Foods Ltd | SQL, Tableau | Excel |
| 2 | BI Developer, Harbor Light Stationery | SQL, Python | Tableau |
| 3 | Data Clerk, Example Wharf Ltd | Excel | Python, Power BI |
| 4 | Analytics Lead, Imaginary Pages Ltd | SQL, Python, and one requirement that is NOT in our skill list ("Kombucha brewing") | Tableau |

Hand count of the requirements the profile does not meet (judgeable ones only; the unlisted one is set aside):
- Ad 1: must Tableau (in progress, so not met).
- Ad 2: must Python; nice Tableau.
- Ad 3: nice Python; nice Power BI. (Its must Excel is met.)
- Ad 4: must Python; nice Tableau. (Kombucha brewing: not counted.)

Counts per skill, each ad counted once per importance:
- **Python:** must in ads 2 and 4 = **2**; nice in ad 3 = **1**.
- **Tableau:** must in ad 1 = **1**; nice in ads 2 and 4 = **2**.
- **Power BI:** must **0**; nice in ad 3 = **1**.
- **Kombucha brewing:** in no row. One requirement could not be judged: the line under the list says 1.

Row order: most must-have asks first, then most nice-to-have asks, then the skill name: Python (2, 1), Tableau (1, 2), Power BI (0, 1). Parts that are 0 are left out of the text ("Power BI: nice-to-have in 1 ad"). The Tableau row carries "(you are learning it, expected 2027-03-01)" because the profile has it in progress. The wording "1 ad" / "2 ads" is singular and plural.

## 2. Where the numbers come from

- **The saved ads and the profile in use, nothing else.** The same rule as 6.2: the profile is the one the report uses on that page (`profile = savedBuilt ?? built`, app/page.tsx:133, passed in as a prop), never a profile of its own; the readings are the ones 6.2 computes once per change of ads or stamps (`openJob`: as stored, or re-checked in the browser from the stored extraction; plain code, not written back). No AI call, no network call, nothing stored (no new field in `SavedJob` or `SavedProfile`), nothing written: the box calls no save or delete function. With NO profile in use the box shows, instead of both parts, the 6.2 note: `No fit levels yet: no profile is in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.` (its wording adjusted to "What to learn needs a profile in use...": see Q12). A profile just confirmed from a CV this visit counts as in use, so the box recomputes live as the confirm screen changes (the cost is one `match` per ad per change for the gap list; the ranking adds work proportional to skills times ads: both small for 10 to 30 ads, by reasoning, not by measurement).
- **Which job and which profile the engine sees: the same as the report.** The report does not hand `match()` the raw profile and job. `profileReport` blanks the constraint kinds the person did not set (app/fitReport.ts:94-115 as of 5a52739, from the comment block above `splitJudgeable` to `const result = match(...)`; it also splits off the requirements that cannot be judged). If the roadmap called the engine on the raw saved job and the raw profile, an ad that asks for German B2, with a person who set no languages, would be a conflict that can't be closed (match.ts:122-132: a language not on the profile), while the report says "not judged": the roadmap would block the ad and the level would not. So 7.1 and 7.2 take the same engine inputs as the report from ONE shared function (`engineView`, section 6), which `profileReport` is refactored to use without any change in its output. This is the point where "N more Strong matches" can agree with the levels the person sees, or not.

## 3. What the existing engine functions return

All in lib/engine/unlock.ts, pure code, no AI. They are NOT changed by this plan.

| Function | Input | Returns |
|---|---|---|
| `classifyJobs(profile, jobs)` | the profile and the jobs (the judgeable ones, section 5) | `{ alreadyStrong: jobId[], blocked: { jobId, by: conflict kinds, onlyClosable, conflicts }[], reachable: { job, missing: Requirement[] }[] }`. A job with any conflict is `blocked`; with none and level Strong it is `alreadyStrong`; otherwise `reachable`, with its missing MUST-haves (nice-to-haves play no part) |
| `rankMissingSkills(profile, jobs)` | the same | an ordered list, greedy and cumulative: `{ skillId, newlyUnlocked: jobId[], totalUnlocked, closer, inProgress: date or null }`. Ties: most newly unlocked, then most brought closer, then skills already in progress (earliest date), then the skill id |
| `jobsBroughtCloser(profile, jobs, chosen, skillId)` | the above | for a skill that unlocks nothing yet: the jobs it moves closer and what each still needs |
| `unlockTimeline(profile, jobs)` | the same | `{ date, skills, moreStrong, newlyUnlocked, jobs }[]` from the skills in progress (step 7.3, not shown by this plan) |

The sentences: `explainRankedSkill` writes "`Python: unlocks 2 jobs (A; B). Total so far: 2 jobs.`" (with "(in progress, expected DATE)" after the name when it applies) or "`Skill: together with X, unlocks Job.`" or "`Skill: brings no job closer.`"; `blockedHeader` and `conflictLine` write the blocked part; counts only, never percentages.

## 4. The 7.2 ranking: below 10 and exactly at 10

- **Which ads count toward the 10 (proposed, Q4):** the saved ads the roadmap can use: readable records whose ad has a requirement we could judge a must-have of (section 5). Ads it cannot use are named in one line and do not count. Corrupted or newer-schema records are not ads here (the list already counts them in its notice).
- **Below 10 (for example 4 usable ads):** the gap list (Part A) shows. Part B shows ONE line, exactly: `The roadmap shows from 10 saved ads we could judge. You have 4. Save 6 more to see it.` No ranking, no "Already Strong", no blocked list.
- **Exactly 10 (and above):** Part B shows. The test is `>=` (the same as lib/engine/report-text.ts:108); 9 shows the line with "You have 9. Save 1 more to see it."; 10 shows the roadmap. Part B then has: `Already Strong: N jobs (labels)`, `Skills to build, in order:` with one `explainRankedSkill` sentence per skill (or "none. No other saved job can become a Strong match by skills alone."), `Blocked jobs (skills alone can't make these Strong): N` with the conflict sentences. These are the strings the command-line report already prints, so the page and the engine say the same thing.
- **The four-ad example worked as if these ads were part of a 10-ad set** (the engine's "test view"): the numbers from Part A's profile. `classifyJobs` on the judgeable jobs: alreadyStrong = [ad 3]; blocked = none; reachable = ad 1 (missing Tableau), ad 2 (missing Python), ad 4 (missing Python). `rankMissingSkills`: round 1, Python newly unlocks ads 2 and 4 (2), Tableau unlocks ad 1 (1): Python first; round 2, Tableau newly unlocks ad 1: total 3. Output: `Already Strong: 1 job (Data Clerk, Example Wharf Ltd)`; `1. Python: unlocks 2 jobs (BI Developer, Harbor Light Stationery; Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)). Total so far: 2 jobs.`; `2. Tableau (in progress, expected 2027-03-01): unlocks 1 job (Reporting Analyst, Northlake Foods Ltd). Total so far: 3 jobs.` `Blocked jobs: none`.

## 5. Decision for HANDOFF item 19 (reviewer): the roadmap works on the same judgeable job the report uses

**The rule.** The roadmap and the gap list work on `splitJudgeable(job).judged` (lib/engine/judgeable.ts, on step-6.2), with the same unset-kinds blanking as the report (`engineView`), so "N more Strong matches" agrees with the levels the person sees.
- A requirement that is not in our skill list cannot be a skill to learn: it appears in no gap list and no ranking, and is counted in the one line under the gap list.
- A job with no requirements, or with no must-have we could judge, never counts as Strong or as unlocked: it is left out of `classifyJobs` altogether and named in one line (`1 saved ad is not counted: the AI found no requirements in it.` / `... no must-have we could judge ...`; for several, `N saved ads are not counted (no requirements found, or no must-have we could judge).`).
- A job with an unjudged must-have whose judgeable must-haves are all met counts as Strong, exactly as its level says ("Strong (...; 1 must-have not judged)"), and its name in the roadmap carries the same caveat: `Analytics Lead, Imaginary Pages Ltd (1 must-have not judged)`.

**What changes in the numbers for an ad with one unlisted must-have (worked by hand, ad 4 above, same profile).**

| | Whole job (today's engine on the raw job) | Judgeable job (this plan) |
|---|---|---|
| ad 4's missing musts | Python AND the unlisted skill (`new:kombucha-brewing`) | Python |
| the candidates the ranking may recommend | Python, Tableau and `new:kombucha-brewing` | Python, Tableau |
| ranking | 1. Python: unlocks 1 job (ad 2), closer 1; 2. Tableau: unlocks 1 (ad 1), total 2; 3. `new:kombucha-brewing`: unlocks 1 (ad 4), total 3 | 1. Python: unlocks 2 jobs (ads 2 and 4), total 2; 2. Tableau: unlocks 1 (ad 1), total 3 |
| what the person is told to learn | three skills, the third with no name ("new:kombucha-brewing" printed as an id: `nameOf` falls back to the id) | two skills |
| "Strong after everything" | 1 already + 3 = 4 jobs | 1 already + 3 = 4 jobs, but ad 4 is Strong "with 1 must-have not judged" |

Worked rounds for the left column: round 1 Python newly unlocks ad 2 only (ad 4 also needs the unlisted skill) with closer 1 (ad 4 is brought closer); Tableau newly unlocks ad 1 with closer 0; Python wins on the tie-break "most brought closer". Round 2 (Python chosen): Tableau and `new:kombucha-brewing` each newly unlock one ad with closer 0; Tableau wins because it is in progress. Round 3: `new:kombucha-brewing` newly unlocks ad 4.

**Where the judgeable job is passed.**
- **The page:** a new pure `app/roadmap.ts` builds, for each saved ad, `engineView(reading.job, profileInUse)` and passes the profile and the counted jobs to `classifyJobs` and `rankMissingSkills` (and to the new `gapList`).
- **The command-line report:** the call sites are in lib/engine/report-text.ts: `classifyJobs` at line 103, `rankMissingSkills` at 104, `unlockTimeline` at 105 and `jobsBroughtCloser` at 130. They would receive the counted judgeable jobs (the same helper), and `ROADMAP_FROM_JOBS` would move to a shared place. The per-job level sections (report-text.ts:41, `match` on each job) stay as they are.
- **Do the command-line report or the golden files change? No, by reasoning, to be proved by running them unchanged:** the three fixture jobs contain no `new:` skill id (fixtures/jobs.ts: 0 occurrences) and each has three must-haves (northwind 3, brightwater 3, fjordlight 3), so the judgeable-job helper removes nothing and leaves no job out. The command-line report does not use `engineView` at all: it keeps passing the whole profile to the engine, as today (only the web page needs the blanking of kinds the person did not set). tests/golden/ana.txt, tests/golden/sam.txt, tests/report.test.ts, tests/unlock.test.ts and tests/explain.test.ts must pass WITHOUT any edit; if one needs an edit when this is built, STOP and tell the reviewer why. `lib/engine/unlock.ts` and `explain.ts` are not edited.

## 6. Files and callers

| File | Change | Callers affected |
|---|---|---|
| lib/engine/gaps.ts (new, pure) | `gapList(profile, jobs)`: for each job, `match()` once; for each unmet requirement (musts and nices apart) add the job to each acceptable skill's count; returns rows `{ skillId, mustAds, niceAds, learning: date or null, noCvLine: boolean }` sorted as in section 1, and `heldBack: { ads: number, of: number, kinds: Kind[] }` for the amendment (ads with a conflict that can't be closed soon, from the same `match()` results) | the page's roadmap module |
| lib/engine/roadmapJobs.ts (new, pure) | `ROADMAP_FROM_JOBS`; `roadmapBasis(job)`: the judgeable job and the reason it is excluded (`no-requirements` or `no-must-have-judgeable`, from `noLevelReason`), and the number of unjudged musts | page, report-text.ts |
| lib/cv/engineView.ts (new, pure) | `engineView(job, built)`: the judgeable job with the unset kinds blanked and the profile with the work-modes default, EXACTLY what `profileReport` builds today (app/fitReport.ts:94-115 as of 5a52739) | `profileReport` (refactored to call it; output unchanged), the roadmap |
| app/fitReport.ts | refactor only: uses `engineView`. Output identical | all `profileReport` callers; tests/profileReport.test.ts (R1 to R14, G1), tests/fitLevelReport.test.ts, tests/saved.test.ts: must pass unchanged |
| app/roadmap.ts (new, pure) | assembles Part A and Part B: counts, lines, the notes, the threshold line; uses `explainRankedSkill`, `blockedHeader`, `conflictLine` | RoadmapView |
| app/RoadmapView.tsx (new) | draws the box; no handler that saves or calls anything | app/page.tsx |
| app/page.tsx | passes `profile` and the shared opened readings (from 6.2) to the box | none beyond |
| lib/engine/report-text.ts | the call sites of section 5; output unchanged | scripts/report.ts, tests/report.test.ts, the golden files |
| lib/engine/unlock.ts, explain.ts, fit.ts, match.ts | NOT edited | |
| lib/saved/messages.ts | the new constant texts (the notes of sections 1 to 5) | the box |

No change to: lib/ai, lib/vocab, lib/schemas, the routes, the reader and its hashes (ad 85357f8fac, CV 193e02ee3f, vocabulary e96370fe4c, READING_VERSION "3").

**Existing tests that could change:** none are expected; the ones that guard the refactor and the call sites are listed above (profileReport R1 to R14 and G1, fitLevelReport, saved S2b-report, report, golden, unlock, explain). Any that needs an edit stops the work.

## 7. Hand-worked cases, tests first, deliberate breaks

**Gap list cases** (expected text written before any code; the four-ad example is G1):

| # | Case | Expected |
|---|---|---|
| G1 | the four-ad example | rows Python (must 2, nice 1), Tableau (must 1, nice 2, learning 2027-03-01), Power BI (must 0, nice 1); no Kombucha row; the line "1 requirement ... could not judge it. It is not counted." |
| G2 | two skills with the same counts | ordered by skill name |
| G3 | a requirement with alternatives ("Power BI or Tableau", must, unmet) | counted for Power BI and for Tableau (one ad each); the sentence `A requirement that accepts several skills is counted once for each of them.` appears under the list |
| G4 | the same requirement when the profile has one of the alternatives | met: no gap, no row |
| G5 | a skill the person is learning | the row carries `(you are learning it, expected DATE)` |
| G6 | a skill added by hand with no CV line | the row carries `(on your profile without a CV line, so it does not count)` |
| G7 | an unlisted-only requirement | in no row; counted in the could-not-judge line (singular and plural) |
| G8 | an ad with no requirements, and an ad with no must-have we could judge | contribute no row; named in the line "N saved ads are not counted ..." |
| G9 | no profile in use | no gap list; the no-profile note |
| G10 | nothing unmet in any ad | `You meet every requirement we could judge in your 4 saved ads.` |
| G11 | a skill asked as a must in one ad and a nice in another | counted in both columns |
| G12 | an ad that is blocked by a conflict (a city out of reach) | its unmet skills still count (Q1) |
| G13 | an ad counted once per importance even if two of its requirements name the same skill | one |
| G14a | the four-ad example, but ad 2 (BI Developer, Harbor Light Stationery) is in Exampleville, hybrid, and the person's city is Berlin (an unclosable location conflict) | the rows are UNCHANGED (Python must 2, nice 1; Tableau must 1, nice 2; Power BI nice 1: ad 2's unmet skills still count), and under the list: `1 of your 4 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.` |
| G14b | the four-ad example with ad 2 hybrid in Exampleville (location conflict only) and ad 3 on-site in Berlin (work-mode conflict only); profile: city Berlin, work mode hybrid only; ads 1 and 4 are hybrid in Berlin and have no conflict. Why this shape: `checkPlace` (lib/engine/match.ts) compares the city only when the ad is not remote, so a "remote only" profile cannot give a location-only conflict (a remote ad has no city check, and a non-remote ad in another city would also fail the work-mode check) | `2 of your 4 counted saved ads are held back by something other than skills (location, work mode), so learning the skills above may not open them.` |
| G14c | the only conflict is one that could be closed (one year short) | no held-back line |
| G14d | no counted ad has a conflict (the plain four-ad example, G1) | no held-back line |
| G14e | the G14a example plus a FIFTH ad that has NO requirements and asks for French; the profile also sets German B2 (so the language kind is set). A language the profile does not list is always unclosable (match.ts `checkLanguages`: `!has` gives `closable: false`), so this does not depend on `LANGUAGE_CLOSABLE_LEVELS` | the line is exactly the G14a line (M is still 4, kinds still `(location)`, French not listed), and the fifth ad is named in the not-counted line (G8) |
| G14f | the person set NO city; an ad is in Exampleville | no held-back line (unset kinds are blanked by `engineView`) |
| G14g | one counted ad, held back by location, with at least one unmet skill | `1 of your 1 counted saved ad is held back by something other than skills (location), so learning the skills above may not open it.` |
| G14h | nothing unmet in any ad, one of 4 held back by location | the G10 sentence `You meet every requirement we could judge in your 4 saved ads.` and then `1 of your 4 counted saved ads is held back by something other than skills (location).` |
| G14i | one ad has an unclosable location conflict AND a closable one-year-short conflict | kinds `(location)` only, N counts the ad once: `1 of your 4 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.` |
| G14j | two ads, both held back by location | `2 of your 4 counted saved ads are held back by something other than skills (location), so learning the skills above may not open them.` |

**Roadmap cases:**

| # | Case | Expected |
|---|---|---|
| U1 | 4 usable ads | the line `The roadmap shows from 10 saved ads we could judge. You have 4. Save 6 more to see it.`; no ranking |
| U2 | 9 usable ads, then 10 | 9: the line with "You have 9. Save 1 more to see it."; 10: the roadmap |
| U3 | the four-ad example with the threshold set to 4 in the pure function (test view) | exactly the text of section 4: Already Strong 1; Python unlocks 2 (total 2); Tableau (in progress) unlocks 1 (total 3); no blocked jobs |
| U4 | the same example with the OLD rule (whole job) | not a test of the new code; the table of section 5 is the hand record; a regression test asserts the new output contains no `new:` id |
| U5 | an ad with no requirements; an ad with no must-have we could judge | never in Already Strong and never unlocked; named in the line |
| U6 | an ad with one unjudged must-have, the rest met | Already Strong, and its name carries "(1 must-have not judged)" |
| U7 | the level and the roadmap agree: for every ad classified Already Strong, `profileReport(...).level` is "strong"; for a reachable ad, after adding its missing skills to the profile the report's level is "strong" | the property over the example and a small grid |
| U8 | the person set no language; an ad asks German B2 | the report does not judge it and the roadmap does not block the ad (the `engineView` rule) |
| U9 | a blocked ad (a city out of reach) | listed under Blocked with its conflict sentence (as the CLI does) and not in the ranking |
| U10 | the CLI report and the golden files | unchanged output |
| U11 | building the box | zero store writes, zero `fetch` calls |
| U12 | the page's ranking text for the same inputs | equals the engine's text line by line (the "page agrees with the engine" check) |

**Tests to write first:** tests/gaps.test.ts (G1 to G13 and the DATA of G14a to G14j), tests/heldBackLine.test.ts (the SENTENCE of G14a to G14j), tests/roadmap.test.ts (U1 to U9, U11, U12), tests/engineView.test.ts (the refactor keeps `profileReport` identical: a grid comparing the old construction with `engineView` over the 2,048-input grid of R14), plus a source guard that app/roadmap.ts and app/RoadmapView.tsx contain no save, delete or `fetch` call. Each shown red before code, expectations never changed to fit.

**Deliberate breaks (each must make a named test fail):** the roadmap on the whole job (unlisted counted); the roadmap on the raw profile and job (phantom language conflict, U8); an ad with no requirements counted as Strong; the threshold `>` instead of `>=` (U2); the threshold 9; must and nice counted together; an alternative counted once instead of for each; an unlisted requirement shown in a gap row; a gap row counting an ad twice; the rows sorted by name only; the page sorting the ranking itself instead of using the engine's order (U12); a store write; a `fetch`; a profile of its own instead of the profile in use; the caveat dropped from a job name in the roadmap; `engineView` blanking nothing; the held-back line shown for a closable-only conflict; the held-back line dropped for an unclosable conflict; the held-back count including an excluded ad; the kinds listed in the wrong order or twice; the kinds list including a closable conflict's kind (G14i); the kinds list showing a kind the person never set (G14f); the "so learning the skills above" words shown when no gap row exists (G14h); the noun not singular for one counted ad (G14g).

## 8. Privacy

Nothing leaves the device. No new network call, no new stored field, nothing written. The box reads what 6.2 already reads (the saved ads) and the profile already in the page's memory. The notice next to the save buttons is unchanged and still true.

## 9. Manual-check outline for the owner (invented material only; every step NOT RUN YET)

To be turned into `docs/MANUAL-CHECK-7.1.md` when built. It needs 10 saved ads, so about 11 AI calls (the CV once, ten short invented ads once each). The free tier allows about one large read a minute, so use SHORT invented ads (a few lines each) and allow 10 to 15 minutes. All steps run against the live site or the branch's preview, with the invented CV of docs/MANUAL-CHECK-6.1.md.

1. Save the profile (the invented CV, confirm SQL, Tableau and Excel, set the city `Berlin`). Mark Tableau as "learning" with the date 2027-03-01 on the confirm screen if the screen offers it. **Expect:** saved.
2. Read and save the four ads of section 1 (written out in the check file). **Expect:** four rows in "Saved ads".
3. Look at "What to learn". **Expect:** the gap list of section 1 exactly (Python 2/1, Tableau 1/2 with the learning note, Power BI 1 nice, the "1 requirement ... could not judge" line) and the line "The roadmap shows from 10 saved ads we could judge. You have 4. Save 6 more to see it."
4. Compare with your own hand count of the four ads. **Expect:** the same numbers.
4b. Read and save a fifth short ad: "Python Developer, Example Docks Ltd, Exampleville, hybrid; you write Python" (a city the profile does not list). **Expect:** the Python row becomes must-have in 3 ads, nice-to-have in 1 ad; the line "You have 5" is shown in the roadmap line; and under the gap list the new line: "1 of your 5 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it." Delete that fifth ad again: the line disappears and the counts return to step 3.
5. Read and save six more short ads (given in the check file) one at a time; after each, look at the box. **Expect:** the line counts down ("You have 5 ... 9"); at the tenth ad the roadmap appears and the line is gone; the counts in Part A change with each ad as the check file says.
6. Read the roadmap. **Expect:** the texts the check file lists (Already Strong, the skills in order, blocked jobs), counts only, no percent sign.
7. Delete one ad (back to 9). **Expect:** the roadmap disappears and the line shows "You have 9".
8. Press "Delete this profile" (when the profile in use is the saved one). **Expect:** the box shows the no-profile note instead of both parts.
9. Network tab while the box updates. **Expect:** no request at all (no `/api/`).
10. Console. **Expect:** no red errors of ours.
Log table: ten rows, all NOT RUN YET.

## 10. Branch order, the "Later" idea, and the questions

**Branch order.** 7.1 and 7.2 are built on the branch `step-7.1`, cut from `step-6.2` (5a52739), because the 6.2 merge waits for the owner's hand checks. Everything they use is already on step-6.2: 6.2's shared opened readings (`openedReadings`, `reportFor`), the profile-in-use prop, `splitJudgeable` and `noLevelReason` (lib/engine/judgeable.ts). They edit app/page.tsx and app/fitReport.ts like 6.2 does. `step-7.1` is merged into main AFTER `step-6.2`; a fix made on `step-6.2` is merged into `step-7.1`. No code of 7.1 or 7.2 reaches main before step-6.2 does.

**The "Later" idea stays NOT built.** Treating a closable conflict (one language level, one year of experience) as an unlock candidate would change `classifyJobs` (a closable conflict now blocks, DECISIONS 2026-11-14) and `unlock.ts`; this plan changes neither. A job blocked by a closable conflict is listed under "Blocked jobs" with "it could be closed", as the command-line report does today.

**Questions for the reviewer, each with the proposed answer** (all answered as proposed, 2026-11-17; the one amendment is above)
1. **Gap-list rules.** One row per skill id; each ad counted once per importance; a requirement with alternatives counts for each alternative (one sentence says so); ads blocked by a conflict still count. Proposed: yes (G3, G12).
2. **In progress and no CV line are gaps** (not met), shown with a short note, so the list agrees with the levels (a skill in progress does not meet a must-have). Proposed: yes.
3. **A zero-skills profile.** The levels say "No level (no skills on your profile)"; the gap list and the roadmap still work (every skill is a gap). Proposed: allow both, since they say what to learn; the alternative hides them.
4. **What counts toward the 10.** Saved ads the roadmap can use (a judgeable must-have), not all saved ads; the line says "10 saved ads we could judge". Proposed: yes.
5. **The not-counted line.** One line naming the excluded ads by reason, wording as in section 5. Proposed: yes.
6. **Where on the page.** A "What to learn" box below the "Saved ads" list, no new route. Proposed: yes.
7. **Refactor `profileReport` to use a shared `engineView`** (output unchanged, proved by the existing 2,048-input grid and all report tests) rather than copying the blanking code into the roadmap. Proposed: yes.
8. **Command-line report call sites change, its output and the golden files do not** (section 5). Proposed: yes; any needed edit to a golden file stops the work.
9. **Nice-to-haves** are counted apart in the gap list and play no part in the ranking (as DECISIONS 2026-11-14). Proposed: yes.
10. **The caveat on job names in the roadmap** ("(1 must-have not judged)", the same words as the label). Proposed: yes.
11. **The "Later" idea** (closable conflict as an unlock candidate) stays not built; it gets its own plan. Proposed: yes.
12. **No profile in use.** The same note as 6.2, with the wording adjusted to the box: `What to learn needs a profile in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.` Proposed: yes.
13. **7.3 (the dated timeline)** is not shown by this plan; `unlockTimeline` is not called by the page until 7.3 has its own plan. Proposed: yes.
14. **Live recomputation** while the confirm screen changes, as in 6.2. Proposed: yes; the work is a few `match` calls per ad, by reasoning, not by measurement.
