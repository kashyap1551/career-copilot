STATUS: APPROVED by the owner on 2026-11-17, with the reviewer's answers in section 10. Built as step 6.1b after 6.1 is ticked, before 6.2.

# Plan: a shared access code on the two AI routes

Goal: `/api/read` and `/api/cv` answer only a caller who sends the shared access code. Today they answer anyone who knows the address; the only brake is the kill switch (`AI_ENABLED=false`, docs/DECISIONS.md 2026-11-16; docs/PLAN-4.2.md section d). Decided earlier (PLAN-4.2 section d, HANDOFF): a shared code in an environment variable, the page asks once, both routes check a header. This plan fixes the exact behaviour, the wording, the tests and the check, so that the code can exist before the link is shared with anyone and before the repository goes public (HANDOFF, open items).

Rules this plan rests on: CLAUDE.md rule 4 (no secrets in code, logs or chat; keys only in `.env.local` and Vercel; I never read or print `.env` files), rule 7 (no new package: `node:crypto` is built in), the Careful lane (tests from hand work, shown red, then deliberate breaks). `AGENTS.md`: read the route-handler pages in `node_modules/next/dist/docs/` before writing the code.

## 1. Goal and threat model

| | Covered? | Why |
|---|---|---|
| A stranger who has found the address, no code | Stopped | 401 before any work; the AI is not called |
| A script from a stranger (a loop, a scanner) | Stopped | the same 401, a few microseconds of work each; the rate rule (section 4) limits the volume |
| A stranger guessing the code | Impractical | a generated code of at least 16 random characters (section 4) |
| Someone who has the code (a friend, a tester) | NOT stopped | they are allowed to use it; this is the point of the code |
| A leaked or forwarded code | NOT stopped | rotate it (section 7); there is no per-person code |
| A distributed attacker with the code | NOT stopped | needs a per-person quota or a counter store (non-goals, section 8) |
| Someone who reads the browser's memory or network on their own machine | NOT stopped | the code is in their own tab; it is theirs |

What stays public, by design: the static page and its scripts (they hold no secrets: no key, no code, no data of anyone), the saved data (it lives only in each person's own browser), and the existence of the two routes (anyone can see them in the page's network tab). The code is the only secret the page ever handles, and it never ships inside the page.

Cost of a stranger today, as already recorded: one call uses a large share of the free tier's minute and day, so a loop makes the site say "busy" to everyone. The code does not make the AI free of limits; it makes the loop come from someone who was given the code.

## 2. The server

**One module, `lib/ai/accessCode.ts` (server only; imports `node:crypto`).** `checkAccess(request): Response | null`: `null` means "go on", a `Response` is the answer to return. Both routes call it. Never imported by a file under `app/` that runs in the browser (a guard test, section 5).

**The variable (proposed; reviewer decides).**
- Name `ACCESS_CODE`. Server only: never `NEXT_PUBLIC_`, so it is never in the page's scripts. Read when called, never at load (as `aiPaused` does).
- Read as `process.env.ACCESS_CODE?.trim()`. A pasted value with a trailing newline or space is the usual mistake; the trim removes it.
- "Configured" means: after the trim it has 16 to 128 characters, all printable ASCII (no spaces inside). Anything else (unset, empty, too short, too long, other characters) means **not configured**. A too-short code is refused on purpose: a weak code must not work quietly.

**The header (proposed; reviewer decides).** `x-access-code` only. Never the address, never a query string (an address is stored in browser history, in server logs, in referrers). The routes are POST only and answer no cross-site preflight, so a page on another site cannot send the custom header from a browser; this is a side effect, not a defence (a script outside a browser ignores it).

**The comparison (timing-safe).** `sha256(sent)` and `sha256(configured)`: two 32-byte values, compared with `crypto.timingSafeEqual`. Hashing first gives both sides a fixed length, so neither the length of the real code nor how many leading characters were right can be read from how long the answer takes. A missing header counts as the empty string and is hashed the same way (no early return on a missing header).

**Never logged, never echoed.** No `console.*` call receives the header or the configured value; no answer body or header contains either; the existing line `console.error("cv: unexpected error in route")` stays as it is (it carries nothing).

