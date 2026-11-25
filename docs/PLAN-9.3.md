# PLAN 9.3: privacy page, consent, "delete my data", Impressum question (PLAN ONLY)

Branch `step-9.3`, cut from main at da51b0c. Stage 1: this plan, no code, no tests, no page. Written 2026-11-25. Careful lane (privacy, anything that makes a claim about data).

**Rules this plan keeps:** the page never says more than the code and a test prove; a fact we do not know is shown as "not confirmed yet", never guessed; nothing here states anything about Groq's or Vercel's terms from memory (section 3); no legal text, no address, no phone, no email (section 7); CC and the reviewer are not lawyers and nothing here claims legal compliance.

**What I read first, and where this plan differs** (SPRINT 9.3, DECISIONS D2 of 2026-11-15 and its Groq line, the cache line of 2026-11-16, the access-code lines of 2026-11-17, HANDOFF, PLAN-4.1 line 48):
1. SPRINT says "consent before a CV **upload**". A file is read on the device (lib/cv/fileToText.ts; tests/fileToText.test.ts proves fetch is never called); data leaves only on "Send for reading". So consent attaches to the **send**, not the file choice.
2. SPRINT says "a 'delete my data' button". One already exists on main: "Delete everything saved on this device" (app/SavedControls.tsx:200-239), with a confirm step, clearing the saved profile and all saved ads (lib/saved/saved.ts:146) and forgetting the tab's access code (app/accessFetch.ts:77). 9.3 **extends** it (section 5); it is not a new button.
3. D2(b) built a notice for the **CV** (app/CvBox.tsx:153-157). The **ad** button ("Read this ad", app/page.tsx:230-236) has no notice at all, and the ad text is sent whole, **not cleaned** of contact details (lib/schemas/job.ts:70-78 only trims and caps). D2 never covered ads. This plan does.
4. D2(a): Groq's terms are "partly verified" in DECISIONS (a tool's summary, training not stated, owner told to read the sentences and consider Zero Data Retention). Nothing shows the owner did. This plan treats every Groq term as **unknown** until the owner brings the words (section 3). D2 also says no real CV goes through the live page until (a) is recorded and the owner agrees: the gate in section 3 is that rule made mechanical.
5. SPRINT says "no CV text in logs". That is already designed and tested (docs/PLAN-4.2.md; tests E8, K6, N1). 9.3 adds proof at route level and at the AI SDK level and trip-wires for later changes; it builds no new logging behaviour.
6. PLAN-4.1:48 says "the Day 9.3 privacy page must say which" Vercel region. The repo sets none (no `preferredRegion`, no vercel.json, grep of app/ and next.config.ts), so the region is unknown to the code; the owner reads it in the Vercel dashboard (section 3).
7. SPRINT 9.2 (daily cap) is not built. A cap that counts per person adds a new data flow; when 9.2 or 9.4 land they fall under the future rule (section 8).

---

## 1. DATA-FLOW INVENTORY

### 1.1 Main (da51b0c)

**What leaves the browser.** Two requests, both `POST` JSON through ONE helper, `postJson` (app/accessFetch.ts:94-113). No other `fetch(`, `XMLHttpRequest`, `sendBeacon` or socket exists in app/ or lib/ outside lib/ai (server) and the helper (grep, section 9 test I3). The browser never calls Groq: no Groq host or `@ai-sdk` import is under app/ except the two route files (test I7).

| | `/api/cv` | `/api/read` |
|---|---|---|
| Trigger | the button "Send for reading", `send()` at app/CvBox.tsx:73-93, `postJson` at :80, button at :162-167 | the button "Read this ad" (app/page.tsx:230-236) and "Read it again with the AI" (:264-267); both call `readAd()` (:70), `postJson` at :78 |
| Exact fields | `{ lines: string[] }`: the CV after `removeContactDetails` (emails, phone numbers, web links replaced by "[link removed]" etc., lib/cv/redact.ts:56-58), split in non-empty lines; the same lines are shown on screen under "What will be sent" (CvBox.tsx:149-152). The person's **name and address are not removed** (CvBox.tsx:154). Limits: 12,000 characters, 400 lines, 1,000 per line (lib/cv/limits.ts:6-9) | `{ text: string }`: the pasted ad, **whole and uncleaned**, trimmed, up to 20,000 characters (lib/schemas/job.ts:68-78) |
| Header | `x-access-code: <the code>` when one is kept (accessFetch.ts:11 constant in lib/ai/accessMessages.ts:11, :83-85, :102-106) | same |
| Server steps | route.ts:14 kill switch, :20 access check (SHA-256 timing-safe compare, lib/ai/accessCode.ts:39-50), :25 `request.json()`, :30 schema (also refuses a line that still holds contact details), :36 `readCvLines` | route.ts:11 kill switch, :17 access check, :22 `request.json()`, :27 schema, :39 `readThroughCache` then `readJobAd` |
| What goes to Groq | `instructions` = the fixed INSTRUCTIONS_CV; `prompt` = "Read this CV." + `<cv>` + the numbered lines (lib/ai/readCv.ts:48-54, :53); the strict JSON schema; model name; settings. **The whole cleaned CV, every line.** | fixed INSTRUCTIONS; `prompt` = "Read this job ad." + `<job_ad>` + the **whole ad text** (lib/ai/readJob.ts:49-55, :54); schema; model; settings |
| Who calls Groq | our server only (`generateText`, `@ai-sdk/groq`); Groq sees the server's request, not the visitor's browser | same |
| What comes back | `{ skills, removed, duplicates, unlisted }` (route.ts:37). Not cached | `{ job, removed, moved, unlisted, notCounted }` + header `x-reading-cache: hit|miss` (route.ts:40) |
| Server-side keeping | **Nothing.** No cache (DECISIONS 2026-11-16: "the CV route is not cached"), no file, no database | **A reading cache in the server's memory**: key = SHA-256 of (READING_VERSION, vocabulary hash, cleaned ad text); value = the reading (it holds short quotes taken from the ad, not the whole text); capacity 20, least recently used dropped (lib/ai/readCache.ts:19, :39, :79). Gone when that server instance restarts. Failures never stored. So "the server stores nothing" is **not strictly true for ads**; the page must say it exactly (claim C3) |

