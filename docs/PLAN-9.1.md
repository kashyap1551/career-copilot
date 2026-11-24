STATUS: DRAFT v1 plus the reviewer's amendments 1 to 8 of 2026-11-24 (= revision 2). Decisions 1 to 7 of section 11 are approved as recommended by the reviewer; the owner may overrule before the merge. Amendments rule over the text above where they differ.

# Plan for step 9.1: demo mode (try the product on invented data, no upload, no AI, no network)

## 0. Purpose, and where this plan differs from the sprint

**The visitor's story.** A stranger opens the live address. On the first screen there is a button "Try a demo with invented data". They press it, with no access code and no CV. In under a minute they see a made-up person (a CV with three skills), ten made-up job ads each with a fit level, the "What to learn" box with the roadmap, and they can open any ad to see its full report. They can untick a skill and watch the levels change. A banner says all the time that this is invented data. One button takes them back to the real first screen.

**Done means:** all of that works on a fresh Incognito window with the Network tab showing no request made by the page's own code; the person's own saved data is never read or written by the demo; the real engine produced every number and sentence; all tests of section 6 pass and every break of section 7 is caught by its named test.

**It must NOT:** call the AI; call `/api/cv`, `/api/read` or anything else; read or write IndexedDB or sessionStorage; offer any save; show a number or sentence that the engine did not produce; look like the person's own data.

