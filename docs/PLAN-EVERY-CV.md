# PLAN: Career Co-pilot works on every CV

Status: PLAN ONLY. No code, no test change, no AI call, no network was used to write it. Written on branch `step-every-cv`, cut from the tip of `step-9.3` (b3c6a21). Every wording in it that a user will read is a DRAFT until the owner approves it.

Written for: the owner (a product manager, not a programmer). Technical words are explained the first time they appear. File references look like `path:line` and were read on this branch.

Words used here, once and for all:
- **Pin**: a test that fixes one value (a hash, a version) so a change cannot slip in unseen. Changing a pinned value is a decision, not an accident.
- **Hash / request hash**: a short fingerprint of exactly what we send to the AI. If the prompt changes, the hash changes. Today: ad 85357f8fac, CV 193e02ee3f. The skill list ("vocabulary") has its own hash, e96370fe4c. `READING_VERSION` is "3". (The bullets hash 5e3da9fa30 exists only on branch `step-8.3`, see section 13.)
- **Engine**: the plain-code rules in `lib/engine` that count and decide the level. No AI. Rule 1 of the project: the AI reads and writes, code decides and counts.
- **Listed / unlisted skill**: listed = the skill is in our skill list (the vocabulary), so it has a fixed id like `sql`. Unlisted = it is not, so it gets a made-up id from its words, like `new:wound-care`.
- **Evidence**: a CV line (word for word) that shows a skill. Every "met" must cite one (project rule 2).
- **Kill switch**: the setting `AI_ENABLED=false` that pauses every AI route.
- **Tokens per minute (TPM)**: the Groq free-tier limit of 8,000 tokens a minute. A token is about four letters of English text.

---

## 1. Goal and definition

The owner's words: **"I want this to work on every cv, because we will test that cv against the job ad."**

The definition of "works on every CV", in three lines:
1. **Nothing is dropped.** Every requirement of the ad stays on the screen, and every confirmed skill of the CV stays on the profile.
2. **Every ad requirement gets an answer**: *met* (with a quote from the CV), *partly* (with a quote), or *no evidence found*. If the check could not run, the row says so, as it does today. It is never filled with a guess.
3. **A wrong answer is visible.** The evidence (the CV quote and the CV line number) is shown next to the answer, so the person can see a wrong "met" at once.

Not goals: a guarantee that the answers are correct (the AI can still be wrong; the plan makes wrong answers visible and measures how often); judging how good someone is at a skill (level of skill); rolling this out to other people (privacy gate of step 9.3 still applies); paid tiers or new paid services (rule 7).

---

## 2. What happens today (read from the code on this branch)

There is no probe report in the repository (I searched `docs/`, `scripts/`, `tests/`, `lib/`, `app/`: the word "probe" appears only as the fake-fetch "fingerprint probe" in `lib/ai/cvRequestBody.ts:9`). So this section is the code reading, not measured results. The size of the problem is measured by Stage 0 (section 10).

1. **The CV side already finds unlisted skills.** The CV prompt asks for any "skills, tools, methods and kinds of work" and its own example is "Welding" (`lib/ai/readCv.ts:16-34`). `fromCv` keeps an unlisted skill with its line and quote and marks it `listed: false` (`lib/engine/fromCv.ts:109-117`, list of them at `:120-126`).
2. **Then the profile throws it away.** When the person ticks an unlisted CV skill, `buildProfile` does not put it on the profile. It pushes only `{ name, where: "cv" }` into `unmatchable`, with no line and no quote (`lib/cv/profile.ts:103-106`). The confirm box says "not in our skill list yet, so it can't be matched with an ad" (`app/ConfirmBox.tsx:33`) and, lower down, "…can't be matched with your CV" (`app/ConfirmBox.tsx:213`; two different sentences for the same thing).
3. **The ad side keeps every requirement but cannot judge the unlisted ones.** `splitJudgeable` takes out every requirement whose skill ids are ALL unlisted (`lib/engine/judgeable.ts:8-21`) BEFORE the engine runs (`lib/cv/engineView.ts:20`). They come back as "could not judge": out of the level and the counts, one row each ("…not in our skill list yet, so we could not judge it", `app/fitReport.ts:107-109`), a tail in the sentence ("plus N must-haves we could not judge", `app/skillsOnly.ts:129-136`) and a label caveat ("(skills only; N must-haves not judged)", `app/skillsOnly.ts:159-171`).
4. **Result for a CV in a field the list does not cover** (nursing, law, construction): most must-haves of the ad are unlisted, so the level reads "No level (no must-have we could judge)" (`app/skillsOnly.ts:150-154`, `lib/engine/judgeable.ts:33-40`). The product does not lie, but it says nothing useful. That is the gap this plan closes.
5. **The 60-skill cap is not silent today, but it is badly worded.** The 61st valid skill is removed as `too-many` (`lib/engine/fromCv.ts:104-107`, test C14 at `tests/fromCv.test.ts:106`) and shown in the list "N items removed because a check failed … there were too many skills" (`app/CvBox.tsx:28`, `:220-233`). Nothing "failed"; the wording is wrong and the list can be long. The cap counts listed and unlisted skills together.
6. **Limits** are in `lib/cv/limits.ts:6-9`: 12,000 characters, 400 lines, 1,000 characters a line, 20 pages, 5 MB. A CV over them is refused with a message (`app/CvBox.tsx:51-54`, `lib/cv/fileToText.ts:45-48`).

---

## 3. Options compared

| | A. Grow the skill list | B. Free names plus similarity matching | **C. Evidence check against the confirmed profile (recommended)** | D. Whole CV against the ad at report time |
|---|---|---|---|---|
| Idea | Add more skills (nursing, law, …) to the vocabulary by hand, so more things are "listed". | Keep the AI's free names; match an ad name to a CV name by how alike they are (close spelling, or word-meaning similarity). | Keep the person's confirmed unlisted skills WITH their CV line. For ad requirements the list cannot match, ask the AI one question: "which confirmed entry, if any, shows this?" Code then proves the answer. | Send the whole CV and the ad together every time a report is built. |
| Covers every field? | No. The tail is endless; each new field is owner review work. | Only as far as the similarity reaches; close spelling mapped 1 of 35 names in the earlier measure (DECISIONS 2026-11-16). | Yes, in any field and any language the AI can read. | Yes. |
| Wrong answer visible? | Yes (deterministic). | **No.** A similarity score has no sentence to show; "met" would rest on a number. | **Yes.** Every AI answer carries a CV quote that code has checked is on the cited line. | Only if it also quotes; same as C but with more text sent. |
| New AI call? | No. | Close spelling: no. Meaning similarity: a new AI call or a new dependency (rule 7: ask first). | **One new call, own prompt, own new pin.** | A new call that also needs the whole CV. |
| Existing pins that move | Vocabulary hash e96370fe4c moves; eval fingerprints move; saved ads are re-checked by code because the stamp differs; some older tests change meaning (18 did in DECISIONS 2026-11-16). Ad hash, CV hash, `READING_VERSION` do not. | A changed mapping changes what the same ad text reads as, so `READING_VERSION` "3" → "4" (precedent: DECISIONS 2026-11-16, 5.2) and its pin test `tests/readingVersionPin.test.ts` changes. That edits live reading code: **needs the owner's explicit go.** Hashes do not move unless the vocabulary data changes too. | **None move.** One NEW pin is added (the check request hash). An addition, not a change. | None of the old ones; one new pin. But `SavedProfile` would have to hold the whole CV (see below). |
| Cost to the person | None. | None. | One click per ad ("Check what we could not judge"), one AI call. | One AI call per ad, with the whole CV in it each time. |