**Browser storage (main).**
| Where | What | Evidence |
|---|---|---|
| IndexedDB database `career-copilot`, stores `profile` and `jobs` | a **confirmed profile** (skills kept, **the CV line that shows each one** (line number and that line's text), dates, constraints; NOT the whole CV, NOT the AI's proposals) and **saved ads** (the full pasted ad text `adText`, the AI's raw reading, the checked reading), written only from click handlers | lib/saved/types.ts:19-20 and :38-42; lib/saved/idbStore.ts:19, :62; app/useSaved.ts:5, :22; SavedControls.tsx:21-23 |
| IndexedDB opened on load, **empty** | the first screen opens the database when it loads (the saved-on-this-device read, 6.1); in a fresh window this creates it empty. Nothing is written. | app/useSaved.ts:16-22; DECISIONS 2026-11-24 |
| `sessionStorage`, key `career-copilot.access-code` | the access code, **this tab only** (gone when the tab closes); memory copy if storage is blocked; forgotten on a rejected code, on "Forget", and on "Yes, delete everything" | app/accessFetch.ts:13, :23, :28, :54, :63-79, :109 |
| cookies, `localStorage` | none: no `document.cookie`, `cookies(`, `Set-Cookie`, `localStorage` in app/ or lib/ (grep; test I5) | (grep) |
| files | a CV file chosen is read in the browser (pdfjs, mammoth, loaded in the browser; "Wasm, remote fonts and worker fetches are off", lib/cv/fileToText.ts:55-71, :101-107) and never uploaded as a file | tests/fileToText.test.ts |

**Third parties in the page itself.** No analytics, tag, tracking or widget: the 8 dependencies are `@ai-sdk/groq`, `ai`, `mammoth`, `next`, `pdfjs-dist`, `react`, `react-dom`, `zod` (package.json); no `next/script` or `<script>` in app/ (grep). The fonts use `next/font/google` (app/layout.tsx:2), which fetches the font files at BUILD time and serves them from our own address: the built output (.next/static, .next/server) holds no `fonts.googleapis.com` or `fonts.gstatic.com` string (grep, 2026-11-25). Whether the Vercel project has its own analytics switched on is a dashboard setting the code cannot show (section 3, unknown U6).

**Logging (the question "can any error path print CV text, ad text or a prompt, including the AI SDK's error objects?").** Every `console.*` in app/ and lib/ (excluding scripts, tests, and the word match in lib/engine/evalFingerprint.ts):
| Site | What it prints |
|---|---|
| app/api/cv/route.ts:48 | the fixed string `cv: unexpected error in route` |
| app/api/read/route.ts:54 | the fixed string `read: unexpected error in route` |
| lib/ai/errors.ts:37 | `${tag}: missing setting` (tag is "cv" or "read") |
| lib/ai/errors.ts:46 | `${tag}: the model's answer did not match the schema` |
| lib/ai/errors.ts:56 | `${tag}: AI service error, status ${code ?? "unknown"}` (a number or "unknown") |
| lib/ai/errors.ts:85 | `${tag}: unexpected error` |
That is **6 sites, all fixed text**. `toReadError` never logs `raw` or `error.message` (errors.ts:24-26); the technical `detail` (which can hold the original message) goes into the response only when `NODE_ENV !== "production"` (cv/route.ts:43, read/route.ts:47-49), never into a log. The AI SDK: both reads use `generateText` (readCv.ts:48, readJob.ts:49). I read the installed `ai@7.0.172` (node_modules/ai/dist/index.js): its default `console.error(error)` handlers sit on `streamText`, `streamObject` and `streamSpeech` (lines 9365, 15048, 15746), which this app does not call; `generateText`'s own output is `logWarnings` (lines 624, 679, 1585...), which carries a warning about a setting or feature (type, feature name, details), through `process.emitWarning` or `console.warn`, not the prompt. The error objects the SDK throws (`APICallError`) do carry `requestBodyValues` and `responseBody`; they are caught in `toReadError` and never printed. Existing tests: errors.test.ts E8 (a message with "SECRET CV TEXT" is not logged, 429 is), cvRoute.test.ts K6, readCache.test.ts N1 (no 40-character slice of an ad in any log across a miss, a hit and a failure), accessCode.test.ts:64 (spies on the four console methods; the code is never logged). **Gaps this plan closes:** no test throws the SDK's real `APICallError` (with `requestBodyValues` and `responseBody` holding a marker) through the real `generateText` and the route and then spies on `console` AND `process.emitWarning`; and nothing stops a future `console.log(body)` (tests L1, I4).
**What I cannot see from code:** Vercel's own platform request logs (path, status, time, maybe more) and any Firewall logs. Unknown (section 3, U4, U5).

### 1.2 The chain, branch by branch, and the tip of step-8.3

Read with `git grep` and `git diff --name-status origin/step-7.1 origin/<branch>`; nothing checked out. The chain is cut from step-7.1 (merged into main), so 9.1's /demo files show as "deleted" in a plain `main..step-8.3` diff only because the chain predates 9.1 (the dry-run merges were clean).

| | main | step-7.3 | step-8.1 | step-8.2 | step-8.3 (tip acc97fd) | Page claim that changes |
|---|---|---|---|---|---|---|
| API routes | `/api/cv`, `/api/read` | same | same | same | **+ `/api/bullets`** (app/api/bullets/route.ts) | list of routes; what is sent (bullets row below) |
| `console.*` sites | 6 | 6 | 6 | 6 | **7** (+ bullets/route.ts:49, `bullets: unexpected error in route`; errors.ts tag "bullets") | "logs hold fixed text" stays true; test I4 count 6 becomes 7 |
| Callers of `postJson` | CvBox, page | same | same | same | + app/bullets.ts | I2 allowlist |
| What goes to Groq | whole cleaned CV (every line); whole ad | same | same | same | + **up to 5 pairs** (`MAX_PAIRS = 5`, lib/engine/bulletPairs.ts:9) of one requirement quote (up to 300 characters) and **one cleaned CV line** each (lib/schemas/bullets.ts:15-40, lib/ai/writeBullets.ts:72); the page says so (lib/saved/messages.ts:190, "W4": "This sends the ad's requirement lines and up to N lines of your own CV to the AI service (Groq). We store nothing and do not log the text.") | the "what is sent" sentence gains a third item |
| Server keeping | ad readings in memory (cache) | same | same | same | bullets: nothing cached (per the route comment); **verify at stage 2 by reading the 8.3 route code** | C3 |
| Browser storage | IndexedDB, sessionStorage code | same | same | same | same (no new key found by grep) | none |
| Clipboard | none | none | **writes on a click** (app/RoadmapReportView.tsx:66, "Copy") | same | same + app/BulletsView.tsx:146 | new line: "Copy puts text in your device clipboard only when you press the button" |
| New screens that sound like tracking | none | none | none | **"Analytics"** (app/AnalyticsView.tsx): counts over YOUR saved ads, computed in the browser | **name clash**: the privacy page must say this screen is a calculation on saved ads on this device, not tracking |
| Cookies / third parties / analytics libraries | none | none | none | none | none | none |

Confirmed at each branch tip by grep: no new `sessionStorage`, `localStorage`, `indexedDB`, `document.cookie`, `fetch(` site beyond `app/accessFetch.ts` and `lib/saved/idbStore.ts`. Step-7.3 changes nothing here (no app/api, no clipboard, no storage): no page change. Step-8.1 and 8.2 add only the clipboard and the "Analytics" word. Step-8.3 is the one that changes the **sentences** (third route, a third thing sent, 7 console sites).

---

## 2. CLAIM-TO-EVIDENCE TABLE

Every page sentence below is short, checkable, tied to a code place AND a test. New sentences live as exported constants in `lib/privacy/messages.ts` (rendered by the /privacy page, the consent lines and nothing else), exactly like lib/demo/messages.ts, so tests compare the exact words. The wording is **DRAFT** until the owner approves (section 4).

| # | Claim (DRAFT words) | Code evidence (main) | Test: existing | Test: new | Status |
|---|---|---|---|---|---|
| C1 | "Your CV file is read on your device. Nothing is sent until you press 'Send for reading'." | fileToText.ts:55-71, :101-107; CvBox.tsx:73-93 (`send` only from the button, :163); CvBox and page import no `useEffect` (`import { useMemo, useState }`, page.tsx:3) | fileToText.test.ts (fetch never called) | **I2**: `postJson(` appears only in app/CvBox.tsx and app/page.tsx (and accessFetch.ts) and neither calls it from an effect (neither file contains `useEffect`) | supported |
| C2 | "Pressing 'Send for reading' sends the lines shown, with email addresses, phone numbers and web links removed. Your name and address are NOT removed." | CvBox.tsx:149-156; redact.ts:56-58; schemas/cv.ts:34 refuses a line still holding contact details | redact.test.ts; cvRoute.test.ts | **M3** exact string; **I9b** the request schema rejects the line "Write to jane@example.org" (hand: 1 issue, message "Remove email addresses, phone numbers and links before sending.") | supported |
| C3a | "Pressing 'Read this ad' sends the whole ad text exactly as pasted. It is not cleaned." | page.tsx:78; lib/schemas/job.ts:70-78 | none | **I9**: `readRequestSchema.parse({ text: "  Contact jobs@example.org  " })` returns `text === "Contact jobs@example.org"` (trim only; the address stays) | supported |
| C3b | "Our server has no database and writes no file. For ads it keeps the short reading (not the pasted text) in memory for a while, up to 20 ads, so the same ad is not read twice. For a CV it keeps nothing." | readCache.ts:19, :39, :79; cv/route.ts has no cache import | readCache.test.ts N1, N2 | **I8**: app/api/cv/route.ts does not import readCache; no `writeFile`/`fs`/database import in app/api and lib/ai | supported (and the old text "We store nothing" at CvBox.tsx:156 must be re-checked against it: for a CV it is true; for ads it is not "nothing") |
| C4 | "A saved profile and saved ads live only in this browser (IndexedDB). They are not sent anywhere. A saved ad holds the whole ad text; a saved profile holds your skills and the CV line each skill was found on, not your whole CV." | types.ts:19-20, :38-42; idbStore.ts:19; saved.ts writes only through the store; SAVE_NOTICE (messages.ts:16-17) | saved.test.ts, savedRoundTrip.test.ts | **I1b**: no file in lib/saved imports `fetch`/`postJson`; **S1b** (hand-worked): a 3-line CV, one skill kept citing line 2 -> the saved profile's JSON contains line 2's text and neither line 1's nor line 3's | supported |
| C5 | "The access code is kept for this tab only. It is forgotten when the tab closes, when the server refuses it, and when you press 'Yes, delete everything'. It is sent to our server with each send." | accessFetch.ts:13, :23, :28, :63-79, :102-109 | accessFetch.test.ts, accessGuards.test.ts (P7: no localStorage/indexedDB in accessFetch) | none new | supported |
| C6 | "Our server code logs only a short fixed message (which route failed, and for an AI service error a status number). It never logs your CV, your ads or your access code. The hosting service keeps its own normal request logs, which we do not control (not confirmed yet)." | the six sites of 1.1; errors.ts:24-26 | errors.test.ts E8; cvRoute.test.ts K6; readCache.test.ts N1; accessCode.test.ts:64 | **L1-L4**, **I4** (section 9) | first half supported; second half = unknown U4 |
| C7 | "There is no analytics, tracking or advertising code in this app, and no cookies are set by it." | package.json dependencies; no `next/script`; no cookie API; fonts self-hosted | none | **I5**, **I6** | supported for OUR code; Vercel project settings = unknown U6 |
| C8 | "The demo sends nothing you type and stores nothing. It uses invented data." | S1-S5, V1-V6 (tests/demoState.test.ts, tests/demoView.test.ts); live step 13 of MANUAL-CHECK-9.1 | S1-S5, V1-V6 | **V7** (no consent/privacy module imported by demo files) | supported; the sentence must not say "loading the page sends nothing" (PLAN-9.1 A3) |
| C9 | "'Delete everything saved on this device' removes the saved profile and all saved ads from this browser, and forgets the access code and your acknowledgement for this tab." | SavedControls.tsx:207-217; saved.ts:146; accessFetch.ts:77 | saved.test.ts (deleteAll), accessFetch.test.ts | **D1-D4** | supported after section 5 |
| C10 | "The first screen opens an empty database in your browser when it loads. Nothing is written until you press a save button." | useSaved.ts:16-22 | savedJobsUi/useSaved tests (guards on click-only writes) | none new (manual step 5) | supported |
| C11 | "The 'Copy' buttons write to your clipboard only when you press them." | RoadmapReportView.tsx:63-66 (8.1+), BulletsView.tsx:144-146 (8.3) | roadmapGuards-style tests on those branches | at merge time of the chain | **not on main yet**: add the sentence only when 8.1 merges |
| C12 | "'Analytics' in this app is a calculation over your saved ads in your browser. Nothing is counted about you." | AnalyticsView/analytics.ts (8.2) | on the 8.2 branch | at merge time | **not on main yet** |
| C13 | "With 'Write CV bullets' (when it exists) up to 5 requirement lines and up to 5 of your CV lines are sent." | writeBullets.ts:72; schemas/bullets.ts; messages.ts:190 | bulletsRoute.test.ts:280 | at merge time | **not on main yet** |
| D (dropped) | "Groq does not train on your data." / "Groq keeps nothing." / "Data stays in the EU/US." / "We delete logs after N days." / "GDPR compliant." / "Secure." | none | none | none | **DROPPED or shown as "not confirmed yet"** (section 3). The legal and security words are forbidden outright (test M5) |

---

## 3. FACTS WE DO NOT KNOW

Listed, not guessed. This plan states nothing about Groq's or Vercel's retention, training or location from memory. The repo's own record (DECISIONS 2026-11-15, "Groq's data terms (D2a)") is a tool's summary that nobody confirmed, so it is treated as **a lead for the owner to read, not as a fact the page may use**.

| Id | Unknown | Who brings it | Words the page shows meanwhile |
|---|---|---|---|
| U1 | Whether Groq uses what we send for training | owner, from the Groq console / terms / DPA: the exact sentence and where it is | "Not confirmed yet: whether the AI service uses what we send to train its models." |
| U2 | How long Groq keeps inputs and outputs, and whether Zero Data Retention is switched on for the owner's account | owner: the exact sentence + the setting as shown in the console | "Not confirmed yet: how long the AI service keeps what we send." |
| U3 | Which country Groq processes the data in | owner: the exact sentence | "Not confirmed yet: the country where the AI service processes your text." |
| U4 | Vercel: what its request logs hold (path, status, address?) and for how long | owner: from the Vercel dashboard / documentation, with the page it came from | "Not confirmed yet: what the hosting service logs and for how long." |
| U5 | Vercel function region (where our server runs), and what the Firewall rule logs | owner: the setting as shown in the project | "Not confirmed yet: the region our server runs in." |
| U6 | Whether the Vercel project has Web Analytics / Speed Insights switched on (dashboard setting) | owner: the setting; also the live Network check (no `/_vercel/insights` script, manual step 8) | "No analytics code is in this app. Whether the hosting service adds its own is not confirmed yet." |
| U7 | Whether an Impressum is needed | owner (a lawyer, not CC or the reviewer) | n/a (section 7) |
| U8 | Whether the Groq and Vercel agreements (DPA) are accepted by the owner | owner | not on the page |

**How the page stays honest while a fact is unknown. Options and a recommendation.**
- **Option 1, a constants file with an explicit "not confirmed" value plus a merge-gate test (recommended).** `lib/privacy/facts.ts` exports, for each of U1-U6, `{ id, status: "confirmed" | "not-confirmed", words, source, date }`. While `status` is `"not-confirmed"`, `words` is the fixed "Not confirmed yet" sentence of the table above, with no source and no date. When the owner brings the sentence, `status` becomes `"confirmed"`, `words` is the owner's exact quoted sentence, and `source` (page name) and `date` (ISO) are required. The /privacy page renders each fact from the file (it types none of them). **Two tests:** F1/F2 always run and always pass (the shape is right: not-confirmed has the fixed sentence and no source; confirmed has a non-empty source, an ISO date and non-empty words), and F3 is the **gate**: it fails while any fact is `"not-confirmed"`, and it runs only when `PRIVACY_GATE=1` (otherwise it is skipped, so `npm test` and every push stay green and the "Tests" line shows one skipped test). The reviewer or the owner runs `PRIVACY_GATE=1 npx vitest run tests/privacyFacts.test.ts` before any real CV is allowed on the live page. Reason: it makes D2's "until (a) is recorded and the owner agrees, no real CV goes through the live page" checkable by one command, without blocking ordinary work, and without a package.json change.
- **Option 2, the page says nothing about U1-U6 until known.** Simplest, but then the page leaves out exactly what D2 and SPRINT say it must state (services, country), and silence looks like an answer.
- **Option 3, "not confirmed" text without a gate.** Honest today, but nothing stops it from staying forever or from being forgotten at the time the link is shared.
Recommendation: **Option 1.** Open question 1 asks whether the gate must also pass before the MERGE or only before real CVs and before the link is shared (I recommend the second: the merged page with "not confirmed yet" words is honest).

---

## 4. THE CONSENT LINE

The CV is the high-risk text (a person's career, name and address in it); an ad is normally public text but the box accepts anything and sends it whole.

**Option A: one info line plus a link, no tick.** At the CV button, the existing "What will be sent" notice (CvBox.tsx:153-157) is replaced by the privacy constant and a link to /privacy; at the ad button a new line is added under "Read this ad" (page.tsx:230-236). Test: the line is rendered next to each button (source guard on the constants) and `/privacy` link count is exactly 1 per place. Effect on the 401 flow: none. On /demo: none (the demo has no sending buttons; V4 forbids `SaveAdButton`-style words, and the demo page does not import the notice modules; test V7).
**Option B: a required tick before the first send in a tab.** `app/consent.ts` (new, plain functions like app/accessFetch.ts): `readConsent(store)`, `giveConsent(store)`, `forgetConsent(store)`, `consentGate(store) -> "go" | "ask"`, key `career-copilot.consent` in `sessionStorage` with a memory fallback. In `send()` (CvBox.tsx:73) and `readAd()` (page.tsx:70) the first line is `if (consentGate() === "ask") { show the tick; return; }` BEFORE `postJson`. After ticking, the person presses the button again (a real AI call is never repeated behind their back, the same rule as the 401 flow, accessFetch.ts:16-17). Flow with the access code: tick -> press -> `postJson` -> 401 -> the Access code box (consent stays) -> code -> press again. Test: with a `fetch` spy, an unticked press makes **0** calls and shows the tick; a ticked press makes exactly **1**. Effect on /demo: none, provided /demo never imports app/consent (V7).
**Option C: both.** A at both buttons (always visible) and B before the first CV send of the tab. Same places, same tests as A and B together.

**DRAFT wording (plain words, no legal claims; the owner approves the final words):**
- DRAFT CV info line: "When you press 'Send for reading', these numbered lines leave your device: they go to our server and on to an AI service (Groq) that reads them. Email addresses, phone numbers and web links are removed first; your name and address are not. Read the privacy page for what is kept and what is not confirmed yet."
- DRAFT ad info line: "When you press 'Read this ad', the whole text above leaves your device exactly as pasted: it goes to our server and on to an AI service (Groq). Do not paste anything you do not want to send. Read the privacy page for what is kept and what is not confirmed yet."
- DRAFT tick (CV only): "I have read this, and I am sending my own text to be read by an AI service."
- The word "consent" is not used on the page; the tick is an acknowledgement ("I have read this").

**Recommendation: C, in this exact form:** the info line + link at BOTH buttons (A), and the required tick only before the first CV send in a tab (B for the CV), remembered for the tab and forgotten by "Yes, delete everything". The ad box gets the info line but no tick: ads are public text in the normal use, and a second gate would be friction for the main flow. If the bullets block (8.3) merges later, its W4 line stays and it is covered by the same tick (the tick sentence then adds "and, if you use it, the bullets feature" at that merge). Reason: it puts the strongest gate where a person's own data goes, costs one extra click once per tab, and leaves /demo and the 401 flow untouched.

---

## 5. "DELETE MY DATA" CONTROL

**Every delete path today (main):**
| Path | Where | Clears |
|---|---|---|
| Delete one saved ad | SavedControls.tsx:326-330 (handler), :360 (button "Delete"), `deleteJob` saved.ts:125 | one record in `jobs` |
| Delete the saved profile | SavedControls.tsx:103-111, buttons :122, :135, :156 ("Delete it", "Delete this profile"), `deleteProfile` saved.ts:136 | the `profile` record |
| **Delete everything** | SavedControls.tsx:200-239, `deleteAll` saved.ts:146 | both stores; and `forgetCodeOnDeleteAll()` first (:209), before the delete, even if the delete fails |
| Forget the access code | AccessBox "Forget" (`forgetTypedCode`, accessFetch.ts:142-145); automatic on a refused code (:109) | the tab's code |
| CV on screen | none: text typed or read lives in the page's memory until the tab is closed or reloaded | (nothing to delete in storage) |

**Gaps against the SPRINT sentence:** (1) the control is hidden unless saving is available (`state.phase === "ready" && state.available && state.ctx`, SavedControls.tsx:203): in a browser where IndexedDB is blocked but `sessionStorage` works, the access code cannot be forgotten with it; (2) it does not mention the code in its text; (3) it will not know the new tick; (4) /privacy does not mention it.

**Smallest change:** keep the same button, same confirm step ("Delete the saved profile and everything else saved on this device?" then "Yes, delete everything"), and change three things:
1. the confirm handler also calls `forgetConsent()` (when B exists), before the delete as with the code;
2. the control also shows when saving is unavailable (then it only forgets the tab's code and acknowledgement; the confirm text is "Forget the access code and your acknowledgement for this tab?");
3. the status line after a successful delete names what was cleared: "Deleted: the saved profile and ads on this device, and the access code and acknowledgement kept for this tab. Text still on the screen goes away when you reload the page."
It does NOT claim to delete anything at Groq or Vercel (the page says those are not in our control; U2, U4).
**On /demo:** hidden by construction (the demo page does not render `SavedDeleteAll`; existing V4 forbids the word; V6 already guards the per-ad Delete).
**Tests (MemoryStore, hand-worked):** D1: a MemoryStore with 1 profile and 2 jobs; `deleteAll` -> `listJobs` length 0, profile null (1+2 -> 0+0). D2: `keepAccessCode("abcdefghijklmnop", fake)` and `giveConsent(fake)`, then the confirm handler's pure part (`forgetCodeOnDeleteAll(fake)` and `forgetConsent(fake)`) -> `readAccessCode(fake) === null`, `readConsent(fake) === false`, `fake` holds 0 keys. D3: the exact status string above. D4: the pure predicate `deleteAllShows({ phase: "ready", available: false })` is true, `deleteAllShows({ phase: "loading" })` is false (the control must not flash while loading).

---

## 6. THE /privacy PAGE

- **Route:** `app/privacy/page.tsx`, a static server component (no `"use client"`, no `fetch(`, no `cookies()`/`headers()`); the build route table must show `○ /privacy`. Before writing it, stage 2 reads `node_modules/next/dist/docs/` for static pages and metadata under this project's Next 16 with `cacheComponents` (AGENTS.md).
- **Language:** English only for now; a German page is a later item (SPRINT later list).
- **Title and description:** `title: "Privacy"` (the root has "Career Co-pilot"), `description: "What leaves your browser, what is kept where, and what is not confirmed yet."`
- **Indexed:** yes (no `robots` noindex). Reason: a privacy page is for anyone to read, it holds no personal data, and hiding it would look like hiding the answer. (No robots.txt or sitemap exists today.)
- **Linked from:** (1) a small footer link on the first screen (app/page.tsx; `<Link href="/privacy" prefetch={false}>`, outside every condition; test: exactly one `href="/privacy"` in page.tsx), (2) the consent lines (section 4), (3) /privacy links back to "/" and to /demo. **Not** from the /demo banner in 9.3: any change inside app/demo/ needs its tests first, and the demo's banner already says what it must; open question 5.
- **Sections, in this order:** What leaves your browser, and when (C1-C3a, the bullets sentence only after 8.3 merges); What is stored, and where (C3b, C4, C5, C10); What is logged (C6); Who processes your text (Groq as the AI service, Vercel as the host, with U1-U5 from lib/privacy/facts.ts); Cookies and analytics (C7, U6; the "Analytics" name clash after 8.2); Your controls (C9); The demo (C8); Not confirmed yet (the list rendered from facts.ts).
- **Includes the line:** "The first screen opens an empty database in your browser when it loads. Nothing is written into it until you press a save button."
- **No contact line** until the Impressum question is answered (no email, no address; section 7).
- **Test:** M1 renders every exported constant (`{CONST}` present); M2 no `"use client"`; M3 exact strings; M4 the page contains no hard-typed fact words; M5 forbidden words (below).

## 7. IMPRESSUM

I write **no legal text and no address, phone or email.** Neither CC nor the reviewer is a lawyer, and nothing in this plan, on the page, in a test message or in a commit may claim legal compliance (test M5 forbids the words GDPR, DSGVO, compliant, compliance, lawful, certified, guarantee, legally, secure, in the privacy constants and the page source).
- **The question for the owner:** is an Impressum needed for a non-commercial portfolio demo that anyone can open? SPRINT 9.3 notes "§ 5 DDG covers business-like services; purely private sites usually need none". The owner (with a lawyer's answer if they want certainty) decides, and writes it in DECISIONS.
- **If yes:** a static page `app/impressum/page.tsx` with three headed sections that the owner fills in themselves: "Provider (to be filled in by the owner)", "Contact (to be filled in by the owner)", "Responsible for the content (to be filled in by the owner, if applicable)". Each shows "To be filled in by the owner" until then; a gate test (like F3, run with `PRIVACY_GATE=1`) fails while any section still shows that placeholder. Linked from the same footer.
- **If no:** nothing is built; the decision is one DECISIONS line with the reason.

## 8. FUTURE RULE

**DRAFT DECISIONS line (in the plan only; DECISIONS is not edited now):**
"2026-11-NN: Any change that adds or changes a data flow (a new API route, a new field sent, a new browser-storage key, a new `console.*`, analytics or usage events, a new third party, a daily-limit counter) updates lib/privacy/messages.ts, lib/privacy/facts.ts and the /privacy page in the SAME commit. The inventory tests (I1 to I8) fail until the allowlist in the test and the page are changed together, by hand. Reason: the page is only honest while it matches the code. The usage events of 9.4 must not count /demo views (DECISIONS 2026-11-24, 9.4 line), and 9.2's counters are a data flow under this rule."

## 9. TEST PLAN (tests first; every expectation worked out by hand from the code listed above)

Main: **95 files, 1,606 tests.** Estimated after 9.3: **101 files, about 1,641 passed + 1 skipped** (counts are estimates; stage 2 fixes the exact numbers before any code). Without the Impressum page: no further file.

**tests/privacyInventory.test.ts** (source guards; green on day one on main, because they describe today's code; each is proven by a deliberate break):
- I1: the files named `route.ts` under app/api are exactly `["app/api/cv/route.ts", "app/api/read/route.ts"]` (2). I1b: no file under lib/saved contains `fetch(` or `postJson`.
- I2: files in app/ containing `postJson(` are exactly CvBox.tsx, accessFetch.ts (definition), page.tsx; neither CvBox.tsx nor page.tsx contains `useEffect`.
- I3: the strings `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource` in app/ and lib/ (excluding lib/ai, lib/engine/eval*, tests): **0 hits each** (grep on main, 2026-11-25: no hit at all; the helper sends through `const doFetch = opts.fetch ?? fetch` at app/accessFetch.ts:101, a call by another name). The bare word `fetch` as an identifier appears in app/ only in app/accessFetch.ts. (On step-8.3 app/timedFetch.ts is added; its comment says it hands a function to `postJson`: the allowlist grows by that one file at the merge.)
- I4: `console.` in app/ and lib/ (excluding tests, scripts, and `evalFingerprint`): exactly 6 sites and their texts exactly the six strings of section 1.1.
- I5: `sessionStorage` appears only in app/accessFetch.ts (plus app/consent.ts once it exists), `indexedDB` only in lib/saved/idbStore.ts, and `localStorage`, `document.cookie`, `cookies(`, `Set-Cookie`, `set-cookie` nowhere.
- I6: package.json dependencies are exactly the 8 names listed in 1.1 (adding any name fails); app/ has no `next/script`, `<script`, `@vercel/`, `gtag(`.
- I7: files under app/ other than app/api/ import from `@/lib/ai/` exactly two lines, both `accessMessages` (constants): app/AccessBox.tsx:12 and app/accessFetch.ts:9 (grep on main); no app/ file mentions a Groq host.
- I8: app/api/cv/route.ts does not import readCache; no file in app/api or lib/ai imports `node:fs`, `fs`, or a database library.
- I9: `readRequestSchema.parse({ text: "  Contact jobs@example.org  " }).text === "Contact jobs@example.org"`. I9b: `readCvRequestSchema.safeParse({ lines: ["Write to jane@example.org"] })` fails with exactly 1 issue whose message is "Remove email addresses, phone numbers and links before sending."
- I10: the `/privacy` link: `app/page.tsx` contains exactly one `href="/privacy"` and it is not inside a condition (same method as V3).
- S1b: the profile test of C4 (3-line CV, one skill kept citing line 2: JSON contains line 2's text, not lines 1 and 3).

**tests/logHygiene.test.ts** (runtime, no network, dummy key; fake `fetch` returns a 500 whose body and a request marker "MARKER-9731" are in the CV/ad/body):
- L1: through the real `readJobAd`/`generateText` with the real Groq provider and a stubbed fetch answering 500 with the marker in the response body, then the route: every console method and `process.emitWarning` receive text without "MARKER-9731"; the only console call is exactly `read: AI service error, status 500`. L2: same for `/api/cv` -> `cv: AI service error, status 500`. L3: a 429 -> `... status 429`, response 429. L4: with `NODE_ENV="production"` (`vi.stubEnv`) the JSON answer has no `detail` key; with "development" it has one (so the test proves the switch).

**tests/privacyMessages.test.ts:** M1 the /privacy page source renders every exported constant of lib/privacy/messages.ts as `{NAME}`; M2 it has no `"use client"`, `fetch(`, `cookies(`, `headers(`; M3 the exact strings of the approved wording (the owner's final text, copied into the test by hand at stage 2); M4 no fact word typed in the page (every U1-U6 sentence comes from facts.ts); M5 forbidden words absent; M6 CvBox.tsx and page.tsx render the CV and ad info constants and a `/privacy` link.

**tests/privacyFacts.test.ts:** F1 each fact has the required shape; F2 `not-confirmed` => `words` equals the fixed sentence and `source`/`date` are empty; `confirmed` => non-empty words, source and an ISO date; F3 (the gate, skipped unless `PRIVACY_GATE=1`) fails while any fact is not confirmed. Expected today: 6 facts (U1 to U6), 6 not-confirmed, F3 would list those 6 ids.

**tests/consent.test.ts** (Option C): C1 unticked CV send: `fetch` spy 0 calls and the tick is shown; C2 ticked: 1 call to `/api/cv`; C3 the choice is kept in the tab's store under `career-copilot.consent` and read back; C4 `forgetConsent` clears it; C5 the ad send is not gated (1 call without any tick; the info line is shown); C6 401 after the tick: the access message appears and the consent is still given; C7 storage throws: the memory fallback works, the app still sends after the tick.

**tests/deleteMyData.test.ts:** D1-D4 of section 5.

**tests/demoView.test.ts:** V7: no file under app/demo, lib/demo or app/DemoEntry.tsx contains `consent` (any case), `app/consent`, `lib/privacy` or `/privacy`; V1 to V6 stay unchanged and must pass.

**Deliberate breaks (each must fail the named test; run with `git checkout -- .` after each):**
| Break | Fails |
|---|---|
| B1 remove the consent/info line from CvBox | M6 (and M1 if the constant is unused) |
| B2 add `console.log(JSON.stringify(body))` to app/api/read/route.ts | I4 and L1 |
| B3 add `fetch("/x")` to app/demo/page.tsx | V4 and I3 |
| B4 add app/api/extra/route.ts | I1 |
| B5 change `sessionStorage` to `localStorage` in accessFetch.ts | I5 (and the existing P6/P7 guards) |
| B6 add `"@vercel/analytics"` to package.json dependencies | I6 |
| B7 make `send()` skip the consent gate | C1 |
| B8 make delete-everything not call `forgetConsent` | D2 |
| B9 set a fact to `confirmed` without a source | F2 |
| B10 write "GDPR compliant" in lib/privacy/messages.ts | M5 |
| B11 make `toReadError` log `raw.message` | L1 and the existing E8 |
| B12 make `readRequestSchema` strip emails from the ad | I9 |
| B13 add `useEffect(() => { postJson(...) })` to CvBox | I2 |
| B14 add `"use client"` or `fetch(` to app/privacy/page.tsx | M2 |
| B15 import `app/consent` in app/demo/page.tsx | V7 |

## 10. STAGES (each ends green: tsc, lint, tests, build)

- **2.0** (no code): read node_modules/next/dist/docs for static pages and metadata; read the 8.3 `writeBullets` route's keeping (C3 table); get the exact `fetch(` count for I3. Careful lane.
- **2.1** inventory and log-hygiene tests (I1-I10, S1b, L1-L4): they describe main, so they pass at once; run breaks B2-B6, B11-B13. No product change. Commit.
- **2.2** facts and messages: lib/privacy/facts.ts (all six `not-confirmed`), lib/privacy/messages.ts (DRAFT words); tests M3, F1-F3 red then green. **Needs the owner:** approval of the wording (section 4) and the order of sections.
- **2.3** the /privacy page + footer link; tests M1, M2, M4-M6 and I10; the build must print `○ /privacy`. Breaks B1, B10, B14.
- **2.4** consent: app/consent.ts, wiring in CvBox.tsx and page.tsx, info lines; tests C1-C7, V7 first (red). Breaks B7, B15. **Needs the owner:** Option A, B or C.
- **2.5** delete-everything change (section 5); tests D1-D4; break B8.
- **2.6** gates, docs/MANUAL-CHECK-9.3.md, push the branch.
- **2.7** (owner, reviewer) facts: the owner brings the Groq words and the Vercel settings; `status` flips to `confirmed` one fact at a time with its source and date; run the gate command.
- **Merge time only:** SPRINT tick, DECISIONS lines (including the future rule), HANDOFF paragraph; after the chain merges (7.3, 8.1, 8.2, 8.3) the page gains C11-C13, the "Analytics" sentence and the I4 count 7, in the same commit as each merge.

**What needs the owner:** the Groq console sentences (U1-U3); the Vercel region, log and analytics settings (U4-U6); wording approval; the consent option; the Impressum decision (U7); whether real CVs may go through the live page after the gate (D2).

**Outline of docs/MANUAL-CHECK-9.3.md** (a fresh private window, every other private window closed; INVENTED material only: the made-up CVs in fixtures/synthetic-cvs/ and the public barista ad; no real CV, no real ad; the access code is typed by the owner, never shown to CC; **Session storage is never opened**, the rule of 9.1 A2; a Vercel preview asks for a sign-in in a fresh private window, so the checks that need "fresh" are repeated on the live address after the merge):
1. The first screen has a footer link "Privacy" and the demo button; /privacy opens as a static page (Network: no `api` row).
2. Read /privacy against the list of approved sentences; every "not confirmed yet" sentence is there while the fact file says so.
3. Choose an invented CV file: Network empty (the file never leaves). The numbered lines on screen match the file.
4. Press "Send for reading" without the tick: Network empty and the tick is shown. Tick, press again: exactly one `/api/cv` request; its body is the lines shown (compare with the Payload tab).
5. Open the IndexedDB view: stores empty before any save; the database exists empty on load. Save the profile: one record; its text has the cited lines only.
6. Paste the barista ad: the info line is next to the button; one `/api/read` request; the Payload is the pasted text.
7. "Delete everything saved on this device": stores empty; the access code is asked for again and the tick is asked for again (behavioural check, no storage panel).
8. Cookies list in Application is empty; Network on first load lists only this address (no third-party host, no `/_vercel/insights`).
9. /demo: unchanged (repeat 9.1 steps 3 and 13 in short).
10. Console: no red text.
11. The reviewer runs `PRIVACY_GATE=1 npx vitest run tests/privacyFacts.test.ts` and pastes the output (expected: failing while any fact is not confirmed; passing after 2.7).

## 11. OPEN QUESTIONS FOR THE REVIEWER (ranked)

1. **Gate timing:** must the privacy gate (F3) pass before the MERGE, or only before any real CV and before the link is shared? I recommend the second (the merged page with "not confirmed yet" is honest; the gate blocks the dangerous step).
2. **Consent option:** C as drafted (info lines at both buttons, a tick only before the first CV send per tab) or A only? I recommend C.
3. **Existing sentence "We store nothing and do not log the text" (CvBox.tsx:156; messages.ts:190 on 8.3):** true for a CV and for bullets, not strictly true for ads (memory cache, section 1.1). Replace with the exact constants now, and handle the 8.3 one at the merge?
4. **Delete control:** show it also when saving is unavailable (section 5, change 2), or keep it hidden then?
5. **Link from /demo:** add a "Privacy" link in the demo banner (needs V7-style tests first), or leave /demo untouched in 9.3? I recommend untouched.
6. **Preview versus live for the manual check:** sign in to Vercel in the private window and test the preview, or run everything on the live address after the merge (as in 9.1)? Because a merge deploys, I recommend the preview first with a Vercel sign-in, then the "fresh" steps again live.
7. **Indexing /privacy:** indexed (recommended) or noindex?
8. **Impressum:** who answers U7, and is a "not needed, because ..." DECISIONS line enough if the answer is no?