**Difference from docs/SPRINT.md 9.1.** SPRINT says "three sample CVs and sample ads, no upload needed. Check: a visitor sees a full report and roadmap within a minute." This plan builds ONE sample CV and TEN sample ads (the roadmap only shows from 10 counted ads, `ROADMAP_FROM_JOBS` in lib/engine/roadmapJobs.ts, so fewer ads could not meet the sprint's own check). Three CVs are a later item (decision 2). The check is kept: report and roadmap within a minute.

**Terms used once.** *Seam*: the one place where what the AI wrote enters plain code. *Prepared reading*: what the AI would return for a CV or an ad, written down in advance (the same shape the AI returns) and run through the same plain code. *Golden test*: a test whose expected text or count was worked out by hand first and is never changed to fit the code.

## 1. What the screen shows

The demo is its own page, `/demo` (**[R]**, section 2.4). From top to bottom:
1. The banner (always visible, section 2.5) and the one button "Leave the demo".
2. A short intro sentence and the "prepared readings" sentence.
3. The invented CV's confirm box (the same `ConfirmBox` as the real page): three skills ticked (SQL, Tableau, Excel), city Berlin typed, nothing else set. The person may untick; levels recompute at once, in the browser.
4. "Saved ads" (the same `SavedAdsList`): ten rows, each with its fit level, in the engine's order. Each row has Open; no Delete (**[R]**, decision 6).
5. The "What to learn" box (the same `RoadmapView`): the gap list, and, because ten ads are counted, the roadmap.
6. After Open: the same `ReportView` the real page shows for that ad.
Not shown: the CV or ad text boxes, "Send for reading", "Read this ad", any Save or Delete everything button, the access code box.

## 2. Design

**2.1 The seam (where the prepared readings enter).** The AI's output enters plain code in exactly two calls, both pure functions in lib/engine: `buildJob(output, text, skills, { id: "pasted-ad", source: null })` (called at lib/ai/readJob.ts:65; defined in lib/engine/fromAd.ts) and `fromCv(output, lines, skills)` (called at lib/ai/readCv.ts:64; defined in lib/engine/fromCv.ts). Today the server makes these calls and sends the result to the browser as JSON (`/api/read`, `/api/cv`). In demo mode the BROWSER makes the same two calls on bundled objects of the AI's own output types (`ExtractedAd` from lib/schemas/job.ts, `ExtractedCv` from lib/schemas/cv.ts). The demo files never import lib/ai/* (readJob.ts and readCv.ts import the `ai` package and the model; they must not enter the page bundle).

**Option A (recommended): bundled prepared readings injected at the seam.** Cost: about 200 lines of data in the bundle (ten short ads and one CV). Benefits: no request at all; every demo number is rebuilt by the current code on every visit, so a vocabulary change shows up as a failing golden test, not as a silently stale demo; the demo uses `saveJob` and `openJob` unchanged, so it also exercises the stamp and re-check paths.
**Option B: a static JSON route (or a file in public/) that holds the built readings.** It needs a request (breaks "zero network"), holds output of an OLD build of the engine (it would not follow vocabulary changes), and would need its own freshness test. Reason against B found: the sprint check and rule 1 both want the numbers to come from the engine as it is now. **Chosen: A.**

**2.2 The data (lib/demo/data.ts, new).** The invented CV (the 8 lines of the CV in docs/MANUAL-CHECK-6.2.md, "Alex Example, Reporting Analyst ..."; no contact line), its `ExtractedCv` (three skills: SQL, Tableau, Excel, each with a line number and a quote from that line), and ten invented ads, each as ad text plus `ExtractedAd`. Reuse check (item 2f): nothing already holds readings in the AI's shape for CVs. tests/support/roadmapFixtures.ts holds hand-made `Job` objects (the very thing P0 warned about: DECISIONS 2026-11-17); tests/support/tenAds.ts (on the unmerged chain only) builds through `buildJob` but holds ten SQL-only ads and is not on main. fixtures/synthetic-ad-texts.ts has four ad TEXTS without readings, for other cities and skills. So the demo data is new, in the AI's shape, built through the same builder. The ten ads reuse the titles and companies of the manual checks (invented material) and are hand-worked in section 3.

**2.3 The state (lib/demo/start.ts, new; app/demo/page.tsx, new).** `startDemo()` is async and takes NO argument (so it can never be handed the person's store). It: (1) builds `CvBuildResult` with `fromCv`; (2) builds a `SavedContext` whose store is a new `MemoryStore` (lib/saved/store.ts, the in-memory double that already exists) with the real `currentStamps()` (Web Crypto, local) and a fixed clock; (3) for each of the ten ads builds the reading with `buildJob` and calls the real `saveJob(ctx, { adText, extraction, reading })`, each with its own fixed time so that ad 1 is the newest; (4) calls the real `listJobs`. The page hands the result to the same components through an object of the same type as the `useSaved()` result (`Saved`, imported as a TYPE only), so SavedControls.tsx needs no change except decision 6. Everything the real page computes (`buildProfile`, `reportFor`, `openedReadings`, `roadmapAds`, `roadmapBoxSafe`, `openJob`, `loadJob`) is called by the demo page as it is; the demo owns no counting or labelling code (a guard test, section 6).
**Isolation by construction:** the demo tree never imports `app/useSaved.ts` as a value, `lib/saved/idbStore.ts` or `app/accessFetch.ts`, never calls `saveProfile`, `deleteProfile` or `deleteAll`, and never renders `SaveAdButton`, `SaveProfileButton`, `SavedDeleteAll` or `SavedOffer`. The `MemoryStore` lives in the tab's memory only and dies with it. Impossible to save as the person's own: the only store the demo can reach is its own `MemoryStore`.

**2.4 Entry and exit.** A separate route `app/demo/page.tsx` (**[R]**), not a mode inside app/page.tsx. Reason: the real page reads IndexedDB when it mounts (app/useSaved.ts effect) and holds the person's unsaved state; a separate route cannot touch either, and "leave" is plain navigation, so the person's saved state is exactly as it was because nothing of it was ever in the demo tree. Entry: `<Link href="/demo" prefetch={false}>` styled as a button, in the intro of app/page.tsx, outside every condition (so it shows with or without the access code and with or without a CV). `prefetch={false}` so the home screen does not fetch the demo route in the background. Exit: `<Link href="/">Leave the demo</Link>` in the banner. A plain `<a>` is not used because the project's lint rule for internal links forbids it (to be confirmed in the build stage).
**Cost to say plainly:** navigating away from the real page drops whatever it holds in memory and was not saved (for example a CV that was read but not saved). Decision 3.

**2.5 The banner and the labels (lib/demo/messages.ts, new; the style of lib/saved/messages.ts, one exported constant per text).** The banner is rendered by app/demo/layout.tsx, so every page under /demo has it by construction. Proposed exact words:
- `DEMO_BANNER` = "Demo: invented data. The person, the CV and the ten job ads are made up. Nothing you do here is saved or sent anywhere."
- `DEMO_PREPARED` = "The AI readings in this demo were prepared in advance and are part of this page, so no AI is used and no request is made. The live version reads your own CV and ads with AI."
- `DEMO_ENTRY` = "Try a demo with invented data"; `DEMO_ENTRY_HINT` = "No upload and no access code. About one minute."
- `DEMO_EXIT` = "Leave the demo"
- `DEMO_TRY` = "Untick a skill below and watch the fit levels change."
- `DEMO_LOADING` = "Preparing the demo ..."
A new file (not lib/saved/messages.ts) because the unmerged chain edits that file (+75 lines).

## 3. The hand-worked data (written before any code; the build stage copies these numbers into the golden tests)

**The person.** Skills SQL (CV line 3), Tableau (line 4), Excel (line 5), all ticked; city Berlin typed; nothing else set. So only "location" is a judged constraint (the label reads "(judged: skills, location)", as in docs/MANUAL-CHECK-6.2.md).

**The ten ads** (invented; all Berlin and hybrid except ad 9; "m" = must-have, "n" = nice-to-have). Saved times fixed so that ad 1 is newest, ad 10 oldest.
| # | Title, company | m | n | gaps for the person | level |
|---|---|---|---|---|---|
| 1 | Reporting Analyst, Northlake Foods Ltd | SQL, Tableau | Excel | 0 | Strong |
| 2 | Data Clerk, Example Wharf Ltd | Excel | Python, Power BI | 0 | Strong |
| 3 | Sales Analyst, Cedar Mill Ltd | SQL, Excel | | 0 | Strong |
| 4 | BI Developer, Harbor Light Stationery | SQL, Python | Tableau | 1 (Python) | Good |
| 5 | Finance Analyst, Elm Court Ltd | Excel, Python | | 1 (Python) | Good |
| 6 | Data Engineer, Fern Dock Ltd | SQL, Python, Power BI | | 2 | Stretch |
| 7 | Dashboard Developer, Gorse Lane Ltd | Power BI, Tableau | SQL | 1 (Power BI) | Good |
| 8 | Reporting Lead, Ivy Gate Ltd | Power BI, Excel | | 1 (Power BI) | Good |
| 9 | Operations Coordinator, Imaginary Pages Ltd (city Exampleville) | SQL, Tableau | | 0 skills, 1 conflict that can't be closed soon (city) | Long shot |
| 10 | Marketing Analyst, Juniper Hall Ltd | Python, Power BI | | 2 | Stretch |
(Levels by the rules of DECISIONS 2026-11-14: 0 gaps Strong; exactly one missing must-have and no conflict Good; 2 gaps Stretch; a conflict that can't be closed soon Long shot.) Counts: Strong 3, Good 4, Stretch 2, Long shot 1 = 10. Each ad's text is written in the build stage with the exact quotes; the requirement names are the plain forms "SQL", "Excel", "Tableau", "Python", "Power BI" so stage 1 of the name mapping finds them exactly (no close spelling needed).

**Rows of the list** (profile in use; by level, then newest first): 1, 2, 3 (Strong); 4, 5, 7, 8 (Good); 6, 10 (Stretch); 9 (Long shot). Row lines: "Fit: Strong (judged: skills, location)" and so on; ad 9 also carries "Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon." (the same sentence the live check of 6.2 showed).

**The box, Part A (M = 10 counted ads).** Title "Skills you are missing across your 10 saved ads"; the subtitle constant; then, equal counts being ordered by display name (PLAN-7.1 Amendment 3), "Power BI: must-have in 4 ads, nice-to-have in 1 ad" (ads 6, 7, 8, 10; nice in 2) and "Python: must-have in 4 ads, nice-to-have in 1 ad" (ads 4, 5, 6, 10; nice in 2); no alternatives note, no could-not-judge line, no not-counted line; the held-back line "1 of your 10 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it."
**Part B (10 counted, so the roadmap shows):** "Already Strong: 3 jobs (Reporting Analyst, Northlake Foods Ltd; Data Clerk, Example Wharf Ltd; Sales Analyst, Cedar Mill Ltd)"; then the header "Skills to build, in order:". Greedy: Power BI alone unlocks ads 7 and 8 (2); Python alone unlocks ads 4 and 5 (2); a tie; ads 6 and 10 need both, so each skill brings 2 jobs one step closer (a tie again); nothing in progress; the skill id decides ("power-bi" before "python"). So line 1 "1. Power BI: unlocks 2 jobs (Dashboard Developer, Gorse Lane Ltd; Reporting Lead, Ivy Gate Ltd). Total so far: 2 jobs." Then Python now unlocks 4 (ads 4, 5, 6, 10): "2. Python: unlocks 4 jobs (BI Developer, Harbor Light Stationery; Finance Analyst, Elm Court Ltd; Data Engineer, Fern Dock Ltd; Marketing Analyst, Juniper Hall Ltd). Total so far: 6 jobs." Then "Blocked jobs (skills alone can't make these Strong): 1", "- Operations Coordinator, Imaginary Pages Ltd: blocked by 1 thing; it can't be closed soon", and the conflict line "(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin."
**With Tableau unticked** (the "untick and watch" case): ad 1 needs Tableau, so Good; ad 7 needs Power BI and Tableau, so Stretch; ad 9 stays Long shot. Counts: Strong 2 (ads 2, 3), Good 4 (1, 4, 5, 8), Stretch 3 (6, 7, 10), Long shot 1 (9) = 10. Part A has three rows: Power BI must 4 (6, 7, 8, 10) nice 1; Python must 4 (4, 5, 6, 10) nice 1; Tableau must-have in 3 ads (1, 7, 9), nice-to-have in 1 ad (4). Already Strong: 2 jobs. (The order of the rows and of the roadmap lines is the engine's and is pinned by tests/gaps.test.ts and tests/roadmap.test.ts; the build stage works it out by hand before its test is written, as the plan of 7.1 did.)
If any hand count here disagrees with the engine in the build stage, the build STOPS and reports; the expectation is not changed.

## 4. Files (new and changed; sizes are estimates)
| File | New or changed | What | Size |
|---|---|---|---|
| lib/demo/data.ts | new | the CV lines, `ExtractedCv`, ten ad texts and `ExtractedAd`, titles and saved times | about 200 lines |
| lib/demo/start.ts | new | `startDemo()` (section 2.3) | about 70 |
| lib/demo/messages.ts | new | the labels of section 2.5 | about 25 |
| app/demo/layout.tsx | new | the banner and the exit link, around every demo page | about 30 |
| app/demo/page.tsx | new | the demo page: wires the existing components | about 150 |
| app/DemoEntry.tsx | new | the entry button (one `Link`) | about 20 |
| app/page.tsx | changed | one import and one element in the intro (about 3 lines) | +3 |
| app/SavedControls.tsx | changed | an optional `readOnly` prop on `SavedAdsList` that hides Delete (default false: the real page is unchanged) | +4 |
| tests/demoData.test.ts, tests/demoState.test.ts, tests/demoView.test.ts | new | section 6 | about 400 |
No new package (rule 7). No change to lib/engine, lib/ai, lib/schemas, the API routes or the vocabulary.

## 5. Where to build
**Files the unmerged chain (7.3, 8.1, 8.2, 8.3) changes** (git diff --name-only origin/main...origin/step-8.3, 74 files outside docs, and 12 docs files): in the app, `app/page.tsx` (+20 and -4 lines: imports, the roadmap `useMemo` becomes `screenOutcomes`, the roadmap report, analytics and bullets views), `app/roadmap.ts` (+131 -58), `app/RoadmapView.tsx`, `app/accessFetch.ts`, and new views and a new route `app/api/bullets`; in lib, `lib/saved/messages.ts` (+75). **Of the files this plan changes, only app/page.tsx overlaps.** app/SavedControls.tsx, app/ConfirmBox.tsx and app/layout.tsx are not touched by the chain.
**Recommendation: build on main (59e1895) now [R].** (1) The demo must match the live site; the chain is not live. (2) It can ship alone and early (the "live and showable" milestone). (3) The merge cost either way is small: the demo edits app/page.tsx in two places far from the chain's hunks (an import after line 3, and an element after the intro paragraph at about line 169; the chain edits lines 18 to 26, 152 to 160, 246 and 273 to 295), so a clean merge is expected; a trial merge before the real one will show it. Today `git merge-tree --write-tree origin/main origin/step-8.3` is clean (exit 0), so the chain still merges onto main without help.
**If built on the chain tip instead:** the demo could also show the roadmap report and the analytics (both are plain code, no AI) but must EXCLUDE the bullets block (`/api/bullets` is an AI call) and its test; the demo page would copy the chain's `screenOutcomes` wiring; it could not ship before the chain is merged (9.2, 9.3 would wait too); a later change to the chain's page.tsx would then touch the demo. **Follow-up if built on main:** a small "9.1b" after the chain merges, to add the roadmap report and analytics to the demo.

## 6. Tests, written BEFORE any code (expectations hand-worked in section 3; every test fails first, red, before its code exists)
**tests/demoData.test.ts** (plain functions; the data and the engine)
- **D1** the bundled objects have the AI's shape: each `ExtractedAd` parses with `extractedAdSchema`, the `ExtractedCv` with `extractedCvSchema`. Expected: 10 of 10 and 1 of 1 parse.
- **D2** the CV through `fromCv`: 3 skills, in order SQL line 3, Tableau line 4, Excel line 5, all listed, removed 0, unlisted 0.
- **D3** each ad through `buildJob`: the ten (title, company) pairs equal the table of section 3 in order; `removed`, `moved`, `unlisted`, `notCounted` are all empty for all ten; each job's requirement skill ids are the table's.
- **D4** the levels, profile with all three ticked: the ten `fitLabel`s start with Strong, Strong, Strong, Good, Good, Stretch, Good, Good, Long shot, Stretch for ads 1 to 10, and the row order of `rankedAdRows` is 1, 2, 3, 4, 5, 7, 8, 6, 10, 9. Counts 3, 4, 2, 1.
- **D5** the box with all three ticked: `partA` and `partB` equal the texts of section 3 line for line; `counted` 10; `alreadyStrongIds` are the saved ids of ads 1, 2, 3.
- **D6** Tableau unticked: counts 2, 4, 3, 1 and the three Part A rows' texts; Already Strong 2 jobs.
- **D7 (the P0 lesson)** all ten jobs carry the job id "pasted-ad", the ten saved ids are ten different 16-character hex strings, and the "Already Strong" labels name ads 1, 2, 3 once each.
**tests/demoState.test.ts** (spies; `startDemo()` and everything after it)
- **S1 no network:** spy on `globalThis.fetch` (and `XMLHttpRequest`, `navigator.sendBeacon` where defined): after `startDemo()`, an untick, an open of every ad and the box, the spy was called 0 times.
- **S2 no browser storage:** replace `indexedDB`, `sessionStorage` and `localStorage` by objects that count every access: 0 accesses over the same run.
- **S3 only its own memory:** the context's store is an instance of `MemoryStore`; after `startDemo()` its `writes` equals 10 (ten `saveJob` puts, hand count) and still 10 after every untick and open; its "profile" list is empty.
- **S4 the person's data is untouched:** build a second `MemoryStore` standing for the person's own, with a saved profile and two saved ads; run `startDemo()`; the person's store, read back with `listJobs` and `loadProfile`, equals the snapshot and its `writes` is unchanged. (`startDemo` takes no argument, so this also pins that it cannot be given one.)
- **S5 the seam is the engine's:** each demo reading deep-equals `buildJob(extraction, text, skills, { id: "pasted-ad", source: null })` called directly, and the CV result deep-equals `fromCv(extraction, lines, skills)`.
**tests/demoView.test.ts** (source guards, as tests/savedAdRowsGuards.test.ts does; vitest has no browser here and no new package is allowed)
- **V1 the banner:** app/demo/layout.tsx renders `DEMO_BANNER` and the exit link; app/demo/page.tsx renders `DEMO_PREPARED`.
- **V2 the exact texts:** the constants equal the words of section 2.5 character for character.
- **V3 entry and exit:** app/page.tsx has exactly one `href="/demo"`, with `prefetch={false}`, not inside any conditional; the demo layout has exactly one `href="/"`.
- **V4 no save, no storage, no network in the source:** no file under app/demo, lib/demo or app/DemoEntry.tsx contains `fetch(`, `XMLHttpRequest`, `sendBeacon`, `indexedDB`, `sessionStorage`, `localStorage`, `saveProfile`, `deleteProfile`, `deleteAll`, `createIdbStore`, `postJson`, `SaveAdButton`, `SaveProfileButton`, `SavedDeleteAll`, `SavedOffer`, or an import from `lib/ai/`, `app/useSaved` (as a value) or `app/accessFetch`.
- **V5 no logic of its own:** the demo files contain none of the label words ("Strong", "Good", "Stretch", "Long shot") and none of the engine's constants; they call `reportFor`, `roadmapBoxSafe`, `roadmapAds`, `openedReadings` and `buildProfile`.
- **V6 read-only list:** with `readOnly`, the list part of SavedControls renders no Delete button; without it (the real page), it does. Guarded by source, plus the real page's existing tests unchanged.
**Numbers for the build stage:** main is 1,588 tests in 92 files. The plan adds 3 files and about 20 tests (7 + 5 + 6 = 18 named tests, some with several `expect`s); the build must report the new totals and that no existing test changed.

## 7. Deliberate breaks (run after the build; each must fail its NAMED test; a break no named test catches is a missing test)
| # | Break | Must fail |
|---|---|---|
| B1 | `startDemo` fetches its readings from a URL instead of using the bundled objects | S1; V4 |
| B2 | the demo context uses `createIdbStore()` instead of `MemoryStore` | S2, S3; V4 |
| B3 | `startDemo` calls `saveProfile` for the demo person | S3 (profile list not empty, writes 11) |
| B4 | one demo job is built by hand (distinct id "a1") instead of through `buildJob` | S5; D7 |
| B5 | the banner is removed from app/demo/layout.tsx | V1 |
| B6 | the demo page renders `SaveAdButton` | V4 |
| B7 | the exit link points to "/demo", or the entry link loses `prefetch={false}` | V3 |
| B8 | the requirement of ad 5 changed from must to nice Python | D4, D5 |
| B9 | all ten saved times equal | D5 (order of the Already Strong labels), D7 |
| B10 | "Power BI" in one ad typed "PowerBI" (unlisted) | D3 (unlisted must be empty), D5 |
| B11 | the readOnly list still renders Delete | V6 |
| B12 | the demo page imports the `ai` package through lib/ai/readJob | V4 |
**Known gaps, said openly:** a request made by the browser itself and not by our code (the page's own scripts and fonts, Next's route prefetch) cannot be seen by S1; B7's prefetch is guarded only as source text. Their real proof is step 4 of the manual check (section 10). A demo entry that is hidden by a CSS change is caught only by that manual check.

## 8. Privacy
The demo processes nothing about the visitor: no CV, no ad, no request, no storage, no access code. Everything shown is invented and bundled. The D2 rule (no real CV through the live page until Groq's retention terms are recorded) is untouched, and the demo is the way to show the product to a stranger without that rule being a problem. The real first screen still opens IndexedDB when it loads (the 6.1 read, creating an EMPTY database in a fresh browser); that happens before the visitor chooses the demo and is not the demo's doing, and the demo page itself never opens it. The banner and the prepared-readings sentence are the honest labels: the visitor sees a polished result of readings that were checked beforehand, not proof that the AI reads every ad correctly. 9.3's privacy page will link here; 9.2's limits do not apply (no request); 9.4's events must not count demo views as "profile confirmed" or "ad checked" (later item).

## 9. Risks and open points
1. A visitor may take the invented person's levels for their own. Stopped by the banner, the intro and the name "Alex Example"; not by anything else.
2. Prepared readings show the engine, not the AI's accuracy: the AI could misread a real ad. The sentence says so; case-study notes (10.3) should not quote demo numbers as accuracy.
3. The ten ads are chosen to show every part of the box (Strong, Good, Stretch, a blocked ad, a two-skill ranking); real use is messier. Said in the intro.
4. A vocabulary or rules change can change the demo's numbers. Intended: D4 to D6 fail loudly, and the hand counts are redone, never edited to fit.
5. Leaving the real page drops unsaved on-screen work (decision 3).
6. `Link` prefetch and Next's own scripts make requests that are not ours; the manual check looks at the Network tab for Fetch/XHR and "api" only, and says so.
7. The demo reads the vocabulary (the client already bundles it); the demo adds about 10 KB of data. To confirm in the build stage with the build output.
8. `app/demo/layout.tsx` uses the global `LayoutProps` type like app/layout.tsx (HANDOFF gotcha: run `npm run build` before `npx tsc --noEmit`).
9. Search engines may index /demo; harmless (invented data); a decision can follow.
10. SavedAdsList's other buttons: Open only reads a record from the demo's `MemoryStore`; checked by S3.

## 10. Manual check outline for the owner (no AI read at all; a fresh Incognito window; the live address or the preview)
1. Open the first screen without any access code. **Expect:** the button "Try a demo with invented data" with the hint under it, and the rest of the page as before.
2. Open the developer tools (Cmd+Option+I), tab **Network**, tick "Preserve log", clear it, choose the filter **Fetch/XHR**. Open the tab **Application**; note that IndexedDB `career-copilot` exists and its stores are empty (the real page created it when it loaded), and that sessionStorage has no access-code key.
3. Press the button. **Expect:** within a minute, the banner with the exact words of `DEMO_BANNER` at the top, the prepared-readings sentence, three ticked skills and "Berlin" in the cities box, ten saved ads and a box "What to learn" with the roadmap.
4. **Expect in the Network tab:** no row at all with the filter Fetch/XHR, and no row whose name contains `api`. (With the filter "All", the page's own files may show; those are not requests made by the demo's code.)
5. Read the list. **Expect:** ten rows in the order of section 3 (three Strong, four Good, two Stretch, one Long shot, the last with "Long shot because of location: ..."), no Delete button, no Save button anywhere.
6. Read the box. **Expect:** the texts of section 3 (Already Strong: 3 jobs ...; 1. Power BI ...; 2. Python ...; Blocked jobs ... 1).
7. Untick Tableau. **Expect:** the counts 2, 4, 3, 1 and Already Strong: 2 jobs; tick it again and the first counts return.
8. Press Open on the Operations Coordinator row. **Expect:** the report with the same "Fit:" line as its row.
9. In **Application**, look at IndexedDB and sessionStorage again. **Expect:** both exactly as in step 2 (nothing written).
10. Press "Leave the demo". **Expect:** the first screen, as in step 1, with the button; reload: no demo data anywhere.
11. If this browser has a saved profile and saved ads on this address, note the line "A profile is saved on this device" and the number of ads BEFORE step 3 and after step 10. **Expect:** identical. (If nothing is saved, step 9's empty stores are the proof.)
12. Write down any word on the screen that suggests the data is the visitor's own, or that the AI read it live.

## 11. Decisions for the owner (each taken as recommended in this draft; the owner can overrule before the build)
1. **Where the demo lives.** Options: a separate page /demo **[R]**; a mode inside the first page. A separate page cannot touch the person's saved data by construction and leaving is just navigation; a mode inside the page is one click closer but shares state with the real page. Matters because "my data is never touched" is the promise a first-time visitor needs.
2. **How many sample CVs.** Options: one now **[R]** (a second and third later); three now (the sprint's wording). Each CV needs its own hand-worked levels and roadmap; one gets the product shown sooner and costs one set of golden numbers.
3. **What happens to unsaved work when the visitor enters the demo.** Options: same tab, unsaved work on the real page is lost **[R]**; open the demo in a new tab (nothing lost, but two tabs and no single "way out"); hide the entry once a CV has been read (nothing lost, but the demo vanishes for someone who may want it). Matters because a person who already spent an AI read should not lose it by a click that looks harmless.
4. **Build base.** Options: main now **[R]**; the chain tip after 8.3 is merged. See section 5; matters for when strangers can try the product (earlier on main).
5. **The ten ads.** Options: ten mixed-outcome ads (section 3) **[R]**; the ten SQL-only ads of docs/MANUAL-CHECK-TEN-ADS.md, already hand-checked but all Strong and a one-line roadmap. Matters because the demo is the product's first impression: the mixed set shows the gap list, the ranking and a blocked ad.
6. **Delete buttons in the demo list.** Options: hidden **[R]**; shown and working on the demo copy. Shown ones let a visitor drop below 10 ads and see the threshold line, at the price of a way to break the demo state that only a reload repairs.
7. **Language.** English only **[R]**; a German CV and German ads too (the engine reads both; the owner can check German). Matters for the first testers (10.1) if they read German.

## 12. Amendments of the reviewer (2026-11-24)

**A1. Manual check step 4 and the "Known gaps" of section 7.** The entry button is a Next `Link`. Pressing it makes Next itself fetch the demo route's data, so one Fetch/XHR row whose name contains `demo` or `_rsc` can appear right after the click; it is not a request of the demo's code. New order for the manual check: after the demo screen is fully shown, clear the Network log (filter Fetch/XHR), then untick Tableau, tick it again and press Open on two rows. Expect: no row at all. For the click itself expect: no row whose name contains `api` and no request to any address other than this site. S1 stays as written (it counts calls made by our code).

**A2. Session storage is never opened in the manual check.** On the real page it holds the access code (standing rule of the owner). Steps 2, 9 and 11 look at IndexedDB only. Test S2 still spies on sessionStorage and localStorage.

**A3. The label `DEMO_PREPARED` is now exactly:** "The AI readings in this demo were prepared in advance and are part of this page. No AI is used here, and nothing you do in the demo is sent anywhere. The live version reads your own CV and ads with AI." `DEMO_BANNER` stays as in section 2.5. Rule: no label may say that "no request is made" for the page as a whole (loading a page is a request); a claim must be about what the visitor does in the demo. Test V2 compares these exact words.

**A4. New names for the ten ads.** The ten ads keep the skills, the levels and the order of section 3 and the city rule (Berlin; ad 9 in Exampleville), but their titles and companies are replaced by new invented ones. Rule: none of the ten titles-with-company and none of the ten companies occurs, ignoring case, anywhere in docs/, tests/, fixtures/, lib/ or app/ of origin/main and origin/step-8.3. Proof, by a case-insensitive search of both branches: for each of the ten, the number of hits of "title, company" and the number of hits of the company are 0 and 0 (a control search for "Northlake Foods Ltd" finds 33 lines, so the search works). The CV stays "Alex Example" and the city Exampleville stays. The final table replaces the table of section 3; the texts below replace the texts of section 3 and change nothing but the names. Redone by hand with the new names: every number of section 3 is unchanged (Strong 3, Good 4, Stretch 2, Long shot 1; with Tableau unticked 2, 4, 3, 1).

| # | Title | Company | City | Must-haves | Nice-to-haves | Level (all three ticked) |
|---|---|---|---|---|---|---|
| 1 | Insight Analyst | Quillon Foods Ltd | Berlin | SQL, Tableau | Excel | Strong |
| 2 | Records Clerk | Marrowby Freight Ltd | Berlin | Excel | Python, Power BI | Strong |
| 3 | Revenue Analyst | Tarnbridge Mills Ltd | Berlin | SQL, Excel | | Strong |
| 4 | BI Engineer | Pellwick Print Ltd | Berlin | SQL, Python | Tableau | Good |
| 5 | Budget Analyst | Ostrander Glass Ltd | Berlin | Excel, Python | | Good |
| 6 | Data Platform Engineer | Fenwick Quarry Ltd | Berlin | SQL, Python, Power BI | | Stretch |
| 7 | Dashboard Specialist | Corvane Tools Ltd | Berlin | Power BI, Tableau | SQL | Good |
| 8 | Management Reporting Lead | Haldane Paper Ltd | Berlin | Power BI, Excel | | Good |
| 9 | Site Coordinator | Wexcombe Textiles Ltd | Exampleville | SQL, Tableau | | Long shot |
| 10 | Campaign Analyst | Yarrowdale Games Ltd | Berlin | Python, Power BI | | Stretch |

The texts (all three skills ticked, city Berlin):
- *Row order of the list* (by level, then newest first): ads 1, 2, 3, 4, 5, 7, 8, 6, 10, 9, that is Insight Analyst, Records Clerk, Revenue Analyst, BI Engineer, Budget Analyst, Dashboard Specialist, Management Reporting Lead, Data Platform Engineer, Campaign Analyst, Site Coordinator. Each row's line is "Fit: <level> (judged: skills, location)". Ad 9 also carries "Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon."
- *Part A of the box, five lines in this order:* "Skills you are missing across your 10 saved ads"; the subtitle "(Counted against the profile in use. Must-haves and nice-to-haves are counted apart.)"; "Power BI: must-have in 4 ads, nice-to-have in 1 ad"; "Python: must-have in 4 ads, nice-to-have in 1 ad"; "1 of your 10 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it." (The two rows are in this order because the engine sorts by must-have count, then nice-to-have count, then lower-case display name: lib/engine/gaps.ts lines 66 to 75.)
- *Part B of the box, seven lines in this order:* "Already Strong: 3 jobs (Insight Analyst, Quillon Foods Ltd; Records Clerk, Marrowby Freight Ltd; Revenue Analyst, Tarnbridge Mills Ltd)"; "Skills to build, in order:"; "1. Power BI: unlocks 2 jobs (Dashboard Specialist, Corvane Tools Ltd; Management Reporting Lead, Haldane Paper Ltd). Total so far: 2 jobs."; "2. Python: unlocks 4 jobs (BI Engineer, Pellwick Print Ltd; Budget Analyst, Ostrander Glass Ltd; Data Platform Engineer, Fenwick Quarry Ltd; Campaign Analyst, Yarrowdale Games Ltd). Total so far: 6 jobs."; "Blocked jobs (skills alone can't make these Strong): 1"; "- Site Coordinator, Wexcombe Textiles Ltd: blocked by 1 thing; it can't be closed soon"; "(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin."
- *With Tableau unticked:* levels by ad 1 to 10: Good, Strong, Strong, Good, Good, Stretch, Stretch, Good, Long shot, Stretch (Strong 2: Records Clerk and Revenue Analyst; Good 4: ads 1, 4, 5, 8; Stretch 3: ads 6, 7, 10; Long shot 1: ad 9). Part A rows, in this order: "Power BI: must-have in 4 ads, nice-to-have in 1 ad"; "Python: must-have in 4 ads, nice-to-have in 1 ad"; "Tableau: must-have in 3 ads, nice-to-have in 1 ad". Part B first line: "Already Strong: 2 jobs (Records Clerk, Marrowby Freight Ltd; Revenue Analyst, Tarnbridge Mills Ltd)".

**A5. The ten saved times.** `SavedContext` has an optional clock, `now?: () => Date` (lib/saved/saved.ts line 14); `nowOf(ctx)` reads it (line 22) and `saveJob` writes `savedAt: nowOf(ctx).toISOString()` (line 78). So `startDemo` calls the real `saveJob` once per ad with `{ ...ctx, now: () => new Date(Date.UTC(2026, 10, 24, 10, 10 - i, 0)) }` for ad number i (1 to 10): ad 1 is saved at 10:09:00 and ad 10 at 10:00:00 on the same fixed day, so the list (newest first) is ad 1 to ad 10. No change to lib/saved is needed.

**A6. Build stage, after `npm run build`:** print the /demo line of the route table and search the built client files under .next/static for the strings `generateText` and `@ai-sdk`; expected 0 hits in files used by /demo (the AI library must not enter the demo's bundle). If a hit exists, report which chunk.

**A7. Merge time.** The unmerged chain and this step both append lines at the end of docs/DECISIONS.md and edit docs/SPRINT.md and docs/HANDOFF.md, so those files may conflict at merge time. At merge time run the trial merges (`git merge-tree --write-tree`) of step-9.1 with each chain branch before any real merge; resolve by keeping both sides' lines, never by dropping one, and only with the reviewer. The merge-time docs commit records, in DECISIONS, that 9.1 builds ONE sample CV and TEN ads where SPRINT says three CVs (decision 2), and amends the wording of SPRINT 9.1.

**A8. Decisions 1 to 7 are taken as recommended.** Riders: no new dependency for browser tests (source guards plus the manual check stand); the stale header comment of app/page.tsx ("nothing is stored") is NOT touched by 9.1 (later item); decision 3 adds no warning text.
