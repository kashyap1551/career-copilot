# Fit-level facts (for the fit-level conversation)

Facts only: what the rules say, what the code does, where they differ, and nine invented cases with the expectation worked by hand from the written rules BEFORE the code was run. No recommendation and no proposed change: the reviewer and the owner decide. Written 2026-11-17 on main (app code unchanged). All data below is invented; no real ad, CV or answer key was read.

## Part 1: what the rules are

### 1a. The written rules (docs/SPRINT.md, "Fit levels (first version; tune them as real ads come in)", in order)

1. **Strong:** every must-have met, and no hard conflict.
2. **Good:** one must-have missing or partly met, and no hard conflict.
3. **Stretch:** two must-haves missing, or one conflict that can be closed, such as a language one level short.
4. **Long shot:** three or more must-haves missing, or a conflict that can't be closed soon, such as an on-site job in a city out of reach.

### 1b. What the code does, in the order it checks

The fit level is decided by `fitLevel` (lib/engine/fit.ts:22-45), called from `match` (lib/engine/match.ts:275-309, the call at 287-290). The page builds the report for a confirmed profile in `profileReport` (app/fitReport.ts:78-200) and, with no profile, for a typed list in `skillsOnlyReport` (app/skillsOnly.ts:142-190); the page chooses between them at app/page.tsx:134-147.

