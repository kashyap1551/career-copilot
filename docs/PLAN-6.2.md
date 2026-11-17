STATUS: DRAFT, awaiting reviewer. Careful lane (it shows a level the person will act on). Nothing is built. All data below is invented.

# Plan for step 6.2: a saved ad shows in the list with its fit level

Step text (docs/SPRINT.md, Day 6): "6.2 Jobs page: paste an ad, check its requirements, save. Check: a saved ad shows in the list with its fit level."

What already exists (read in the code on main, commit eefcc46): the page already lets the person paste an ad, read it and "Save this ad" (6.1 part 3c); the "Saved ads" list shows, per record, "Title, Company (date)" with Open and Delete (`jobRows`, lib/saved/ui.ts:80-88; `SavedAdsList`, app/SavedControls.tsx:295-338). PLAN-6.1 section 3 deliberately stores no level ("computed when a job is opened, against the profile as it is then") and section 10 leaves "the jobs page and the saved-jobs list with fit levels (6.2)" for this step. So what 6.2 adds is **the fit level on each row, and the order**. What it does NOT add is listed in section 4 (the "check its requirements" tick list is not built).

What the level text is: the level of each row is the label that `profileReport` already returns (`fitLabel`, built by `fitLabelText` and the no-level rules of docs/PLAN-FIT-LEVEL.md, on the branch `step-fit-levels`). **6.2 calls those functions and never writes its own label** (a guard test in section 6 reads the source and fails if a label string is written in the 6.2 files).

## 1. What the screen shows

The "Saved ads" box stays where it is. Each row, in the order of section 3, is up to four short lines, then Open and Delete:

1. `Title, Company (date)` (as today; only `Title` when the company is null; the date is the first 10 characters of `savedAt`).
2. `Fit: <the label>` (the exact text `profileReport` returns, for example `Fit: Strong (judged: skills, location)`).
3. Only for a Long shot that a conflict that can't be closed soon set: the reason, in quiet type: the first sentence of the report's explanation, `Long shot because of location: ... That can't be closed soon.` (proposed; question Q5).
4. Only for an old reading: `Old reading: open it to read it again.` (section 2).

**One worked example.** The stored profile (invented): skills SQL (CV line 3), Tableau (line 4), Excel (line 5); the person set only a city, `Berlin`. Three saved ads (invented), all from the invented material of docs/FIT-LEVEL-FACTS.md:

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

## 2. Where the level comes from

- **Recomputed in the browser, each time the list opens** (precisely: whenever the list of saved ads, the saved profile or the current stamps change, and once when the page loads; not on every render). From two things already stored: the saved ad's reading (`SavedJob.reading`, with the re-check rule below) and the saved profile (`SavedProfile`, rebuilt with `builtFromSaved`). Pure code, no AI call, no network call, no new stored field. The level is never stored (PLAN-6.1 section 3 stands).
- **Per row:** `openJob(record, { stamps, skills })` (lib/saved/openJob.ts:15-37) decides which reading to use, exactly as Open does, so the list and the opened report agree: as stored, or re-checked in the browser from the stored extraction when only the vocabulary or reading version differ (plain code, not written back). Then `profileReport(reading.job, builtFromSaved(profile), skills, reading.unlisted)` gives the label.
- **Listing and opening never write back.** Nothing in the list code calls `saveJob`, `saveProfile`, `deleteJob`, `deleteProfile` or `deleteAll` except the click handlers that already exist (PLAN-6.1 rule). A test counts every store call made while the rows are built (section 6).

**The states a row can be in (never crash, never hide a record):**

| State | What the row shows |
|---|---|
| A profile is saved and readable; the reading is current (`as-stored`) or re-checked | the level lines of section 1 |
| No profile is saved on this device | the rows without a level line, in date order (newest first), and ONE note above the list: `Fit levels need a saved profile. None is saved on this device, so no level is shown.` (proposed; Q6) |
| A profile record exists but cannot be read (corrupted) | the rows without a level, one note above: `The saved profile could not be read, so no level is shown.` |
| The profile record was saved by a newer version of the app | one note above: `The saved profile was saved by a newer version of this app, so no level is shown.` (the app does not read or change it) |
| The ad's reading is from older instructions (`adRequestHash` differs) or cannot be re-checked (no stored extraction) | the level computed from the OLD stored reading, plus the line `Old reading: open it to read it again.` (proposed; Q4). The row is still listed, still ranked by its level, never hidden |
| The ad's record schema is newer than the app, or the record is corrupted | not a row (the app cannot read it): counted in the existing notice ("1 saved ad was saved by a newer version of the app and is left untouched.", `listNotice`, lib/saved/ui.ts:93-98). It is not deleted or changed |
| The level could not be worked out for one row (any exception while computing it) | that row: `Title, Company (date)`, the line `A level could not be worked out for this ad.`, and Open and Delete. It sorts with the No level group. The other rows are unaffected |
| The profile's vocabulary stamp differs from the current vocabulary | the profile is used as it is (6.1: `builtFromSaved` leaves out only skill ids the vocabulary no longer knows) |

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
| "Save on this device" / "Delete this profile" (profile box) | unchanged, but they now also change the levels: after a successful save the page re-reads the profile (a READ, `loadProfile`) so the levels use the profile just saved; after "Delete this profile" `clearOffer` already empties the record, so the rows lose their level lines and the "no profile" note appears at once | no new write |