**Why D breaks "we do not keep your whole CV".** To judge an ad at report time the server must see the CV at report time. The server keeps nothing, so either (a) the browser keeps the whole CV so it can be re-sent with every ad (the saved profile today holds only the cited lines, claim C4 in `lib/privacy/messages.ts:43-44`, and `lib/saved/profile.ts:9-24` rebuilds the lines from them for exactly that reason), or (b) the person pastes the CV again each time. (a) reverses the promise of step 6.1 and 9.3 and puts name, address and every employer in browser storage; either way the whole CV, including the parts we cannot clean, leaves the device again for every ad. D is a different product.

**Recommendation: C.** It keeps rule 1 (code decides: the AI only points, code proves), rule 2 (every "met" cites a CV line), rule 3 ("not stated" beats a guess: no proof means "no evidence found" or "could not judge"), and moves no existing pin. A can still be done later, ad by ad, as a cheap complement: a skill that is listed never needs the AI.

Does C need an existing prompt to change? **No.** The CV prompt already returns unlisted skills; the ad prompt already returns unlisted requirements. Neither is touched. (If a later stage finds they must change, it is marked "needs the owner's explicit go" and moves pins 193e02ee3f or 85357f8fac and `READING_VERSION`.)

---

## 4. Design of C, step by step

### 4.1 CV side: keep unlisted skills, with their line

- `buildProfile` keeps a ticked unlisted CV skill in a NEW list `unlistedKept: { name, skillId, evidence: { line, text } }[]` on `BuiltProfile` (type at `lib/cv/profile.ts:42-51`; the push site is `:103-106`). The old `unmatchable` list is left exactly as it is, so the pinned test `tests/profileBuild.test.ts:69` (`unmatchable` equals `[{ name: "Frontend development", where: "cv" }]`) does not change. The new field is optional in the type so literals in other tests (for example `tests/savedRoundTrip.test.ts:159`) still compile.
- Skills added by hand (no CV line) and skills "in progress" stay out, as today (`lib/cv/profile.ts:129-130`, `:153-154`): they have no line to cite, so the check never sees them. Test K5 (`tests/savedUi.test.ts:137`) stays true.
- **Confirm-box wording (DRAFT).** The tag at `ConfirmBox.tsx:33` today says "not in our skill list yet, so it can't be matched with an ad". After this work that is false, so it becomes: "not in our skill list yet; it is checked against an ad by the AI, with your CV line as proof". The second place (`ConfirmBox.tsx:213`, "can't be matched with your CV") is the "with an ad" fix's twin: for `where: "cv"` it is replaced with "kept with CV line n (checked against an ad by the AI)"; for hand-added and in-progress names the old sentence stays. After the fix the two places say the same thing in the same words. No test pins either string today (searched `tests/` for "matched with"); the new wording gets its own test.
- **The 60-skill cap shows a message.** Keep 60 (raising it grows the CV call's answer and the check call's input, see section 5). Replace the "removed because a check failed" treatment for `too-many` with its own line: "Your CV showed N more skills than the 60 we keep. These were left out: …names…. Pick the ones that matter by unticking others and sending again, or shorten the CV." The cap still keeps the first 60 in the AI's order (today's rule; test C14 unchanged). A smarter rule ("named before inferred") is a code decision in `fromCv` and is offered as a question, not built.
- The profile can now hold up to 60 entries with a line each. Those lines go to the AI again in the check (section 6).

### 4.2 Ad side: every requirement is kept; list match first

Order of work for each requirement of an ad, all in the browser except step 3:
1. **List match** (today): a requirement whose ids include a listed skill is judged by the engine. Unchanged.
2. **Same-name match by code (new, no AI).** If every id of the requirement is unlisted and the person has a kept unlisted entry with the SAME id (the same words, slugged the same way: `new:wound-care` on both sides, DECISIONS 2026-11-14 gives the same id to the same words in an ad and a CV), it is met by that entry, citing its line. This is as safe as listed matching: same words, one line. (The pasted-list page keeps its own rule, test S8 `tests/skillsOnly.test.ts:96`, because that page has no CV lines.)
3. **AI check** (new, only on a click) for what is still "could not judge". Which requirements are sent is question 8 (section 12): recommended, only requirements where every id is unlisted, musts and nice-to-haves.

Requirements the ad reader flagged as "not a skill a CV can show" (traits, `notCounted`) and the "check this yourself" conditions keep their current treatment: they are listed, not counted, not sent. Nothing is dropped; they were never counted.

### 4.3 The check call

**Input** (all numbered, built by code):
- Requirements: `R1 [must] "<the ad's own words>"` … (the quote that is already on every requirement, `lib/engine/types.ts:54-62`; clipped at 300 characters; at most 30 per call, see section 5).
- Entries: `E1 | Wound care | "<the CV line, word for word, clipped at 240 characters>"` … one for every confirmed entry that has a CV line, listed and unlisted skills alike (a listed "SQL" line can show an unlisted "data-driven decisions" requirement). At most 60.
- Not sent: the access code (header only), the person's cities, languages, years, dates, the unticked skills, the whole CV, the whole ad.

**Output** (strict mode: every field required, `nullable` not `optional`, per CLAUDE.md): a list with one item per requirement: `{ requirement: number, verdict: "met" | "partly" | "none", entry: number | null, quote: string | null }`.

**Code-side proof** (a pure function, no AI; it mirrors what `fromCv` does for a CV skill, `lib/engine/fromCv.ts:86-99`). An answer counts only if ALL of these hold:
1. the requirement number is one we sent, and it was answered exactly once (twice or never = unanswered, row stays "could not judge");
2. for `met` and `partly`: the entry number is one we sent (an entry with a CV line);
3. the quote has at least one real word (`hasRealWord`, `lib/engine/quoteMatch.ts:18`);
4. the quote is really inside THAT entry's line (`isInAd`, `lib/engine/text.ts:27`: case and accents ignored). A quote that is only on another entry's line is not rescued, exactly as in `fromCv`.

