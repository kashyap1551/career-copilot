STATUS: APPROVED by the owner on 2026-11-16, with the reviewer's answers to section 12: (1) offer the saved profile with one click, nothing automatic; (2) one record per ad text, savedAt updated; (3) fit level computed on opening; (4) a stored profile is used and deleted, not edited; (5) the small controls on the existing page are enough for the 15-ad check; (6) a re-check is not written back; (7) no cap on saved jobs; (8) no fake-indexeddb now; (9) the extraction field, READING_VERSION "3" and the AD_REQUEST_HASH constant are approved. Amended on approval (2026-11-16): sections 1, 2, 2a, 4, 7, 8, 9 and 11 (the build order), and decisions 1 to 9 of the approval, are written into this text. Written 2026-11-16. Careful lane (privacy, storage, a record that a reading depends on). No code, no AI call, no change to the vocabulary, NOT_A_SKILL or any rule is made by writing this plan.

# Plan for step 6.1 (and the data side of 6.2): keep the profile and saved jobs on this device

Goal (docs/SPRINT.md, Day 6): the profile and saved jobs live in the browser's own database (IndexedDB); no accounts. Check: 15 saved ads survive a reload. This plan fixes the record shapes, the storage interface, versioning, failure handling, the tests and the privacy position. It builds no 6.2 screen (jobs page, list, fit level per job) and no 6.3 screen (fit report page).

Built on the reviewer's six answers (the owner may overrule at approval). Standing decisions it rests on: DECISIONS 2026-11-13 (the MVP keeps each person's data in their own browser; no accounts, no database), D6 of 2026-11-15 (nothing stored until step 6.1), D2 (privacy before a CV goes to the AI), CLAUDE.md "MVP storage: the browser (IndexedDB)".

## 1. What is stored: the confirmed profile, not the CV

**Finding (checked in the code, 2026-11-16).** Something DOES read `cvLines` after the profile is built: `lib/engine/match.ts:58`, `citesCvLine`: a skill counts as met only if `profile.cvLines[evidence.line - 1] === evidence.text` ("no evidence, never met"). Other readers: `app/skillsOnly.ts` (the typed-list path, which builds its own lines and is not stored) and tests and fixtures. `profile.name` is the constant "You"; `profile.id` is the constant "confirmed-profile".

**Smallest alternative (proposed, fits answer 1).** Store no CV text at all except the lines the profile cites. Each kept `have` skill already carries `evidence: { line, text }`. On opening, rebuild a sparse `cvLines`: an array whose length is the highest cited line number, with `cvLines[line - 1] = text` for every cited line and `""` elsewhere. After saving, the engine's `citesCvLine` check is satisfied BY CONSTRUCTION: the sparse array is built from the same evidence text the check compares it with, so the check can no longer catch anything on a stored profile. That is fine and must be said plainly: the real guard is at BUILD time, when the AI's quote is checked against the real CV (`fromCv`); a stored profile is the person's own statement about themselves. A hand-worked test shows the engine and the page report give the same result for a saved and reloaded profile as for the one just built (section 8, S2), a test documents the limit (S2b), and a test shows an uncited CV line never reaches the stored record (S3).

Stored profile record (key `"current"`; one profile in 6.1):

```ts
type SavedProfile = {
  schemaVersion: 1;
  savedAt: string;                    // ISO date-time, set when the person clicks Save
  skills: ProfileSkill[];             // existing engine type: "have" (skillId, evidence {line, text} or null) and "inProgress" (skillId, expectedDate)
  constraints: ProfileConstraints;    // languages, locations, workModes, years, availableFrom
  set: Record<Kind, boolean>;         // which constraint kinds the person set (location, language, workMode, years, startDate)
  stamps: { vocabularyHash: string; readingVersion: string };
};
```

Not stored: the whole CV text, the raw AI proposals, unticked proposals, the names of unlisted or ignored skills, the problems and notes shown on the confirm screen. A saved profile whose vocabulary stamp differs from the current one is used as it is. A skill id that is no longer in the vocabulary on opening is shown as "no longer in our skill list" (never dropped silently from what the person sees, and never counted as met: it is left out of what the engine gets).

Consequence to approve: a stored profile is for JUDGING. Changing it means reading the CV again (the CV is not kept). Open question Q4.

## 2. Saving is explicit; deleting ships with 6.1