**The order in both routes (proposed; reviewer decides):**

1. kill switch (`aiPaused`): `503` "paused", as today;
2. access check (`checkAccess`);
3. body parsing and schema check (`400` as today);
4. for `/api/read` the reading cache; then the AI call.

Why the check comes before parsing and the cache: a cache hit must not be probeable without the code (the `x-reading-cache: hit|miss` header would tell a stranger whether an ad was read before), and a stranger must not learn anything from the schema errors. Why the kill switch comes first: it must work even if the code is lost or misconfigured, and "paused" tells a stranger nothing useful.

**Hand-worked table: the answer for each state.**

| # | Kill switch | `ACCESS_CODE` | Environment | Header | Answer |
|---|---|---|---|---|---|
| 1 | on | any | any | any | 503, paused message; AI not called |
| 2 | off | not configured | any `NODE_ENV` except exactly "development" or "test" (production, staging, unset, anything else) | any | 503, "not set up" message; AI not called |
| 3 | off | not configured | `NODE_ENV` exactly "development" or "test" | any | goes on (no check) |
| 4 | off | configured | any | missing, empty, whitespace, wrong | 401, one plain message; AI not called |
| 5 | off | configured | any | the right code | goes on to body parsing |

**The answers (proposed; reviewer decides).**
- 401, body `{ "error": "The access code is missing or wrong." }`. One message for missing and wrong: no hint which. No `WWW-Authenticate` header (it would make a browser pop up its own dialog).
- 503 not configured, body `{ "error": "This site is not set up to read yet. Please try again later." }`.
- Every answer keeps `Cache-Control: no-store` through `jsonNoStore`; the two constants and the two statuses live in `lib/ai/accessMessages.ts` (no `node:` import, as `noStore.ts`), so the page can import the words without importing `node:crypto`.

**If `ACCESS_CODE` is not set (decided: the environment rule).** The access check is skipped ONLY when `NODE_ENV` is exactly "development" or "test". Any other value, including unset, behaves like production.
- Anything but "development" or "test": fail closed, 503 "not set up". `NODE_ENV` is "production" on every Vercel deployment, previews included, so a preview without the variable also answers 503 (set the variable for Production and Preview). A missing or misspelt `NODE_ENV` also fails closed, never open.
- "development" (`npm run dev`) and "test" (the test runner): no check, so local work and the existing tests need no code. To test the page's code box locally the owner adds an `ACCESS_CODE` line to `.env.local` by hand (I never read or write that file).
- A forgotten Vercel variable: the live routes answer 503 "not set up" on every call, the page shows that sentence, nothing is exposed, and the AI is not called. Fix: add the variable, redeploy (section 7). This is the safe way to fail and the plan's reason for fail-closed.
- Order of deployment: set the variable in Vercel FIRST (it does nothing until the new code ships), then deploy the code.

## 3. The page

**When it asks (proposed; reviewer decides): after a 401, not up front.** The page stays usable (saved profile, saved ads, the report on screen need no code); the first send that gets 401 opens a small "Access code" box next to the button. If a code is already kept in this tab, every send carries it from the start, so the person is asked once per tab. Up front would put a gate in front of features that do not call the AI.

**One place adds the header.** The two `fetch` calls (`app/CvBox.tsx:77`, `app/page.tsx:72`) go through one helper, `postJson(url, body)` in `app/accessFetch.ts`: it adds `x-access-code` when a code is kept, never touches the address, and tells the caller when the answer was 401 so the box opens. The pure parts (header builder, message choice) are plain functions with tests, like `lib/saved/messages.ts`.

**Exact wording.**

| Situation | Text |
|---|---|
| 401 and no code was sent | "Enter the access code you were given, then press the button again." |
| 401 and a code was sent | "That access code was not accepted. Check it and try again." |
| Box, label | "Access code" |
| Box, button | "Use this code" |
| Box, link, shown while a code is kept | "Forget the code" |
| Empty input | "Type the access code first." |
| After "Use this code" | "Access code kept in this tab until you close it." |
| After "Forget the code" | "The access code was forgotten." |
| 503 not configured | the server's sentence from section 2 (the page already shows a route's `error` text, as it does for "paused") |

