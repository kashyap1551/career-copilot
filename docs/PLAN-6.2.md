STATUS: APPROVED 2026-11-17 (revision 2); the build waits for the merges in section 5. Careful lane (it shows a level the person will act on). Nothing is built. All data below is invented.

REVISION 2 (2026-11-17, reviewer decision): the list uses exactly the profile the report uses on that page, never a profile of its own (section 2). The first draft read the stored profile on its own; that was a FAULT, shown by the fact below.

# Plan for step 6.2: a saved ad shows in the list with its fit level

Step text (docs/SPRINT.md, Day 6): "6.2 Jobs page: paste an ad, check its requirements, save. Check: a saved ad shows in the list with its fit level."

What already exists (read in the code on main, commit eefcc46): the page already lets the person paste an ad, read it and "Save this ad" (6.1 part 3c); the "Saved ads" list shows, per record, "Title, Company (date)" with Open and Delete (`jobRows`, lib/saved/ui.ts:80-88; `SavedAdsList`, app/SavedControls.tsx:295-338). PLAN-6.1 section 3 deliberately stores no level ("computed when a job is opened, against the profile as it is then") and section 10 leaves "the jobs page and the saved-jobs list with fit levels (6.2)" for this step. So what 6.2 adds is **the fit level on each row, and the order**. What it does NOT add is listed in section 4 (the "check its requirements" tick list is not built).

What the level text is: the level of each row is the label that `profileReport` already returns (`fitLabel`, built by `fitLabelText` and the no-level rules of docs/PLAN-FIT-LEVEL.md, on the branch `step-fit-levels`). **6.2 calls those functions and never writes its own label** (a guard test in section 6 reads the source and fails if a label string is written in the 6.2 files).

**The fact that showed the fault (read in the code on main, eefcc46).** After a page reload with a saved profile on the device and NO click on "Use this profile":
- `usingSaved` starts as `null` (app/page.tsx:63) and `built` is `null` (no CV read, app/page.tsx:126-129), so `profile = savedBuilt ?? built` is `null` (app/page.tsx:133). **No profile is in use.**
- `onOpenAd` (app/page.tsx:96-117) does not look at any profile: it loads the record, runs `openJob`, and calls `setResult(opened.reading)` (line 114; its own comment says "the fit level is computed against the profile in use"). The report is then computed by the `report` memo (app/page.tsx:135-147) from `result` and `profile`; with `profile` null it takes the typed-list branch (lines 143-146, `skillsOnlyReport` on the typed skill list), not the saved profile.
- So the opened report does NOT use the saved profile. Under the first draft's plan (rows computed from the stored profile) a row would say "Strong (judged: skills, location)" while Open showed the typed-list report ("... (skills only)", or "No level (no skills on your list)" with an empty list). **The first draft had that fault**, and its manual step 5 ("the report's level is the same as the row's") would have failed. Revision 2 removes it.

## 1. What the screen shows

The "Saved ads" box stays where it is. Each row, in the order of section 3, is up to four short lines, then Open and Delete:

1. `Title, Company (date)` (as today; only `Title` when the company is null; the date is the first 10 characters of `savedAt`).
2. `Fit: <the label>` (the exact text `profileReport` returns for the profile in use, for example `Fit: Strong (judged: skills, location)`).
3. Only for a Long shot that a conflict that can't be closed soon set: the reason, in quiet type: the first sentence of the report's explanation, `Long shot because of location: ... That can't be closed soon.` (proposed; question Q5).
4. Only for an old reading: `Old reading: open it to read it again.` (section 2).

**One worked example.** The profile IN USE (invented; here the person pressed "Use this profile" on a saved profile, or confirmed it from a CV this visit): skills SQL (CV line 3), Tableau (line 4), Excel (line 5); the person set only a city, `Berlin`. Three saved ads (invented), all from the invented material of docs/FIT-LEVEL-FACTS.md:

| Saved ad | Date saved | What the saved reading holds |
|---|---|---|
| A: "Reporting Analyst, Northlake Foods Ltd" | 2026-11-18 | Berlin, hybrid; musts SQL, Tableau; nice Excel |
| B: "Operations Coordinator, Harbor Light Stationery" | 2026-11-20 | Exampleville, hybrid; musts SQL, Tableau |
| C: "Customer Helper, Imaginary Pages Ltd" | 2026-11-19 | the AI read no requirements |