- A "Save on this device" button next to the confirmed profile (and next to a read ad, for a job). Nothing is written to the browser without a click. Reading, building and opening never write. A test counts writes (S4).
- A one-line notice next to the button, wording (the reviewer's privacy decision of 2026-11-16 added the shared-computer sentence): "Saved on this device, in this browser only. It is not sent anywhere, and anyone who can use this browser can see it. You can delete it at any time. In a private window it is deleted when you close the window."
- A "Delete everything saved on this device" button, with a confirm step, deletes the profile and all saved jobs (S9). It ships with 6.1. The privacy page and consent stay in 9.3.
- 6.1 puts only these small controls on the existing page `/`: Save profile, Save this ad, one status line ("1 profile and N jobs saved on this device"), Delete everything. The saved-jobs LIST screen is 6.2 (Q5).

## 2a. What the page shows when a saved profile is loaded

A loaded profile has no CV proposals, so the confirm screen cannot be shown. Instead the page shows a READ-ONLY summary of exactly what is stored: the skills with the cited line's text, the in-progress skills with their dates, the constraints, and which constraint kinds were set; a skill id no longer in our list is marked "no longer in our skill list". Two actions: "Delete" and "Read a CV again". Nothing else can be edited (answer 4). The page work is part 3 of the build order (section 11); part 1 builds only the pure helper that produces the summary data.

## 3. The saved job record (the data side of 6.2)

```ts
type SavedJob = {
  schemaVersion: 1;
  id: string;                         // first 16 hex characters of SHA-256 of the cleaned ad text: saving the same ad twice is one record (Q2)
  savedAt: string;
  adText: string;                     // the cleaned (trimmed) ad text, exactly what was sent to the AI
  extraction: ExtractedAd | null;     // the AI's raw reading (names as the AI wrote them); null if unavailable
  reading: { job: Job; removed: RemovedItem[]; moved: ...; unlisted: Skill[]; notCounted: NotCounted[] };  // the checked reading as shown when saved (job carries closeMatches)
  stamps: { vocabularyHash: string; readingVersion: string; adRequestHash: string };
  // Reserved, NOT built in 6.1: removedByYou?: { quote: string }[]  (a remove-only tick list of requirements)
};
```

No fit level is stored: it is computed when a job is opened, against the profile as it is then (the profile can change). The ad is public text; the reading is derived from it.

**Can /api/read return the raw extraction cheaply? Yes (costed).** `readJobAd` already holds the AI's output (`output: ExtractedAd`) before `buildJob`. Add it to the result as one additive field (`extracted`), carry it in `CachedReading` (`lib/ai/readCache.ts`) as `extraction`, and return it from the route. Cost: the response grows by about the size of the job JSON again (about 2 to 3 KB for a typical ad); no extra AI call; no change to the prompt or the schema, so the request hash 85357f8fac does not move. The existing route test that lists the answer's keys (`readRoute.test.ts`: "job, removed, moved, unlisted and notCounted, and nothing else") and the cache tests change deliberately, with the new field. The cache value shape changes, so `READING_VERSION` goes from "2" to "3" (its documented purpose), and the pin test is updated with it. The page ignores the new field except when saving.

**The stamps in the browser.**
- `readingVersion`: the constant from `lib/ai/readingVersion.ts` (pure; importable in the browser).
- `adRequestHash`: do NOT compute it on a live server: `captureRequest` swaps `fetch` and the key process-wide for a moment, which is unsafe next to real requests. Instead add a constant `AD_REQUEST_HASH = "85357f8fac"` next to `READING_VERSION`, and extend the existing pin test so the constant must equal the hash the code computes (change the prompt without updating it: the test fails). The browser reads the constant.
- `vocabularyHash`: `vocabHash()` uses `node:crypto` and cannot run in the browser. Add a browser-safe async version with Web Crypto (`crypto.subtle.digest("SHA-256", ...)`, available in the browsers we support and in Node 20 for the tests) over the same `stableStringify` of the same four parts; a test proves it equals the Node `vocabHash()` for the real vocabulary (S12). No new package.

**How an old record is opened** (decided by comparing its stamps with the current ones; a table test, S6):

| Stamps compared with now | Opened as |
|---|---|
| `schemaVersion` newer than this app knows | Shown as "saved by a newer version of this app", not opened, never changed or deleted by the app |
| everything equal | Shown as stored |
| `adRequestHash` differs | The old reading is shown, marked "read with older instructions", and an AI re-read is OFFERED (asked first; one AI call; never automatic) |
| `adRequestHash` equal, `vocabularyHash` or `readingVersion` differs, `extraction` present | Plain code (`buildJob` / `fromAd`) is re-run in the browser on the stored extraction and ad text; no AI call; marked "re-checked with the current vocabulary". Not written back (nothing is written without a click; the re-check is cheap and deterministic) |
| same, but `extraction` is null | Cannot be re-checked: the old reading is shown, marked as old, and an AI re-read is offered |

Fallback if the owner prefers not to add the `extraction` field: store the checked reading only; any stamp difference then means "show the old reading, marked, offer a re-read". Cost: every vocabulary change would turn all saved jobs into AI re-reads (free-tier tokens). The reviewer's answer 4 prefers the extraction.

## 4. The storage interface

A small interface, no library:

```ts
type StoreName = "profile" | "jobs";
interface KeyValueStore {
  get(store: StoreName, key: string): Promise<unknown | undefined>;
  put(store: StoreName, key: string, value: unknown): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  list(store: StoreName): Promise<{ key: string; value: unknown }[]>;
  clear(): Promise<void>;                     // both stores
}
```

- `MemoryStore` (in-memory double) implements it; ALL logic is tested against it.
- `IndexedDbStore` (a thin adapter, about 60 lines, database `career-copilot`, version 1, two object stores) implements it. A write counts as done only when the TRANSACTION completes (`oncomplete`), not when the request succeeds (`onsuccess`): a request can succeed and the transaction still abort (quota, a closed page). The manual checklist (save, reload, still there) is what proves it. Errors are mapped to three typed outcomes: `unavailable`, `quota`, `failed`.
- A logic layer (`saved.ts`, pure, takes a store): `saveProfile`, `loadProfile`, `saveJob`, `listJobs`, `loadJob`, `deleteJob`, `deleteAll`, each returning a result object (`{ ok: true }` or `{ ok: false, reason }`) and never throwing for a storage problem. Records are validated on reading with Zod (an existing dependency).

**The adapter and automated tests (answer 3).** The adapter only opens, reads and writes by key; every rule is above it. I judge a hand-checked adapter acceptable for the MVP (the manual checklist in section 7 covers save, reload, delete and 15 jobs). The cost of automating it: `fake-indexeddb`, a dev-only package (a rule-7 question, nothing installed by this plan); worth it only if the adapter grows. Recommendation: do not install it now (Q8).

## 5. Versioning and migration

- Every record carries `schemaVersion` (1 now). `SCHEMA_VERSION` is one constant; the IndexedDB database version is separate and changes only if an object store is added.
- A new OPTIONAL field (for example `removedByYou`) needs no migration: a reader treats an absent field as empty, and an old app that meets a record with extra fields keeps them when it does not write. A change that is not additive bumps `schemaVersion` and adds one migration function `vN -> vN+1`; migrations run in a chain on opening, in memory, and are written back only when the person saves.
- A record with a LARGER `schemaVersion` than the app knows is left untouched (see the table). A record that fails validation is "corrupted" (section 6), never repaired by guessing.
- A test (S5) proves a field can be added without losing saved data: a fake v2 migration that adds a field, applied to a v1 record, keeps every v1 field.

## 6. Failure cases (the app always works without saving)

| Case | What happens | Message (plain) |
|---|---|---|
| IndexedDB blocked by a browser setting or a company policy (private windows normally work; see section 7) | Save buttons are disabled; everything else works as today | "Saving is not available in this browser (a setting or a policy blocks it). You can still use everything else; nothing will be kept." |
| Quota full on a write | The write returns `quota`; nothing partial is kept; the page keeps working | "Not saved: this browser's storage for this site is full. Delete some saved jobs and try again." |
| A write fails for another reason (aborted transaction) | `failed`; nothing partial | "Could not save. Please try again." |
| A record is corrupted (fails validation) | The list shows the others; the bad one is counted and can be deleted | "1 saved item could not be read. You can delete it." |
| Another tab upgrades or deletes the database | The connection closes cleanly (`versionchange`) and reopens on the next action | none, or "Reload the page" |
| Delete everything fails | The result says so; nothing claims success | "Could not delete everything. Try again, or clear this site's data in your browser settings." |

## 7. Privacy

- **What is stored:** the confirmed profile (skill ids; for each kept skill the cited CV line's number and exact text; in-progress skills with dates; the constraints and which kinds were set) and saved jobs (public ad text, the AI's reading of it, stamps, dates). Not the full CV, not names or contact details beyond what a cited line happens to contain (D2: names and addresses cannot be removed reliably, and a cited line, for example an employer line, can hold them).
- **Where:** this browser's IndexedDB for this site's address. No server copy, no cookie, no other service. Saving makes no network call (a test spies `fetch`, S4).
- **How long:** until the person deletes it ("Delete everything saved on this device"), or until the browser or the person clears this site's data. There is no expiry in 6.1.
- **Shared computer:** anyone using the same browser profile can open the site and see the saved profile's cited lines and the saved jobs. There is no password and no encryption (the browser's own separation between sites and profiles is the only wall). The notice and the delete button are the mitigation. This is stated in the one-line notice next to Save, and the full privacy page comes in 9.3.
- **Private windows:** IndexedDB works in private windows in current browsers (Firefox 115 and later; Chrome and Safari as far as known), and the data is discarded when the window closes. The notice says so. Whether it works in each browser is checked by hand (section 9).
- **The site address:** saved data belongs to the site address (the origin). A preview deployment on another address, or a future custom domain, starts empty; nothing is carried across.
- **The Groq terms check still gates any real CV through the live AI reading** (D2 and HANDOFF: training terms and Zero Data Retention unverified; an access code is still to be built). Storing on this device does not change what is sent to Groq; "Save" sends nothing.
- No secrets or keys are involved; nothing is logged.

