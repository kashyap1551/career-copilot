STATUS: APPROVED 2026-11-17 with three amendments (see "Amendments" below). Built on the branch step-fit-levels, not merged. Careful lane (it changes what level a person is shown). The four changes are decided by the owner (a to d below); this plan only works out how, with hand-worked cases and wording. Nothing is built. All data below is invented.

# Plan: four changes to what the fit report prints

Sources: docs/FIT-LEVEL-FACTS.md (file:line references below are the ones listed there, checked again on main at commit cc1ca3b), HANDOFF open items 12, 15, 17 and the empty-skills observation O-4 (manual check 2026-11-16 and 2026-11-17), docs/DECISIONS.md 2026-11-14.

The four changes (decided; not reopened here):
- **(a) Unlisted requirements (HANDOFF 12, option c):** the level is decided only from requirements in our skill list. An unlisted must-have no longer counts as a missing must-have. It gets its own "could not judge" row, and the sentence says "plus N must-haves we could not judge". If every must-have is unlisted, no level is printed.
- **(b) Named reason (HANDOFF 17):** when a conflict that can't be closed soon sets the level, the explanation names it ("Long shot because of location: ..."). The rule itself stays as it is.
- **(c) Satisfied constraint (HANDOFF 15):** each constraint that was judged and is fine gets one short line.
- **(d) Empty skills (O-4):** zero skills on the profile or on the typed list means no level, and one sentence says to add skills first. Both paths (`profileReport` and `skillsOnlyReport`).

## Amendments (reviewer, 2026-11-17; they override the text below where they differ)

1. **The label carries the caveat.** HANDOFF 12 option (c) puts "plus N we could not judge" beside the label. Whenever 1 or more must-haves could not be judged, the label ends with `; N must-have(s) not judged` INSIDE the brackets: "Strong (skills only; 1 must-have not judged)", "Strong (judged: skills, location; 2 must-haves not judged)". This is IN ADDITION to the sentence (W1), the row (W2) and the counts line (W4), and applies to every level (Strong, Good, Stretch, Long shot). Unjudged nice-to-haves do not go in the label. A "No level" label does not carry it (there is no level to qualify; its own wording already says no must-have could be judged). Wording W9 below. Re-worked: cases 7, A1, A2, A5, A6 (the only cases with an unjudged must-have and a level); A3, A3b, A4, A7, A8 and every other case keep their labels.
2. **W8 language line** becomes `Language: fine. The ad asks for German at B2; your profile has C1.` Several languages: one line, each part in that form (case C1 and C4 re-worked below).
3. **The count of new cases** is A1 to A8 plus A3b (9), B1 to B5 (5), C1 to C7 (7), D1 to D5 (5): 26 in all.

Not touched by this plan: the reader (AI) and its hashes (ad 85357f8fac, CV 193e02ee3f, vocabulary e96370fe4c, READING_VERSION "3"), `lib/engine/fit.ts`, `lib/engine/match.ts`, `lib/engine/unlock.ts`, `lib/engine/explain.ts`, `lib/engine/report-text.ts` (the command-line report), the golden files.

## 1. Where each change goes, what it touches, who calls it

**Smallest-change decision (proposed; reviewer decides).** None of the four needs `fit.ts` or `match.ts` to change. They all work by changing what is handed to `match()` and what the report layer prints:
- (a) hands `match()` a job without its unlisted requirements (the report layer already hands `match()` a modified job copy, `engineJob`, app/fitReport.ts:85-92 and `skillsOnlyJob`, app/skillsOnly.ts:93-105, so this follows an existing pattern). `fitLevel` then sees only judgeable must-haves, with no change to its rules (fit.ts:22-45).
- (b), (c) and (d) are report text built from fields `match()` already returns (`decidedBy`, `conflicts`) and from the profile.