The list as the person sees it (the order is explained in section 3):

```
Saved ads
  Reporting Analyst, Northlake Foods Ltd (2026-11-18)
  Fit: Strong (judged: skills, location)                         [Open] [Delete]

  Operations Coordinator, Harbor Light Stationery (2026-11-20)
  Fit: Long shot (judged: skills, location)
  Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon.
                                                                 [Open] [Delete]

  Customer Helper, Imaginary Pages Ltd (2026-11-19)
  Fit: No level (no requirements found in this ad)               [Open] [Delete]
```

How each line is worked out by hand, from the rules in docs/PLAN-FIT-LEVEL.md and docs/FIT-LEVEL-FACTS.md (case 9, case 2, Amendment 4 case Z1): ad A, both musts met, the city Berlin is on the profile and the ad states it: Strong, judged kinds skills and location. Ad B, both musts met, Exampleville is not on the profile, a conflict that can't be closed soon: Long shot, and the named reason is location. Ad C, zero requirements: no level, whatever the profile holds. The label strings are not typed in 6.2: they are `profileReport(...).fitLabel`.

## 2. Where the level comes from: the profile in use, and nothing else

**The rule (decided by the reviewer, replaces the first draft's Q2, Q8 and Q9).** The list uses exactly the profile the report uses on that page: the variable `profile = savedBuilt ?? built` (app/page.tsx:133), passed to the list as a prop. The list never reads or builds a profile of its own, never calls `loadProfile`, and never refreshes anything from storage. **For the same ad and the same profile in use, the row's level text equals the opened report's level text, always.** Both are `profileReport(reading.job, profile, skills, unlisted).fitLabel`, computed through ONE shared function (`reportFor`, section 5), so they cannot drift apart in the code, and L19 tests it on three routes.

- **Recomputed in the browser** whenever the saved ads, the current stamps or the profile in use change (once on load, then on each change; not on every render). From the saved ad's reading (re-checked exactly as Open does, below) and `profile`. Pure code, no AI call, no network call, no new stored field. The level is never stored.
- **Per row, two steps, memoized apart:** (1) `openJob(record, { stamps, skills })` (lib/saved/openJob.ts:15-37) decides the reading, as Open does: as stored, or re-checked in the browser from the stored extraction when only the vocabulary or reading version differ (plain code, not written back). It does not depend on the profile, so it is computed when the ads or stamps change only. (2) `reportFor(...)` with the profile in use, computed when the profile changes.
- **Listing and opening never write back.** The list code calls no save or delete function; the click handlers that exist (`onDeleteAd`, `onDeleteAll`, ...) are unchanged. A test counts every store call made while the rows are built (L12).

**What "profile in use" is, route by route (all from the code):**

| Route | Profile in use | Rows | The opened report |
|---|---|---|---|
| R1. Reload; a saved profile exists; no click | none (`usingSaved` null, `built` null) | no level, one note | the typed-list report (the typed list, usually empty): a different kind of report, labelled "skills only" (see Q13) |
| R2. "Use this profile" pressed | the saved profile (`savedBuilt`) | levels | the profile report on the same profile: same text |
| R3. A CV read and confirmed this visit (not saved, or saved) | the profile just confirmed (`built`) | levels | the profile report on the same profile: same text |
| R4. R2 then "Delete this profile" | `usingSaved` is cleared (`onForget`, app/SavedControls.tsx:100-109) so `profile` is `built`: none, unless a CV was also read this visit | no level and the note (or, with a CV-built profile, unchanged) | by the code, the `report` memo is recomputed from the same `profile`. The owner's observation in the manual check (HANDOFF item 16: the report kept saying "on your profile") is a different thing from the code reading and is NOT resolved or claimed fixed here |
| R5. R3 then "Delete this profile" (the saved copy) | unchanged: the profile in use is the one confirmed from the CV | unchanged | unchanged |
| R6. "Delete everything" | `onForget` clears `usingSaved`; `built` stays if a CV was read | the list is gone (the ads are deleted) | follows `profile` |

**The guarantee, and what it does not claim.** Rows and report are computed from the same variable in the same render, so they cannot use different profiles. If the opened report ever shows a stale text (item 16 is exactly that kind of observation: not understood yet), the list, being computed fresh from `profile`, could differ from that stale report; this plan does not claim to fix item 16. Manual step 6 asks the owner to write down what the opened report says after "Delete this profile", so the question is answered by looking.

**When no profile is in use (R1, and R4 without a CV).** The rows are shown WITHOUT a level line, in date order (newest first), with Open and Delete, and ONE note above the list. Proposed wording: `No fit levels yet: no profile is in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.` (a saved profile that cannot be read or comes from a newer app is never in use, so it gives the same note; the profile box already tells the person why).

**A profile just confirmed from a CV counts as in use (R3), and the rows re-rank live.** `built` changes with every change on the confirm screen (ticking a skill, setting a city, a year), so the rows can change level and move while the person edits. What that costs: (a) **computation:** the opened readings are not recomputed (step 1 memo), only `reportFor` per ad: **15 reports per change for 15 saved ads**. One report is one `match()` over the ad's requirements (an ad has on the order of 10 to 25) against the profile's skills (on the order of 10 to 30), plus building a few sentences: on the order of a thousand comparisons, so 15 reports is on the order of 10^4 simple operations per change, by reasoning not by measurement (the page already runs `buildProfile` and one `profileReport` per change). (b) **what the person sees:** the list is below the controls (app/page.tsx:231, before the report), so rows may move while they work; each row's text is always the text the report would show. If that proves distracting the list can be computed on pause, a later decision; it does not change the rule.

**The states of a row (never crash, never hide a record):**

| State | What the row shows |
|---|---|
| A profile is in use; the reading is current (as stored) or re-checked | the lines of section 1 |
| No profile in use | the row without a level line, date order, and the note above |
| The reading is from older instructions (`adRequestHash` differs) or cannot be re-checked (no stored extraction) | the level computed from the OLD stored reading (what Open would show), plus the line `Old reading: open it to read it again.` (Q4). Still ranked by its level, never hidden |
| The ad's record schema is newer than the app, or the record is corrupted | not a row (the app cannot read it): counted in the existing notice (`listNotice`, lib/saved/ui.ts:93-98: "1 saved ad was saved by a newer version of the app and is left untouched."). Not deleted or changed |
| The level could not be worked out for one row (any exception) | that row: the title line, `A level could not be worked out for this ad.`, Open and Delete. Sorts with the No level group; the other rows are unaffected |
| The profile's vocabulary stamp differs from now | the profile in use is used as it is (6.1: `builtFromSaved` leaves out only skill ids the vocabulary no longer knows) |

## 3. Order and ties

**Proposed order (the reviewer's lean):** Strong, Good, Stretch, Long shot, then No level (and "level could not be worked out" with the No level group). Inside a group: saved date, newest first; then `id`, so the list never jumps (the existing rule of `jobRows`, lib/saved/ui.ts:81-82, and of `listJobs`, lib/saved/saved.ts:107). With no profile saved there is one group: the order is by date, newest first, as today.

**The order for the example, worked by hand.** Levels: A Strong (rank 0), B Long shot (rank 3), C No level (rank 4). So the order is A, B, C. (By date alone it would be B 2026-11-20, C 2026-11-19, A 2026-11-18, so this is the case that shows the ranking is not the date.)

**A tie, worked by hand.** Add ad D, "Data Clerk, Example Wharf Ltd", saved 2026-11-21, a second Strong. Order: D (Strong, 2026-11-21), A (Strong, 2026-11-18), B, C. Two ads saved at the same instant with the same level: ordered by `id`.

**The rank comes from a number, not from the text.** `profileReport` gets one additive field, `level: "strong" | "good" | "stretch" | "longShot" | null` (null = no level), set from the same value it already uses for the label; the list sorts on it. Parsing the label would be fragile. (Section 5.)

## 4. Actions per row, and what they do to storage

| Action | What it does | Storage |
|---|---|---|
| Open | exactly what it does today (app/page.tsx `onOpenAd`): reads the record, decides the outcome with `openJob`, puts the ad text in the box, shows the report | READ only. A re-check is never written back |
| Delete (this ad) | exactly as today (`deleteJob`, app/SavedControls.tsx:305-309): removes that one record, then the list is rebuilt from the remaining records | one delete. The other rows keep their order and levels |
| "Delete everything saved on this device" | unchanged from 6.1: the inline second step, then `deleteAll`. The rows and levels disappear | clears the profile and the jobs (and, on branch step-6.1b, the access code kept in the tab) |
| "Save on this device" / "Delete this profile" (profile box) | unchanged. They do not change the profile IN USE by themselves (saving the profile just confirmed leaves it in use; "Delete this profile" clears `usingSaved` only), so the list follows exactly what the report follows (the table of section 2) | no new write |

Not in 6.2 (stated so nobody expects it): the remove-only "check its requirements" tick list of the 6.1 plan (section 3 reserves `removedByYou` and PLAN-6.1 section 10 leaves it out); a new "jobs" route (the saved list stays on the existing page, Q7); any AI call (a re-read stays an offer made after Open, as in 6.1); the fit report page (6.3); editing a saved ad.

## 5. Files that change, and the callers

6.2 touches the UI and the list code, not the engine.

| File | Change | Callers affected |
|---|---|---|
| app/fitReport.ts | `ProfileReport` gains two additive fields: `level` (`"strong" | "good" | "stretch" | "longShot" | null`, null = no level; the number the list sorts on) and `namedReason` (the lead sentence of the explanation, or null). Nothing else changes | `profileReport` callers: app/page.tsx:140, the list code (new), tests/profileReport.test.ts, tests/fitLevelReport.test.ts, tests/saved.test.ts S2b-report (compares two reports of the same input: both gain the same fields: still passes) |
| app/savedAdRows.ts (new, pure) | `reportFor(reading, profile, skills, extraUnlisted)`: the ONE function that turns a reading and a profile into a `ProfileReport`; `openedReadings(ads, current)` (step 1 of section 2); `rankedAdRows(opened, profile, skills)` returns `{ id, titleLine, date, levelText, rank, namedReason, oldReading, error }` sorted as in section 3, and the notes as plain functions | `SavedAdsList`; app/page.tsx (its `report` memo calls `reportFor` for the profile branch, so the opened report and the rows share the code) |
| lib/saved/ui.ts | unchanged (`jobRows` stays for the no-profile-in-use order, `listNotice`, `openView`, `canSaveAd`) | none |
| lib/saved/messages.ts | three new texts as constants: the no-profile-in-use note, the old-reading line, the could-not-be-worked-out line | the list |
| app/SavedControls.tsx | `SavedAdsList` takes `profile` (`BuiltProfile | null`, the profile in use) and `skills` as props and draws the new lines and the note. Click handlers unchanged | app/page.tsx:231 (the only place it is used) |
| app/page.tsx | passes `profile` and `skills` to `SavedAdsList`; its `report` memo (lines 135-147) calls `reportFor` for the profile branch | none beyond that |
| app/useSaved.ts | UNCHANGED (the first draft's `setRecord` is gone: the list does not use the stored record) | none |

No change to: lib/engine (fit.ts, match.ts, unlock.ts, judgeable.ts), lib/ai, lib/vocab, lib/schemas, the routes, the reader and its hashes (ad 85357f8fac, CV 193e02ee3f, vocabulary e96370fe4c, READING_VERSION "3").

**Branch.** 6.2 should NOT branch from main as it is, and should not be stacked on `step-fit-levels` while that waits. Proposed order: (1) 6.1 is ticked (the owner's manual check); (2) `step-6.1b-access-code` is merged (it edits app/page.tsx, app/CvBox.tsx and app/SavedControls.tsx, the same files 6.2 edits); (3) `step-fit-levels` is merged (it edits app/fitReport.ts, app/skillsOnly.ts, app/ReportView.tsx, and it is the source of the label text and the no-level rules the list must show); (4) 6.2 is built on a new branch cut from main after both merges. Why: the list calls `fitLabelText` and the no-level rules, which exist only on step-fit-levels, and a list built on main's old labels would show "Strong" for an ad with no requirements, the very fault Amendment 4 removes; and branches that all edit page.tsx, SavedControls.tsx and fitReport.ts would conflict. The alternative (stack 6.2 on step-fit-levels now) saves waiting but would carry 6.1b-unmerged code in the same files (Q1). This plan can be approved now; no code is written until the merges.

**Existing tests that could change.** Checked against the files: none has to change if `jobRows` is kept as it is (tests/savedJobsUi.test.ts R1 to R5, L1 to L4, O1, O2, A1, A2, D1, S1 are about `jobRows`, `listNotice`, `openView`, the keys and the messages: unchanged). `tests/profileReport.test.ts` and `tests/fitLevelReport.test.ts` assert on specific fields of the report, so two extra fields do not change them. `tests/saved.test.ts` S2b-report: unchanged (see the table). Any whole-report `toEqual` would change; none exists. If the reviewer prefers that `jobRows` itself returns the ranked rows, R1 to R5 are re-worked by hand (they move to the new function with the same expectations for the no-profile-in-use case).

## 6. Hand-worked cases, tests first, deliberate breaks

**Cases (expected text written before any code).** Profile in use, ads A to D as in sections 1 and 3 unless stated; "rows" means the output of `rankedAdRows` as the page draws it.

| # | Case | Expected |
|---|---|---|
| L1 | the three-ad example, profile in use | order A, B, C. Lines: A `Fit: Strong (judged: skills, location)`; B `Fit: Long shot (judged: skills, location)` and the named reason `Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon.`; C `Fit: No level (no requirements found in this ad)` |
| L2 | a tie: A (2026-11-18) and D (2026-11-21), both Strong | D before A, then B, then C; same savedAt and same level: by id |
| L3 | Good before Stretch before Long shot: three ads in the order Stretch (two musts missing), Long shot (three gaps), Good (one must missing), no conflicts, same date order scrambled | Good, Stretch, Long shot, whatever the dates |
| L4 | NO profile in use (route R1): A, B, C | no `Fit:` line on any row; ONE note above: `No fit levels yet: no profile is in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.`; order by date, newest first: B, C, A |
| L5 | a saved profile record that cannot be read (never in use): the page state has no profile in use | the same as L4 (the unreadable record is not read by the list at all) |
| L6 | a saved profile from a newer app (never in use) | the same as L4; the record is not changed |
| L7 | an ad whose `adRequestHash` differs from now (older instructions) | its level computed from the stored reading, plus `Old reading: open it to read it again.`; still ranked by that level |
| L8 | an ad with the same request hash but a different vocabulary stamp and a stored extraction | re-checked by `openJob`; the level is the one Open would show; no old-reading line; nothing written |
| L9 | an ad with a different vocabulary stamp and NO stored extraction | like L7 (cannot re-check): old-reading line |
| L10 | computing one row throws | that row shows `A level could not be worked out for this ad.`, sorts with the No level group, keeps Open and Delete; the other rows are exactly as without it |
| L11 | an ad record from a newer schema, or a corrupted one, among the others | not a row; the existing notice line counts it; the record stays in the store |
| L12 | building the rows | the store (`MemoryStore` spy) receives ZERO put, delete or clear calls, no read of the profile record, and `fetch` is never called |
| L13 | profile changes in use, by route: R2 then "Delete this profile" (R4); R3 then "Delete this profile" (R5); "Delete everything" (R6) | R4: rows lose their level lines and show the L4 note (no CV read). R5: rows unchanged (the profile in use is the CV-built one). R6: no rows. In each, `profile` is the one variable both the rows and the report get |
| L14 | a profile just confirmed from a CV this visit (R3), not saved | rows have levels from it; changing the confirm state re-ranks the rows. By hand: untick Tableau: A `Good (judged: skills, location)` (one must-have missing, the city fine), B stays `Long shot (judged: skills, location)` (a missing must-have plus a city that can't be closed: the city decides), C unchanged: order A, B, C. Then set the city to Exampleville (Tableau still unticked): B becomes `Good (judged: skills, location)` (city fine, Tableau missing), A becomes `Long shot (judged: skills, location)` (Berlin is not on the profile): order B, A, C. Each state's row text equals what the report would show for that ad |
| L15 | one ad deleted | its row disappears; the others keep their order and levels |
| L16 | each row's level text | equals `reportFor(reading, profileInUse, skills, ...).fitLabel` (the very function the page's report uses), never a string typed in the list code |
| L17 | source guard | the 6.2 files (app/savedAdRows.ts, the list part of app/SavedControls.tsx) contain none of the strings `Strong`, `Good`, `Stretch`, `Long shot`, `No level (`, `not judged` |
| L18 | 15 saved ads (the 6.1 check) | 15 rows, ranked; a fresh context on the same store gives the same 15 rows in the same order |
| **L19** | **NEW: same ad, same profile in use, the row text equals the opened report's text, on three routes.** The "opened report" is built the way the page builds it: `openJob` on the record, then the page's report path (`reportFor`) on the profile in use | route 1, profile just confirmed (`buildProfile` from the invented CV, as R3): for each of A, B, C, `row.levelText === opened.fitLabel`. Route 2, profile loaded by "Use this profile" (`builtFromSaved(savedFromBuilt(...))`, R2): the same equality for A, B, C. Route 3, no profile in use (R1): the row has NO level line and carries the L4 note; the opened report is the typed-list report (its label is `profileReport`-independent: for an empty list `No level (no skills on your list)`). Equality of level text is asserted on routes 1 and 2 only; route 3 asserts the rows' state and, separately, that the page's report path really is the typed-list path (Q13 explains why equality cannot hold on route 3) |

**Tests to write first:** `tests/savedAdRows.test.ts` (L1 to L12, L15, L16, L18, L19; pure, with `MemoryStore`, no browser), a small addition to `tests/fitLevelReport.test.ts` (the two new report fields: `level` is null exactly when the label starts "No level", and equals the level the label names; `namedReason` is the lead sentence for a Long shot by an unclosable conflict and null otherwise), `tests/savedAdRowsGuards.test.ts` (L17; the wiring guards: the page passes the SAME `profile` variable to the list and to the report, i.e. the source of app/page.tsx contains one `profile = savedBuilt ?? built` and `SavedAdsList` receives `profile={profile}`; no save or delete function is called from the list's render or from an effect), and the L13, L14 pieces as plain-function tests on the state helpers. Each must be shown red before any code, with the expectation worked out above and never changed to fit the result.

**Deliberate breaks to run: 14 (each must make a named test fail):**
1. rank by date only;
2. Good and Stretch swapped;
3. the tie order reversed (oldest first);
4. a label typed in the list code instead of `fitLabel` (L17, L16);
5. the level written to the store (L12);
6. the list calling `fetch` (L12);
7. **the list shows a level while no profile is in use** (L4, L19 route 3);
8. the old-reading line dropped (L7);
9. a throwing row taking the whole list down (L10);
10. **the list uses the saved profile while the report uses another** (for example the list reads the stored record instead of the `profile` prop) (L19, L13);
11. a No level row ranked above a Long shot (L1);
12. a newer-schema record counted as a row (L11);
13. the no-profile-in-use note dropped (L4);
14. the rows not recomputed when the profile in use changes (a stale memo) (L14).

## 7. Privacy

Nothing leaves the device: the list reads IndexedDB for the ads (as today) and computes in the page from the profile already in the page's memory. No new network call (a test spies `fetch`). No new stored field: the level is never stored, and nothing is added to `SavedJob` or `SavedProfile` (PLAN-6.1 sections 1 and 3 stand). The list does not read the saved profile record at all (it uses the profile in use), so 6.2 adds no new read of the profile. The notice next to "Save this ad" and "Save on this device" is unchanged and still true.

## 8. Manual-check outline for the owner (invented material only; every step NOT RUN YET)

To be turned into `docs/MANUAL-CHECK-6.2.md` when built; uses the invented CV and ads of docs/MANUAL-CHECK-6.1.md and docs/MANUAL-CHECK-FIT.md; about 4 AI calls (CV once, three ads once each).

1. Fresh private window; paste the invented CV, confirm the three skills, set the city `Berlin`, press "Save on this device". **Expect:** "Saved on this device."
2. Read and save invented ads A, B and C (A: Berlin, hybrid, SQL and Tableau; B: Exampleville, hybrid, SQL and Tableau; C: a text with no requirements, for example one friendly sentence). **Expect:** three rows in "Saved ads". Because the profile just confirmed is in use, they already show levels.
3. Look at the list. **Expect:** order A (Strong), B (Long shot, with the reason line), C (No level (no requirements found in this ad)); not the date order.
4. **Reload the page. Do NOT press "Use this profile".** **Expect:** the same three rows WITHOUT a `Fit:` line, in date order (B, C, A), and the note "No fit levels yet: no profile is in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device." In the Network tab: no request to `/api/` by loading the list. Press Open on B and write down the first line of the report ("Fit: ..."): by the rule it is the typed-list report, not the saved profile's.
5. Press **"Use this profile"**. **Expect:** the rows now have levels and the order A, B, C. Press Open on B. **Expect:** the report's "Fit:" line is the same text as row B's. Do the same for A and C.
6. Press **"Delete this profile"**. **Expect:** the rows lose their `Fit:` lines and the note of step 4 appears. **Write down the exact wording of the opened report after "Delete this profile"** (the "Fit:" line, the first sentence under it, and whether it still says "on your profile"; HANDOFF item 16). Do not judge it. IndexedDB: `jobs` still has three entries with unchanged `savedAt`.
7. Paste the invented CV again, send it for reading and confirm the skills (do not save). **Expect:** the rows have levels again from the profile just confirmed. Untick Tableau on the confirm screen. **Expect:** A becomes "Good (judged: skills, location)"; B stays Long shot; C unchanged. Then change "Cities you can work in" to `Exampleville`. **Expect:** the rows re-rank at once: B first (Good), then A (Long shot), then C. Open B: the report's level equals the row's.
8. Press Delete on one row. **Expect:** two rows left, order kept.
9. Press "Delete everything saved on this device", then "Yes". **Expect:** the list is gone; both boxes of IndexedDB are empty.
10. Open the Console. **Expect:** no red errors of ours.
Log table: ten rows, all NOT RUN YET.

## 9. Decided item, notes and questions for the reviewer

**Decided (reviewer, 2026-11-17; replaces the first draft's Q2, Q8 and Q9).** The list uses exactly the profile the report uses on that page (`profile = savedBuilt ?? built`, the same variable), never a profile of its own. For the same ad and the same profile in use, the row's level text equals the opened report's level text, always. With no profile in use the rows show no level (one note). A profile just confirmed from a CV counts as in use, so the rows re-rank live. The page does not re-read the stored profile after a save, and the list does not use the stored record.

**Notes**
12. **The remove-only "check its requirements" list is not built in 6.2** (the reserved `removedByYou` of PLAN-6.1 section 3 stays unused). It needs its own HANDOFF item when 6.2 is built, so the SPRINT 6.2 words "check its requirements" are not read as done.

**Questions (the numbers of the first draft are kept; 2, 8 and 9 are the decided item above)**
1. **Branch order.** Build 6.2 on a new branch cut from main after 6.1 is ticked and both `step-6.1b-access-code` and `step-fit-levels` are merged, rather than stacking on step-fit-levels now? Proposed: yes, in that order (section 5).
3. **Order.** Strong, Good, Stretch, Long shot, then No level; ties by saved date, newest first, then id. Proposed: yes (section 3).
4. **Old readings.** A row whose reading is from older instructions or cannot be re-checked shows its level with the line "Old reading: open it to read it again." Alternative: show no level for it. Proposed: show the level with the line (it is computed by code from data the person saved, and hiding it would hide information).
5. **Reason line for a Long shot.** Show the report's lead sentence under the label when a conflict that can't be closed soon set the level (HANDOFF 17: a Long shot with every must-have met looks odd without a reason). Proposed: yes, from a new `namedReason` field.
6. **No profile in use.** One note above the list, rows without a level line, date order. Alternative: a note on every row. Proposed: one note above, with the wording of section 2.
7. **Scope.** "Jobs page: paste an ad, check its requirements, save" is already served by the existing page (paste, read, save, list). Proposed: no new route; the remove-only tick list is note 12.
10. **No cap.** All saved ads are computed (the report of one ad is a few thousand operations, section 2); no limit and no paging. Proposed: yes; the readings are computed once per change of ads or stamps, the reports once per change of profile, not per render.
11. **The `Fit:` prefix and the quiet lines** use the same wording as the report page ("Fit: ..."). Proposed: yes.
13. **A gap in "always equal" when no profile is in use (new, flagged).** With no profile in use, the opened report is the typed-list report (app/page.tsx:143-146), which can show its own level ("... (skills only)") for the skills the person typed, while the rows show no level. So "the row text equals the opened report text" holds whenever a profile is in use, and cannot hold on route R1 unless the rows also followed the typed-list path. Proposed: keep the reviewer's rule as decided (rows without a level when no profile is in use) and state the limit in the manual check (step 4 asks for the report's first line); the alternative is that the rows use the same selector as the report, including the typed list, which would make the rule hold on every route at the cost of showing a provisional "skills only" level on every row. The reviewer decides.
    **Answered (reviewer, 2026-11-17): keep the rule as decided.** With no profile in use the rows show no level and one note; the opened report is the typed-list report; manual step 4 notes it. Q1, Q3, Q4, Q5, Q6, Q7, Q10 and Q11 are answered as proposed.