## 8. Tests, written before the code (hand-worked; in-memory double; no AI call)

| # | Test | Hand-worked expectation |
|---|---|---|
| S1 | The store interface: put, get, list, delete, clear on the double | put 3 keys, get returns each, list has 3, delete one leaves 2, clear leaves 0; a missing key is `undefined` |
| S1b | 15 saved jobs survive a "reload": a second `saved` layer over the same backing data lists the same 15 | 15 saved, 15 listed, ids equal |
| S2 | Save, load and match gives the same answer as the profile just built | (a) for a built profile from a made-up CV: save, load, `match` gives the same fit level, met and missing lists as the profile with the full CV; (b) `profileReport(job, builtFromSaved(saved), skills, [])` equals `profileReport(job, built, skills, [])` for the same job; (c) a hand-added skill with `evidence: null` is still not met |
| S2b | DOCUMENTS the limit: a stored profile whose evidence text was edited still counts as met | the check is satisfied by construction (section 1); the test says so in its name |
| S3 | The stored profile holds no uncited CV line (and S13: nothing under `lib/saved`, and nothing it imports, uses `node:` or `fs`) | a CV with 10 lines, 3 cited: the serialised record contains the 3 texts and none of the other 7 |
| S4 | Nothing is written without a click; saving makes no network call | building and opening a profile: 0 `put` calls; `saveProfile` once: 1 `put`; `fetch` spy: 0 calls |
| S5 | Versions: v1 opens; a future version (99) is reported "newer", left untouched, not deleted; an absent optional field reads as empty; a fake v2 migration keeps all v1 fields | as written |
| S6 | The stamp table of section 3, every row | 5 rows, each one outcome |
| S7 | A re-check from the stored extraction equals what a fresh `buildJob` gives under the current vocabulary, and calls no AI | with a stored extraction containing "Experimenten" and a stub vocabulary difference: the re-checked reading carries the close match; the `fetch` spy has 0 calls |
| S8 | Failures return results, never throw: quota on put, unavailable store, one corrupted record among 3 | `{ok:false, reason:"quota"}`; save disabled state; list gives 2 and a corrupted count of 1; deleting the corrupted one works |
| S9 | Delete everything empties both stores | after `deleteAll`: profile undefined, jobs listed 0 |
| S10 | The same ad saved twice is one record; two different ads are two | ids from the text hash; 1 record, then 2 |
| S11 | `/api/read` returns `extraction`; a cache hit returns the same; request hashes unchanged; READING_VERSION "3" pinned with 85357f8fac; the constant `AD_REQUEST_HASH` equals the computed hash | as written |
| S12 | The browser-safe vocabulary hash equals the Node `vocabHash()` | equal strings |

