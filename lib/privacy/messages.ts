// Step 9.3, stage 2.2 (docs/PLAN-9.3.md sections 2, 4 and 6; amendments A12 and A13): the words of the privacy page and of the notices at the two
// send buttons. ONE exported constant per text, so the exact strings are tested (tests/privacyMessages.test.ts, M3) and the components only show them.
//
// DRAFT. The owner approves the wording; until then WORDING_APPROVED_ON is null and the gate test F4 fails when it is run with PRIVACY_GATE=1.
// An owner edit changes the constant and its pinned string in the test in ONE commit. Plain words; no legal claim of any kind. The word "consent" is
// not used: the tick is an acknowledgement.
//
// Every sentence is a claim about OUR code and is tied to a place in the code and to a test (PLAN-9.3 section 2). What the AI service and the hosting
// service do comes only from lib/privacy/facts.ts, never from here. The claims C11 to C13 are not here: they are not on main yet.

export const WORDING_APPROVED_ON: string | null = null;

// ---- the notices at the buttons and the tick (section 4, option C) ----------------------------------------------------------------------------

// Next to "Send for reading" (app/CvBox.tsx:153-157, :162-167). Code: CvBox.tsx:149-156 (the lines shown), lib/cv/redact.ts:56-58, lib/ai/readCv.ts:48-54.
export const CV_INFO_LINE =
  "When you press 'Send for reading', the numbered lines shown above leave your device. They go to our server and on to an AI service (Groq) that reads them. Email addresses, phone numbers and web links are removed first. Your name and address are not. The privacy page says what is kept.";

// Next to "Read this ad" (app/page.tsx:230-236). Code: page.tsx:78, lib/schemas/job.ts:70-78, lib/ai/readJob.ts:49-55 (test I9).
export const AD_INFO_LINE =
  "When you press 'Read this ad', the whole text in the box leaves your device. It goes to our server and on to an AI service (Groq). It is not cleaned: an email address or phone number in it is sent as it is. Do not paste anything you do not want to send. The privacy page says what is kept.";

// The tick before the first CV send in a tab.
export const CV_TICK = "I have read this, and I am sending my own text to be read by an AI service.";

// ---- the claims, in the order of use (section 2) --------------------------------------------------------------------------------------------

// C1. Code: lib/cv/fileToText.ts:55-71, :101-107; app/CvBox.tsx:73-93 and :163 (send only from the button). Tests: fileToText.test.ts, I2.
export const CLAIM_C1 = "A CV file you choose is read on your device. Nothing from it is sent until you press 'Send for reading'.";

// C2. Code: app/CvBox.tsx:149-156; lib/cv/redact.ts:56-58; lib/schemas/cv.ts:34 (refuses a line that still holds contact details). Tests: redact, I9b.
export const CLAIM_C2 =
  "'Send for reading' sends the numbered lines shown on the page. Email addresses, phone numbers and web links are removed first. Your name and address are not removed.";

// C3a. Code: app/page.tsx:78; lib/schemas/job.ts:70-78 (trim and length only). Test: I9.
export const CLAIM_C3A = "'Read this ad' sends the whole ad text from the box. It is not cleaned: an email address or phone number in it is sent as it is.";

// C3b. Code: lib/ai/readCache.ts:19, :39, :79 (up to 20 readings, in memory, quotes only); app/api/cv/route.ts has no cache. Tests: readCache N1, N2; I8.
export const CLAIM_C3B =
  "Our server code has no database and writes no file. For an ad, the server keeps the reading of the ad (it holds short quotes from the ad, not the whole text) in its memory for a while, up to 20 ads, so the same ad is not read twice. For a CV it keeps nothing.";

// C4. Code: lib/saved/types.ts (SavedProfile, SavedJob), lib/saved/profile.ts, lib/cv/profile.ts (ConfirmState), lib/saved/idbStore.ts. Tests: I1b, S1b.
export const CLAIM_C4 =
  "A saved ad and a saved profile stay in this browser (IndexedDB). Saving sends nothing. A saved ad holds the whole ad text. A saved profile holds the skills you confirmed, with the CV line each one was found on, and the cities, languages, work modes, years of experience and start date you entered. It does not hold your whole CV.";

// C5. Code: app/accessFetch.ts:13, :23, :28, :63-79, :102-109. Tests: accessFetch.test.ts, accessGuards P7, I5.
export const CLAIM_C5 =
  "The access code is kept for this tab only. It is forgotten when you close the tab, when the server refuses it, and when you press 'Yes, delete everything'. It is sent to our server with each send.";

// C6 (our code's half only; the hosting service's own logs come from facts U4a and U4b). Code: the six console lines (lib/ai/errors.ts, both routes).
// Tests: I4, L1 to L4, errors.test.ts E8, cvRoute.test.ts K6, readCache.test.ts N1, accessCode.test.ts.
export const CLAIM_C6 =
  "Our server code logs only a short fixed message, such as 'read: AI service error, status 429'. It never logs your CV, your ads or your access code.";

// C7 (our code's half only; the hosting service's own analytics come from fact U6). Code: package.json, no cookie API. Tests: I5, I6.
export const CLAIM_C7 = "Our code has no analytics, tracking or advertising code and sets no cookies.";

// C8. Code: app/demo/*, lib/demo/*. Tests: S1 to S5, V1 to V6; step 13 of docs/MANUAL-CHECK-9.1.md. It says what you DO in the demo, never that
// loading the page sends nothing (docs/PLAN-9.1.md A3).
export const CLAIM_C8 = "The demo uses invented data. What you do in the demo is not sent anywhere and not saved.";

// C9, as the code is TODAY: the acknowledgement of stage 2.4 is added to this sentence by the commit that builds it. Code:
// app/SavedControls.tsx:207-217, lib/saved/saved.ts:146, app/accessFetch.ts:77. Tests: saved.test.ts, accessFetch.test.ts.
export const CLAIM_C9 =
  "'Delete everything saved on this device' removes your saved profile and all your saved ads from this browser, and forgets the access code kept in this tab. It does not delete anything held by the AI service or the hosting service.";

// C10. Code: app/useSaved.ts:16-22 (the read when the page loads), app/SavedControls.tsx:21-23 (writes only from clicks). Manual check step.
export const CLAIM_C10 =
  "When the first screen loads it opens the saved-data database in your browser (it is created empty in a new browser). Nothing is written into it until you press a save button.";

// C15 (amendment A12). Evidence: the AI SDK's defaults (node_modules/ai/dist/index.js:2429, :2450) and tests L1 to L3.
export const CLAIM_C15 =
  "If the AI service answers with an error or says it is busy, our server asks again up to two more times, so the same text can reach the AI service up to three times for one click.";

// ---- the headings of the /privacy page, in the order of section 6 --------------------------------------------------------------------------

export const HEADING_LEAVES = "What leaves your browser, and when";
export const HEADING_STORED = "What is stored, and where";
export const HEADING_LOGGED = "What is logged";
export const HEADING_PROCESSORS = "Who processes your text";
export const HEADING_COOKIES = "Cookies and analytics";
export const HEADING_CONTROLS = "Your controls";
export const HEADING_DEMO = "The demo";
export const HEADING_NOT_CONFIRMED = "Not confirmed yet";
