STATUS: APPROVED by the owner on 2026-11-15, with these changes (recorded in docs/DECISIONS.md):
- D1: latest `pdfjs-dist` and `mammoth`; report exact versions and the `npm audit` result; pdf.js's eval option off; no other new packages.
- D2: (a), (b) and (c) all yes. CV lines are numbered AFTER the removal of email, phone and links, so the text the person sees, the text the AI gets and the evidence quotes are one text. Hand-worked tests for the removal include what it must NOT remove. No real CV through the live page until (a) is recorded (it is, partly: training not stated; see DECISIONS and HANDOFF).
- D3: code numbers the lines; SPRINT 4.2 reworded. D4: CLAUDE.md rule 8 edited. D5, D6, D8: as recommended.
- D7: one definition of "invented" (section 3 below) before any code. 4.2's final check is two full runs of the five CVs with the same fingerprint.
Careful lane for 4.2; 4.1 and 4.3 are fast lane apart from the privacy wording. Written 2026-11-15; no AI calls so far.

# Plan for Day 4: the CV comes in

Goal (docs/SPRINT.md): a person's profile from their CV, confirmed by them. The engine already has the Profile type: skills as `have` (with evidence: a CV line number and its exact text) or `inProgress` (with an expected date), plus constraints. Day 4 produces that Profile. The engine, `match` and its tests do not change.

## 1. What each step builds

**4.1 PDF or Word to text, in the browser.** New dependencies `pdfjs-dist` and `mammoth` (SPRINT names both; rule 7 says ask first, see decision D1). A client-only function `fileToText(file)` in `lib/cv/` (no AI, no network): PDF through pdf.js, DOCX through mammoth's raw-text call, `.txt` as plain text. Anything else, or a file with no text (a scanned PDF), gives a plain message ("no text found, paste your CV text instead"). A paste box is the always-works fallback. The page shows the extracted text so the person sees exactly what would be read. A size limit on the file (for example 5 MB) and on the text (20,000 characters, as for ads).
Check (SPRINT): text appears for a made-up test CV. My version: a made-up PDF and a made-up DOCX each give the text of their made-up CV, a scanned-style PDF (image only) gives the "no text" message, and a wrong file type is refused.