The typed code is trimmed and capped at 128 characters; the input is `type="password"` with a label, so it is not shown on screen. The person's CV text and the ad text stay in their boxes after a 401 (nothing was processed); the person presses the button again (no automatic retry: a real AI call is never repeated behind the person's back).

**Where the code is kept (proposed; reviewer decides).**
- `sessionStorage`, key `career-copilot.access-code`, every access inside try/catch. It is cleared when the tab closes, and other tabs do not see it.
- NEVER `localStorage` and never IndexedDB. The saved profile and ads are kept on the device on purpose, and the notice says anyone who uses the browser can see them; a code is a credential and must not outlive the tab.
- If `sessionStorage` is unavailable or throws, the code is kept in the page's memory only (until reload); the app still works.
- "Delete everything saved on this device" also forgets the code (proposed). The message stays "Everything saved on this device was deleted." (no new wording; the person is simply asked again at the next 401).

**A wrong code.** On a 401 that followed a send WITH a code, the kept code is removed (no stale code is sent again), the message "That access code was not accepted..." shows, the box stays open with the input empty. There is no counter and no lockout in the page (non-goal; the server and the Firewall rule do the limiting).

**Leaving.** "Forget the code" removes it from `sessionStorage` and from memory at once. Closing the tab does the same.

## 4. Rate limiting and the length of the code

**The Vercel Firewall rate-limit rule is a dashboard step for the owner.** What Vercel's page says (https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting, last updated 2026-08-28, as read by the reviewer):
- available on all plans; the Hobby plan has **1 rate-limit rule per project** (within 3 custom rules);
- a fixed window, from 10 seconds to 10 minutes; keys: IP address and JA4; 1,000,000 allowed requests included;
- the default action is 429 (also Log, Deny 403, Challenge);
- **counters are per region**, so the limit can be exceeded across regions (it slows a loop; it is not an exact fence);
- the first rate-limit rule shows a **"Rate Limiting Pricing" dialog**: the owner reads it and reports what it says BEFORE pressing Continue. Nothing is bought (rule 7).
The owner still confirms in the dashboard that the rule is offered and that these values hold.

Steps:
1. Vercel dashboard, open the project, open the **Firewall** tab (some accounts show it under **Security**).
2. Look for **Configure** or **Custom Rules**, then **Add rule**.
3. In the rule's action list choose **Rate Limit**. When the pricing dialog appears, STOP: read it, send its words to the reviewer, and press Continue only after the reviewer says nothing is bought.
4. Condition "Request Path" "starts with" `/api/`; key: IP address; a fixed window; default action 429.
5. Starting value: **10 requests per 60 seconds per address.** Reason: several people on one network share one address, and one real use of the page is one CV read and a few ad reads a minute.
6. Afterwards the check in section 6 step 12: a normal minute (one CV and three ads, four requests) never gets 429; a loop does.
7. Record the result in docs/DECISIONS.md and HANDOFF (offered: yes/no; the values; what the pricing dialog said).

Because every 401 is also a request to `/api/*`, the same rule limits guessing of the code.

**The length of the code (proposed; reviewer decides).** The server accepts only a code of at least 16 characters (section 2). The owner makes the code with the machine, not with their head: in a terminal `openssl rand -hex 16` prints 32 random characters from 0 to 9 and a to f (128 bits); paste it straight into Vercel and into the people's private message; never into a chat with me, a document or a commit (rule 4).

Hand-worked: expected guesses are half of all possibilities; a year is about 3.2 x 10^7 seconds.

