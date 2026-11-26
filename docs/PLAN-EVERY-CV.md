## WHERE WE STOPPED (2026-11-26)

- **Built and pushed (branch step-every-cv):** EC-0 tooling and the ten answer keys (5099bad), EC-1 to EC-4b (the check on the page), EC-5a f80a69a (check eval, pure parts), EC-5b 3dfc1be (check eval script, modes, docs).
- **NOT done:** the baseline run, the calibration run and the two counted runs. No real AI call has been made for the every-CV work. Every number so far comes from invented data and fake models.
- **Day plan (four separate days, each needs the owner's explicit go in its own prompt):** A baseline (about 90,000 tokens) | B calibration check run (about 65,000, not counted) | C counted run 1 | D counted run 2, same fingerprint.
- **First step of any real run: the --fingerprint mode** (no network). `npm run every-cv:baseline -- --fingerprint` and `npm run eval-check -- --fingerprint` print the values the guard variables must hold.
- **Baseline:** `npm run every-cv:baseline` needs EXPECT_REQUEST_HASH, EXPECT_INSTRUCTIONS_LEN, EXPECT_AD_REQUEST_HASH, EXPECT_AD_INSTRUCTIONS_LEN and EVERY_CV_GO=yes (values from --fingerprint; the go is the owner's).
- **Check eval:** `npm run eval-check` (add `-- --calibration` for the not-counted run) needs EXPECT_CHECK_REQUEST_HASH, EXPECT_CHECK_INSTRUCTIONS_LEN and EVERY_CV_GO=yes, ten complete keys committed, and a baseline run that matches today's fingerprint. Never an access code in any file.
- **The owner still owes:** the 9.3 manual check on a different day than the baseline; the stage 2.7 homework; the approval of the DRAFT wording list (end of this file); an explicit go before each real run.
- **D-R1:** no code change after EC-5; for the invented pairs X, Y, Z the bar fails on numbers 1, 2, 3, 4, 6 and 7.
- **D-R2:** the finding in `app/fitReport.ts` (a profile with only unlisted skills shows "No level (no skills on your profile)" even after the check answers) is NOT changed now; after the baseline, look at which of the ten pairs show it, then the reviewer and the owner decide.
- **D-R3:** the new test files are named `checkEval*.test.ts`, not `everyCv*`, because guard D3 in `everyCvBaseline.test.ts` keeps every `everyCv*.test.ts` away from `lib/ai`.
- **D-R4:** every real run needs the owner's explicit go in its own prompt; four separate days; a stopped real call is never retried by hand.

# PLAN: Career Co-pilot works on every CV

Status: PLAN ONLY. No code, no test change, no AI call, no network was used to write it. Written on branch `step-every-cv`, cut from the tip of `step-9.3` (b3c6a21). Every wording in it that a user will read is a DRAFT until the owner approves it.

Amended on 2026-11-25 (AM1 to AM8, listed in the Amendments log at the end) after the owner answered all twelve questions of section 12 (see the Decision log there). Where an amendment changed an earlier sentence, the sentence was edited in place.

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

Section 2 is a reading of the code on this branch; EC-0 measures the real size.

1. **The CV side already finds unlisted skills.** The CV prompt asks for any "skills, tools, methods and kinds of work" and its own example is "Welding" (`lib/ai/readCv.ts:16-34`). `fromCv` keeps an unlisted skill with its line and quote and marks it `listed: false` (`lib/engine/fromCv.ts:109-117`, list of them at `:120-126`).
2. **Then the profile throws it away.** When the person ticks an unlisted CV skill, `buildProfile` does not put it on the profile. It pushes only `{ name, where: "cv" }` into `unmatchable`, with no line and no quote (`lib/cv/profile.ts:103-106`). The confirm box says "not in our skill list yet, so it can't be matched with an ad" (`app/ConfirmBox.tsx:33`) and, lower down, "…can't be matched with your CV" (`app/ConfirmBox.tsx:213`; two different sentences for the same thing).
3. **The ad side keeps every requirement but cannot judge the unlisted ones.** `splitJudgeable` takes out every requirement whose skill ids are ALL unlisted (`lib/engine/judgeable.ts:8-21`) BEFORE the engine runs (`lib/cv/engineView.ts:20`). They come back as "could not judge": out of the level and the counts, one row each ("…not in our skill list yet, so we could not judge it", `app/fitReport.ts:107-109`), a tail in the sentence ("plus N must-haves we could not judge", `app/skillsOnly.ts:129-136`) and a label caveat ("(skills only; N must-haves not judged)", `app/skillsOnly.ts:159-171`).
4. **Result for a CV in a field the list does not cover** (nursing, law, construction): most must-haves of the ad are unlisted, so the level reads "No level (no must-have we could judge)" (`app/skillsOnly.ts:150-154`, `lib/engine/judgeable.ts:33-40`). The product does not lie, but it says nothing useful. That is the gap this plan closes.
5. **The 60-skill cap is not silent today, but it is badly worded.** The 61st valid skill is removed as `too-many` (`lib/engine/fromCv.ts:104-107`, test C14 at `tests/fromCv.test.ts:106`) and shown in the list "N items removed because a check failed … there were too many skills" (`app/CvBox.tsx:28`, `:220-233`). Nothing "failed"; the wording is wrong and the list can be long. The cap counts listed and unlisted skills together.
6. **Limits** are in `lib/cv/limits.ts:6-9`: 12,000 characters, 400 lines, 1,000 characters a line, 20 pages, 5 MB. A CV over them is refused with a message (`app/CvBox.tsx:51-54`, `lib/cv/fileToText.ts:45-48`).

**A worked example (invented data, from an earlier read-only run of the real functions; the strings agree with `app/skillsOnly.ts:129-136` and `:159-171` and with `tests/fitLevelReport.test.ts:156-157` and `:232`).** An ad has 6 must-haves. 4 are on our skill list and the person has them (met). 2 are not on our list ("Quorbix", "Zentrafold"). Today the page shows:
- the label: "Strong (skills only; 2 must-haves not judged)";
- the explanation: "You meet all 4 must-haves on your profile, plus 2 must-haves we could not judge";
- the amber note: "2 requirements are not in our skill list yet, so we could not judge them. They are not counted in the level or in the counts below."

Two of six must-haves are unknown, yet the label says "Strong". That is the gap this plan closes, and the reason for rule R7 in 4.4.

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

- `buildProfile` keeps a ticked unlisted CV skill in a NEW list `unlistedKept: { name, skillId, evidence: { line, text }, inferred }[]` on `BuiltProfile` (type at `lib/cv/profile.ts:42-51`; the push site is `:103-106`). The old `unmatchable` list is left exactly as it is, so the pinned test `tests/profileBuild.test.ts:69` (`unmatchable` equals `[{ name: "Frontend development", where: "cv" }]`) does not change. The new field is optional in the type so literals in other tests (for example `tests/savedRoundTrip.test.ts:159`) still compile.
- **Inferred skills go in too (AM5).** The confirm box has two groups: skills whose name is written in the CV line ("named", pre-ticked) and skills the AI read from the wording of the line ("inferred", not ticked; `app/ConfirmBox.tsx:71-72`, set at `lib/engine/fromCv.ts:115`). If the person ticks an unlisted skill from the inferred group, it goes into `unlistedKept` like any other, because it has a line and the person confirmed it, with `inferred: true`. An unticked one never goes in. The flag is saved with the entry (an optional field; absent means "not inferred"). It is shown next to the row in the report's AI block (4.5) ("inferred from your wording, confirmed by you"); it is NOT sent in the check's input (AM10). One limit, stated openly: for LISTED ticked skills the profile does not keep the flag today (`lib/cv/profile.ts:109` builds the skill without it), so a listed entry sent to the check carries no label; this plan does not change that.
- Skills added by hand (no CV line) and skills "in progress" stay out, as today (`lib/cv/profile.ts:129-130`, `:153-154`): they have no line to cite, so the check never sees them. Test K5 (`tests/savedUi.test.ts:137`) stays true.
- **Confirm-box wording (DRAFT).** The tag at `ConfirmBox.tsx:33` today says "not in our skill list yet, so it can't be matched with an ad". After this work that is false, so it becomes: "not in our skill list yet; it is checked against an ad by the AI, with your CV line as proof". The second place (`ConfirmBox.tsx:213`, "can't be matched with your CV") is the "with an ad" fix's twin: for `where: "cv"` it is replaced with "kept with CV line n (checked against an ad by the AI)"; for hand-added and in-progress names the old sentence stays. After the fix the two places say the same thing in the same words. No test pins either string today (searched `tests/` for "matched with"); the new wording gets its own test.
- **The 60-skill cap shows a message.** Keep 60 (raising it grows the CV call's answer and the check call's input, see section 5). Replace the "removed because a check failed" treatment for `too-many` with its own line: "Your CV showed N more skills than the 60 we keep. These were left out: …names…. Pick the ones that matter by unticking others and sending again, or shorten the CV." The cap still keeps the first 60 in the AI's order (today's rule; test C14 unchanged). A smarter rule ("named before inferred") is a code decision in `fromCv` and is offered as a question, not built.
- The profile can now hold up to 60 entries with a line each. Those lines go to the AI again in the check (section 6).

### 4.2 Ad side: every requirement is kept; list match first

Order of work for each requirement of an ad, all in the browser except step 3:
1. **List match** (today): a requirement whose ids include a listed skill is judged by the engine. Unchanged.
2. **Same-name match by code (new, no AI, no click).** If every id of the requirement is unlisted and the person has a kept unlisted entry with the SAME id (the same words, slugged the same way: `new:wound-care` on both sides; DECISIONS 2026-11-14 gives the same id to the same words in an ad and a CV), the requirement is met by that entry, citing its line. It is as safe as listed matching: same words, one line, decided by code. **Where it lives:** inside `engineView` (`lib/cv/engineView.ts`), as a step before `splitJudgeable`, so that the report, the roadmap, the gap list and, on the chain, bullets and analytics all see the same thing and cannot disagree (the point of step 7.1a). It needs the id rewrite of 4.4: `splitJudgeable` removes every requirement whose ids are all `new:` ids before the engine runs (`lib/engine/judgeable.ts:13`), so without the rewrite the match would never be seen. The pasted-list page keeps its own rule (test S8, `tests/skillsOnly.test.ts:96`), because that page has no CV lines.
3. **AI check** (new, only on a click) for what is still "could not judge". Decided (question 8): only requirements where every id is unlisted, musts and nice-to-haves, and not the ones step 2 has already met.

Requirements the ad reader flagged as "not a skill a CV can show" (traits, `notCounted`) and the "check this yourself" conditions keep their current treatment: they are listed, not counted, not sent. Nothing is dropped; they were never counted.

### 4.3 The check call

Owner approved the check prompt text on 2026-11-25 (2,665 characters, zero word overlaps).

**Input** (all numbered, built by code):
- Requirements: `R1 "<the ad's own words>"` … (no importance tag: the code knows must or nice by position, and priority must not change the verdict; the quote that is already on every requirement, `lib/engine/types.ts:54-62`; clipped at 300 characters; at most 30 per call, see section 5).
- Entries: `E1 | Wound care | "<the CV line, word for word, clipped at 240 characters>"` … one for every confirmed entry that has a CV line, listed and unlisted skills alike (a listed "SQL" line can show an unlisted "data-driven decisions" requirement). At most 60. No inferred note is sent (AM10): the note still shows in the report's AI block.
- Not sent: the access code (header only), the person's cities, languages, years, dates, the unticked skills, the whole CV, the whole ad.

**Contact details are refused again (AM4).** The check route applies the same refusal as `/api/cv` to every CV line it receives: the same `containsContactDetails` function (`lib/cv/redact.ts:63`), the same formats and the same plain message, "Remove email addresses, phone numbers and links before sending." (`lib/schemas/cv.ts:34`). So a line saved under older cleaning rules cannot go out unchanged. The test is made on the text as it is sent (after clipping). The page makes the same test first: an entry whose line fails is left out of the call and the screen names it ("The line for … still holds an email address, phone number or link. Remove it from your CV text and read your CV again."). The ad's requirement sentences are not cleaned, as the ad itself is not (section 6).

**Output** (strict mode: every field required, `nullable` not `optional`, per CLAUDE.md): a list with one item per requirement: `{ requirement: number, verdict: "met" | "partly" | "none", entry: number | null, quote: string | null }`.

**Code-side proof** (a pure function, no AI; it mirrors what `fromCv` does for a CV skill, `lib/engine/fromCv.ts:86-99`). An answer counts only if ALL of these hold:
1. the requirement number is one we sent, and it was answered exactly once (twice or never = unanswered, row stays "could not judge");
2. for `met` and `partly`: the entry number is one we sent (an entry with a CV line);
3. the quote has at least one real word (`hasRealWord`, `lib/engine/quoteMatch.ts:18`);
4. the quote is really inside THAT entry's line, with case, accents and ß ignored (`foldText`, `lib/engine/text.ts:19`; the proof is in `lib/engine/evidenceProof.ts`). `isInAd` (`lib/engine/text.ts:27`) alone ignores case and spacing but NOT accents, and `fromCv` uses `isInAd` for a CV skill (`lib/engine/fromCv.ts:96`), so this proof is looser on accents than `fromCv`'s: an AI that writes "Kuhlkette" for a line that says "Kühlkette" is accepted here. The quote is still shown with its CV line. A quote that is only on another entry's line is not rescued, as in `fromCv`.

If 2, 3 or 4 fails, the AI's answer is thrown away and the row reads **"no evidence found"** (as the owner asked), and the screen counts how many answers were thrown away. A `none` answer needs no entry and no quote. A requirement the AI skipped is never turned into "none": silence is "could not judge".

### 4.4 How answers reach the level without changing the engine

The engine (`match.ts`, `fit.ts`, `unlock.ts`) is not touched. It already counts a requirement as met when the profile holds a `have` skill with the same id and a citation that really matches a CV line (`lib/engine/match.ts:57-59`, `:65-82`). So the translation happens BEFORE the engine, inside `engineView` itself (`lib/cv/engineView.ts`). That function gets an optional third argument, the verified answers of a click (none by default), and it also does the same-name match of 4.2 (no click needed). One function, so every user of `engineView` stays consistent. (The first version of this plan put the answers in a sibling function; AM3 moved everything into `engineView`, because the same-name rule must reach the roadmap and the gap list too.)

Both rules use the same **id rewrite**:
- **Met** (a verified AI answer, or a same-name match): the requirement's ids are replaced by one internal id that does not start with `new:` (for example `ev:3` for an answer, `kept:wound-care` for a same-name match), and the engine profile gets one extra `have` skill with that id and the entry's own evidence. The engine then counts a normal "met" with a citation. The evidence comes from a profile entry that already passed the CV-side checks; the AI never writes a line. Without the rewrite, `splitJudgeable` would set the requirement aside again.
- **Partly** and **no evidence found**: the ids are rewritten to an internal id with NO profile skill, so the engine counts a normal **missing** must-have.
- **Unanswered** (the AI skipped it, the call failed, the answer came twice, AI is paused): the requirement is left alone, so `splitJudgeable` sets it aside as "could not judge" exactly as today.
- **Internal ids never reach the screen (AM2).** `ev:n`, `kept:…` and the made-up `new:<slug>` ids are for the engine only. `engineView` returns, with the rewritten job, a map from each rewritten requirement back to the original one. Every place that writes text for a person (the rows, the counts sentence, the gap list, the "What to learn" box, analytics) uses the ORIGINAL requirement: its own words and its original skill name. Today the name lookup falls back to the raw id when a name is unknown (`app/fitReport.ts:95-97`, the same pattern at `app/skillsOnly.ts:189-193`), which is exactly how `ev:3` would leak, so this is a tested rule (EV13), not a hope. A "partly" or "none" requirement shows "Wound care: partly" or "Wound care: no evidence found", never "ev:3".

Why this is the right place: `engineView` is the one construction that the report, the roadmap and the gap list share (its own header comment, `lib/cv/engineView.ts:7-18`). On the unmerged chain it is also used by `app/roadmap.ts:114` and `app/bullets.ts:30`, and by analytics through `profileReport` (`app/analytics.ts:70`); a new optional argument leaves those calls as they are. **Test EV1, stated exactly:** with NO answers AND NO `unlistedKept` entries, what `engineView` returns (`engineJob`, `engineProfile`, `couldNotJudge`) is identical to what today's function returns, and the new map is empty. With `unlistedKept` entries but no same-name hit and no answers, it is also identical (EV1b). **The one case where a report changes without a click:** a person who kept an unlisted skill opens an ad that asks for the very same words; that row is met by code at once, with its CV line, and the counts and the level follow. Nothing else changes until a click, apart from the label wording of R7.

**Label and level rules (a level must never read stronger than the evidence):**
- R1. A verified met counts as met, shown with its quote.
- R2. **Partly counts as NOT met** (a missing must-have). It never raises the level. (Question 2, answered yes.)
- R3. No evidence found counts as missing, like a listed skill the person does not have.
- R4. **AI could not answer** (error, 429, `AI_ENABLED=false`, schema failure, skipped item): nothing changes. The rows stay "could not judge", out of the level, with the caveat in the label (and R7's "At best"), as today. The page shows a plain message ("The check could not run: …. Nothing changed. You can try again later."). It never retries by itself.
- R5. Whenever at least one must-have was judged by the AI, the label says so inside the brackets: "Stretch (skills only; 2 must-haves judged by AI)". When there were none, the label is today's, apart from R7. Any must-have still unanswered keeps its own caveat ("; 1 must-have not judged").
- R6. The order of the "No level" reasons is unchanged (`lib/engine/judgeable.ts:24-40`).
- R7 (owner's answer to question 12, AM6). **When at least one must-have is not judged, the level reads "At best <level>".** A must-have that is not judged can only lower the level, so the level shown is a ceiling, not a result. Example: "At best Strong (skills only; 2 must-haves not judged)". "No level" labels are unchanged (they are not a level). **Long shot keeps its plain name**, because it is the lowest level and nothing can lower it: "Long shot (judged: skills, location; 1 must-have not judged)" stays as it is today. (This last point is my reading of the owner's rule; see the report.) The sentence under the label and the amber note are unchanged.

**How R5 and R7 combine** (the label is built from the level, then the brackets; the brackets hold, in this order, the judged kinds, the AI count, the unjudged count):

| Judged by AI | Not judged | Level | Label |
|---|---|---|---|
| 0 | 0 | Strong | Strong (skills only) |
| 0 | 2 | Strong | At best Strong (skills only; 2 must-haves not judged) |
| 2 | 0 | Stretch | Stretch (skills only; 2 must-haves judged by AI) |
| 1 | 1 | Good | At best Good (skills only; 1 must-have judged by AI; 1 must-have not judged) |
| 2 | 1 | Long shot, set by location | Long shot (judged: skills, location; 2 must-haves judged by AI; 1 must-have not judged) |
| all must-haves unjudged | | No level | No level (no must-have we could judge), unchanged |

Worked example, by hand (invented ad; assume "SQL" and "Excel" are listed and "Wound care" and "Patient intake" are not; the person's CV line 4 says "Dressed and monitored wounds on a surgical ward"):

| Must-have | List match | AI check | Counts as |
|---|---|---|---|
| SQL | met (line 2) | – | met |
| Excel | not on profile | – | missing |
| Wound care | unlisted | met, entry E3, quote "Dressed and monitored wounds" (on line 4) | met |
| Patient intake | unlisted | partly, entry E5 | missing |

Today: only SQL and Excel are judged: 1 of 2 met, 1 gap, **Good (skills only; 2 must-haves not judged)**; under R7 the same case reads **At best Good (skills only; 2 must-haves not judged)**. With the check: 4 musts, 2 met, 2 missing, 2 gaps: **Stretch (skills only; 2 must-haves judged by AI)**. If "Patient intake" had been met: 3 of 4 met, **Good (skills only; 2 must-haves judged by AI)**. If the check had failed: unchanged from today, so "At best Good (skills only; 2 must-haves not judged)". These cases become test cases before any code.

### 4.5 The report

- Rows judged by list or by same-name match stay where they are, in the ad's order, with today's wording.
- A second block, **"Judged by the AI from your CV lines (read each quote)"**, holds the AI-judged rows, apart from the others. Each row: the requirement's words, the verdict (met / partly / no evidence found), and for met and partly the entry name, "CV line n" and the quote; for an entry the person ticked from the inferred group the row adds "inferred from your wording, confirmed by you" (AM5). Answers the proof threw away are counted in one line ("2 answers were not accepted because their quote was not on the CV line").
- The counts sentence says how many of the met must-haves were AI-judged ("You meet 3 of 4 must-haves (2 judged by AI)").
- **What changes without a click (AM3):** two things only. (1) The same-name match of 4.2: a person who kept an unlisted skill and opens an ad that asks for the very same words sees that row met at once, with its CV line, and the counts and level follow. (2) R7's "At best" in the label whenever a must-have is not judged. Everything else waits for the button. The demo (no AI, `/demo`) has no button and no kept skills; the two pinned demo level lines carry no unjudged must-have (`tests/demoData.test.ts:114-116`), so they do not change.

### 4.6 Saved ads and profiles: what is stored, what is computed

| Item | Stored on this device? | Where / how |
|---|---|---|
| Unlisted confirmed skills with their CV line | **Yes**, new optional field on the saved profile, `unlistedKept` (name, id, line, line text, inferred) | `lib/saved/types.ts:20-27`, `lib/saved/schemas.ts:74-87`, `lib/saved/profile.ts:27-40`. |
| The check's answers | **No in the first release.** They live in the page's memory and go on reload or on "Delete everything". | Computed again by one click. |
| Rewritten ids, rows, level, label, counts | Never stored. | Computed in the browser at report time, as today. |

- **Old saved profiles still open.** The new field is optional; `lib/saved/migrate.ts:3-6` says an added optional field needs no schema bump (`SCHEMA_VERSION` stays 1, `lib/saved/types.ts:10`), the profile schema is a "loose" object, and a profile's stamps are written but never compared when it is loaded (`lib/saved/saved.ts:39-60`). An old profile simply has no unlisted entries. The page then says (DRAFT): "This saved profile was saved before unlisted skills were kept. Read your CV again to add them."
- **A newer profile opened by an older app** keeps the field untouched (loose object), as `migrate.ts` intends.
- `sparseCvLines` (`lib/saved/profile.ts:16-24`) rebuilds the CV lines from cited evidence only; it must also include the lines of the unlisted entries, or the engine's line check (`match.ts:57-59`) would fail for them. `builtFromSaved` (`:50-67`) fills the new field back. When the vocabulary later lists a skill that was unlisted, the entry's id is looked up again on load (same function as `fromCv` uses, `readNameId`, `lib/engine/readName.ts:22`), so a saved `new:x` becomes the real id. A test pins it.
- **Consequence to accept, openly:** a saved ad opened from the list, and the "What to learn" box and the analytics, do not know the check's answers (nothing is stored), so they show the conservative "could not judge" picture. They are never stronger than the evidence. If the owner wants them to agree with the open report, that is EC-6 (store answers per saved ad, with a key of the profile they were made for).

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
- **What the plan does about it** (all code, no prompt change): clip entry lines at 240 characters and requirement quotes at 300; send at most 30 requirements, musts first, and show "N requirements were not checked (limit)" for the rest, never silently; if the entries plus requirements still pass about 6,000 input tokens, the call is split in two requests of half the requirements, sent one after the other with the existing pacing idea (`lib/engine/evalCvRun.ts:48` `waitForTokens` shows how the eval paces itself). EC-3 and EC-5 measure the real numbers before anything else is decided.

**A CV over the cap (characters, lines or 60 skills). Options:**
1. **Refuse with a clearer message (today, improved).** Say how far over it is and which part is long (for example "lines 300 to 400 are over the limit"). Nothing is dropped, the person edits. Cheap, honest; some real CVs (long academic ones) need work by hand.
2. **Read the first part, say so, and let the person decide.** "Only the first 12,000 characters (lines 1 to 310) were read. Lines 311 to 400 were not." A person can then paste the second part as a second reading. Fast to build, but part of the CV is "dropped" by size (visibly).
3. **Read in two parts and merge in the browser.** Two CV calls (the second after a wait for the minute's tokens), the skills merged, lines numbered once. Works on every CV; costs two calls and a more complex page.

**Recommendation: 1 now (with the better message), 3 later if the near-cap test pair (section 9) shows real CVs hit the cap.** Option 2 is the fallback if 3 proves too big. For the 60-skill cap: keep 60 and show the message (4.1). (Owner's answer to question 1, 2026-11-25: yes.)

### Daily token budget (AM7)

Groq allows **200,000 tokens a day for the whole organisation** (the owner's figure of 2026-11-25) and 8,000 a minute. The project instructions list only 1,000 requests a day, so the token figure is the one that binds. All numbers below are estimates (four characters a token) to be replaced by the real ones from the first run. A stopped or failed run is never repeated by hand, but it has already used its tokens.

| Stage | Calls | Typical tokens | Ceiling | Time at 8,000 a minute | Day |
|---|---|---|---|---|---|
| EC-0 baseline: 10 CV reads + 10 ad reads | 20 | about 90,000 (about 4,500 a call; the near-cap CV about 7,000, the very short one about 2,500) | 120,000 | about 12 to 15 minutes | Day 1 |
| One accuracy run of the check calls (reads taken from the saved baseline) | 10 to 12 (one per pair; a pair with more than 30 requirements, or over about 6,000 input tokens, is split in two) | about 65,000 (about 6,500 a call) | 85,000 | about 10 to 12 minutes (one call a minute) | |
| EC-5 calibration run (not counted) | as above | about 65,000 | 85,000 | | Day 2 |
| EC-5 counted run 1 | as above | about 65,000 | 85,000 | | Day 3 |
| EC-5 counted run 2 (same fingerprint, as earlier evals) | as above | about 65,000 | 85,000 | | Day 4 |
| **Whole plan** | about 50 to 56 | **about 285,000** | **about 375,000** | | 4 days |

- **One real run a day.** Two check runs on one day (about 130,000, up to 170,000) would leave no room for anything else. One run a day leaves about 110,000 to 135,000 for the owner's manual checks and retries.
- **The owner's manual checks use the same daily limit.** A manual-check document such as `docs/MANUAL-CHECK-8.3.md` (5 AI calls) costs roughly 20,000 to 30,000 tokens; keep about 40,000 a day in reserve for them and for any live use of the site, and do not start an eval run on a day when they are planned.
- **The baseline is reused.** The raw AI readings of the baseline (the AI's own answer for each CV and each ad, before any code touches it) are saved under `eval-runs/` (git-ignored, never committed) and used as the input of every check run. The plain code that follows (`fromCv`, `buildJob`, the profile build) is re-run from them for free, so a check run costs only its check calls. The saved readings stay valid only while the CV request hash (193e02ee3f), the ad request hash (85357f8fac), the vocabulary hash and `READING_VERSION` are unchanged; if one moves (for example the CV prompt change of option (ii) in section 10), the CV readings are redone (about 45,000 tokens). The files hold made-up text only.

---

## 6. Privacy and consent

**What the new call sends:** the ad's requirement sentences (short quotes of the ad, which is not cleaned: it is whatever the person pasted) and, for each confirmed skill that has a CV line, the skill name and that CV line (clipped at 240 characters). The CV lines were already sent once, after the contact-detail check, in the CV reading; the check sends the confirmed subset again, once per click, and up to three times when the AI service errors (C15). It does NOT send: the whole CV, the unconfirmed skills, cities, languages, years, dates, the access code in the body. **The lines are checked again before sending** (AM4): the page and the route both refuse a line that still holds an email address, a phone number or a link, with the same check as the CV route (4.3), so a line saved under older cleaning rules cannot go out unchanged. The ad's requirement sentences are not cleaned, as the ad is not. The server keeps nothing (no cache for this route, no file, no database) and logs only a fixed line (a new "check: …" line in the same set as `lib/ai/errors.ts:37,46,56,85`). The AI service's own handling is the same two facts as today (U2a: may store for up to 30 days; U2b: zero retention is switched on, both `lib/privacy/facts.ts:17-33`).

**New and changed items (all DRAFT, wording only after the owner approves):**
- `lib/privacy/facts.ts`: **no new row is needed.** Facts are about the two services (Groq, Vercel), not about our routes; the new call goes to the same two. The Vercel rule U9 already covers "paths that start with /api/". (Optionally re-observe the rule once the route exists.)
- `lib/privacy/messages.ts`: new `CHECK_INFO_LINE` (next to the new button, like `AD_INFO_LINE` at `:20-21`); a new claim, "The check sends the requirement sentences and the confirmed skills with their CV lines; the server keeps nothing"; changes to **C3B** (`:39-40`, "For a CV it keeps nothing": add the check route), **C4** (`:43-44`: the saved profile now also holds the unlisted skills with their CV line), **C6** (`:52-53`, the fixed log lines) and the stored-data heading text. **C9** (`:64-65`, delete everything) and **C16** (`:117-118`) stay as they are, unless the answers are later stored (EC-6).
- `/privacy` page (`app/privacy/page.tsx`): the new claim and the changed claims render from the constants (test M1 requires every constant to be rendered).
- **Tick or info line? Recommendation: an info line plus the existing tick, no second tick.** The tick (`CV_TICK`, `:24`; kept for the tab only, `app/consent.ts:69-72`) already says "I am sending my own text to be read by an AI service"; the check sends a smaller part of the same text to the same service. The check button goes through the same gate (`sendIfAcknowledged`), so a profile loaded from storage in a fresh tab shows the tick before the first check. The info line says exactly what is sent. A separate tick was the cautious alternative; the owner chose the info line plus the existing tick (question 5, 2026-11-25).
- **Delete everything.** The unlisted entries live inside the saved profile record, so the existing delete removes them (new test: a profile with `unlistedKept` is gone after delete, extending `tests/deleteMyData.test.ts`). The check answers live in page memory: "Yes, delete everything" must clear them too, like the 2.6b fix for the access code on screen (`b3c6a21`); new test.
- **`WORDING_APPROVED_ON`** (`lib/privacy/messages.ts:11`) is `null` now, and the gate test F4 (`tests/privacyFacts.test.ts:108`) fails with `PRIVACY_GATE=1` until the owner sets it. Every new or changed line stays a draft. **If the owner has approved the wording by the time this is built, the first commit that adds or changes a line sets it back to `null`** (approval of the old text is not approval of the new), and the owner approves the whole privacy page once more, at the end (the owner's answer to question 9, 2026-11-25).
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
| **NEW: check request hash** | new `lib/ai/checkRequestHash.ts` and a pin test, as `bulletsRequestHashPin.test.ts` does on `step-8.3` | Added in EC-3, **only after the owner approves the prompt text**; a test says it differs from the other four |

Existing tests that must be changed by hand in the same commit as the code that causes them (old, new, reason). Nothing here is changed now.

| Test | Old expectation | New expectation | Reason |
|---|---|---|---|
| `tests/privacyInventory.test.ts` I1 (`:117`) | API routes are exactly `/api/cv` and `/api/read` | exactly the routes that exist at that moment: `/api/cv`, `/api/read`, `/api/check` after the check lands, and `/api/bullets` as well once `step-8.3` is merged (whichever of the two merges second adds its own row; section 13) | a new route is a new data flow; the test is meant to fail until list and privacy page change together |
| same file, I2 (`:128`) | `postJson(` is called only by CvBox.tsx and page.tsx, one line each | the file that holds the check click gains one call line (count in page.tsx 1 → 2 if the handler is there) | the check is sent with the same helper |
| same file, I4 (`:168`) | console is used in exactly 6 places | 7 (the new route's "check: unexpected error in route") | one more fixed log line; `errors.ts` lines unchanged |
| same file, I7, I8 (`:207`, `:216`) | outside `app/api` only the access constants are imported from `lib/ai`; the CV route has no cache | unchanged text; a NEW sibling test says the check route has no cache and the page imports nothing from `lib/ai` for it | additions |
| `tests/privacyMessages.test.ts` M3, M6 | the exact approved strings of today | the changed strings (C3B, C4, C6) and the new ones | wording changes with the owner's approval, pinned in the same commit |
| `tests/noStoreHeader.test.ts`, `tests/logHygiene.test.ts`, `tests/accessGuards.test.ts:38` | cover `/api/read` and `/api/cv` | gain cases for `/api/check` (the access test finds the new route by itself) | additions |

**Existing tests that change because of R7, "At best" (AM6).** R7 changes the label text only when at least one must-have is not judged. Nothing changes now; each of these is edited by hand, from the table in 4.4, in the same commit as the code. Searched: every test that pins a label (`fitLabel`, `levelLine`, "must-have(s) not judged").

| Test (line) | Old string | New string | Reason |
|---|---|---|---|
| `tests/fitLevelReport.test.ts:124` | "Strong (skills only; 1 must-have not judged)" | "At best Strong (skills only; 1 must-have not judged)" | R7: one must-have not judged |
| `tests/fitLevelReport.test.ts:156` | "Strong (skills only; 2 must-haves not judged)" | "At best Strong (skills only; 2 must-haves not judged)" | R7 |
| `tests/fitLevelReport.test.ts:166` | "Good (skills only; 1 must-have not judged)" | "At best Good (skills only; 1 must-have not judged)" | R7 |
| `tests/fitLevelReport.test.ts:209` (the pasted-list page, which uses the same label function) | "Strong (skills only; 1 must-have not judged)" | "At best Strong (skills only; 1 must-have not judged)" | R7 |

**Pinned label lines that stay as they are:** `tests/fitLevelReport.test.ts:201` ("Long shot (judged: skills, location; 1 must-have not judged)": Long shot keeps its name, R7); every "No level (…)" label (`:172`, `:184`, `:387`, `tests/profileReport.test.ts:140`, `tests/skillsOnly.test.ts:115`); every label with no unjudged must-have (about 40 lines in `fitLevelReport`, `profileReport`, `skillsOnly`, `savedAdRows`, `demoData`). The sentences under the labels (for example `fitLevelReport.test.ts:125`) and the amber notes (`:196`, `:232`) are not changed by R7.

**Roadmap and analytics.** `tests/roadmap.test.ts:54`, `:281`, `:286` and `tests/roadmapIds.test.ts:37`, `:102` (and on `step-8.3`: `tests/roadmapReport.test.ts:37`, `:55`, `:171` and `tests/timeline.test.ts:38-39`) pin "(N must-have(s) not judged)" as a caveat after a JOB NAME in the roadmap, not as the level label; R7 as worded does not touch them. The word "Strong" there names a group of jobs ("Already Strong", "Strong matches") whose entries already carry the caveat. Whether to extend "At best" to those groups is a follow-up for the reviewer: if it is extended, `roadmap.test.ts:281` and `:286` and the chain's `timeline.test.ts:38-39` would change (for example "Already Strong" would become "Already, at best, Strong"). Analytics (on `step-8.3`) counts the level, not the label text (`app/analytics.ts:70`), and I found no analytics test that pins a label, so nothing changes there.

**Documents to update in the same commit (not tests):** `docs/MANUAL-CHECK-FIT.md:48` and `:58` quote the old label; `docs/DECISIONS.md:99` ("Label caveat") is superseded by a new line; `docs/PLAN-FIT-LEVEL.md` and `docs/PLAN-7.1.md` are history and stay.

**Tests that deliberately do NOT change under C** (so they are proof that nothing else moved): the "could not judge" and "No level can be shown" lines and the explanation sentences in `tests/fitLevelReport.test.ts` (for example `:125`, `:172-173`, `:177`, `:184-185`), `tests/profileReport.test.ts:133-141` (R10), `tests/skillsOnly.test.ts:96` (S8), `tests/roadmap.test.ts:32-39`, `tests/profileBuild.test.ts:69`, `tests/saved.test.ts` S2d, `tests/fromCv.test.ts:106` (C14), `tests/judgeable.test.ts`, `tests/engineView.test.ts`, the demo tests. Reason: with no answers and no kept unlisted skills the new code returns exactly today's output (test EV1).

---

## 8. Tests first (for the later build)

Every stage below starts by writing its tests, with expected values worked out by hand from this plan (never from the code's output). If a test then fails, the owner is told whether the code or the hand count was wrong; an expectation is never changed to fit the code. After the code is green, each "break" is applied on purpose and must make the named tests fail, then undone.

| Tests (new files) | What they pin |
|---|---|
| `tests/evidenceProof.test.ts` EP1 to EP12 | The proof of 4.3: met with a real entry and quote; entry number not sent; quote on ANOTHER entry's line; quote with no real word; `none` with leftover entry; `partly` verified; requirement number not sent; answered twice; skipped; quote copied from the AD instead of the CV; case and accent differences; a German quote on a German line. |
| `tests/evidenceView.test.ts` EV1 to EV13 | **EV1: with NO answers and NO `unlistedKept` entries, `engineJob`, `engineProfile` and `couldNotJudge` are deep-equal to today's `engineView` for every existing fixture job and profile, and the new map is empty. EV1b: with kept unlisted entries but no same-name hit and no answers, the same.** **EV13 (AM2): no text for the person contains `ev:`, `kept:` or `new:`.** One job with a met, a partly, a none, a same-name and an unanswered requirement is built; every string of the report (label, explanation, row labels and details, counts sentence, not-judged lines), of the gap list, of the "What to learn" box and of the analytics lines made from the same view is scanned; each partly/none row shows its own words and original skill name. Met counts met with the entry's own citation; partly and none count missing; unanswered stays "could not judge"; the worked example of 4.4 (Good → Stretch, and the two variants); a requirement with one listed and one unlisted alternative is not touched; "No level" reasons keep their order; the engine files do not import the new code (source guard). |
| `tests/evidenceLabels.test.ts` EL1 to EL12 | Labels R5 and R7 character by character, one test for each row of the table in 4.4 (0, 1, 2 AI-judged; with and without leftover unjudged; "At best" for Strong, Good and Stretch; none for Long shot and "No level"); the sentence; the AI block's rows (with the inferred wording); the "thrown-away answers" line. |
| `tests/profileUnlisted.test.ts` PU1 to PU10 | A ticked unlisted CV skill lands in `unlistedKept` with line and text AND still in `unmatchable`; unticked, hand-added and in-progress do not; two unlisted with one id once; the 60-cap message names the left-out skills. **PU9 (AM5): a ticked unlisted skill from the inferred group lands in `unlistedKept` with `inferred: true`, its line and text; the same skill unticked does not; a named one has `inferred: false`. PU10: the check input line and the AI block row carry "inferred from your wording, confirmed by you" for an inferred entry and not for a named one.** |
| `tests/sameName.test.ts` SN1 to SN7 (AM3) | SN1 the same id on both sides: met, citing the entry's line, counts 1 met. SN2 a different spelling (`new:wound-care` against `new:wound-caring`): not matched, stays "could not judge". SN3 a requirement with two unlisted ids, one of them matching: met. SN4 a requirement with a listed alternative is not touched by the same-name rule. SN5 hand-added and in-progress skills never match (they are not in `unlistedKept`). SN6 the roadmap and gap list, built from the same `engineView`, agree with the report (a same-name requirement is not a gap). SN7 it needs no click (no answers argument) and gives the same output twice. |
| `tests/checkContact.test.ts` CS1 to CS6 (AM4) | CS1 the route refuses a line with an email address (400, the same message as `/api/cv`, no AI call, nothing logged). CS2 a phone number. CS3 a web link. CS4 a clean line passes. CS5 page side: an entry whose saved line holds an email address is left out of the call and named on the screen. CS6 source guard: the check's schema uses the same `containsContactDetails` as `lib/schemas/cv.ts`. |
| `tests/recallCeiling.test.ts` RC1 to RC5 (AM1) | The ceiling measure of section 9, pure code on invented data: RC1 key says met and a named entry sits on the key's line: reachable. RC2 an entry only on another line: not reachable. RC3 no entry, but an unticked inferred proposal sits on the line: counted as recoverable by option (i). RC4 no proposal at all: counted as needing option (ii). RC5 the ceiling is reachable divided by all "met" of the key; with no "met" in the key there is no figure (not 100 %). |
| `tests/savedUnlisted.test.ts` SU1 to SU8 | Round trip keeps `unlistedKept` (with the `inferred` flag); an old record without it opens; the schema accepts both; `sparseCvLines` includes the unlisted lines; a skill listed later is re-resolved on load; the profile key changes when an unlisted entry is kept (extends the K tests); delete-everything removes it and clears the answers on screen. |
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
- B19 (AM2) a gap row, or the roadmap box, shows the internal id `ev:3` instead of the requirement's own words → EV13.
- B20 (AM4) the route skips the contact-details refusal → CS1 to CS3. B21 the page sends a line that fails the test → CS5.
- B22 (AM5) the `inferred` flag is dropped on the way to the check input or the AI block → PU10, PU9.
- B23 (AM3) the same-name rule matches a near spelling (compares only the start of the id) → SN2. B24 the same-name rule lives only in the report, not in `engineView` → SN6.
- B25 (AM6) R7: "At best" is missing for Good → EL. B26 "At best" is added to a Long shot or to a "No level" label → EL.
- B27 (AM1) the ceiling counts an entry that sits on a different line than the key's → RC2.

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
- Share of requirements that have an answer (met / partly / none) instead of "could not judge", before (EC-0) and after.
- Cross-language pairs (6, 10) reported separately.
- Tokens per call and any 429.
- **Recall ceiling (AM1), reported on its own, apart from the check's errors.** The check can only cite an entry that exists. For every requirement the owner's key marks "met", does a confirmed entry (built as the page builds it, named skills ticked, listed and unlisted alike) sit on the key's CV line (any of them, if the key gives several)? If not, even a perfect check could not find it. Three groups: (a) an entry sits on that line: reachable; (b) no entry, but an unticked inferred proposal sits on it: recoverable by option (i) in section 10; (c) no proposal at all: needs option (ii). Ceiling = (a) divided by all "met" requirements of the key (no figure if the key has none). It is measured in EC-0 from the saved readings, with no check call at all. It is not a pass line: it tells whether the check can ever reach the pass bar.

**Pass bar (accepted by the owner on 2026-11-25, question 4; the numbers are as I proposed them):**
1. False "met": **0** on all ten pairs. (With about 40 AI "met" answers, zero errors still allows a true error rate of up to about 7 %, "rule of three": 3 divided by 40. The report says so.)
2. Levels stronger than the key's level: 0 of 10; levels equal to the key's: at least 8 of 10.
3. At least 90 % of requirements have an answer; every other row says why.
4. Of the requirements the key says "met", at least 80 % found.
5. No pair's call fails on a 429 in the counted run; no single call over 7,000 tokens.
6. Throw-away rate of the proof (quote not on the line) at most 10 % of answers.

The runs are spread over days by the token budget in section 5 (baseline on day 1, calibration on day 2, the two counted runs on days 3 and 4).

---

## 10. Stages

Small, each tests-first, each its own commit, careful lane (anything the AI reads or writes). The owner gives a step number to each; here they are EC-0 to EC-7.

- **EC-0a. Material and keys, no code and no AI.** The ten invented pairs (I write them) and one key sheet per pair for the owner to fill in. Test: the key's lines and quotes exist.
- **EC-0b. Baseline script, built with fake dependencies, no AI.** Reuses `scripts/evalCv.ts` and its guard (`EXPECT_REQUEST_HASH`, `EXPECT_INSTRUCTIONS_LEN`, `lib/engine/evalCvGuard.ts:12-34`), the pacing (`lib/engine/evalCvRun.ts:48`), the fingerprint (`lib/engine/evalFingerprint.ts:19-54`); outputs to `eval-runs/` (git-ignored).
- **EC-0. BASELINE RUN of today's product on the ten pairs. Go in principle (owner, question 6); it starts only after the owner has written the key sheets, and each real run needs its own go in its own prompt.** Reads each CV and each ad exactly as the live page does, builds the profile as the page does (named skills ticked), builds the report, and compares with the key: how many requirements are "could not judge" today, how many wrong, and the recall ceiling of section 9. About 20 calls (10 CV reads, 10 ad reads); by my estimate about 90,000 tokens (ceiling 120,000, section 5), which the 8,000-a-minute pacing spreads over roughly 12 to 15 minutes, on day 1. The raw AI readings are saved under `eval-runs/` (git-ignored) and reused by every later check run. It shows the real size of the problem and whether C is worth building.
- **DECISION POINT after EC-0 (AM1): the recall ceiling.** If the ceiling is low, the options are: **(i)** also send unticked and inferred entries to the check (no pin moves; but an unticked entry is something the person has not confirmed, so an answer through it must be labelled as such and its counting rule, probably "shown, not counted", is a new owner decision with its own design note first); **(ii)** a CV prompt change that also returns experience lines (**moves the CV pin 193e02ee3f and invalidates the saved CV readings; needs the owner's explicit go**); **(iii)** accept it and say so on screen ("Some skills your CV shows may not have been found; read the lines of your CV yourself"). My proposal for reading the number, the owner decides: 90 % or more, accept (iii); between 70 and 90 %, try (i) first; under 70 %, (ii) is on the table. Nothing is built for this before the number exists.
- **EC-1. Pure code, no AI:** the proof, the answers argument and the same-name step inside `engineView` (with the id rewrite and the map back to the original requirement), the labels R5 and R7, the recall-ceiling measure (sections 4.2 to 4.5, 9). Engine untouched. Tests EP, EV, SN, EL, RC first; breaks B1 to B7, B17, B19, B23 to B27.
- **EC-2. CV side, no AI:** `unlistedKept` (with the `inferred` flag), the saved field, `sparseCvLines`, the confirm-box wording, the 60-skill message. Tests PU, SU first; breaks B8 to B10, B18, B22.
- **EC-3. The call, no real AI call:** schema, prompt (the owner approves the prompt text first), `lib/ai/checkEvidence.ts`, the route, the request-body capture on a fake fetch, the NEW pin. The route and its privacy and inventory rows in one commit; the route refuses CV lines with contact details (AM4). Tests CR, CS, schema, hygiene, pin first; breaks B11 to B13, B16, B20.
- **EC-3 is split:** EC-3a (lib: schema, prompt, input builder, evidence call, request-body capture, pin; no route) and EC-3b (route, privacy rows, inventory and log tests, contact-detail refusal).
- **EC-4a. The pure parts and the report block (nothing can send):** `lib/cv/checkPlan.ts` (`buildCheckPlan`, `extrasFor`, `Checked`), `lib/cv/checkBridge.ts` (`toViewAnswers`), `lib/cv/checkWording.ts` (DRAFT), the optional fifth parameter of `reportFor`, and the AI block in `app/ReportView.tsx`. Tests CPL, CB, PR, CP6, CP9 and the copy-drift tests D1 to D3.
- **EC-4b. Page wiring:** the button (`app/CheckBox.tsx`), the click logic (`app/runCheck.ts`, the one new `postJson(`), the info line, the tick gate, the message when the call fails, `onWipe` in `SavedDeleteAll`, the `"check"` word of `AccessSource`, and the privacy-test updates I2, I3 and M6. Tests RC, CP1 to CP5, CP7, CP8, CP10 and CP11 first; breaks B14, B15, B18, B21. The first time the page can send, the privacy page, `messages.ts` and the inventory are already in place (EC-3).
- **EC-5. Eval script (`npm run eval-check`) and runs:** dry run with the fingerprint (no AI); one calibration run (not counted); the counted run. **Each real run needs the owner's go, in its own prompt, and goes on its own day (section 5)**; a guard that stops a run stops it. The owner reads every AI "met".
  **Built (EC-5a, EC-5b):** the pure parts are `lib/engine/evalEveryCvCheck{Guard,Score,Report,Fetch,Probe,Canned}.ts` and two optional fields of `compareBaseline`; the script is `scripts/everyCvCheck.ts` with its logic in `scripts/everyCvCheckMain.ts` and the chain that makes the call in `scripts/everyCvCheckChain.ts` (the page's own `runCheck` into the real route, called in this process). Modes: `--dry`, `--fingerprint`, real, `--calibration`. No real run has been made.
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
8. **Merge friction** with the unmerged chain, which now merges AFTER the check (section 13): `app/page.tsx` (touched on all four branches), `lib/saved/messages.ts`, `lib/ai/errors.ts` (`step-8.3` widens `ReadSubject`). The clean merge-tree result of section 13 was against `step-9.3` alone and must be run again against main once the check has landed.
9. **Over-trust**: a person reads "Strong" and stops reading. Mitigation: label R5 always names the AI-judged count, and R7 says "At best" whenever any must-have is not judged.
10. **Scope creep**: sending listed-but-missing requirements to the AI too (question 8, answered: not now) would multiply the false-"met" risk on rows that are deterministic today.
11. **The CV reading did not make an entry for a line that shows the skill (AM1).** The check can only cite entries that exist. If the CV reading missed a line, or the person left an inferred skill unticked, no check can find it: the row then says "no evidence found" although the CV does show it. That is a false "none" (safe direction, but the product is poorer). It is measured as the recall ceiling (section 9) and answered at the decision point after EC-0 (section 10).

---

## 12. Questions for the owner (each with my recommendation, and the owner's answer)

All twelve were answered by the owner on 2026-11-25; the answers are in the Decision log below.

1. **A CV over the cap.** Refuse with a clearer message now (1), two-part reading later (3)? Recommend 1 now, 3 only if the near-cap pair needs it. **Answer: YES.**
2. **How "partly" counts.** Counts as NOT met (missing), shown as "partly"? Recommend yes: it can never make the level stronger than the evidence. The alternative (leave "partly" as "could not judge") hides a gap behind a caveat. **Answer: YES.**
3. **Do AI-judged answers count in the level?** Yes, with the label naming the count (R5), or show them only as extra information and keep the level list-only? Recommend yes, count them, otherwise most nursing or law CVs still get "No level" and the goal is not met; the label and the separate block keep it honest. **Answer: YES.**
4. **The pass bar** of section 9 (false "met" 0, no level stronger than the key, 90 % answered, 80 % found). **Answer: ACCEPTED as proposed.**
5. **A new tick, or an info line?** Recommend an info line plus the existing tick gate, no second tick (section 6). **Answer: YES.**
6. **The go for EC-0** (the baseline run: about 20 real AI calls, about 90,000 tokens, on made-up material only). Recommend yes, after the owner has written the key sheets (EC-0a). **Answer: go in principle; it happens only after the owner has written the key sheets, and each real run needs its own go in its own prompt.**
7. **Same-name match by code** (4.2, step 2): an unlisted requirement and an unlisted CV entry with the very same words match without the AI. Recommend yes; it is deterministic and cites the line. **Answer: YES.**
8. **What is sent to the check:** only requirements the list cannot judge (every id unlisted), or also listed requirements the person is missing? Recommend only the unlisted ones first. **Answer: YES (only the unlisted ones).**
9. **Wording approval after changes:** approve the whole privacy page again, or only the new and changed lines? Recommend the whole page once, since `WORDING_APPROVED_ON` is a single date. **Answer: YES, the whole privacy page once more, at the end.**
10. **Stored answers (EC-6):** yes or later? Recommend later, after the accuracy test, so the first release stores nothing new except the unlisted skills the person confirmed. **Answer: YES (later, not in the first release).**
11. **Does the check wait for the chain 7.3 to 8.3?** Recommend no: the check does not need the chain, and waiting would hold back the main goal for a chain whose own manual checks are still to be done. **Answer: NO, it does not wait.** (Section 13.)
12. **Use "At best" in the label when must-haves are not judged?** Recommend yes: a must-have that is not judged can only lower the level, so "Strong" alone reads stronger than the evidence. **Answer: YES.** (Rule R7, section 4.4.)

### Decisions that wait for numbers (not part of the twelve)

- **After EC-0, the recall ceiling (AM1):** options (i), (ii), (iii) of section 10; the owner decides when the number exists. (ii) needs the owner's explicit go and moves the CV pin.
- **The roadmap's "Already Strong" group and R7** (section 7): extend "At best" to those groups or leave the caveat next to the job name as it is. A follow-up for the reviewer; nothing is built for it in this plan.

### Decision log (2026-11-25)

| # | Decision (owner's answer) | Plan sections it set |
|---|---|---|
| 1 | CV over the cap: refuse with a clearer message now; two-part reading later only if the near-cap pair needs it. YES | 5, 10 (EC-7) |
| 2 | "Partly" counts as NOT met (a missing must-have), shown as "partly". YES | 4.4 (R2) |
| 3 | AI-judged answers count in the level; the label names how many. YES | 4.4 (R5) |
| 4 | Pass bar exactly as proposed in section 9. ACCEPTED | 9 |
| 5 | An info line plus the existing tick; no second tick. YES | 6 |
| 6 | Baseline run (EC-0): go in principle; only after the owner has written the key sheets; each real run needs its own go in its own prompt. YES | 10, 5 |
| 7 | Same-name match by code, no AI. YES | 4.2, 4.4 |
| 8 | Send to the check only requirements the list cannot judge (every id unlisted). YES | 4.2 |
| 9 | Approve the whole privacy page once more, at the end. YES | 6 |
| 10 | Store the check's answers later, not in the first release. YES | 4.6, 10 (EC-6) |
| 11 | The check does not wait for the chain 7.3 to 8.3. NO (it does not wait) | 13 |
| 12 | Use "At best" in the label when must-haves are not judged. YES | 4.4 (R7), 7 |

---

## 13. Order: build after 9.3 is merged, and why

The owner answered NO to question 11: **the check does not wait for the chain 7.3 to 8.3.**

**New order:**
1. **Merge 9.3.** The privacy page, `facts.ts`, `messages.ts`, the inventory tests, the consent tick and delete-everything exist only on `step-9.3` (17 commits ahead of main). A new data flow must update them in the same commit, so this work must stand on them.
2. **EC-0a, EC-0b and EC-0 (the baseline), in parallel with the chain's own manual checks.** They only add files under `fixtures/`, `docs/` and `scripts/` and need today's reading code; the owner's key sheets can be written at any time. The chain's manual checks and the baseline use the same daily token limit (section 5), so they are planned on different days or inside the daily reserve.
3. **EC-1 to EC-5 on main, after 9.3.** The change to `engineView` is an optional argument and a new step inside it, so the callers on the chain (`app/roadmap.ts:114`, `app/bullets.ts:30`, analytics through `profileReport`) keep compiling and keep today's behaviour. R7 changes label text only; the chain's tests pin "(N must-have(s) not judged)" only as a caveat after a job name, not as the label (section 7), so I expect none of them to change; this is checked when the chain is merged.
4. **The chain (7.3, 8.1, 8.2, 8.3) merges later.**

**Both new routes and the inventory.** `step-8.3` adds `/api/bullets`; the check adds `/api/check`. `tests/privacyInventory.test.ts` I1 ("the API routes are exactly …", `:117`) is built to fail until the privacy page and the inventory list every route (I did not run that merge; I expect it from the test's own header, `:3-4` and `:19`). **Whichever of the two merges second adds the missing privacy and inventory rows**; I1 then lists the routes it has at that moment (after the check: `/api/cv`, `/api/read`, `/api/check`; after both: also `/api/bullets`). The same holds for the other counted lists (I2, I4, the log and no-store tests): each merge changes the counts by the routes it brings.

**The merge-tree finding (kept).** The chain `step-7.3 → 8.1 → 8.2 → 8.3` (12, 23, 36, 84 commits ahead of main; each is contained in the next) was tried against `step-9.3` with `git merge-tree --write-tree` (read-only: nothing was merged, no branch or file changed): **all four merge with no textual conflict**. The files both sides changed, and my plan would touch as well, are `app/page.tsx` (all four), `lib/saved/messages.ts` (all four) and `lib/ai/errors.ts` (`step-8.3` only). **That result was against `step-9.3` alone.** With the check merged first, the chain is merged into a main that has changed in exactly those three files, so the same read-only `git merge-tree` must be run again, against main after the check has landed, before the chain is merged. A clean text merge is not a clean test run either: the full suite runs after each merge.

---

## Appendix: the code reading behind this plan (Step 2, points a to g)

**a) How `match()` and the level rules take a profile; where an answer can enter without changing the engine.**
`match(profile, job)` (`lib/engine/match.ts:275`) calls `checkRequirement` for each requirement (`:61-109`): a requirement is met if any of its skill ids equals the id of a profile skill with `kind: "have"`, a non-null `evidence`, and `profile.cvLines[line - 1] === evidence.text` (`:57-59`, `:65-82`). Otherwise it is missing, with a reason (`in-progress`, `no-cv-line`, `not-on-profile`, `:84-108`); `fitLevel` (`lib/engine/fit.ts`) counts only `missingMusts` and conflicts. So an extra per-ad `have` entry for an unlisted id WORKS in the engine as it is. What blocks it today is not the engine but the step before it: `splitJudgeable` (`lib/engine/judgeable.ts:16-21`) removes every requirement whose ids are all unlisted before `match()` sees it, called from `engineView` (`lib/cv/engineView.ts:20`) and `skillsOnly` (`app/skillsOnly.ts:184`). `profileReport` then labels the removed ones "could not judge" (`app/fitReport.ts:107-109`), and `noLevelReason` counts them only as `unjudgedMusts` (`:163-170`). So the entry point is `engineView` itself: an optional argument (the verified answers) and a same-name step that rewrite the ids of answered requirements and add the matching `have` skills (4.4). `match.ts`, `fit.ts`, `unlock.ts` and `judgeable.ts` stay unchanged.

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

---

## Amendments log

All dated 2026-11-25.

| AM | What | Sections touched |
|---|---|---|
| AM1 | Recall ceiling: a measure, a risk, a decision point after EC-0 with options (i) to (iii), tests RC1 to RC5, break B27 | 8, 9, 10, 11, 12 |
| AM2 | No internal ids (`ev:n`, `kept:…`, `new:<slug>`) on screen: the map back to the original requirement, test EV13, break B19 | 4.4, 8 |
| AM3 | Same-name match: lives inside `engineView`; needs the id rewrite; EV1 stated exactly (no answers and no `unlistedKept`), EV1b; the 4.5 sentence corrected; tests SN1 to SN7, breaks B23, B24 | 4.2, 4.4, 4.5, 8, 10 |
| AM4 | Contact details: the check route and the page refuse CV lines the way `/api/cv` does; one sentence in section 6; tests CS1 to CS6, breaks B20, B21 | 4.3, 6, 8, 10 |
| AM5 | Inferred entries: a ticked unlisted skill from the inferred group goes into `unlistedKept` with `inferred: true`; labelled in the AI block (amended by AM10: not sent in the check input); tests PU9, PU10, break B22 (amended by AM10) | 4.1, 4.3, 4.5, 4.6, 8 |
| AM6 | R7 "At best" is a rule of the plan; table of R5 and R7 combinations; list of existing tests that would change (four lines in `fitLevelReport.test.ts`), the ones that stay, the roadmap and analytics findings, documents to update; breaks B25, B26 | 4.4, 7, 8, 12 |
| AM7 | Daily token budget (200,000 a day, 8,000 a minute), the day for each run, the baseline readings saved under `eval-runs/` and reused, the manual checks share the limit | 5, 9, 10 |
| AM8 | Housekeeping: the "no probe report" paragraph replaced by one sentence plus the worked example (Quorbix, Zentrafold); questions 11 and 12 and the Decision log; section 13 rewritten for the answer NO to question 11 | 2, 12, 13 |
| AM9 | The AI input carries no importance tag; priority must not change the verdict, and a nice-to-have could be judged more leniently. | 4.3 |
| AM10 | AM5 amended: the inferred note is NOT sent in the AI input (owner decision 2026-11-25, option A); rule 1 of the instructions already says the name is a label and only the line counts; the label stays in the report block. | 4.3 |
| AM11 | The check schema uses plain numbers, like the CV and ad schemas. zod's `.int()` adds minimum and maximum keywords that Groq's strict-mode documentation neither lists nor promises, and the existing readers never send them. A number that is not whole is rejected by the proof (no entry or requirement has that number). Owner re-pin 2026-11-25. | 4.3, 7 |
| AM12 | Delete everything cleared on-screen state only after a successful delete (`onForget`); the tab-only path and a failed delete skipped it. EC-4b adds `onWipe`, called right after `forgetConsent()`. | 4.6, 10 |
| AM13 | The page re-proves the route's answers with `proveAnswers` before showing them; a damaged reply cannot put an unproven line on screen. | 4.3, 4.5 |
| AM14 | Answers are used only while the key of what was sent equals the key at click time; the plan of what to send is computed without the answers. | 4.5, 4.6 |
| AM15 | Known gaps accepted until EC-6: rows of listed skills from a saved profile lack the inferred note (`inferred` is stored only for unlisted skills); the saved-ads list uses `reportFor` without extras and can show a different label than the open report. | 4.5, 4.6 |
| AM16 | Q3 decided: the tick stays in the CV box only, no second tick next to the button; CHECK_TICK_NEEDED is shown next to the button; the manual check covers a saved profile in a new tab with no tick. | 6, 10 |
| AM17 | Wrong-evidence rule: an AI-judged row where the key says met but the CV line the AI cites is not one of the key's lines counts against the bar as a false met (kind 1b), and the report marks it "wrong-evidence candidate" and lists it first. In the calibration run the owner and the reviewer read each candidate. A key line is ADDED only when the CV text really supports the other line; the reason is logged and the change is committed before the counted runs; never to fit the code. | 9, 10 |
| AM18 | Ceiling labels: when a must stays unjudged after the check (thrown away, not answered, not read), the report's R7 label is "At best <level>"; the eval records that as a "ceiling": never equal, never stronger, never weaker, with its own count. Long shot and "No level" labels have no ceiling and compare normally. | 4.4, 9 |
| AM19 | Day plan of the real runs (four separate days, each needs the owner's explicit go in its own prompt): Day A baseline (about 90,000 tokens), Day B calibration check run (about 65,000, not counted), Day C counted run 1, Day D counted run 2 with the SAME fingerprint. The calibration may change a key line (AM17) or a prompt; a re-pin needs the owner's explicit go. | 5, 10 |

Chain note: `lib/ai/errors.ts`: EC-3a added the subject check (`ReadSubject`, the log tag, a 500 message); `step-8.3` edits the same file for its own subject; keep both when merging.

Note: `toViewAnswers` (route answer positions to `engineView`'s `ViewAnswer`) is built in EC-4, where the page's lists are known.

## DRAFT wording awaiting the owner's approval

Only the file and the name of each piece of wording are listed (no text is copied here, so this list cannot drift from the code). All of it is DRAFT; `WORDING_APPROVED_ON` stays null until the owner approves.

From EC-1:
- `lib/engine/evidenceText.ts`: `AI_BLOCK_TITLE`, `INFERRED_NOTE`, `aiCountsSentence`, `aiRowText`, `thrownAwayLine`.
- `app/skillsOnly.ts`: `fitLabelText` (the label forms: "At best", "N must-have(s) judged by AI", "N must-have(s) not judged"), and `NO_REQUIREMENTS_SENTENCE`, `noMustHaveJudgeableSentence` as they were before (not new).

From EC-2:
- `lib/cv/capMessage.ts`: `capMessage` (the 60-skill message).
- `lib/saved/messages.ts`: `OLD_PROFILE_NOTE`.
- `lib/cv/confirmWording.ts`: `UNLISTED_TAG` (the skill row tag), `keptLineText` (the confirm-box text).
- `lib/privacy/messages.ts`: `CLAIM_C4` (the change that says the saved profile holds unlisted skills with their CV line).

From EC-3b:
- `app/api/check/route.ts`: `CONTACT_REFUSAL`, `SEND_JSON`, `WRONG_FIELDS` (the sentences a person can read when a check request is refused).
- `lib/ai/errors.ts`: the sentence for an unexpected error of the check ("Something went wrong while checking your CV lines against the ad. Please try again."), inline in `toReadError`.
- `lib/privacy/messages.ts`: `CHECK_INFO_LINE`, `CLAIM_C17`, `CLAIM_C3B` (changed), `CLAIM_C16` (changed), `CHECK_TICK_NEEDED`.

From EC-4a:
- `lib/cv/checkWording.ts`: `CHECK_BUTTON`, `CHECK_RUNNING`, `CHECK_DONE`, `CHECK_NOT_CHECKED`, `CHECK_NO_ENTRIES`, `CHECK_STALE`, `CHECK_CONTACT` (a copy of `CONTACT_REFUSAL`), `CHECK_UNREACHABLE` and `CHECK_SERVER_ERROR` (copies of the CvBox sentences), `CHECK_BAD_ANSWER`.

From EC-8a (the check reads the CV's own lines; all DRAFT):
- `lib/privacy/messages.ts`: `CHECK_INFO_LINE` and `CLAIM_C17` (changed: they now say the check sends the lines of the person's CV, each with its line number, the same text that was sent when the CV was read; the cap is 120 CV lines).
- `lib/cv/checkWording.ts`: `CHECK_NO_ENTRIES` (changed: "There is no CV line to check the rest against.").
- `app/api/check/route.ts`: `WRONG_FIELDS` (changed: 1 to 120 CV entries, was 60). `SEND_JSON` still says "skill name" in its example: decide at approval.
- `lib/engine/evalEveryCvCheckReport.ts` (eval report only, not shown to a person): "no CV line to send", "the cap dropped N CV line(s)".
- `INSTRUCTIONS_CHECK` is NOT changed (it never calls an entry a skill: it says "a name and the one CV line it was found on"); the check pin 61d7628d46 and the length 2,665 stay.

From EC-4b (no new sentence; notes for the approval):
- (i) `CHECK_CONTACT` says "Take it out", but a CV line cannot be edited on the confirm screen: decide the wording at approval (for example: untick the skill that has the line, or take the contact detail out of the CV and read it again). D1 pins the copy, so the route's `CONTACT_REFUSAL` and `CHECK_CONTACT` change together.
- (ii) `CHECK_NOT_CHECKED` is shown before the click too and reads as past tense: decide at approval.
- (iii) Known limit: a check always takes the first 30 open requirements (musts first); a second click sends the same 30; the rest stay "not judged".

Known limits of the check eval (EC-5):
- The eval runs the route in this process, so it measures the model's time plus our code, not Vercel's network or time limit; one real click on the deployed site is timed later.
- The caps of 30 requirements and 120 entries (EC-8a: the entries are CV lines) drop the rest; the report shows, for each pair, how many entries the cap dropped and how many open requirements stay not judged.
- A profile with ONLY unlisted skills is shown as "No level (no skills on your profile)" whatever the check answers (`app/fitReport.ts` counts the profile's own skills, not the ones the engine view adds). Found while building the eval; not changed here.

Note: EC-6 (storing answers) must change C4 and C17 (the "not saved" sentence) in the same commit.

Note: The check call's latency is unmeasured and no route sets `maxDuration`; EC-5 records the elapsed time per call; set `maxDuration` only if the numbers need it.