**One new pure file, `lib/engine/judgeable.ts` (proposed; reviewer decides).** The rule "a requirement is judgeable unless all of its skill ids are unlisted (`new:...`)" and the two "no level" rules are level rules, and CLAUDE.md rule 1 says levels come only from `lib/engine`. They would live there, as three small pure functions, instead of inside `app/`:
- `splitJudgeable(job): { judged: Job; couldNotJudge: Requirement[] }`: the same test that fitReport.ts:119 and skillsOnly.ts:88, 168 already use (`every id starts with "new:"`), so a requirement with at least one listed alternative stays judged (existing test S9).
- `noLevelReason(input): "no-must-have-judgeable" | "no-skills" | null`.
- Nothing in `fit.ts`, `match.ts` or `unlock.ts` imports it.

| Change | File:line to change (FIT-LEVEL-FACTS numbering) | Touches lib/engine? | Callers affected |
|---|---|---|---|
| (a) | app/fitReport.ts:85-100 (engine job), 109-137 (rows), 172-176 (counts sentence), 188-199 (return: counts, `unlistedRequirements`, new `couldNotJudge`); app/skillsOnly.ts:93-105 (job), 128-134 (`countsSentence`), 136-138, 158-176 (rows), 179-189; app/ReportView.tsx:38-53, 78 (amber note, "Not met" label for unlisted) | new file only (`judgeable.ts`) | `profileReport`: app/page.tsx:140, tests/profileReport.test.ts, tests/saved.test.ts:166 (S2b-report compares two reports of the same input: unaffected). `skillsOnlyReport`: app/page.tsx:145, tests/skillsOnly.test.ts. `countsSentence`: fitReport.ts:173, skillsOnly.ts:137. `ReportView`: app/page.tsx:258 |
| (b) | app/fitReport.ts:174-186 (explanation): a lead sentence when `result.decidedBy` starts with `unclosable-conflict:` (the same condition as fit.ts:26-32; the conflict named is `result.conflicts.find(c => !c.closable)`, the one `fitLevel` names) | no | `profileReport` callers as above. `skillsOnlyReport` never has conflicts (skillsOnly.ts:93-105 blanks every constraint), so it is not affected |
| (c) | app/fitReport.ts:13-24 (new field `satisfied: string[]`), after line 143 (build the lines); app/ReportView.tsx:9-18 (optional `satisfied?: string[]`), after 55-64 (list "Checked and fine:") | no | `profileReport` callers; `ReportView` (page.tsx:258). The typed-list report has no `satisfied` (nothing is judged there) |
| (d) | app/fitReport.ts:188-190 (label) and the explanation; app/skillsOnly.ts:179-189 (label), 136-138 (explanation) | `judgeable.ts` (`noLevelReason`) | both report functions and their callers as above |