Not in 6.2 (stated so nobody expects it): the remove-only "check its requirements" tick list of the 6.1 plan (section 3 reserves `removedByYou` and PLAN-6.1 section 10 leaves it out); a new "jobs" route (the saved list stays on the existing page, Q7); any AI call (a re-read stays an offer made after Open, as in 6.1); the fit report page (6.3); editing a saved ad.

## 5. Files that change, and the callers

6.2 touches the UI and the list code, not the engine.

| File | Change | Callers affected |
|---|---|---|
| app/fitReport.ts | `ProfileReport` gains two additive fields: `level` (the number to sort on) and `namedReason` (the lead sentence of the explanation, or null). Nothing else changes | `profileReport` callers: app/page.tsx:140 (ignores the new fields), the list code (new), tests/profileReport.test.ts, tests/fitLevelReport.test.ts, tests/saved.test.ts S2b-report (compares two reports of the same input: both gain the same fields, so it still passes) |
| app/savedAdRows.ts (new, pure) | `rankedAdRows(ads, profileState, current)`: for each saved ad, opens it as in `openJob`, builds the report, returns `{ id, title line, date, levelText, rank, namedReason, oldReading, error }` sorted as in section 3; and the notes of section 2 as plain functions | `SavedAdsList` |
| lib/saved/ui.ts | unchanged (`jobRows`, `listNotice`, `openView`, `canSaveAd` keep their behaviour; `jobRows` stays for the no-profile case) | none |
| lib/saved/messages.ts | the five new note texts (section 2) as constants, next to the existing messages | the list |
| app/SavedControls.tsx | `SavedAdsList` draws the new lines and the note; gets the stored profile and the skills as props. Click handlers unchanged | app/page.tsx:231 (the only place it is used) |
| app/useSaved.ts | a `setRecord` (state only) so the profile saved or deleted during this visit reaches the list; the load effect stays READ-ONLY | SaveProfileButton (calls `loadProfile` then `setRecord` after a successful save) |
| app/page.tsx | passes the stored profile record and the skills to `SavedAdsList` | none beyond that |

No change to: lib/engine (fit.ts, match.ts, unlock.ts, judgeable.ts), lib/ai, lib/vocab, lib/schemas, the routes, the reader and its hashes (ad 85357f8fac, CV 193e02ee3f, vocabulary e96370fe4c, READING_VERSION "3").