If 2, 3 or 4 fails, the AI's answer is thrown away and the row reads **"no evidence found"** (as the owner asked), and the screen counts how many answers were thrown away. A `none` answer needs no entry and no quote. A requirement the AI skipped is never turned into "none": silence is "could not judge".

### 4.4 How answers reach the level without changing the engine

The engine (`match.ts`, `fit.ts`, `unlock.ts`) is not touched. It already counts a requirement as met when the profile holds a `have` skill with the same id and a citation that really matches a CV line (`lib/engine/match.ts:57-59`, `:65-82`). So the new code does the translation BEFORE the engine, in a new pure file next to `lib/cv/engineView.ts` (a sibling, `engineViewWithAnswers`):

- For a verified **met** answer: the requirement's id is rewritten to a new non-`new:` id (for example `ev:3`), and the engine profile gets one extra `have` skill with that id and the entry's own evidence. The engine then counts a normal "met" with a citation. The evidence comes from a profile entry that already passed the CV-side checks; the AI never writes a line.
- For **partly** and **no evidence found**: the id is rewritten to `ev:n` with NO profile skill, so the engine counts a normal **missing** must-have.
- **Unanswered** (the AI skipped it, the call failed, the answer was twice, AI is paused): the requirement is left alone, so `splitJudgeable` sets it aside as "could not judge" exactly as today.

Why this is the right place: `engineView` is the one construction that the report, the roadmap and the gap list share (its own header comment, `lib/cv/engineView.ts:7-18`). On the unmerged chain it is also used by `app/roadmap.ts:114` and `app/bullets.ts:30`, and by analytics through `profileReport` (`app/analytics.ts:70`). With no answers the new function must return EXACTLY what `engineView` returns today (test EV1), so nothing that exists changes until a person clicks.

**Label and level rules (a level must never read stronger than the evidence):**
- R1. A verified met counts as met, shown with its quote.
- R2. **Partly counts as NOT met** (a missing must-have). It never raises the level. (Question 2.)
- R3. No evidence found counts as missing, like a listed skill the person does not have.
- R4. **AI could not answer** (error, 429, `AI_ENABLED=false`, schema failure, skipped item): nothing changes. The rows stay "could not judge", out of the level, with the caveat in the label, as today. The page shows a plain message ("The check could not run: …. Nothing changed. You can try again later."). It never retries by itself.
- R5. Whenever at least one must-have was judged by the AI, the label says so inside the brackets: "Stretch (skills only; 2 must-haves judged by AI)". When there were none, the label is identical to today's, character for character. Any remaining unanswered must-haves keep their own caveat ("; 1 must-have not judged").
- R6. The order of the "No level" reasons is unchanged (`lib/engine/judgeable.ts:24-40`).