**Roadmap and "unlocked" counts (DECISIONS 2026-11-14, "a job counts as unlocked only if it becomes Strong by gaining skills").** Checked in the code:
- The only callers of `classifyJobs`, `rankMissingSkills`, `unlockTimeline` and `jobsBroughtCloser` today are `lib/engine/report-text.ts:103-130` (the command-line report, scripts/report.ts) and tests (tests/unlock.test.ts, tests/report.test.ts, tests/explain.test.ts, tests/golden/*). All use fixture jobs whose skills are all listed. The web page does not call them yet (the roadmap is step 7.1 to 7.2).
- Because this plan leaves `match()` and `unlock.ts` alone, **no existing unlock count, ranking or golden file changes.**
- What it does not settle (a fact, not a fix): `classifyJobs` (unlock.ts:42-63) calls `match(profile, job)` on the job as saved. A saved job with an unlisted must-have is, there, "not Strong, one must-have missing that no skill can cover", so it is never counted as unlocked; the report, after (a), would call the same job "Strong ... plus 1 must-have we could not judge". When step 7 is built it has to choose: pass `splitJudgeable(job).judged` to the roadmap (the job then counts as Strong or unlockable on its judgeable must-haves, as the report says), or keep passing the whole job (the roadmap stays stricter than the report). A job with no judgeable must-have must in either case not be counted as Strong (it would otherwise look like "no must-haves, Strong", fit.ts:44). Question Q1 below.

## 2. The exact wording (plain words)

W1. **Counts sentence (a).** The existing sentence, with this tail before the full stop when N must-haves could not be judged (N at least 1): `, plus 1 must-have we could not judge` or `, plus N must-haves we could not judge`.
- "You meet all 2 must-haves on your profile, plus 1 must-have we could not judge."
- "You meet the only must-have on your profile, plus 2 must-haves we could not judge."
- "One must-have is missing: Tableau, plus 1 must-have we could not judge."
- "2 of 3 must-haves are missing: SQL, Excel, plus 1 must-have we could not judge." (the list path says "on your list" where the profile path says "on your profile", as today)
- With no unlisted must-haves the sentence is exactly today's.

W2. **A could-not-judge row (a).** Shown in the must-haves or nice-to-haves group where the requirement stands in the ad. Label: **"Could not judge"** (it was "Not met", ReportView.tsx:78). Detail: `{name}: not in our skill list yet, so we could not judge it.` (it was "...so it can't be matched with your CV"). The row's `status` value stays `"unlisted"` inside the code.

W3. **The amber note under the explanation (a)**, replacing "N of M requirements are not in our skill list yet, so they count as not met." (ReportView.tsx:47-53): `1 requirement is not in our skill list yet, so we could not judge it. It is not counted in the level or in the counts below.` / `N requirements are not in our skill list yet, so we could not judge them. They are not counted in the level or in the counts below.` N counts must-haves and nice-to-haves together.

W4. **The counts line (a)** keeps "Must-haves met: X of Y. Nice-to-haves met: X of Y." where Y no longer includes could-not-judge requirements, and adds, only when there are any: ` Could not judge: 1 must-have, 0 nice-to-haves.` (singular and plural as in "1 must-have", "2 must-haves", "1 nice-to-have", "2 nice-to-haves").

W5. **No judgeable must-have (a, the edge case).** Label: `No level (no must-have we could judge)`. Explanation: `No level can be shown: the ad's only must-have is not in our skill list yet, so it could not be judged.` for one, `No level can be shown: none of the ad's N must-haves is in our skill list yet, so none could be judged.` for two or more. Rows, conflicts and "not judged" lines are still printed.

W6. **No skills (d).** Profile path: label `No level (no skills on your profile)`, explanation starts `No level yet: there are no skills on your profile. Add skills first.` followed by the usual explanation text. List path: label `No level (no skills on your list)`, explanation starts `No level yet: your list has no skills we can match. Add skills first.` followed by the usual explanation text. (No sentence contains "conflict" or "stands in the way": test S14 and R12 stay true.)

W7. **Named reason (b).** Only when the level is Long shot because of a conflict that can't be closed soon: the explanation starts with `Long shot because of {kind}: {the conflict's own sentence} That can't be closed soon.` and then the usual explanation. `{kind}` is one of: location, language, work mode, years, start date (the words of KIND_WORDS). The conflict's own sentence is `Conflict.message` unchanged (for example "The job is in Exampleville; the cities on your profile are: Berlin."). If two conflicts can't be closed, only the first (the one `fitLevel` names, fit.ts:26) is named; both stay in the conflict list. Long shot from three or more gaps gets no such sentence.

W8. **Satisfied lines (c).** A list headed `Checked and fine:` (under the conflicts, above the must-haves), in the order location, language, work mode, years, start date; one line per kind that was judged (set by the person AND stated by the ad, fitReport.ts:43-57, 102) and has no conflict:
- `Location: fine. The job is in Berlin, and Berlin is on your profile.`
- `Language: fine. The ad asks for German at B2; your profile has C1.` (several languages: one line, each part in that form, separated by a space; only languages whose level the ad gave and that have no conflict)
- `Work mode: fine. The job is hybrid, and your profile accepts hybrid.`
- `Years: fine. The ad asks for 2 years; your profile has 3.` (singular: "1 year")
- `Start date: fine. The ad wants a start by 2026-12-01; you are available from 2026-11-15.`
A kind with any conflict gets no "fine" line. A language with no level in the ad is not compared (match.ts:134-139) and gets no "fine" line; the existing "not judged" line stays.

W9. **The label caveat (amendment 1).** The label inside the brackets gets `; 1 must-have not judged` or `; N must-haves not judged` (N at least 2) at the end, whenever the number of unjudged must-haves is at least 1. "Strong (skills only; 1 must-have not judged)"; "Good (skills only; 2 must-haves not judged)"; "Long shot (judged: skills, location; 1 must-have not judged)". With nothing unjudged the label is exactly today's. The typed-list path says "(skills only; 1 must-have not judged)" the same way.

## 3. Hand-worked cases (expected text written BEFORE any code)

Same invented material as docs/FIT-LEVEL-FACTS.md: CV lines 1 "Alex Example, Reporting Analyst, Exampleville", 2 "Wrote SQL queries to reconcile order data", 3 "Built monthly dashboards in Tableau", 4 "Kept the weekly sales sheet in Excel". Ad "Reporting Analyst, Northlake Foods Ltd": musts SQL and Tableau, nice Excel unless stated. "Nothing set" means the person set no constraint. TAIL = "Location, language, work mode, years and start date are not judged here." Expectations are written from the wording above and the rules in section 1, not from running the code.

### 3a. Regression set: the 11 rows of FIT-LEVEL-FACTS Part 2 (which change, which must not)

| Case | Input | After the change: label; explanation | Changes? |
|---|---|---|---|
| 1 | all met, nothing set | Strong (skills only); "You meet all 2 must-haves on your profile. TAIL" | must NOT change |
| 2 | all met; ad Exampleville, hybrid; profile city Berlin | Long shot (judged: skills, location); "Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon. You meet all 2 must-haves on your profile. 1 conflict was found in what you set (listed below). Not judged here: language, work mode, years, start date." No "fine" line | CHANGES (explanation only; label and counts the same) |
| 3 | all met; ad 3 years, profile 2 | Stretch (judged: skills, years); "You meet all 2 must-haves on your profile. 1 conflict was found in what you set (listed below). Not judged here: location, language, work mode, start date." No "fine" line (years has a conflict) | must NOT change |
| 4 | all met; ad German B2, profile German B1 | Stretch (judged: skills, language); explanation as today ("...1 conflict was found...Not judged here: location, work mode, years, start date."); no "fine" line | must NOT change |
| 5 | profile with no skills; two must-haves | No level (no skills on your profile); "No level yet: there are no skills on your profile. Add skills first. 2 of 2 must-haves are missing: SQL, Tableau. TAIL" Counts musts 0 of 2, nices 0 of 1; rows "Missing" as today | CHANGES (was Stretch) |
| 5b | the same on the typed-list path (empty list) | No level (no skills on your list); "No level yet: your list has no skills we can match. Add skills first. 2 of 2 must-haves are missing: SQL, Tableau. TAIL" | CHANGES (was Stretch) |
| 6 | Tableau missing, nothing set | Good (skills only); "One must-have is missing: Tableau. TAIL" | must NOT change |
| 7 | musts SQL, Tableau, plus one unlisted must; nice Excel; nothing set | Strong (skills only; 1 must-have not judged); "You meet all 2 must-haves on your profile, plus 1 must-have we could not judge. TAIL"; counts musts 2 of 2 (was 2 of 3), nices 1 of 1; the unlisted row says "Could not judge" and "...so we could not judge it." | CHANGES (was Good; the one case where the level moves) |
| 8 | only the nice-to-have missing | Strong (skills only); "You meet all 2 must-haves on your profile. TAIL" | must NOT change |
| 9 | location set and matching (Berlin, hybrid) | Strong (judged: skills, location); explanation as today ("You meet all 2 must-haves on your profile. No conflict was found in what you set. Not judged here: language, work mode, years, start date."); **Checked and fine:** "Location: fine. The job is in Berlin, and Berlin is on your profile." | CHANGES (adds the "fine" line only) |
| 9b | Tableau in progress (2027-03-01), SQL a have skill | Good (skills only); "One must-have is missing: Tableau. TAIL"; row "Tableau: in progress, expected 2027-03-01" | must NOT change |

### 3b. New cases per change (26 new cases: A1 to A8 plus A3b, B1 to B5, C1 to C7, D1 to D5)

**(a) unlisted requirements**

| Case | Input | Expected |
|---|---|---|
| A1 | SQL met, Tableau met, plus two unlisted musts; nothing set | Strong (skills only; 2 must-haves not judged); "You meet all 2 must-haves on your profile, plus 2 must-haves we could not judge. TAIL"; counts 2 of 2; "Could not judge: 2 must-haves, 0 nice-to-haves."; two "Could not judge" rows |
| A2 | SQL met, Tableau not on profile, plus one unlisted must | Good (skills only; 1 must-have not judged); "One must-have is missing: Tableau, plus 1 must-have we could not judge. TAIL" |
| A3 | edge: both musts unlisted; the profile has all three skills | No level (no must-have we could judge); "No level can be shown: none of the ad's 2 must-haves is in our skill list yet, so none could be judged."; counts musts 0 of 0; two "Could not judge" rows; the nice-to-have Excel (listed, met) still shows Met |
| A3b | edge with one must-have, unlisted | No level (no must-have we could judge); "No level can be shown: the ad's only must-have is not in our skill list yet, so it could not be judged." |
| A4 | musts SQL, Tableau met; the only nice-to-have is unlisted | Strong (skills only); "You meet all 2 must-haves on your profile. TAIL"; nices 0 of 0; "Could not judge: 0 must-haves, 1 nice-to-have."; amber note "1 requirement is not in our skill list yet, so we could not judge it. It is not counted in the level or in the counts below." |
| A5 | SQL met, one unlisted must; ad Exampleville hybrid; profile city Berlin | Long shot (judged: skills, location; 1 must-have not judged); lead sentence W7, then "You meet the only must-have on your profile, plus 1 must-have we could not judge. 1 conflict was found in what you set (listed below). Not judged here: language, work mode, years, start date." |
| A6 | typed-list path: list "SQL"; ad: SQL must, one unlisted must | Strong (skills only; 1 must-have not judged); "You meet the only must-have on your list, plus 1 must-have we could not judge. TAIL" |
| A7 | the ad has no must-haves at all (nice Excel only), skills present | Strong (skills only); "The ad lists no must-haves. TAIL" (unchanged: zero must-haves is not the same as "none could be judged") |
| A8 | a requirement with one listed and one unlisted alternative ("Power BI or Looker"), nothing on the profile | missing, not "could not judge" (existing test S9 stays true) |

**(b) named reason**

| Case | Input | Expected |
|---|---|---|
| B1 | all musts met; ad German B2; profile lists English C1 only | Long shot (judged: skills, language); "Long shot because of language: The ad asks for German at B2; your profile does not list German. That can't be closed soon. You meet all 2 must-haves on your profile. 1 conflict was found in what you set (listed below). Not judged here: location, work mode, years, start date." |
| B2 | all musts met; two unclosable conflicts: ad Exampleville, on-site; profile city Berlin, work mode remote only | Long shot (judged: skills, location, work mode); the lead names location only (the first, fit.ts:26), then "...2 conflicts were found in what you set (listed below)." Both conflicts are listed. |
| B3 | one closable conflict only (case 4) | no lead sentence (Stretch) |
| B4 | three gaps, no unclosable one: SQL and Tableau missing, ad 3 years, profile 2 | Long shot (judged: skills, years) by three gaps; NO lead sentence; "2 of 2 must-haves are missing: SQL, Tableau. 1 conflict was found in what you set (listed below). Not judged here: location, language, work mode, start date." |
| B5 | unclosable conflict and zero skills on the profile | No level (no skills on your profile): no "Long shot because of" sentence (there is no level to explain); the conflict is still listed |

**(c) satisfied constraints**

| Case | Input | Expected |
|---|---|---|
| C1 | all five kinds set, stated and fine: ad Berlin, hybrid, German B2, 2 years, start 2026-12-01; profile Berlin, hybrid, German C1, 3 years, available 2026-11-15; all musts met | Strong (judged: skills, location, language, work mode, years, start date); "You meet all 2 must-haves on your profile. No conflict was found in what you set."; five lines in this order: "Location: fine. The job is in Berlin, and Berlin is on your profile." / "Language: fine. The ad asks for German at B2; your profile has C1." / "Work mode: fine. The job is hybrid, and your profile accepts hybrid." / "Years: fine. The ad asks for 2 years; your profile has 3." / "Start date: fine. The ad wants a start by 2026-12-01; you are available from 2026-11-15." |
| C2 | location fine, years conflict (case 3 plus Berlin matching) | only the location line; the years conflict is listed as today |
| C3 | the ad names German without a level; profile has German | no language "fine" line; the existing line "Language: The ad names German but no level, so your level was not compared." stays |
| C4 | two languages in the ad, both fine | ONE language line: "Language: fine. The ad asks for German at B2; your profile has C1. The ad asks for English at C1; your profile has C1." |
| C5 | a kind set by the person but not stated by the ad (existing R13) | not judged, no "fine" line |
| C6 | two languages, one closable conflict, one fine | no language "fine" line (the kind has a conflict) |
| C7 | typed-list path, any ad | no "fine" lines (nothing is judged there) |

**(d) empty skills**

| Case | Input | Expected |
|---|---|---|
| D1 | profile with no skills; ad with no must-haves | No level (no skills on your profile); the sentence W6 |
| D2 | the profile's only skill is one in progress | has a skill, so a level is printed: ad musts SQL, Tableau, SQL in progress, Tableau absent: Stretch (skills only) (2 gaps) |
| D3 | the profile's only skill is a listed skill added by hand with no CV line | has a skill, so a level is printed (Stretch with two musts); its row says "added by hand with no CV line, so it does not count..." (uncertain, question Q4) |
| D4 | no skills AND every must-have unlisted | No level (no must-have we could judge): the (a) sentence W5 wins (adding skills would not help) (question Q3) |
| D5 | typed list whose lines are all unlisted skills; the ad has listed must-haves | No level (no skills on your list); the existing "On your list, not in our skill list yet:" block (app/page.tsx:264-279) still shows |

## 4. Existing tests that would change (each re-worked by hand, never edited to fit the code)

Checked every test that calls `profileReport`, `skillsOnlyReport`, `countsSentence` or reads the report text. Four change; all others must pass unchanged and are listed so that is checked.

| Test | Today | After (worked by hand) |
|---|---|---|
| tests/profileReport.test.ts R3 (lines 65-72): Berlin and hybrid for a hybrid Manchester job | explanation "One must-have is missing: Communication. 1 conflict was found...Not judged here: language, years, start date." | explanation starts with the W7 lead: "Long shot because of location: The job is in Manchester; the cities on your profile are: Berlin. That can't be closed soon. One must-have is missing: Communication. 1 conflict was found in what you set (listed below). Not judged here: language, years, start date." Label and conflicts unchanged. (New field `satisfied` = ["Work mode: fine. The job is hybrid, and your profile accepts hybrid."]) |
| tests/profileReport.test.ts R10 (lines 130-136): one unlisted must-have, "counted" | row status "unlisted", detail "...so it can't be matched with your CV", `unlistedRequirements` 1 | row status still "unlisted"; detail "Welding: not in our skill list yet, so we could not judge it."; `unlistedRequirements` 1; the ONLY must-have is unlisted, so the label is "No level (no must-have we could judge)" and counts are 0 of 0 (the test's title changes from "counted" to "not counted") |
| tests/skillsOnly.test.ts S5 (lines 74-82): an empty list, "3 musts missing is Long shot" | label "Long shot (skills only)"; explanation "3 of 3 must-haves are missing: SQL, Excel, Communication. TAIL" | label "No level (no skills on your list)"; explanation "No level yet: your list has no skills we can match. Add skills first. 3 of 3 must-haves are missing: SQL, Excel, Communication. TAIL"; counts.mustsMet 0 and all rows "missing" stay (the title changes) |
| tests/skillsOnly.test.ts S8 (lines 96-116): all-unlisted must-have "is not met" | row detail "...so it can't be matched with your CV"; explanation "One must-have is missing: Welding. TAIL"; mustsMet 0; label "Good (skills only)" | row status "unlisted", detail "Welding: not in our skill list yet, so we could not judge it."; label "No level (no must-have we could judge)" (the list "Welding" is also an empty list, and the (a) rule wins, D4); explanation "No level can be shown: the ad's only must-have is not in our skill list yet, so it could not be judged."; counts mustsTotal 0; `unlistedRequirements` 1 (the title changes) |

Must pass unchanged (re-checked by hand against sections 1 and 2): profileReport R1, R2, R4, R4b, R5, R6, R7, R8, R9, R11, R12 (no "stands in the way" and no "%" in the new sentences), R13a to R13c, G1 (the 2,048-input grid; it asserts conflicts are of judged kinds, which the new lines do not touch; its profile has skills, so (d) never fires); skillsOnly S1 to S4, S6, S7, S9 (a requirement with a listed alternative is not "could not judge"), S10 to S14 (S14's list "" now also prints the W6 sentence, which has no "conflict" and no "stands in the way"); tests/saved.test.ts S2b-report; tests/traits.test.ts and tests/wireStage2.test.ts (they read the reader, not the report); every engine and CLI test (fit, match, unlock, explain, report, golden), because `lib/engine` files other than the new one are not edited.

New tests to write first from section 3 (a new file, `tests/fitLevelReport.test.ts`, one test per case id above, plus a grid test for (c): for every kind in the existing 2,048-input grid, `satisfied` lists exactly the judged kinds without a conflict, in KINDS order), and unit tests for `splitJudgeable` and `noLevelReason` in `tests/judgeable.test.ts`. Deliberate breaks to run when built, each must make a named test fail: unlisted must counted again in the level; "could not judge" requirement dropped without its row; all-unlisted case still printing a level; lead printed for a closable conflict; lead printed for three-or-more gaps; lead naming the second unclosable conflict; a "fine" line for a kind with a conflict; a "fine" line for a language without a level; a "fine" line on the typed-list path; the label caveat dropped ("; N must-have(s) not judged" missing from the label, or added for an unjudged nice-to-have, or added to a No level label); zero skills still printing a level on either path; one in-progress skill wrongly counting as zero skills; `splitJudgeable` treating a requirement with one listed alternative as unlisted.

## 5. Proposed changes to docs/SPRINT.md "Fit levels" (text only; SPRINT.md is NOT edited yet)

Today's four bullets, with the differences D1 to D10 of docs/FIT-LEVEL-FACTS.md. Proposed replacement text (to match the code after this plan is built):

- **Strong:** every must-have we can judge is met, and there is no conflict (not even one that could be closed). *(D6: "no hard conflict" becomes "no conflict"; D8 and D10: "we can judge"; an ad with no must-haves is Strong.)*
- **Good:** exactly one must-have is missing, and there is no conflict. *(D1: "or partly met" removed; the code has no "partly met".)*
- **Stretch:** two gaps. A gap is a missing must-have or a conflict that could be closed soon; one such conflict alone is also Stretch. *(D2: the combination rule of DECISIONS 2026-11-14, made visible.)*
- **Long shot:** three or more gaps, or any conflict that can't be closed soon. *(D3: not only "an on-site job in a city out of reach": a hybrid job in a city out of reach too; D4: a work mode the profile does not accept.)*

Then one new list of notes under them:
- A conflict can be closed soon if: a language is one level short (a language missing from the profile can't); total years are one year short; the start is up to 30 days late. A city that is not on the profile, and a work mode the profile does not accept, can't be closed soon; a hybrid job counts as on-site for the city. *(D3, D4, D5: the numbers are in lib/engine/rules.ts and DECISIONS 2026-11-14.)*
- Nice-to-haves are shown and counted but never change the level. *(D7)*
- A must-have that is not in our skill list yet is shown as "could not judge" and is not counted; if none of the ad's must-haves can be judged, or the profile or list has no skills, no level is shown. *(D8, new rules (a) and (d))*
- The report says "(skills only)" when no constraint was both set by the person and stated by the ad, and "(judged: skills, ...)" otherwise. *(D9)*
- When a conflict that can't be closed soon sets the level, the report names it; each constraint that was judged and is fine gets one line. *(rules (b) and (c))*

## 6. Docs to update when it is built (not now)

DECISIONS: one line superseding the 2026-11-14 line "Requirements with only unlisted skills count as not met" and the PLAN-3.1 stop-gap; one line each for (b), (c), (d) and the no-level labels. HANDOFF: items 12, 15, 17 and O-4 closed with the commit; item 16 is not part of this plan (the code reading and the owner's observation disagree, FIT-LEVEL-FACTS Part 3). SPRINT: the "Fit levels" text of section 5, once the reviewer agrees. A manual-check step for the live site (an invented ad with an unlisted requirement; an empty typed list).

## 7. Questions for the reviewer (each with a proposed answer)

1. **Roadmap and "unlocked" (section 1).** Step 7 will have to choose between passing it the judgeable job (the roadmap then agrees with the report: a job with an unjudgeable must-have can be Strong or unlockable on the rest) and the whole job (stricter than the report). Proposed: decide when 7.1 is planned; this plan changes no roadmap code, and a job with no judgeable must-have is never counted as Strong.
2. **New file `lib/engine/judgeable.ts`** rather than the logic inside `app/fitReport.ts`. Proposed: yes (rule 1: level rules live in lib/engine).
3. **No judgeable must-have wins over no skills (D4).** Proposed: yes, because adding skills would not fix it.
4. **"Zero skills" means zero entries on the profile or list (D2, D3).** A profile whose only skill is in progress, or a listed skill added by hand with no CV line, has an entry, so a level is printed (every must-have then shows as missing, with the reason). Proposed: yes; the alternative, "no skill that could count as met", would also need a rule for in-progress-only profiles.
5. **(c) wording and the per-kind rule.** One line per kind; a kind with any conflict gets no "fine" line; several languages share one line; a language without a level gets none. Proposed: as in W8.
6. **(b) names only the first unclosable conflict** and repeats the conflict's own sentence (it is also listed below). Proposed: yes; the repetition is the point of the change.
7. **Nice-to-haves that are unlisted** are also taken out of the nice-to-have count and shown as "could not judge" (the owner's wording named must-haves). Proposed: yes, the same rule for both, so the counts never include something that was not judged.
8. **The no-level labels** ("No level (no skills on your profile)", "No level (no skills on your list)", "No level (no must-have we could judge)") are the same strings step 6.2's list screen will show next to a saved ad. Proposed: yes; 6.2 must use these functions, not its own label.
9. **Level moves in one existing case (7: Good becomes Strong).** A must-have we could not judge no longer holds the level down, and the sentence says so. Proposed: yes; this is what option (c) means.