**Branch.** 6.2 should NOT branch from main as it is, and should not be stacked on `step-fit-levels` while that waits. Proposed order: (1) 6.1 is ticked (the owner's manual check); (2) `step-6.1b-access-code` is merged (it edits app/page.tsx, app/CvBox.tsx and app/SavedControls.tsx, the same files 6.2 edits); (3) `step-fit-levels` is merged (it edits app/fitReport.ts, app/skillsOnly.ts, app/ReportView.tsx, and it is the source of the label text and the no-level rules the list must show); (4) 6.2 is built on a new branch cut from main after both merges. Why: the list calls `fitLabelText` and the no-level rules, which exist only on step-fit-levels, and a list built on main's old labels would show "Strong" for an ad with no requirements, the very fault Amendment 4 removes; and two branches that both edit page.tsx, SavedControls.tsx and fitReport.ts would conflict. The alternative (stack 6.2 on step-fit-levels now) saves waiting but would carry 6.1b-unmerged code in the same files; if the reviewer wants to start earlier, stack on step-fit-levels and merge in that order (Q1). This plan can be approved now; no code is written until the merges.

**Existing tests that could change.** Checked against the files: none has to change if `jobRows` is kept as it is (tests/savedJobsUi.test.ts R1 to R5, L1 to L4, O1, O2, A1, A2, D1, S1 are about `jobRows`, `listNotice`, `openView`, the keys and the messages: unchanged). `tests/profileReport.test.ts` and `tests/fitLevelReport.test.ts` assert on specific fields of the report, so two extra fields do not change them. `tests/saved.test.ts` S2b-report: unchanged (see the table). Any test of a whole-report `toEqual` would change; none exists. If the reviewer prefers that `jobRows` itself returns the ranked rows, R1 to R5 are re-worked by hand (they would move to the new function with the same expectations for the no-profile case).

## 6. Hand-worked cases, tests first, deliberate breaks

**Cases (expected text written before any code).** Profile, ads A to D as in sections 1 and 3 unless stated; "rows" means the output of `rankedAdRows` as the page draws it.

| # | Case | Expected |
|---|---|---|
| L1 | the three-ad example | order A, B, C. Lines: A `Fit: Strong (judged: skills, location)`; B `Fit: Long shot (judged: skills, location)` and the named reason `Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon.`; C `Fit: No level (no requirements found in this ad)` |
| L2 | a tie: A (2026-11-18) and D (2026-11-21), both Strong | D before A, then B, then C; same savedAt and same level: by id |
| L3 | Good before Stretch before Long shot: three ads in the order Stretch (two musts missing), Long shot (three gaps), Good (one must missing), no conflicts, same date order scrambled | Good, Stretch, Long shot, whatever the dates |
| L4 | no profile saved: A, B, C | no `Fit:` line on any row; ONE note above: `Fit levels need a saved profile. None is saved on this device, so no level is shown.`; order by date, newest first: B, C, A |
| L5 | a profile record that cannot be read | no levels; the note `The saved profile could not be read, so no level is shown.`; rows still listed with Open and Delete |
| L6 | a profile record from a newer app | no levels; the note `The saved profile was saved by a newer version of this app, so no level is shown.`; the record is not changed |
| L7 | an ad whose `adRequestHash` differs from now (older instructions) | its level computed from the stored reading, plus the line `Old reading: open it to read it again.`; still ranked by that level |
| L8 | an ad with the same request hash but a different vocabulary stamp and a stored extraction | re-checked by `openJob`; the level is the one Open would show; no old-reading line; nothing written |
| L9 | an ad with a different vocabulary stamp and NO stored extraction | like L7 (cannot re-check): old-reading line |
| L10 | computing one row throws | that row shows `A level could not be worked out for this ad.`, sorts with the No level group, keeps Open and Delete; the other rows are exactly as without it |
| L11 | an ad record from a newer schema, or a corrupted one, among the others | not a row; the existing notice line counts it; the record stays in the store |
| L12 | building the rows | the store (`MemoryStore` spy) receives ZERO put, delete or clear calls, and `fetch` is never called |
| L13 | the profile is deleted (profile box) | the same list, rebuilt, has no `Fit:` lines and the L4 note |
| L14 | a profile is saved this visit (no reload) | the rows get their levels from the profile just saved |
| L15 | one ad deleted | its row disappears; the others keep their order and levels |
| L16 | each row's level text | equals `profileReport(job, built, skills, unlisted).fitLabel` for the same inputs (the label is never typed in the list code) |
| L17 | source guard | the 6.2 files (app/savedAdRows.ts, the list part of app/SavedControls.tsx) contain none of the strings `Strong`, `Good`, `Stretch`, `Long shot`, `No level (`, `must-have not judged` |
| L18 | 15 saved ads (the 6.1 check) | 15 rows, ranked; reload (a fresh context on the same store) gives the same 15 rows in the same order |

**Tests to write first:** `tests/savedAdRows.test.ts` (L1 to L12, L15, L16, L18; pure, with `MemoryStore`, no browser), a small addition to `tests/fitLevelReport.test.ts` (the two new report fields: `level` is null exactly when the label starts "No level", and equals the level the label names; `namedReason` is the lead sentence for a Long shot by an unclosable conflict and null otherwise), `tests/savedAdRowsGuards.test.ts` (L17; the wiring guard that no save or delete function is called from the list's render or from an effect, as in the existing 6.1 guards), and the L13, L14 pieces as plain-function tests on the state helpers. Each must be shown red before any code, with the expectation worked out above and never changed to fit the result.

**Deliberate breaks to run (each must make a named test fail):** rank by date only; the order of Good and Stretch swapped; the tie order reversed (oldest first); a label typed in the list code instead of `fitLabel` (L17, L16); the level written to the store; the list calling `fetch`; no-profile rows still showing a level; the "old reading" line dropped; a throwing row taking the whole list down; the stored profile replaced by the profile on screen; an unreadable-profile note dropped; a No level row ranked above a Long shot; the newer-schema record counted as a row.

## 7. Privacy

Nothing leaves the device: the list reads IndexedDB and computes in the page. No new network call (a test spies `fetch`). No new stored field: the level is never stored, and nothing is added to `SavedJob` or `SavedProfile` (PLAN-6.1 sections 1 and 3 stand). The notice next to "Save this ad" and "Save on this device" is unchanged and still true. One new in-memory field in the page state (`record`, already there) is refreshed after a save; it is not persisted by this step.

## 8. Manual-check outline for the owner (invented material only; every step NOT RUN YET)

To be turned into `docs/MANUAL-CHECK-6.2.md` when built; uses the invented CV and ads of docs/MANUAL-CHECK-6.1.md and docs/MANUAL-CHECK-FIT.md; about 4 AI calls (CV once, three ads once each).

1. Fresh private window; paste the invented CV, confirm the three skills, set the city `Berlin`, press "Save on this device". **Expect:** "Saved on this device."
2. Read and save invented ads A, B and C (A: Berlin, hybrid, SQL and Tableau; B: Exampleville, hybrid, SQL and Tableau; C: a text with no requirements, for example one friendly sentence). **Expect:** three rows in "Saved ads".
3. Without reloading, look at the list. **Expect:** order A (Strong), B (Long shot, with the reason line), C (No level (no requirements found in this ad)); not the date order.
4. Reload the page. **Expect:** the same three rows, the same order, the same level lines. In the Network tab: no request to `/api/` was made by loading the list.
5. Press Open on B. **Expect:** the report's level is the same as the row's.
6. Press "Delete this profile". **Expect:** the same rows, no `Fit:` lines, and the note "Fit levels need a saved profile...". IndexedDB: `jobs` still has three entries with unchanged `savedAt`.
7. Press Delete on one row. **Expect:** two rows left, order kept.
8. Save a profile again (steps 1 to 3 of this list) and press "Delete everything saved on this device", then "Yes". **Expect:** the list is gone; both boxes of IndexedDB are empty.
9. Open the Console. **Expect:** no red errors of ours.
Log table: nine rows, all NOT RUN YET.

## 9. Questions for the reviewer, each with the proposed answer

1. **Branch order.** Build 6.2 on a new branch cut from main after 6.1 is ticked and both `step-6.1b-access-code` and `step-fit-levels` are merged, rather than stacking on step-fit-levels now? Proposed: yes, in that order (section 5).
2. **Use of the stored profile without a click.** 6.1's decision was "offer the saved profile with one click, nothing automatic". Computing list levels reads the stored profile automatically (read-only, display only, nothing written). Proposed: allow it, because the person saved the profile to get exactly this, and the list is the only automatic use; the main report still needs "Use this profile". If the reviewer holds the stricter reading, the list shows levels only after "Use this profile" and the L4 note changes to say so.
3. **Order.** Strong, Good, Stretch, Long shot, then No level; ties by saved date, newest first, then id. Proposed: yes (section 3).
4. **Old readings.** A row whose reading is from older instructions or cannot be re-checked shows its level with the line "Old reading: open it to read it again." Alternative: show no level for it. Proposed: show the level with the line (it is computed by code from data the person saved, and hiding it would hide information).
5. **Reason line for a Long shot.** Show the report's lead sentence under the label when a conflict that can't be closed soon set the level (HANDOFF 17: a Long shot with every must-have met looks odd without a reason). Proposed: yes; the label alone is the text of `fitLabelText`, the reason is a separate line, from a new `namedReason` field.
6. **No profile.** One note above the list, rows without a level line, date order. Alternative: a note on every row. Proposed: one note above.
7. **Scope.** "Jobs page: paste an ad, check its requirements, save" is already served by the existing page (paste, read, save, list). Proposed: no new route; the "check its requirements" remove-only tick list (the reserved `removedByYou`) stays NOT built in 6.2 and is raised separately if wanted.
8. **Which profile.** The list uses the SAVED profile, not the profile on screen (a CV just read and not yet saved). Proposed: the saved one, because that is what "each time the list opens" and a reload can reproduce; a person who wants levels for a new profile saves it first.
9. **Refreshing the profile after a save in the same visit.** After "Save on this device" the page re-reads the profile (a READ) so the levels update without a reload. Proposed: yes.
10. **No cap.** All saved ads are computed (the report of one ad is a few milliseconds); no limit and no paging. Proposed: yes; computed once per change, not per render.
11. **The `Fit:` prefix and the quiet lines** use the same wording as the report page ("Fit: ..."). Proposed: yes.