Requirements (match.ts:276-278 and 286):
1. A requirement is **met** only if the profile has a `have` skill with the wanted id, with a cited CV line, and the cited line exists and says exactly the cited text (match.ts:61-82, 57-59). Any one of the requirement's alternative ids is enough (65-66).
2. **Not met, in progress:** a skill the person is learning does not count; the report shows its expected date (match.ts:86-98; app/fitReport.ts:126-128).
3. **Not met, no CV line:** a `have` skill added by hand without a CV line does not count (match.ts:99-107; fitReport.ts:129-135).
4. **Not met, not on the profile** (match.ts:106; fitReport.ts:136).
5. **Unlisted** (the requirement's ids all start with `new:`): never matches a profile skill, so it is not met (match.ts:65-82); the report shows the row as "Not met" with "not in our skill list yet" (fitReport.ts:119-125; app/ReportView.tsx:47-53, 78); it is counted as a missing must-have if it is a must-have (match.ts:286-290).
6. **Must-haves vs nice-to-haves:** both are checked and counted (match.ts:277-278, 299-304), but only the number of missing must-haves goes into the level (fit.ts:13, 22-25, 35).

Constraints (each makes zero or one conflict; all four checks at match.ts:281-284):
7. **Language** (match.ts:115-155): the ad names a language and the profile does not list it: conflict, can't be closed soon (122-132). The ad gives no level: not judged (134-139). The profile's level is below the ad's: conflict; closable if at most 1 level short (`LANGUAGE_CLOSABLE_LEVELS` = 1, lib/engine/rules.ts:6; match.ts:141-152).
8. **Years** (match.ts:157-185): ad or profile has no number: not judged (160-173). The profile's total years are below the ad's: conflict; closable if at most 1 year short (`YEARS_CLOSABLE_SHORTFALL` = 1, rules.ts:9; match.ts:174-184).
9. **Work mode and location** (match.ts:190-232): the ad gives no work mode: work mode not judged, and the city is not checked (192-198). For on-site and hybrid ("Hybrid counts as on-site", 200) the ad's city is compared with the profile's cities, ignoring case: a city not on the profile is a conflict, never closable (201-217). A remote job needs no city (201). A work mode the profile does not accept is a conflict, never closable (220-231).
10. **Start date** (match.ts:234-271): not judged if either date is missing or unreadable (237-259). The person available later than the ad's date: conflict; closable if at most 30 days late (`START_DATE_CLOSABLE_DAYS` = 30, rules.ts:12; match.ts:260-269).

The level (fit.ts:22-45):
11. **Any conflict that can't be closed soon: Long shot**, checked first, whatever else is true (fit.ts:26-32; types.ts:120-123).
12. Otherwise gaps = missing must-haves + number of conflicts (all remaining ones are closable) (fit.ts:34-35). 3 or more gaps: Long shot (37). 2 gaps: Stretch (38). 1 gap: a missing must-have gives Good; a closable conflict gives Stretch (39-43). 0 gaps: Strong (44).

The label (what the report prints):
13. **"(skills only)"** is printed when no constraint kind was both set by the person and stated by the ad (app/fitReport.ts:102, 189; the kind rules at 43-57); the constraints the person did not set are hidden from the engine (85-99). Otherwise the label is "(judged: skills, <kinds>)" (189). The typed-list report always says "(skills only)" and blanks every constraint (app/skillsOnly.ts:93-105, 179).
14. **"can't be closed soon"** is only the prefix of a conflict line: `(can't be closed soon)` when the conflict is not closable, `(could be closed)` otherwise (lib/engine/explain.ts:172-174). Closable is decided per kind as in items 7 to 10.

### 1c. Differences (the SPRINT.md text and the code; quoted, no judgement)

| # | SPRINT.md says | The code does |
|---|---|---|
| D1 | Good: "one must-have missing or partly met" | There is no "partly met": a requirement is met or not met (match.ts:73-80, 91-107); in-progress and no-CV-line are "not met" |
| D2 | Stretch: "two must-haves missing, or one conflict that can be closed"; Long shot: "three or more must-haves missing" (the text is silent on mixtures) | gaps = missing must-haves + closable conflicts (fit.ts:6, 34-35): one missing must-have plus one closable conflict is 2 gaps, Stretch; two missing plus one closable conflict is 3 gaps, Long shot (also in docs/DECISIONS.md, 2026-11-14) |
| D3 | Long shot: "a conflict that can't be closed soon, such as an on-site job in a city out of reach" (silent on hybrid) | A city that is not on the profile is unclosable for on-site and hybrid alike (match.ts:200-217) |
| D4 | silent on work mode as a constraint | A work mode the profile does not accept is always unclosable (match.ts:220-231) |
| D5 | "such as a language one level short" is closable (silent on other thresholds) | Language: at most 1 level; a language missing from the profile is unclosable (match.ts:122-132, 146). Years: at most 1 year short (rules.ts:9). Start date: at most 30 days late (rules.ts:12). The numbers are in docs/DECISIONS.md 2026-11-14, not in SPRINT.md |
| D6 | Strong and Good: "no hard conflict" ("hard" is not defined) | Any conflict at all, closable or not, stops Strong and Good: one closable conflict alone is Stretch (fit.ts:39-43) |
| D7 | silent on nice-to-haves | They never enter the level (fit.ts:13) |
| D8 | silent on requirements that are not in the skill list | They count as not met, and as a missing must-have if they are must-haves (match.ts:65-82, 286-290; docs/DECISIONS.md 2026-11-14) |
| D9 | silent on "(skills only)" and "(judged: ...)" | Label rules at app/fitReport.ts:102, 189 (item 13 above) |
| D10 | "every must-have met" (silent on an ad with no must-haves) | An ad with zero must-haves and no conflicts is Strong (0 gaps, fit.ts:44); the sentence shown is "The ad lists no must-haves." (app/skillsOnly.ts:129) |

## Part 2: nine invented cases

Method. The invented CV (4 lines): 1 "Alex Example, Reporting Analyst, Exampleville"; 2 "Wrote SQL queries to reconcile order data"; 3 "Built monthly dashboards in Tableau"; 4 "Kept the weekly sales sheet in Excel". The invented ad is "Reporting Analyst, Northlake Foods Ltd"; its requirements and constraints are in each row. Skills from the vocabulary: SQL, Tableau, Excel (CV lines 2, 3, 4). The "expected (hand)" column was written from the four rules in 1a ONLY, before the code was run, and has not been changed since. The "got (code)" column is the label returned by `profileReport` (app/fitReport.ts) for the same input, through `buildProfile` (lib/cv/profile.ts) as the page does. Counts only; no percentages.

Hand-work notes where the written rules need a reading (stated before running):
- Cases 2 and 9 use a hybrid job. The SPRINT text names "an on-site job in a city out of reach" and is silent on hybrid; the hand reading for case 2 is that a hybrid job in a city out of reach is the same kind of conflict (Long shot).
- Case 3: the SPRINT text does not say how many years short can be closed; the hand reading is that one year short is the mildest shortfall and can be closed ("one conflict that can be closed" gives Stretch).
- Case 4: the SPRINT text's own example, "a language one level short", is closable (Stretch).
- Case 7: an unlisted must-have is a must-have that no profile can meet, so it is a missing must-have (Good with one missing).

| Case | Input (one line) | Expected (hand, from the SPRINT rules) | Got (code) | Match |
|---|---|---|---|---|
| 1 | musts SQL, Tableau; nice Excel; all three on the CV; nothing set; the ad states no constraint | Strong (skills only); musts 2/2, nices 1/1 | Strong (skills only); musts 2/2, nices 1/1 | yes |
| 2 | as 1; ad: Exampleville, hybrid; profile city Berlin (set) | Long shot (judged: skills, location); musts 2/2, nices 1/1 | Long shot (judged: skills, location); musts 2/2, nices 1/1 | yes |
| 3 | as 1; ad: 3 years; profile 2 years (set) | Stretch (judged: skills, years); musts 2/2, nices 1/1 | Stretch (judged: skills, years); musts 2/2, nices 1/1 | yes |
| 4 | as 1; ad: German B2; profile German B1 (set) | Stretch (judged: skills, language); musts 2/2, nices 1/1 | Stretch (judged: skills, language); musts 2/2, nices 1/1 | yes |
| 5 | as 1 but the profile has no skills at all; nothing set | Stretch (skills only); musts 0/2, nices 0/1 | Stretch (skills only); musts 0/2, nices 0/1 | yes |
| 6 | as 1 but Tableau is not on the profile (SQL and Excel are); nothing set | Good (skills only); musts 1/2, nices 1/1 | Good (skills only); musts 1/2, nices 1/1 | yes |
| 7 | musts SQL, Tableau and an unlisted skill; nice Excel; the three listed ones on the CV; nothing set | Good (skills only); musts 2/3, nices 1/1 | Good (skills only); musts 2/3, nices 1/1 | yes |
| 8 | as 1 but Excel (the nice-to-have) is not on the profile; nothing set | Strong (skills only); musts 2/2, nices 0/1 | Strong (skills only); musts 2/2, nices 0/1 | yes |
| 9 | as 1; ad: Berlin, hybrid; profile city Berlin (set) | Strong (judged: skills, location); musts 2/2, nices 1/1 | Strong (judged: skills, location); musts 2/2, nices 1/1 | yes |
| 9b | as 1 but Tableau is IN PROGRESS (expected 2027-03-01), not a have skill; SQL a have skill; nothing set | Good (skills only); musts 1/2, nices 0/1 | Good (skills only); musts 1/2, nices 0/1 | yes |
| 5b | as 5, through the typed-list report (no profile loaded, empty list) | Stretch (skills only); musts 0/2, nices 0/1 | Stretch (skills only); musts 0/2, nices 0/1 | yes |

Result: all 10 numbered rows (cases 1 to 9 and 9b) matched the hand work, on level and on counts; the extra row 5b (the same ad as case 5 on the typed-list path, which is what the page shows with no profile loaded) matched too. No row did not match.

### What the report prints, exactly

**Case 9 (location set and matching; HANDOFF item 15)**

- Label: Strong (judged: skills, location)
- Explanation: You meet all 2 must-haves on your profile. No conflict was found in what you set. Not judged here: language, work mode, years, start date.
- Conflicts: (none printed)
- Not judged lines: Language: not judged (you did not set yours, and the ad does not say). / Work mode: the ad says hybrid; not judged because you did not set yours. / Years: not judged (you did not set yours, and the ad does not say). / Start date: not judged (you did not set yours, and the ad does not say).
- Requirement rows:
  - must | met | SQL: CV line 2: "Wrote SQL queries to reconcile order data"
  - must | met | Tableau: CV line 3: "Built monthly dashboards in Tableau"
  - nice | met | Excel: CV line 4: "Kept the weekly sales sheet in Excel"

The satisfied location has no line of its own: it appears only in the label ("judged: skills, location") and in the sentence "No conflict was found in what you set." (no row or line mentions the city). Compare case 3, where the years conflict does get a line:

- Case 3 conflict line: (could be closed) The ad asks for 3 years of experience; your profile has 2 (1 year short).

**Case 2 (the "Long shot" case seen live)**

- Label: Long shot (judged: skills, location)
- Explanation: You meet all 2 must-haves on your profile. 1 conflict was found in what you set (listed below). Not judged here: language, work mode, years, start date.
- Conflicts: (can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin.
- Not judged lines: Language: not judged (you did not set yours, and the ad does not say). / Work mode: the ad says hybrid; not judged because you did not set yours. / Years: not judged (you did not set yours, and the ad does not say). / Start date: not judged (you did not set yours, and the ad does not say).
- Requirement rows:
  - must | met | SQL: CV line 2: "Wrote SQL queries to reconcile order data"
  - must | met | Tableau: CV line 3: "Built monthly dashboards in Tableau"
  - nice | met | Excel: CV line 4: "Kept the weekly sales sheet in Excel"

**Case 5 (empty skills, profile path)**

- Label: Stretch (skills only)
- Explanation: 2 of 2 must-haves are missing: SQL, Tableau. Location, language, work mode, years and start date are not judged here.
- Conflicts: (none printed)
- Not judged lines: Location: not judged (you did not set yours, and the ad does not say). / Language: not judged (you did not set yours, and the ad does not say). / Work mode: not judged (you did not set yours, and the ad does not say). / Years: not judged (you did not set yours, and the ad does not say). / Start date: not judged (you did not set yours, and the ad does not say).
- Requirement rows:
  - must | missing | SQL: not on your profile
  - must | missing | Tableau: not on your profile
  - nice | missing | Excel: not on your profile

**Case 5b (empty list, typed-list path)**

- Label: Stretch (skills only)
- Explanation: 2 of 2 must-haves are missing: SQL, Tableau. Location, language, work mode, years and start date are not judged here.
- Not judged lines: (none)
- Requirement rows:
  - must | missing | SQL: not on your list
  - must | missing | Tableau: not on your list
  - nice | missing | Excel: not on your list

**Case 7 (one unlisted must-have)**

- Label: Good (skills only)
- Explanation: One must-have is missing: Kombucha brewing. Location, language, work mode, years and start date are not judged here.
- Conflicts: (none printed)
- Not judged lines: Location: not judged (you did not set yours, and the ad does not say). / Language: not judged (you did not set yours, and the ad does not say). / Work mode: not judged (you did not set yours, and the ad does not say). / Years: not judged (you did not set yours, and the ad does not say). / Start date: not judged (you did not set yours, and the ad does not say).
- Requirement rows:
  - must | met | SQL: CV line 2: "Wrote SQL queries to reconcile order data"
  - must | met | Tableau: CV line 3: "Built monthly dashboards in Tableau"
  - must | unlisted | Kombucha brewing: not in our skill list yet, so it can't be matched with your CV
  - nice | met | Excel: CV line 4: "Kept the weekly sales sheet in Excel"

**Case 9b (one skill in progress)**

- Label: Good (skills only)
- Explanation: One must-have is missing: Tableau. Location, language, work mode, years and start date are not judged here.
- Conflicts: (none printed)
- Not judged lines: Location: not judged (you did not set yours, and the ad does not say). / Language: not judged (you did not set yours, and the ad does not say). / Work mode: not judged (you did not set yours, and the ad does not say). / Years: not judged (you did not set yours, and the ad does not say). / Start date: not judged (you did not set yours, and the ad does not say).
- Requirement rows:
  - must | met | SQL: CV line 2: "Wrote SQL queries to reconcile order data"
  - must | missing | Tableau: in progress, expected 2027-03-01
  - nice | missing | Excel: not on your profile


## Part 3: where each observation comes from (facts only)

| Item | The rule or line that produces it | Cases |
|---|---|---|
| HANDOFF 12: unlisted requirements count as "not met" | An unlisted requirement has ids that start with `new:` (assigned in lib/engine/fromAd.ts:243-248 when a name is not in the skill list; a name on the not-a-skill list is diverted to "not counted" instead, fromAd.ts:226-237). A requirement is met only through a profile skill with the wanted id (lib/engine/match.ts:65-82), and a typed or hand-added unlisted name is never put on the profile (lib/cv/profile.ts:37-40; app/skillsOnly.ts:39-42), so it can never be met. It is counted as a missing must-have (match.ts:286-290), and every missing must-have is one gap (lib/engine/fit.ts:35-45). The row is labelled "unlisted" (app/fitReport.ts:119-125), shown as "Not met" (app/ReportView.tsx:78), with an amber sentence "...not in our skill list yet, so they count as not met" (ReportView.tsx:47-53); the explanation sentence names it among the missing must-haves (fitReport.ts:172-173). A nice-to-have never enters the level (fit.ts:13). | 7 (the one unlisted must-have turns Strong into Good; the printed explanation reads "One must-have is missing: Kombucha brewing" while its row says "not in our skill list yet") |
| HANDOFF 15: a judged and satisfied constraint gets no line | `judged` is the kinds the person set AND the ad states (app/fitReport.ts:102, 43-57). The only per-constraint lines are conflicts (fitReport.ts:142, from `result.conflicts`) and "not judged" lines (145-170). A satisfied kind appears in the label only (fitReport.ts:189) and in the sentence "No conflict was found in what you set." (fitReport.ts:178-185). ReportView shows conflicts (app/ReportView.tsx:55-64) and not-judged lines (91-100) and nothing for a satisfied kind. | 9 (location matches: no line mentions it); 3 (a years conflict does get a line) |
| HANDOFF 16: after "Delete this profile" the report on screen still says "on your profile" | By the code: the report is recomputed at app/page.tsx:135-147 from `profile = savedBuilt ?? built` (page.tsx:133); the delete handler calls `onForget` (app/SavedControls.tsx:100-109) which is `setUsingSaved(null)` (page.tsx:164, 180); with no CV read in the session `built` is null, so the memo returns the typed-list report (page.tsx:143-146), whose wording is "not on your list" (app/skillsOnly.ts:175), not "on your profile" (the profile report's wording: app/fitReport.ts:136, 173). The owner's manual-check log (step 9, observation O-2) says the report did not change and still said "on your profile". The code reading and the observation do not agree; the cause is not determined here and could not be reproduced with a pure function (it is page state). | none (UI state, not part of the fit functions) |
| HANDOFF 17: "Long shot" although every must-have and nice-to-have is met | The first check in `fitLevel` is "any conflict that can't be closed soon: Long shot" (lib/engine/fit.ts:26-32), before the count of gaps. A city that is not on the profile is a conflict with `closable: false` for on-site and hybrid jobs (lib/engine/match.ts:200-217). The conflict line is prefixed "(can't be closed soon)" (lib/engine/explain.ts:172-174). | 2 (Long shot with 2 of 2 must-haves and 1 of 1 nice-to-have met); 9 (the same ad with a matching city: Strong) |
| The empty-skills observation (O-4): "Stretch (skills only)" and "not on your list" for every skill | With no skills on the profile every requirement is "not on the profile" (lib/engine/match.ts:99-107); two missing must-haves are 2 gaps (fit.ts:35, 38), so Stretch (three would be Long shot, fit.ts:37). "(skills only)" is printed when no constraint kind was both set and stated (app/fitReport.ts:102, 189), and always on the typed-list path (app/skillsOnly.ts:93-105, 179). With no profile loaded the page uses the typed-list report (app/page.tsx:143-146), whose row wording is "not on your list" (skillsOnly.ts:175); the profile report says "not on your profile" (fitReport.ts:136). | 5 (profile path, empty profile), 5b (typed-list path, empty list) |