Worked example, by hand (invented ad; assume "SQL" and "Excel" are listed and "Wound care" and "Patient intake" are not; the person's CV line 4 says "Dressed and monitored wounds on a surgical ward"):

| Must-have | List match | AI check | Counts as |
|---|---|---|---|
| SQL | met (line 2) | – | met |
| Excel | not on profile | – | missing |
| Wound care | unlisted | met, entry E3, quote "Dressed and monitored wounds" (on line 4) | met |
| Patient intake | unlisted | partly, entry E5 | missing |

Today: only SQL and Excel are judged: 1 of 2 met, 1 gap, **Good (skills only; 2 must-haves not judged)**. With the check: 4 musts, 2 met, 2 missing, 2 gaps: **Stretch (skills only; 2 must-haves judged by AI)**. If "Patient intake" had been met: 3 of 4 met, **Good (skills only; 2 must-haves judged by AI)**. If the check had failed: unchanged from today. These three become test cases before any code.

### 4.5 The report

- Rows judged by list or by same-name match stay where they are, in the ad's order, with today's wording.
- A second block, **"Judged by the AI from your CV lines (read each quote)"**, holds the AI-judged rows, apart from the others. Each row: the requirement's words, the verdict (met / partly / no evidence found), and for met and partly the entry name, "CV line n" and the quote. Answers the proof threw away are counted in one line ("2 answers were not accepted because their quote was not on the CV line").
- The counts sentence says how many of the met must-haves were AI-judged ("You meet 3 of 4 must-haves (2 judged by AI)").
- The page works exactly as today until the button is pressed. In the demo (no AI, `/demo`) nothing changes.

### 4.6 Saved ads and profiles: what is stored, what is computed

| Item | Stored on this device? | Where / how |
|---|---|---|
| Unlisted confirmed skills with their CV line | **Yes**, new optional field on the saved profile, `unlistedKept` (name, id, line, line text) | `lib/saved/types.ts:20-27`, `lib/saved/schemas.ts:74-87`, `lib/saved/profile.ts:27-40`. |
| The check's answers | **No in the first release.** They live in the page's memory and go on reload or on "Delete everything". | Computed again by one click. |
| Rewritten ids, rows, level, label, counts | Never stored. | Computed in the browser at report time, as today. |

- **Old saved profiles still open.** The new field is optional; `lib/saved/migrate.ts:3-6` says an added optional field needs no schema bump (`SCHEMA_VERSION` stays 1, `lib/saved/types.ts:10`), the profile schema is a "loose" object, and a profile's stamps are written but never compared when it is loaded (`lib/saved/saved.ts:39-60`). An old profile simply has no unlisted entries. The page then says (DRAFT): "This saved profile was saved before unlisted skills were kept. Read your CV again to add them."
- **A newer profile opened by an older app** keeps the field untouched (loose object), as `migrate.ts` intends.
- `sparseCvLines` (`lib/saved/profile.ts:16-24`) rebuilds the CV lines from cited evidence only; it must also include the lines of the unlisted entries, or the engine's line check (`match.ts:57-59`) would fail for them. `builtFromSaved` (`:50-67`) fills the new field back. When the vocabulary later lists a skill that was unlisted, the entry's id is looked up again on load (same function as `fromCv` uses, `readNameId`, `lib/engine/readName.ts:22`), so a saved `new:x` becomes the real id. A test pins it.
- **Consequence to accept, openly:** a saved ad opened from the list, and the "What to learn" box and the analytics, do not know the check's answers (nothing is stored), so they show the conservative "could not judge" picture. They are never stronger than the evidence. If the owner wants them to agree with the open report, that is Stage 6 (store answers per saved ad, with a key of the profile they were made for).

### 4.7 Language

An English CV with a German ad, and the reverse, work with the same call: the AI is told that requirements and CV lines can be in different languages and that the quote must be copied from the CV line in the CV's own language, never translated. The code's proof is language-blind (it only checks that the quote is on the line). The vocabulary already knows German names for listed skills, so list matching handles the listed part in both directions. The risk is higher here: translation makes a generous "met" easy ("Buchhaltung" ↔ "bookkeeping" is fine; "Pflege" ↔ "care" may not be the same job). So two of the ten test pairs are cross-language (section 9) and false "met" is counted separately for them. The screen text stays English.

---

## 5. Limits

- **12,000 characters and 400 lines of CV** (`lib/cv/limits.ts:6-8`), 1,000 characters a line. **60 skills** (`lib/engine/fromCv.ts:12`). **30 requirements per check call** (new; chosen so one call fits, see below). An ad is at most 20,000 characters (`lib/schemas/job.ts:68`).
- **Token estimate for the check call** (an estimate: four characters a token, to be replaced by the real numbers from the `x-ratelimit` headers that `lib/ai/usage.ts:3-12` already keeps):

| Part | Typical (20 requirements, 60 entries) | Worst case (30 requirements, 60 entries, all clipped) |
|---|---|---|
| Instructions (about 2,400 characters) | 600 | 600 |
| Requirements (about 40 tokens each) | 800 | 30 × 85 = 2,550 |
| Entries (name + line, about 38 tokens each; worst 70) | 2,300 | 4,200 |
| Answer format overhead | 250 | 250 |
| **Input** | **about 4,000** | **about 7,600** |
| Output: the JSON answer (about 45 tokens a requirement) plus the model's own reasoning (the `gpt-oss` model "thinks" before answering; the bullets eval on `step-8.3` used about 1,000 output tokens per call on a small input) | 900 + 1,000 to 2,000 = 2,000 to 3,000 | up to 4,000 |
| **Total** | **about 6,000 to 7,000** | **over 11,000** |

- **Does it fit 8,000 tokens a minute?** Typical, alone: yes, but with almost no room (75 to 90 % of a minute). Together with an ad read in the same minute (about 3,500 to 5,000 tokens) the sum passes 8,000, so a 429 ("busy") is likely if the person clicks within about a minute of reading an ad. The worst case does not fit at all. **Requests per minute (30) and per day (1,000) are no problem**: one click is one request, and the Vercel firewall rule of 10 `/api/` requests per 60 seconds per IP (fact U9, `lib/privacy/facts.ts:53-61`, observed 2026-11-25) is not reached by one click. Retries: the SDK asks again twice on an error (claim C15, `lib/privacy/messages.ts:72-73`), so one 429 can cost three tries of the same tokens.
- **What the plan does about it** (all code, no prompt change): clip entry lines at 240 characters and requirement quotes at 300; send at most 30 requirements, musts first, and show "N requirements were not checked (limit)" for the rest, never silently; if the entries plus requirements still pass about 6,000 input tokens, the call is split in two requests of half the requirements, sent one after the other with the existing pacing idea (`lib/engine/evalCvRun.ts:48` `waitForTokens` shows how the eval paces itself). Stage 3 measures the real numbers before anything else is decided.

**A CV over the cap (characters, lines or 60 skills). Options:**
1. **Refuse with a clearer message (today, improved).** Say how far over it is and which part is long (for example "lines 300 to 400 are over the limit"). Nothing is dropped, the person edits. Cheap, honest; some real CVs (long academic ones) need work by hand.
2. **Read the first part, say so, and let the person decide.** "Only the first 12,000 characters (lines 1 to 310) were read. Lines 311 to 400 were not." A person can then paste the second part as a second reading. Fast to build, but part of the CV is "dropped" by size (visibly).
3. **Read in two parts and merge in the browser.** Two CV calls (the second after a wait for the minute's tokens), the skills merged, lines numbered once. Works on every CV; costs two calls and a more complex page.

**Recommendation: 1 now (with the better message), 3 later if the near-cap test pair (section 9) shows real CVs hit the cap.** Option 2 is the fallback if 3 proves too big. For the 60-skill cap: keep 60 and show the message (4.1).

---

## 6. Privacy and consent

**What the new call sends:** the ad's requirement sentences (short quotes of the ad, which is not cleaned: it is whatever the person pasted) and, for each confirmed skill that has a CV line, the skill name and that CV line (clipped at 240 characters). The CV lines were already sent once, after the contact-detail check, in the CV reading; the check sends the confirmed subset again, once per click, and up to three times when the AI service errors (C15). It does NOT send: the whole CV, the unconfirmed skills, cities, languages, years, dates, the access code in the body. The server keeps nothing (no cache for this route, no file, no database) and logs only a fixed line (a new "check: …" line in the same set as `lib/ai/errors.ts:37,46,56,85`). The AI service's own handling is the same two facts as today (U2a: may store for up to 30 days; U2b: zero retention is switched on, both `lib/privacy/facts.ts:17-33`).

**New and changed items (all DRAFT, wording only after the owner approves):**
- `lib/privacy/facts.ts`: **no new row is needed.** Facts are about the two services (Groq, Vercel), not about our routes; the new call goes to the same two. The Vercel rule U9 already covers "paths that start with /api/". (Optionally re-observe the rule once the route exists.)
- `lib/privacy/messages.ts`: new `CHECK_INFO_LINE` (next to the new button, like `AD_INFO_LINE` at `:20-21`); a new claim, "The check sends the requirement sentences and the confirmed skills with their CV lines; the server keeps nothing"; changes to **C3B** (`:39-40`, "For a CV it keeps nothing": add the check route), **C4** (`:43-44`: the saved profile now also holds the unlisted skills with their CV line), **C6** (`:52-53`, the fixed log lines) and the stored-data heading text. **C9** (`:64-65`, delete everything) and **C16** (`:117-118`) stay as they are, unless the answers are later stored (Stage 6).
- `/privacy` page (`app/privacy/page.tsx`): the new claim and the changed claims render from the constants (test M1 requires every constant to be rendered).
- **Tick or info line? Recommendation: an info line plus the existing tick, no second tick.** The tick (`CV_TICK`, `:24`; kept for the tab only, `app/consent.ts:69-72`) already says "I am sending my own text to be read by an AI service"; the check sends a smaller part of the same text to the same service. The check button goes through the same gate (`sendIfAcknowledged`), so a profile loaded from storage in a fresh tab shows the tick before the first check. The info line says exactly what is sent. A separate tick is the cautious alternative (question 5).
- **Delete everything.** The unlisted entries live inside the saved profile record, so the existing delete removes them (new test: a profile with `unlistedKept` is gone after delete, extending `tests/deleteMyData.test.ts`). The check answers live in page memory: "Yes, delete everything" must clear them too, like the 2.6b fix for the access code on screen (`b3c6a21`); new test.
- **`WORDING_APPROVED_ON`** (`lib/privacy/messages.ts:11`) is `null` now, and the gate test F4 (`tests/privacyFacts.test.ts:108`) fails with `PRIVACY_GATE=1` until the owner sets it. Every new or changed line stays a draft. **If the owner has approved the wording by the time this is built, the first commit that adds or changes a line sets it back to `null`** (approval of the old text is not approval of the new), and the owner approves again, whole page or only the new lines (question 9).
- The privacy inventory tests are built to fail on exactly this change (`tests/privacyInventory.test.ts:19`, section 8 below). The route and its inventory/privacy rows go in the SAME commit.

---

## 7. Pins

| Pin | Where | Moves for C? |
|---|---|---|
| Ad request hash 85357f8fac | `tests/requestHashPins.test.ts` P1, `tests/readingVersionPin.test.ts:16` | No |
| CV request hash 193e02ee3f | `tests/requestHashPins.test.ts` P2 | No |
| Vocabulary hash e96370fe4c | `lib/engine/vocabHash.ts`, `tests/vocabWebHash.test.ts` | No (C adds no skill; A would) |
| `READING_VERSION` "3" | `lib/ai/readingVersion.ts:7` | No (B would) |
| Bullets request hash 5e3da9fa30 | only on `step-8.3` | No |
| **NEW: check request hash** | new `lib/ai/checkRequestHash.ts` and a pin test, as `bulletsRequestHashPin.test.ts` does on `step-8.3` | Added in Stage 3, **only after the owner approves the prompt text**; a test says it differs from the other four |

Existing tests that must be changed by hand in the same commit as the code that causes them (old, new, reason). Nothing here is changed now.

| Test | Old expectation | New expectation | Reason |
|---|---|---|---|
| `tests/privacyInventory.test.ts` I1 (`:117`) | API routes are exactly `/api/cv` and `/api/read` | exactly `/api/cv`, `/api/read`, `/api/check` (and `/api/bullets` once `step-8.3` is merged) | a new route is a new data flow; the test is meant to fail until list and privacy page change together |
| same file, I2 (`:128`) | `postJson(` is called only by CvBox.tsx and page.tsx, one line each | the file that holds the check click gains one call line (count in page.tsx 1 → 2 if the handler is there) | the check is sent with the same helper |
| same file, I4 (`:168`) | console is used in exactly 6 places | 7 (the new route's "check: unexpected error in route") | one more fixed log line; `errors.ts` lines unchanged |
| same file, I7, I8 (`:207`, `:216`) | outside `app/api` only the access constants are imported from `lib/ai`; the CV route has no cache | unchanged text; a NEW sibling test says the check route has no cache and the page imports nothing from `lib/ai` for it | additions |
| `tests/privacyMessages.test.ts` M3, M6 | the exact approved strings of today | the changed strings (C3B, C4, C6) and the new ones | wording changes with the owner's approval, pinned in the same commit |
| `tests/noStoreHeader.test.ts`, `tests/logHygiene.test.ts`, `tests/accessGuards.test.ts:38` | cover `/api/read` and `/api/cv` | gain cases for `/api/check` (the access test finds the new route by itself) | additions |

Tests that deliberately do NOT change under C (so they are proof that nothing moved): `tests/fitLevelReport.test.ts` ("could not judge" lines such as `:124-125`, `:172-173`, `:177`), `tests/profileReport.test.ts:133-141` (R10), `tests/skillsOnly.test.ts:96` (S8), `tests/roadmap.test.ts:32-39`, `tests/profileBuild.test.ts:69`, `tests/saved.test.ts` S2d, `tests/fromCv.test.ts:106` (C14), `tests/judgeable.test.ts`, `tests/engineView.test.ts`, the demo tests. Reason: with no answers the new code returns exactly today's output (test EV1).

---

## 8. Tests first (for the later build)

Every stage below starts by writing its tests, with expected values worked out by hand from this plan (never from the code's output). If a test then fails, the owner is told whether the code or the hand count was wrong; an expectation is never changed to fit the code. After the code is green, each "break" is applied on purpose and must make the named tests fail, then undone.

| Tests (new files) | What they pin |
|---|---|
| `tests/evidenceProof.test.ts` EP1 to EP12 | The proof of 4.3: met with a real entry and quote; entry number not sent; quote on ANOTHER entry's line; quote with no real word; `none` with leftover entry; `partly` verified; requirement number not sent; answered twice; skipped; quote copied from the AD instead of the CV; case and accent differences; a German quote on a German line. |
| `tests/evidenceView.test.ts` EV1 to EV12 | **EV1: no answers gives exactly the same as `engineView` for the existing fixtures.** Met counts met with the entry's own citation; partly and none count missing; unanswered stays "could not judge"; the worked example of 4.4 (Good → Stretch, and the two variants); a requirement with one listed and one unlisted alternative is not touched; "No level" reasons keep their order; the engine files do not import the new code (source guard). |
| `tests/evidenceLabels.test.ts` EL1 to EL8 | Label R5 character by character, with 0, 1 and 2 AI-judged and with leftover unjudged; sentence; the AI block's rows; the "thrown-away answers" line. |
| `tests/profileUnlisted.test.ts` PU1 to PU8 | A ticked unlisted CV skill lands in `unlistedKept` with line and text AND still in `unmatchable`; unticked, hand-added and in-progress do not; two unlisted with one id once; the same-name match of 4.2 (cites the entry's line; not for a different spelling); the 60-cap message names the left-out skills. |
| `tests/savedUnlisted.test.ts` SU1 to SU8 | Round trip keeps `unlistedKept`; an old record without it opens; the schema accepts both; `sparseCvLines` includes the unlisted lines; a skill listed later is re-resolved on load; the profile key changes when an unlisted entry is kept (extends the K tests); delete-everything removes it and clears the answers on screen. |
| `tests/checkSchema.test.ts`, `tests/checkPromptHygiene.test.ts` | Strict-mode shape (all fields required, `nullable`); the prompt's made-up example shares no word of 5 letters or more with the fixtures (as `tests/promptHygiene.test.ts`, bullets on `step-8.3`). |
| `tests/checkRoute.test.ts` CR1 to CR10, extending the log, no-store and access tests | Same order as `/api/cv`: kill switch, access code, body, schema, AI call, proof; no-store on every answer; 400 messages; 503 when paused; 429 gives the busy message and one fixed log line; no text in any log; no `detail` in production. |
| `tests/checkRequestHashPin.test.ts` | The new pin and "differs from the other four" (after prompt approval). |
| `tests/checkPage.test.ts` (source guards) | The check is sent only from a click, through `sendIfAcknowledged`, never from an effect, never under `app/demo` or `lib/demo`; the info line and the privacy link are rendered. |
| `tests/evalCheckGuard.test.ts` ... (as `evalBulletsGuard.test.ts` on `step-8.3`) | The eval script refuses to run without the guard variables; fake dependencies only. |

**Breaks** (deliberate mutations; each must turn the named tests red):
- B1 the proof accepts an entry number that was not sent → EP2.
- B2 the proof checks the quote against ANY line, not the cited entry's → EP3, EP12.
- B3 `partly` counts as met → EV (worked example), EL.
- B4 `none` is left as "could not judge" → EV.
- B5 an unanswered requirement counts as missing → EV, EP7.
- B6 the view adds a `have` skill with no evidence, or invents a line → EV, plus the engine's own `match.test.ts`.
- B7 the label forgets the AI note → EL.
- B8 `unlistedKept` is dropped when saving → SU. B9 `sparseCvLines` ignores unlisted lines → SU.
- B10 the 61st skill is dropped with no message → PU.
- B11 the route skips `checkAccess` → CR, `accessGuards`. B12 the route ignores `AI_ENABLED` → CR. B13 the route logs the body → CR, `logHygiene`.
- B14 the button sends without the tick → `checkPage`. B15 the check is sent from an effect → `checkPage`, I11.
- B16 the prompt's example copies a fixture word → `checkPromptHygiene`.
- B17 the engine imports the new code → EV source guard.
- B18 delete-everything forgets to clear the answers on screen → SU.

---

## 9. Accuracy test

About 10 invented CV and ad pairs, all made up (so they may be committed, rule 8: `fixtures/every-cv/`; no real person, no real ad, no real CV text anywhere):

| # | Field / case | Purpose |
|---|---|---|
| 1 | Nursing | clear unlisted field, plain English |
| 2 | Law | long sentences, few tools |
| 3 | Mechanical engineering | mix of listed (CAD, Excel) and unlisted |
| 4 | Teaching | skills described as activities, not tools |
| 5 | Construction | trades, German-English mix of words |
| 6 | German-language CV, English ad | cross-language, one direction |
| 7 | Career changer | old job and new target; evidence on old lines |
| 8 | Academic CV near the 12,000-character cap | the cap and the 60-skill message |
| 9 | Very short CV | little evidence; most answers should be "no evidence" |
| 10 | Control in a field the list covers, English CV and **German ad** | list matching should do the work; the other direction |

**The owner writes the expected answer for every requirement BEFORE any run**, in a key file per pair (met / partly / none, and which CV line shows it): so expectations cannot be fitted to the output. (I write the invented CVs and ads; I do not write the key. A "key check" test, like `tests/cvKey.test.ts`, only checks that the key's lines and quotes really exist.)

**What to measure** (per requirement, then per pair):
- **False "met"**: the system says met, the key says partly or none. **The error to watch most**, reported with the quote it used.
- Wrong-line "met": the key says met but the quote is on a line that does not really show it (by eye, like the M2 reading in PLAN-8.3).
- False "none": the key says met, the system says none or "could not judge" (safe direction, but loses the point).
- "Partly" mismatches.
- Answers thrown away by the proof (and why); answers skipped; calls that failed.
- Level of each pair: the system's against the level the key gives; **how many are stronger than the key's** (must be 0).
- Share of requirements that have an answer (met / partly / none) instead of "could not judge", before (Stage 0) and after.
- Cross-language pairs (6, 10) reported separately.
- Tokens per call and any 429.

**Proposed pass bar (owner decides):**
1. False "met": **0** on all ten pairs. (With about 40 AI "met" answers, zero errors still allows a true error rate of up to about 7 %, "rule of three": 3 divided by 40. The report says so.)
2. Levels stronger than the key's level: 0 of 10; levels equal to the key's: at least 8 of 10.
3. At least 90 % of requirements have an answer; every other row says why.
4. Of the requirements the key says "met", at least 80 % found.
5. No pair's call fails on a 429 in the counted run; no single call over 7,000 tokens.
6. Throw-away rate of the proof (quote not on the line) at most 10 % of answers.

---

## 10. Stages

Small, each tests-first, each its own commit, careful lane (anything the AI reads or writes). The owner gives a step number to each; here they are EC-0 to EC-7.

- **EC-0a. Material and keys, no code and no AI.** The ten invented pairs (I write them) and one key sheet per pair for the owner to fill in. Test: the key's lines and quotes exist.
- **EC-0b. Baseline script, built with fake dependencies, no AI.** Reuses `scripts/evalCv.ts` and its guard (`EXPECT_REQUEST_HASH`, `EXPECT_INSTRUCTIONS_LEN`, `lib/engine/evalCvGuard.ts:12-34`), the pacing (`lib/engine/evalCvRun.ts:48`), the fingerprint (`lib/engine/evalFingerprint.ts:19-54`); outputs to `eval-runs/` (git-ignored).
- **EC-0. BASELINE RUN of today's product on the ten pairs. NEEDS THE OWNER'S GO (real AI calls).** Reads each CV and each ad exactly as the live page does, builds the profile as the page does (named skills ticked), builds the report, and compares with the key: how many requirements are "could not judge" today, how many wrong. About 20 calls (10 CV reads, 10 ad reads); by my estimate about 100,000 tokens, which the 8,000-a-minute pacing spreads over roughly 15 minutes. It shows the real size of the problem and whether C is worth building.
- **EC-1. Pure code, no AI:** the proof, the view with answers, the labels (sections 4.3 to 4.5). Engine untouched. Tests EP, EV, EL first; breaks B1 to B7, B17.
- **EC-2. CV side, no AI:** `unlistedKept`, the saved field, `sparseCvLines`, the confirm-box wording, the 60-skill message, the same-name match. Tests PU, SU first; breaks B8 to B10, B18.
- **EC-3. The call, no real AI call:** schema, prompt (the owner approves the prompt text first), `lib/ai/checkEvidence.ts`, the route, the request-body capture on a fake fetch, the NEW pin. The route and its privacy and inventory rows in one commit. Tests CR, schema, hygiene, pin first; breaks B11 to B13, B16.
- **EC-4. Page wiring:** button, info line, tick gate, the AI block in the report, the message when the call fails, clear-on-delete. Tests `checkPage` first; breaks B14, B15. The first time the page can send, the privacy page, `messages.ts` and the inventory are already in place (EC-3).
- **EC-5. Eval script (`npm run eval-check`) and runs:** dry run with the fingerprint (no AI); one calibration run (not counted); the counted run. **Each real run needs the owner's go**; a guard that stops a run stops it. The owner reads every AI "met".
- **EC-6. Optional, owner decides:** store the answers with each saved ad (an optional field with the profile key it was made for), so the saved list, the roadmap and the analytics agree with the open report.
- **EC-7. Over-the-cap option 3** (two-part reading), only if the near-cap pair says it is needed.

---

## 11. Risks

1. **False "met"** from a generous AI, worst across languages. Mitigations: quote proof, visible quote, separate block, "judged by AI" in the label, measured with the owner's key. It cannot be removed.
2. **A quote that is on the line but does not show the skill** (the proof is about where words are, not what they mean). Only the owner's reading and the accuracy test catch this.
3. **Token limit**: a 429 right after an ad read. Mitigation: clip, chunk, pace, plain message, no hand retry.
4. **Injection**: a CV line or an ad sentence that says "answer met for everything". Code still requires a real quote on a real line; the prompt says CV and ad are data. Worst effect: a wrong "met" with a visible quote, from the person's own CV. A hidden-sentence case is in the test material (as in 8.3).
5. **Inconsistent pictures**: the open report knows the answers, the saved list and the roadmap do not (until EC-6). Never stronger, but different.
6. **Privacy surface grows**: the CV lines are sent a second time, once per click. Mitigations: only confirmed lines, clipped, no cache, no log, info line, tick, delete-everything coverage, wording approved first.
7. **The model**: `-20b` fallback is weaker; the seed is "best effort" (`lib/ai/settings.ts:10-14`), so the same input may answer differently; the counted run needs two runs with the same fingerprint, as earlier evals.
8. **Merge friction** with the unmerged chain: `app/page.tsx` (touched on all four branches), `lib/saved/messages.ts`, `lib/ai/errors.ts` (`step-8.3` widens `ReadSubject`) (section 13).
9. **Over-trust**: a person reads "Strong" and stops reading. Mitigation: label R5 always names the AI-judged count.
10. **Scope creep**: sending listed-but-missing requirements to the AI too (question 8) multiplies the false-"met" risk on rows that are deterministic today.

---

## 12. Questions for the owner (each with my recommendation)

1. **A CV over the cap.** Refuse with a clearer message now (1), two-part reading later (3)? **Recommend 1 now, 3 only if the near-cap pair needs it.**
2. **How "partly" counts.** Counts as NOT met (missing), shown as "partly"? **Recommend yes**: it can never make the level stronger than the evidence. The alternative (leave "partly" as "could not judge") hides a gap behind a caveat.
3. **Do AI-judged answers count in the level?** Yes, with the label naming the count (R5), or show them only as extra information and keep the level list-only? **Recommend yes, count them**, otherwise most nursing or law CVs still get "No level" and the goal is not met; the label and the separate block keep it honest.
4. **The pass bar** of section 9. **Owner decides**; my proposal is on the page (false "met" 0, no level stronger than the key, 90 % answered, 80 % found).
5. **A new tick, or an info line?** **Recommend an info line plus the existing tick gate**, no second tick (section 6). The cautious alternative is a second tick next to the check button.
6. **The go for Stage EC-0** (the baseline run: about 20 real AI calls, about 100,000 tokens, spread over roughly 15 minutes, on made-up material only). **Recommend yes, after you have written the key sheets (EC-0a).** Not before: it costs free-tier tokens and the keys must exist first.
7. **Same-name match by code** (4.2, step 2): an unlisted requirement and an unlisted CV entry with the very same words match without the AI. **Recommend yes**; it is deterministic and cites the line.
8. **What is sent to the check:** only requirements the list cannot judge (every id unlisted), or also listed requirements the person is missing (a CV line "PostgreSQL" against a listed "SQL")? **Recommend only the unlisted ones first**; the second kind turns deterministic "missing" rows into AI answers and can be decided later with the baseline numbers in hand.
9. **Wording approval after changes:** when the new and changed privacy lines exist, approve the whole page again, or only the new and changed lines? **Recommend the whole page once**, since `WORDING_APPROVED_ON` is a single date.
10. **Stored answers (EC-6):** yes or later? **Recommend later**, after the accuracy test, so the first release stores nothing new except the unlisted skills the person confirmed.

---

## 13. Order: build after 9.3 is merged, and why

1. The privacy page, `facts.ts`, `messages.ts`, the inventory tests, the consent tick and delete-everything exist only on `step-9.3` (17 commits ahead of main). A new data flow must update them in the same commit, so this work must stand on them.
2. `step-9.3` is main plus 17 commits. The unmerged chain `step-7.3 → 8.1 → 8.2 → 8.3` (12, 23, 36, 84 commits ahead of main; each is contained in the next) was tried against `step-9.3` with `git merge-tree --write-tree` (read-only: nothing was merged, no branch or file changed): **all four merge with no textual conflict**. The files both sides changed, and my plan would touch as well, are `app/page.tsx` (all four), `lib/saved/messages.ts` (all four) and `lib/ai/errors.ts` (`step-8.3` only).
3. **A clean text merge is not a clean test run.** `step-8.3` adds a third AI route, `/api/bullets`. After it joins `step-9.3`, `tests/privacyInventory.test.ts` I1 ("exactly `/api/cv` and `/api/read`") is built to fail until the privacy page and inventory list it. I did not run that merge; I expect the failure from the test's own header (`:3-4` and `:19`). So the privacy sweep for `/api/bullets` is a task that belongs to the chain's merge, and the check route should be added after it so each commit changes the inventory by one route.
4. `engineView` is shared by the report, the roadmap and `app/bullets.ts` and, through `profileReport`, by the analytics on the chain. Building after the chain is merged (or at least after the owner has decided on it) means one consistent change instead of two.
5. **What can start earlier:** EC-0a and EC-0b only add files under `fixtures/`, `docs/` and `scripts/` and touch no shared file. EC-0 (the real baseline) can run on any branch that has today's reading code. The owner's key sheets can be written now.

**Recommended order:** merge 9.3 → decide the chain (7.3 to 8.3) and do its privacy sweep → EC-0a, EC-0b, EC-0 (go) → EC-1 … EC-5.

---

## Appendix: the code reading behind this plan (Step 2, points a to g)

**a) How `match()` and the level rules take a profile; where an answer can enter without changing the engine.**
`match(profile, job)` (`lib/engine/match.ts:275`) calls `checkRequirement` for each requirement (`:61-109`): a requirement is met if any of its skill ids equals the id of a profile skill with `kind: "have"`, a non-null `evidence`, and `profile.cvLines[line - 1] === evidence.text` (`:57-59`, `:65-82`). Otherwise it is missing, with a reason (`in-progress`, `no-cv-line`, `not-on-profile`, `:84-108`); `fitLevel` (`lib/engine/fit.ts`) counts only `missingMusts` and conflicts. So an extra per-ad `have` entry for an unlisted id WORKS in the engine as it is. What blocks it today is not the engine but the step before it: `splitJudgeable` (`lib/engine/judgeable.ts:16-21`) removes every requirement whose ids are all unlisted before `match()` sees it, called from `engineView` (`lib/cv/engineView.ts:20`) and `skillsOnly` (`app/skillsOnly.ts:184`). `profileReport` then labels the removed ones "could not judge" (`app/fitReport.ts:107-109`), and `noLevelReason` counts them only as `unjudgedMusts` (`:163-170`). So the entry point is one new function beside `engineView` that rewrites the ids of answered requirements and adds the matching `have` skills (4.4). `match.ts`, `fit.ts`, `unlock.ts` and `judgeable.ts` stay unchanged.

**b) Tests that pin the words or behaviour that would change.**
Under C these do NOT change (the new code returns today's output when there are no answers): `tests/fitLevelReport.test.ts` ("could not judge" and label lines at `:61`, `:124-125`, `:156-157`, `:166-167`, `:172-173`, `:177`, `:184-185`, `:196`, `:201-210`, `:232`, D4 `:385-387`, `:398`, `:458`; the "(skills only; N must-haves not judged)" label is pinned at `:124`, `:156`, `:166`, `:201`, `:209`); `tests/profileReport.test.ts` R10 (`:133-141`); `tests/skillsOnly.test.ts` S8 (`:96-115`); `tests/roadmap.test.ts` (`:32-39`, `:54`, `:154`, `:265-286`) and `tests/roadmapIds.test.ts` (`:37`, `:102`); `tests/judgeable.test.ts`; `tests/engineView.test.ts`; `tests/gaps.test.ts`; `tests/demoData.test.ts`. The "No level can be shown" lines are in `tests/fitLevelReport.test.ts:173`, `:185`, `:398`, `tests/profileReport.test.ts:141`, `tests/skillsOnly.test.ts:112`. The confirm-box tag has no test (no test mentions "matched with"). The saved-profile shape: `tests/saved.test.ts` S2d (`:178-181`), `tests/savedRoundTrip.test.ts` (`:159`, `:174-175`), `tests/savedUi.test.ts` K1 to K5 (`:120-141`), `tests/privacyInventory.test.ts` S1b (`:239`). Tests that change: the table in section 7.

**c) The saved profile.**
`SavedProfile` is `{ schemaVersion, savedAt, skills, constraints, set, stamps }` (`lib/saved/types.ts:20-27`); `skills` is a strict list of `have` and `inProgress` (`lib/saved/schemas.ts:64-72`), so unlisted entries must go in a NEW optional field, not in `skills`. Added optional fields need no version bump (`lib/saved/migrate.ts:3-6`; the top-level schema is a loose object, `schemas.ts:74-87`). The stamps are written (`lib/saved/profile.ts:27-40`) but never compared when a profile is loaded (`lib/saved/saved.ts:39-60`), so a vocabulary change does not block an old profile; `builtFromSaved` only drops ids that the vocabulary no longer knows (`lib/saved/profile.ts:50-52`). The CV lines are rebuilt from cited evidence (`:16-24`), which must include the unlisted entries.

**d) The AI route pattern.**
Smallest way: a NEW route `app/api/check/route.ts` copying `/api/cv` (`app/api/cv/route.ts:13-50`), with its own schema, prompt and function, as `step-8.3` did for bullets (`app/api/bullets/route.ts`, `lib/ai/writeBullets.ts`, `lib/ai/bulletsRequestHash.ts`; decision D10 in its plan). Reusing `/api/read` or `/api/cv` is not possible without moving a pin: both are pinned, and `/api/read` has a cache keyed by the ad text. Guards that apply: kill switch `aiPaused()` first (`lib/ai/enabled.ts:5-7`); `checkAccess` second (`lib/ai/accessCode.ts:39-50`; the test `tests/accessGuards.test.ts:38` fails if any route lacks it); then body, schema, call, proof. Errors go through `toReadError` (`lib/ai/errors.ts:26-91`: the console lines are fixed, never the text; a new subject word is added). `jsonNoStore` on every answer (`tests/noStoreHeader.test.ts`). Log hygiene (`tests/logHygiene.test.ts` L1 to L5) and the inventory (`tests/privacyInventory.test.ts` I1, I2, I4, I7, I8) need new cases. There is **no rate limit in our code** (the read route says so in its decision record); the only rate rule is the Vercel Firewall rule on `/api/` (fact U9). The code-side rule for retries is the SDK's two retries (C15).

**e) Token estimate.** Section 5.

**f) How the eval runs work today.**
`npm run eval` and `npm run eval-cv` (`package.json:12-13`) are small scripts (`scripts/eval.ts`, `scripts/evalCv.ts`) over library code that is tested without any AI. A real run refuses unless `EXPECT_REQUEST_HASH` and `EXPECT_INSTRUCTIONS_LEN` are set and equal what would be sent (`lib/engine/evalCvGuard.ts:12-34`; the request is captured on a fake fetch, `lib/ai/cvRequestBody.ts:9-39`); `--fingerprint` prints them and stops. The run is paced against the token limit (`lib/engine/evalCvRun.ts:48` `waitForTokens`, `:114` `runCvEval`), scored against a hand-made key (`lib/engine/cvKey.ts`, `evalCvScore.ts`, the fixtures in `fixtures/synthetic-cvs/`), and printed in at most 15 lines; full output goes to `eval-runs/`, which is git-ignored. A "counted" result needs two runs with the same fingerprint (`lib/engine/evalRun.ts:138` `twoInARow`); the first run is a calibration run. `step-8.3` repeats the pattern for bullets (`scripts/evalBullets.ts`, `evalBulletsMain.ts`). The accuracy test reuses all of it: a new script with the same guard, fingerprint and pacing, made-up fixtures and the owner's key.

**g) Files the new work would touch, and the dry-run.**
New: `lib/schemas/check.ts`, `lib/ai/checkEvidence.ts`, `lib/ai/checkRequestHash.ts` and a request-body capture, `app/api/check/route.ts`, the proof and the view with answers (new files next to `lib/cv/engineView.ts`), `fixtures/every-cv/`, `scripts/evalCheck.ts`, the test files of section 8. Changed (small): `lib/cv/profile.ts`, `lib/engine/fromCv.ts` (only if the cap rule changes), `lib/saved/profile.ts`, `types.ts`, `schemas.ts`, `app/ConfirmBox.tsx`, `app/CvBox.tsx`, `app/fitReport.ts`, `app/ReportView.tsx`, `app/page.tsx`, `lib/ai/errors.ts`, `lib/privacy/messages.ts`, `app/privacy/page.tsx`, `app/deleteAll.ts` or `SavedControls.tsx`, the tests of section 7. Dry run, read-only: `git merge-tree --write-tree step-9.3 step-7.3`, `… step-8.1`, `… step-8.2`, `… step-8.3`: exit code 0 for all four (no conflict). Overlap of my planned files with each branch: 7.3: `lib/saved/messages.ts`; 8.1 and 8.2: `app/page.tsx`, `lib/saved/messages.ts`; 8.3: `app/page.tsx`, `lib/ai/errors.ts`, `lib/saved/messages.ts`.