| Code | Possibilities | At 1,000 guesses a second, no rule | At 10 a minute from one address |
|---|---|---|---|
| 16 hex characters (the server's minimum, if random) | 16^16 = 2^64, about 1.8 x 10^19 | 9.2 x 10^18 guesses / 1,000 = 9.2 x 10^15 s, about 2.9 x 10^8 years | 10 a minute is 10/60 = 0.167 per second, so 9.2 x 10^18 / (10/60) = 9.2 x 10^18 x 6 = 5.5 x 10^19 s; 5.5 x 10^19 / 3.2 x 10^7 = 1.7 x 10^12 years (with a million addresses at once, 1.7 x 10^6 years) |
| 32 hex characters (`openssl rand -hex 16`) | 16^32 = 2^128, about 3.4 x 10^38 | 1.7 x 10^38 / 1,000 = 1.7 x 10^35 s, about 5.4 x 10^27 years | far beyond that |

A made-up word of 16 characters is not covered by this table: only a random code is. The server cannot check randomness; the generation rule does.

Alternative considered, not chosen: Vercel's own deployment protection (not verified; it would also lock the static page and cannot be tested in our test suite).

## 5. Tests (written first from the tables, shown red, then the code)

Setup, for both routes in turn (one parametrised test file): `ACCESS_CODE` is a made-up 26-character string; the AI readers (`readJobAd`, `readCvLines`) are spies that return a small valid reading; the environment is set with `vi.stubEnv` (`NODE_ENV`, `ACCESS_CODE`, `AI_ENABLED`); `node:crypto`'s `timingSafeEqual` is wrapped in a spy that still calls the real one; `console.log`, `info`, `warn`, `error` are spied. A valid body is sent for each route. "Next stage" means the answer is the route's normal 200 and the spy was called once.

| # | Case (each route) | Expected status | Expected body / checks |
|---|---|---|---|
| A1 | no header, production, code set | 401 | `{ error: "The access code is missing or wrong." }`; no-store; AI spy 0 calls |
| A2 | wrong code (same length as the right one) | 401 | the same body; `timingSafeEqual` called once with two 32-byte buffers |
| A3 | right code | 200 | the route's normal body; AI spy 1 call |
| A4 | empty-string header | 401 | the same body |
| A5 | whitespace-only header (`"   "`) | 401 | the same body (the Fetch standard strips outer spaces, so the server sees an empty value) |
| A6 | right code with a space on each side | 200 | normal body (the same standard strips the spaces) |
| A7 | a header of 100,000 characters | 401 | the same body; `timingSafeEqual` still called with 32-byte buffers (the real platform may refuse such a header earlier; not testable here) |
| A8 | code unset, `NODE_ENV` "production", a header sent | 503 | `{ error: "This site is not set up to read yet. Please try again later." }`; no-store; AI spy 0 |
| A8b | code set to blank (`"   "`), production, empty header | 503 | the same (a blank code never matches a blank header) |
| A8c | code set but shorter than 16 characters, production, header equal to it | 503 | the same |
| A8d | `NODE_ENV` unset, code unset, no header | 503 | the "not set up" body; no-store; AI spy 0 |
| A8e | `NODE_ENV` "staging", code unset, no header | 503 | the same |
| A9 | `NODE_ENV` "development", code unset, no header | 200 | normal body (no check) |
| A9b | `NODE_ENV` "development", code unset, a header sent | 200 | normal body (the header is ignored) |
| A9c | `NODE_ENV` "test", code unset, no header | 200 | normal body (no check) |
| A10 | kill switch on, right code | 503 | the paused message; AI spy 0 |
| A11 | kill switch on, wrong code | 503 | the paused message, NOT 401 (the kill switch comes first) |
| A12 | read route only: a right-code call fills the cache (miss), then the same ad with a wrong code | 200 then 401 | second answer has NO `x-reading-cache` header; AI spy stays at 1 |
| A12b | read route only: then the same ad with the right code | 200 | `x-reading-cache: hit`; AI spy still 1 |
| A13 | no header and a malformed JSON body | 401 | NOT 400 (the check comes before parsing) |
| A13b | right code and a malformed JSON body | 400 | the existing JSON message |
| A14 | the right code only in the query string (`?code=...`), no header | 401 | the same body |
| A15 | header name in capitals (`X-Access-Code`) with the right code | 200 | normal body |
| A16 | every case above | | neither the right code nor the sent value appears in any body or header of the answer |
| A17 | every case above | | `Cache-Control: no-store` on every answer |
| A18 | every case above | | no `console.*` call received an argument containing the right code or the sent value |
| A19 | one-off: a code with a trailing wrong character or the right code minus its last character | 401 | the same body |

Page and helper tests (plain functions, no browser): (P1) `accessHeaders(null)` is `{}`, `accessHeaders("abc")` is `{ "x-access-code": "abc" }`; (P2) the message table of section 3: (401, nothing sent) gives the "Enter the access code..." sentence, (401, code sent) gives the "not accepted" sentence; (P3) with a fake `sessionStorage`: save, read, forget round-trip; a fake that throws on every call gives `null` and a memory fallback, never an exception; (P4) `postJson` with a fake `fetch`: the address passed has no `?` and no code in it, the header is present when a code is kept, absent when not; (P5) a 401 after a send with a code removes the kept code, a 401 after a send without one keeps nothing; (P6) the delete-everything effect list includes forgetting the code; (P7) source guards: no file under `app/` imports `lib/ai/accessCode`; no source file contains `NEXT_PUBLIC_ACCESS`; `app/accessFetch.ts` contains neither `localStorage` nor `indexedDB`; (P8) source guard, one for every route: every file matching `app/api/**/route.ts` calls `checkAccess(` (the allow-list is EMPTY), so a future route cannot forget it.

**The existing route tests run as `NODE_ENV` "test" with `ACCESS_CODE` unset, so they stay open and must pass WITHOUT any edit** (tests/cvRoute.test.ts, tests/readRoute.test.ts, tests/readCacheRoute.test.ts, tests/readCache.test.ts, tests/readExtraction.test.ts, tests/noStoreHeader.test.ts, and any other that calls a route). If one of them needs an edit when this is built, STOP and tell the reviewer why before changing it.

**Deliberate breaks (each must make a named test fail):**

| # | Break | Caught by |
|---|---|---|
| b1 | compare the two strings with `===` instead of the hashes and `timingSafeEqual` | A2 (the spy sees no call) |
| b2 | compare the raw strings with `timingSafeEqual` (no hashing) | A7 and A19 (unequal lengths throw, 500 instead of 401; the spy sees buffers that are not 32 bytes) |
| b3 | access check after body parsing | A13 |
| b4 | access check after the reading cache | A12 |
| b5 | access check before the kill switch | A11 (401 instead of 503) |
| b6 | unset code passes in production (fail open) | A8 |
| b7 | blank code and blank header match (no blank check) | A8b |
| b8 | no minimum length | A8c |
| b9 | the code is also accepted from the query string | A14 |
| b10 | the 401 body echoes the sent value | A16 |
| b11 | the 401 answer is built without `jsonNoStore` | A17 |
| b12 | the header is written to `console.log` | A18 |
| b13 | only `/api/read` is protected (cv forgotten) | the parametrised cv cases A1 to A8 |
| b14 | development or test without a code checks anyway | A9, A9b and A9c (and every existing route test) |
| b15 | the page imports `accessCode.ts` | P7 |
| b16 | the page keeps the code in `localStorage` | P7 |
| b17 | the page puts the code in the address | P4 |
| b18 | a wrong code stays kept | P5 |
| b19 | open for every `NODE_ENV` that is not "production" | A8d and A8e |
| b20 | a new route file under `app/api/` without the check | P8 |

Hand-work discipline as always: expectations come from the tables above; if a test fails, I say whether the code or the hand count is wrong and never change the expectation. A test that passes at once is reported as a guard. Counts before and after, the three hashes (ad 85357f8fac, CV 193e02ee3f, vocabulary e96370fe4c) and READING_VERSION "3" stay unchanged: this step does not touch the reading.

## 6. Manual check for the owner (on the live site, after deploy)

Use the invented CV and ads of docs/MANUAL-CHECK-6.1.md only. Chrome, a normal window with the developer tools open on the **Network** tab before each press.
1. Deploy order done (section 2): the variable is set in Vercel, then the code deployed.
2. **Do:** open the site in a **new Incognito window** (no code kept). Paste the invented CV, press Send for reading. **Expect:** no skill list; the sentence "Enter the access code you were given, then press the button again." and the Access code box. In the Network tab the `cv` row is **401**; its response has `Cache-Control: no-store`; its body is the one-line "missing or wrong" message and nothing else.
3. **Do:** type a wrong code, press Use this code, press Send again. **Expect:** "That access code was not accepted. Check it and try again." The `cv` row is 401 again. The box is empty.
4. **Do:** type the right code, press Use this code, press Send again. **Expect:** "Access code kept in this tab until you close it." and then the skill list. The `cv` row is 200.
5. **Do:** click the `cv` row, open Headers. **Expect:** under Request Headers there is `x-access-code`; the **Request URL** at the top shows `.../api/cv` with nothing after it (no code in the address). Under Response Headers: `Cache-Control: no-store`.
6. **Do:** read invented ad 1. **Expect:** a report; the `read` row is 200, with `no-store`, and the code is again only in a header, not in the address.
7. **Do:** reload the page (Cmd+R), read the ad again. **Expect:** no question (the code is kept for this tab).
8. **Do:** press Forget the code, then press Read this ad. **Expect:** "The access code was forgotten." and then the "Enter the access code..." sentence; the `read` row is 401.
9. **Do:** enter the right code again, then close the whole Incognito window, open a new one, paste the CV and press Send. **Expect:** asked again (the code did not outlive the tab).
10. **Do (optional, in a terminal; no AI call is made):** `curl -i -X POST <the live site>/api/read -H 'content-type: application/json' -d '{"text":"x"}'` **Expect:** `HTTP/2 401`, `cache-control: no-store`, and the one-line message.
11. **Do:** in the Vercel dashboard open the project's **Logs** for those requests. **Expect (to be confirmed by looking, not assumed):** paths and statuses, no header values and no code.
12. **Do (Firewall, section 4; no AI call is made, because every request is refused before the AI):** in a terminal, replacing the placeholder with the site address:
    `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" -X POST <the live site>/api/read -H 'content-type: application/json' -d '{"text":"x"}'; done`
    It sends 12 requests WITHOUT a code and prints only the status codes, one per line. **Expect:** 401 first, then 429 once the rule bites (about the 11th line; the exact switch point may differ by a request or two: the window is fixed and the counters are per region). **Also expect:** normal use (one CV and three ads in a minute, four requests) never gets 429. If the rule does not bite, report what the rule list offered and what the pricing dialog said.
Send back "passed" or the step number and what was seen. 6.1b is ticked only when all of these pass.

## 7. Rotation and sharing

- **Change the code:** run `openssl rand -hex 16`, paste the result into the `ACCESS_CODE` variable in Vercel (Production and Preview; mark it Sensitive if the dashboard offers it, to be confirmed), then **redeploy** (a changed variable reaches the running site only with a new deployment). Tell the people the new code privately. Never in the repository, a document or a chat with me.
- **Open pages when the code changes:** a page keeps working until its next send; that send gets 401, the page removes the old kept code, shows "That access code was not accepted..." and the person types the new one. Nothing is lost: the CV and ad text stay in their boxes; saved profile and ads are not touched.
- **A reply already in flight** when the redeploy happens finishes normally.
- **The redeploy also empties the server's reading cache** (memory only), which is harmless.
- **Sharing:** one code for everybody; tell each person it is for their use only. If it leaks, rotate. There is no way to remove one person (non-goal).
- **Before the repository goes public:** the code has been set, the manual check passed, the rate rule is set and checked. The code itself never appears in any file of the repository, and the tracked docs describe the design, not a value.

## 8. Non-goals

Accounts and sign-in (after the MVP). A code per person, per-person quotas or a daily cap (step 9.2). Abuse detection, lockout after wrong guesses, captcha. A counter store (Upstash, KV or a database; a new service, rule 7). Protecting the static page. Hiding that the routes exist. Encrypting the code in the browser (it is the person's own tab). A "who used the code" log (no personal data is collected, plan 9.4).

## 9. Sprint placement (proposed; reviewer decides)

Proposal: a step **6.1b "Access code"**, built **after 6.1 is ticked** (the owner's manual check of docs/MANUAL-CHECK-6.1.md passes) and **before 6.2**.
- Why after 6.1's check: steps 10 to 25 of that check use the live AI routes; if the code shipped in the middle, those steps would suddenly ask for a code and the result could not be compared. Finish and tick 6.1 first.
- Why before 6.2: 6.2 builds a jobs page that will add more places that call the AI routes. The one helper `postJson` should exist before a third `fetch` is written.
- Why before anything else after that: HANDOFF requires the code before the link is shared and before the repository goes public; Day 10 (people use it) and Day 9 (strangers) depend on it. It is about half a day of work and touches only the two routes, one new server module, one new page helper and one small box.
- Cost of this placement: one half day before 6.2. The alternative (after 6.3) keeps the Day 6 product flow unbroken but leaves the routes open for longer; nothing may be shared in that time.
- It does not replace 9.2 (a daily cap per person and the "busy" message), which stays where it is.

Build order, if approved: (1) read the Next route-handler docs; (2) tests A1 to A19 (with A8b to A8e and A9 to A9c) and P1 to P8 from section 5, shown red; the existing route tests must pass untouched; (3) `accessMessages.ts`, `accessCode.ts`, both routes; (4) `accessFetch.ts`, the box, wiring the two fetch calls; (5) breaks b1 to b20; (6) docs: DECISIONS lines, HANDOFF, a step added to MANUAL-CHECK; gate; commit; push; (7) the owner sets the variable and runs section 6.

## 10. Questions for the reviewer, each with the proposed answer

1. **When does the page ask?** Proposed: after the first 401, not up front (section 3).
   Reviewer: yes.
2. **Any environment but "development" or "test" without `ACCESS_CODE` (or with a too-short one):** fail closed with 503 "not set up", previews included? Proposed: yes (section 2).
   Reviewer: yes, with the NODE_ENV rule of 1b (the check is skipped only when NODE_ENV is exactly "development" or "test"; anything else, including unset, fails closed).
3. **"development" or "test" without a code:** open, no check? Proposed: yes; the owner adds a line to `.env.local` by hand to try the box locally.
   Reviewer: yes.
4. **Minimum length 16 characters, enforced by the server, and the owner generates the code with `openssl rand -hex 16`?** Proposed: yes (section 4).
   Reviewer: yes.
5. **Kill switch before the access check** (so "paused" is answered to anyone, with no code)? Proposed: yes.
   Reviewer: yes.
6. **One 401 message for missing and wrong:** "The access code is missing or wrong."? Proposed: yes; the page, not the server, tells the two situations apart from what it sent.
   Reviewer: yes.
7. **Header `x-access-code`** rather than `Authorization: Bearer ...`? Proposed: `x-access-code` (no browser sign-in dialog; it does not suggest accounts).
   Reviewer: yes.
8. **Where the code is kept:** `sessionStorage` with a memory fallback, never `localStorage` or IndexedDB? Proposed: yes (section 3).
   Reviewer: yes.
9. **"Delete everything saved on this device" also forgets the code**, with the message unchanged? Proposed: yes.
   Reviewer: yes.
10. **Placement:** step 6.1b after 6.1 is ticked and before 6.2? Proposed: yes (section 9).
   Reviewer: yes.
11. **No lockout or counter in the app before the repository goes public;** the Firewall rule and the code length are enough, and if the rule does not exist on Hobby we record that and accept it? Proposed: yes.
   Reviewer: yes.
12. **Should the rate rule be a condition for going public,** or only the code? Proposed: the code is required; the rule is required if it exists on Hobby, otherwise recorded as accepted.
   Reviewer: the code is required; the rate rule is required too, since Hobby offers it; 10 a minute.
13. **This plan is a committed file and will be public with the repository.** It describes the design and what the code does not stop, and contains no value, no address and no quota number. Publish it as it is, or keep it out of the public tree until the code is built and checked? Proposed: it may be committed now (a design is not a secret); no further weak-spot detail goes into any other committed file (the owner's instruction of 2026-11-17 stays).
   Reviewer: commit now; the repository is private; when the public copy is made, rewrite the sentences that say the routes are open today into the past tense, and review this plan.