**Deliberate breaks planned (Python, each reverted, each CAUGHT or MISSED; every MISSED gets a real test):** (1) save on build, without a click (S4); (2) off-by-one in the sparse rebuild (S2); (3) store the whole `cvLines` (S3); (4) treat a version-99 record as version 1 or overwrite it (S5); (5) re-check ignores a vocabulary difference, or a re-check calls the AI (S6, S7); (6) throw on quota instead of returning a result (S8); (7) one corrupted record empties the whole list (S8); (8) `deleteAll` leaves the jobs (S9); (9) a different job id per save (S10); (10) `extraction` dropped from the cache value or the route (S11); (11) READING_VERSION left at "2" (S11); (12) the browser hash differs from the Node hash (S12).

## 9. Manual browser checklist (the adapter, by hand, with the real IndexedDB)

Run locally and once on the live site, in Chrome and Safari (and Firefox private mode for the unavailable case). Written results go in the end-of-day notes.
1. Read the made-up CV, confirm, click "Save on this device": the status line says 1 profile; reload: the profile is still found and can be used (this is also the check that the write counted only after the transaction completed: save, reload at once, still there).
2. Read a made-up ad, click "Save this ad": the status line says 1 job; reload: still 1.
3. Save 15 different made-up or public ads: the status line says 15 jobs; reload; close the tab and reopen: still 15 (the 6.1 check).
4. Save the same ad again: still 15 (one record per ad).
5. Delete everything: the confirm appears; after it: 0 and 0; reload: still 0.
6. Private window (Firefox, and Chrome or Safari as far as available): save a profile and a job; it works and survives a reload inside the same window; close the window, reopen the site in a new private window: gone (0 and 0).
7. Open the browser's storage inspector (Application > IndexedDB): the stored profile holds only cited lines and no uncited CV line.
8. Fill the browser's quota is not tested by hand; the quota path is covered by S8.