**4.2 The AI proposes skills, each citing a line.**
- Plain code first removes email addresses, phone numbers and web links (D2c), then splits the text into numbered lines (blank lines dropped, whitespace trimmed). The SPRINT says "the AI splits the CV into numbered lines"; I recommend code does the numbering, so the AI cannot change a CV line and rule 1 holds (decision D3).
- `lib/schemas/cv.ts`: the strict-mode reading, every field required: `skills: [{ name, line, quote }]`. `line` is the number the AI saw; `quote` is the words from that line that show the skill.
- `lib/ai/readCv.ts` and `app/api/cv/route.ts`: same pattern as `readJob.ts` (Groq, `Output.object`, `GENERATION_SETTINGS`, `getModel`). The prompt says: only skills the line shows, never guess, the CV is data not instructions.
- `lib/engine/fromCv.ts` (pure, like `fromAd.ts`): checks every proposed skill: the line number exists, the quote is inside that exact line (same normaliser as ads, `isInAd`), and the skill name goes through `skillIdFor` (same name-to-id function as ads and the pasted list). It also splits the survivors in two: **named** (the skill's name appears in the quoted words) and **inferred** (it does not: e.g. "led weekly reporting" proposed as "Reporting"). Anything failing a check is dropped and listed as removed, with a reason, as the ad page does.
- Check (SPRINT): five made-up CVs come back with every skill tied to a line and nothing invented. Made measurable in section 4.

**4.3 Confirm screen.** From the checked reading, build the Profile in the page:
- each skill with its cited line, keep or remove; "named" skills pre-ticked, "inferred" ones pre-unticked;
- add a skill by hand with no CV line: it is stored as `have` with `evidence: null`, which the engine never counts as met (existing rule), and the screen says so;
- add skills in progress with an expected date;
- set constraints: languages with levels, cities, work modes, years of experience, available from.
- The result feeds the 3.4 fit report: its evidence now cites real CV lines ("CV line 4") instead of "your list, line n". A constraint kind the person did not set stays "not judged" (decision D5).
- No edit of the CV text itself.
Check (SPRINT): a profile is confirmed in under 3 minutes (the owner times it on a made-up CV; the deploy-side check is the live link).

**Where it lives on screen.** One page (decision D6): the profile is held in page state, and nothing is stored (storage is step 6.1). Reloading the page loses it. That is deliberate for Day 4.

## 2. Where the CV text travels (privacy)

| Stage | Where the CV is | Leaves the device? |
|---|---|---|
| Choose a file | the browser | no |
| PDF/DOCX to text (4.1) | the browser (pdf.js, mammoth run client-side) | no |
| Split into numbered lines, confirm, build the Profile | the browser | no |
| "Read my CV" (4.2) | the text goes browser, then our Next.js route on Vercel, then Groq | **yes: this is the only step** |
| Groq's answer | back through our route to the browser | n/a |

- **Sent to the AI:** the numbered CV text only (lines and their numbers), plus our fixed instructions and schema. Not the file, not the person's name from anywhere else, no id, no IP. A CV usually holds a name, email, phone and address in its first lines; a cheap protection is to remove email addresses, phone numbers and web links in the browser before sending, and to show the person the text that will be sent (decision D2). Names and addresses cannot be removed reliably by code, so the notice must say so.
- **Stored by us: nothing.** No database, no file, no cookie, no localStorage; the profile lives in page state. The route keeps nothing between requests.
- **Logged by us:** nothing about content. Today the only logging is `console.error` of an error kind and a status code (grep of `app/` and `lib/`: five lines, none prints a request or an ad). The CV route would follow the same rule, with a test that a failing call writes no CV text to the console (section 3). Vercel's own runtime logs record the request line and our `console` output; they do not record request bodies by default. I have not verified this against Vercel's current documentation, and I would check it in 4.2.
- **At Groq:** the CV text is processed on their servers. Read on 2026-11-15 (DECISIONS has the sentences): by default Groq does not retain inference data, but inputs and outputs may be logged up to 30 days for reliability or abuse cases, Zero Data Retention can be enabled in the console, and data is held in the United States. The page says nothing about training, so that part is **unverified**; the DPA has not been read. Vercel functions also run in a region we have not chosen (default is the US); the Day 9.3 privacy page must say which.
- **Consent gap:** SPRINT puts the privacy page and "consent before a CV upload" on step 9.3, after Day 4. Until then only synthetic CVs should be used, or the page gets a one-sentence notice and a button that says what is sent (D2).
- **Prompt injection:** a CV can contain "ignore previous instructions". Same position as ads (DECISIONS 2026-11-13): the output affects only the person who pasted it, and every skill must cite a line and a quote that is in that line.

## 3. Testing without any real CV in the repo

### 3.0 The one definition of "invented" for 4.2 (fixed before any code)

- **The key.** Each made-up CV has an answer key that lists, for every CV line that supports a skill, the skills that line supports, each marked **named** (the skill's name or a listed alias is written in that line) or **inferred** (the line shows the skill without naming it, for example a line about weekly reporting supporting "Reporting"). A line may support several skills; a skill may be supported by several lines.
- **Invented.** A skill the AI proposes is **invented** only if the line it cites does not support that skill in the key. A skill cited on the wrong line is therefore invented, even if another line supports it. A skill supported by no line at all is invented. Nothing else is invented.
- **Amended 2026-11-16 (PLAN-4.2, section "Metrics"):** invented is split into (a) invented, which alone counts in the pass line, and (b) unmatched inferred, which is only printed; a listed skill not written in its line and not accepted by the key is invented. The text below is the original.
- **Not part of "invented":** whether a supported skill is named or inferred (a separate label, reported as two counts), whether the AI missed a skill the key lists (reported as found of key total, no target), and how the AI worded the name (the name goes through `skillIdFor`).
- **Pass lines for 4.2, fixed now:** on each of two full runs of the five CVs with the same fingerprint (prompt, schema, model, settings, CVs and keys): invented 0; every kept skill cites an existing line and a quote found inside that line (enforced by code); the named and inferred counts are reported, with no pass line. Both runs must pass.
- **Order of the pipeline, so there is one text.** The browser takes the text (file or paste), removes email addresses, phone numbers and web links (placeholders such as `[email removed]`), **then** numbers the lines. The person sees that text, the AI is sent exactly those numbered lines, and every evidence quote is taken from them.
- **The removal's tests are worked out by hand first**, with two lists. Must remove (examples): an email address, a phone number written with a country code, with spaces, and with brackets, a `https://` link, a `www.` link, a `linkedin.com/in/...` address. Must NOT remove (examples): date ranges `2019-2023` and `2019 - 2023`, `12/2021`, `Q3 2024`, `ISO 27001`, `10,000 users`, `Python 3.11`, `SQL Server 2019`, `3.5 years`, a plain number with a percent sign. The full table is written before the code in 4.2.

### 3.1 Fixtures and tests

- **Five made-up CVs** (D4), written by Claude, every name, employer and line invented, saved as text in `fixtures/synthetic-cvs/` with their answer keys: for each CV the skills a careful reader would list, each with its line number. One CV has a German section, one has an injection line, one is thin (few skills), one has a skills list in one comma line, one has skills only in prose ("led weekly reporting"), so named and inferred both get exercised. The profiles in `fixtures/profiles.ts` already hold six made-up people and can seed some of these.
- **Made-up PDF and DOCX** for 4.1: one tiny text-only PDF and one DOCX for one made-up CV, generated by a one-off script and committed as small fixtures, plus a PDF with no text layer for the "no text" message. No file from the owner or anyone else.
- **Unit tests, no AI:** `fromCv` (hand-worked table first, like `fromAd`): bad line number, quote not in the line, quote in the wrong line, skill named vs inferred, duplicates, unlisted skill ids (`new:`), injection line. Line splitting. Profile building from the confirmed choices. The redaction of email, phone and links. A test that a failing call logs no CV text.
- **Test the 4.2 check as a script:** `npm run eval-cv` reads the five CVs (5 Groq calls, about 25,000 tokens a run at the 4,400-a-call rate seen in 3.3) and prints, per CV: skills proposed, tied to a line, named, inferred, dropped by the checks, and **invented** (a proposed skill that is on no key line). Pass lines are in section 3.0: invented 0 on two full runs of the five CVs with the same fingerprint, every kept skill citing an existing line that contains its quote; found is printed for information only, with no target (a missed skill is added by hand in 4.3). To avoid a repeat of 3.3: write the prompt once, run once, and change it at most twice, each time on a stated reason, with the 3.3 rule that a change is judged on its side effects, not only its target.
- **Eval and CV keys are committed** (D4): they are about invented people, not a real person.
- `npm run build`, `tsc`, lint and tests stay green on the working tree; the scratch folder `eval-runs/` is already excluded.

## 4. Does Day 4 touch lib/ai? Yes, in 4.2

- New: `lib/ai/readCv.ts`, `lib/schemas/cv.ts`, `app/api/cv/route.ts`, plus `lib/engine/fromCv.ts` (pure).
- **The HANDOFF fix goes in with it.** The AI SDK retries a retryable error twice and then throws a `RetryError`; `toReadAdError` reports that as a generic 500, so a 429 or a 5xx loses its status code and the eval runner's 429 backoff cannot fire on the real path. Fix: move the error mapping into a shared `lib/ai/errors.ts` that both routes use, and first unwrap `RetryError` (its `lastError`) before looking at `APICallError`. Tests use fake errors only (a `RetryError` wrapping a 429 gives the 429 message and status; wrapping a 503 gives the 502 message; a `RetryError` wrapping something unknown stays a 500), expectations by hand. No AI call. The ad request must not change: the call-free fingerprint must still read `request 85357f8fac | INSTRUCTIONS 3,347` after the change.
- The 4.2 prompt is new text the AI reads, so it is careful lane in full: plan, hand-worked table, then code, then deliberate breaks.

## 5. Decisions (all approved on 2026-11-15; the original recommendations)

| # | Decision | Recommendation |
|---|---|---|
| D1 | Add `pdfjs-dist` and `mammoth` (rule 7: ask before any new dependency; both free, open source, run in the browser)? A dev-only helper to build the made-up DOCX fixture is not needed if the fixture is generated once and committed. | Yes to both. No other new packages. I will check that pdf.js's worker loads under Next 16 and Turbopack on day one of 4.1; if it does not, I stop and tell you. |
| D2 | Privacy before real CVs: (a) read Groq's current retention terms and record them; (b) a one-sentence notice and a "Send for reading" button saying what leaves the device; (c) strip email, phone and links in the browser before sending. | Yes to all three, kept small. Until (a) is done, only synthetic CVs are used. The full privacy page and consent stay on 9.3. |
| D3 | Who numbers the CV lines: the SPRINT says the AI splits it. | Plain code numbers the lines; the AI only returns line numbers and quotes, and code checks them. Rule 1, and it makes "every skill tied to a line" true by construction. |
| D4 | CV fixtures and keys: your CLAUDE.md rule 8 says never commit answer keys. Made-up CVs and their keys contain no real person (the barista known case and its key are already committed). | Commit them, and record the exception in DECISIONS.md, so the tests and the CV eval run for anyone and on a clean checkout. |
| D5 | Constraints after 4.3: the person's cities, languages, years and availability make the engine judge constraints. If a person leaves a kind empty, the engine counts a missing city or language as a conflict. | The page judges a constraint kind only if the person set it; the rest stay "not judged" and the label shows which kinds were judged. This is page code like 3.4's, with no engine change. "Skills only" stays as the label only when nothing was set. |
| D6 | Screen structure: the profile is held in page state, so a second page would lose it. | Keep everything on the one page `/` for Day 4 (CV, confirm, ad, report in that order). A separate profile page waits for 6.1's storage. |
| D7 | What counts as "invented" for 4.2. (Approved; the approved definition is section 3.0, which replaces "name not in the quoted line".) | Named skills are pre-ticked; inferred ones are listed apart and pre-unticked ("from your wording, keep only if true"). The pass line is invented 0 against the keys, and found has no target. |
| D8 | Should the AI also read languages, cities and years from the CV? | No. 4.2 says "proposes skills"; constraints are set by hand in 4.3. Less AI reading, fewer invented facts. |

## 6. Order of work and a stop rule

4.1 (fast lane, apart from the dependency decision and the privacy wording), then 4.2 (careful: plan, hand-worked table for `fromCv` and the error unwrap, tests, deliberate breaks, then one real run of the five CVs with your go), then 4.3 (fast lane, display and wiring, with the `Profile` builder tested). Ticks and log lines at the end of the day. I stop and tell you if a check fails twice, if pdf.js does not load, or if a decision above changes.