## 10. What is NOT in 6.1

The jobs page and the saved-jobs list with fit levels (6.2); the fit report page (6.3); the remove-only requirement list (only the room for it); editing a stored profile; accounts, sync or export and import; the privacy page, consent and Impressum check (9.3); usage events (9.4); encryption; an AI re-read button's UI (6.2; 6.1 only marks the record and returns the stamps decision); the item 12 decision (unlisted requirements count as not met), which is settled before 6.2; no new package, no change to the vocabulary, NOT_A_SKILL or any rule, and no change to the prompts or the request hashes (85357f8fac, 193e02ee3f).

## 11. Build order (approved)

- **Part 1 (logic and tests, no UI, no route change):** `lib/saved/` with the types, `KeyValueStore`, `MemoryStore`, the logic layer, the pure helpers (sparse rebuild, `builtFromSaved`, `jobIdFor`, `openJob`), tests S1 to S10, S2b and a no-node-imports test (S13). It takes the CURRENT stamps as parameters, so it does not depend on part 2.
- **Part 2 (route, extraction, hashes):** `/api/read` returns `extraction`; `READING_VERSION` "3"; the `AD_REQUEST_HASH` constant and its pin; the browser-safe vocabulary hash (S11, S12).
- **Part 3 (adapter and page):** the `IndexedDbStore` adapter, the page controls (Save profile, Save this ad, the status line, Delete everything), the loaded-profile summary (section 2a), and the manual browser checklist.

## 12. Open questions for the owner (answered at approval, kept for the record)

1. **Opening the profile.** When a saved profile exists, should the page offer it ("A saved profile was found: use it / delete it") or apply it automatically? Proposal: offer, one click, nothing automatic.
2. **Same ad saved twice.** One record per ad text (updated), as proposed, or a new record each time?
3. **Fit level on a saved job.** Computed on opening (proposed), not stored. Agreed?
4. **Editing a stored profile.** In 6.1 it can be used and deleted, not edited; to change it, read the CV again. Acceptable until a profile edit screen exists?
5. **The "15 saved ads" check without a list screen.** 6.1 adds only Save profile, Save this ad, a status line and Delete everything to the existing page; the list is 6.2. Acceptable, or wait for the 6.2 screen?
6. **Re-check not written back.** A re-check on opening is shown but not saved unless the person saves again. Acceptable?
7. **Retention.** No limit on the number of saved jobs in 6.1 (a full quota gives the message in section 6). Add a soft cap?
8. **`fake-indexeddb` (dev-only, rule 7).** Not installed; recommended to wait. If you want automated adapter tests, say so and it is a separate ask.
9. **`extraction` in the response (section 3).** Approve the additive field, `READING_VERSION` "3" and the `AD_REQUEST_HASH` constant; or choose the fallback.
