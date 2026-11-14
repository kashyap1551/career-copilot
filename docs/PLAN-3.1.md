STATUS: BUILT and committed as "3.1: full job schema and extraction" (see git log). The approved table below is what the tests follow. Reading-quality issues found on the first real run are listed in docs/HANDOFF.md for step 3.3.

I checked Groq's strict-mode page. These are the points that affect the schema:
- Every field must be required, and every object must be closed.
- Nullable fields, nested objects, arrays of objects, enums and numbers are all supported.
- The page lists no length or format limits, so I'll avoid them.
- Strict mode and streaming don't mix.

Here is the plan for step 3.1. I haven't written any code.

## Answers and changes (after the owner's review)

**Answers to the four questions:** (1) yes: skill ids come from names, with `new:` ids for unlisted skills. (2) yes: skill names are not filtered by their quote. (3) yes: a value that fails its check is nulled and its quote moves to `otherConditions`. (4) yes: the owner will paste a real public ad when asked.

**Four changes to the plan, which win wherever the text below says otherwise:**
- **(a) Eval matching is by quote only.** An extracted requirement matches a key item when, after normalising, one quote contains the other. A different skill name is counted as a separate figure, "name differs", and never lowers the reading score, so vocabulary mismatches never count as misses.
- **(b) The report change for unlisted skills moves out of 3.1 into step 3.4.** A note is added under 3.4 in docs/SPRINT.md. Step 3.1 only produces the `new:` ids and the list of unlisted skills.
- **(c) The eval script waits between Groq calls and retries on a rate-limit error** with a short backoff.
- **(d) Claude drafts each answer key from the ad text alone, without seeing the AI's output.** The owner reviews every must-have and constraint before the key is final.

# Plan for 3.1: the full job schema and the extraction function

## The shape of the change
The AI returns a **reading** of the ad in its own schema, with every claim backed by an exact quote. **Plain code** then turns that reading into the engine's existing `Job` type: it maps words to levels and ids, checks each quote against the ad, and drops or nulls whatever fails. The engine's types don't change. New files:
- `lib/schemas/job.ts` (the AI's output schema, replacing the Day 1 one).
- `lib/engine/fromAd.ts` (the conversion and the checks, pure code).
- `lib/engine/languageWording.ts` (words to CEFR level, and language names to codes).
- `lib/engine/skillIds.ts` (skill names to ids).
- `lib/ai/readJob.ts` is updated and keeps the prompt and the call.
- The `/api/read` route and the page are updated to show the new result.

## 1. How the AI's output maps to the engine's types

| Ad says | AI returns | Code produces |
|---|---|---|
| "Strong TypeScript and React." | two requirement items, same quote, one skill each | two engine requirements: `typescript`, `react` |
| "Power BI or Tableau dashboard experience." | one item, two skill names | one requirement, `skillIds: ["power-bi", "tableau"]` |
| "Fluent English, written and spoken." | language "English", level wording "Fluent" | `{ code: "en", level: "C1" }` |
| "Fluent English (C1 or better)." | level wording "C1" | `C1` (a stated CEFR level wins) |
| "Good English for…" | wording "Good" | `B2` |
| "German required" | language "German", wording `null` | `{ code: "de", level: null }` |
| "Knowledge of Hindi or Kannada." | an `otherConditions` item, not a language | exact quote in `otherConditions` |
| "Bachelor's degree…", "right to work in the UK" | `otherConditions` items | exact quotes in `otherConditions` |
| "start within two months" | no start date; the sentence in `otherConditions` | `startDate: null` |
| "At least 3 years…" | years 3 with its quote | `minYears: 3`, no skill |
| "2 to 4 years … financial planning and analysis" | years 2, plus a requirement for the field | `minYears: 2` and a `financial-planning` requirement (the DECISIONS rule) |
| "Hybrid: three days… Manchester office" | work mode hybrid with its quote, city "Manchester" | `remote: "hybrid"`, `location: "Manchester"` |

- **The AI reads, code decides.** The AI never produces CEFR levels from wording, never produces ids and never produces the final job. The wording-to-level table from DECISIONS.md becomes pure code. I'll extend it to German words ("Muttersprache", "fließend", "verhandlungssicher", "gut", "Grundkenntnisse"). A wording not in the table gives `null`.
- **Language names map to codes** by a small table (English, Deutsch, Hindi and so on). A language the table doesn't know goes to `otherConditions` as a quote and is never guessed.
- **A language goes in `languages` only if the ad requires it.** If the ad says "or", "preferred" or "plus", the prompt tells the AI to put the sentence in `otherConditions`, per the SPRINT note under 3.1.

## 2. Skill ids before Day 5
**The AI returns skill names only, never ids.** Code assigns the id:
1. Normalise the name (lowercase, spaces collapsed, punctuation and accents stripped). If it exactly matches a skill in the current list (`fixtures/skills.ts`), use that id.
2. Otherwise make a **provisional id** from its text: `new:docker-compose`.

The same function will later turn the list of skills a person pastes into ids (step 3.4), so a skill that's unlisted on both sides still matches itself.

**What the report does with unlisted skills (moved to step 3.4 after review).** A requirement whose alternatives are all unlisted counts as **not met**, because we can't prove it from a CV. In 3.4 the verdict line will say "Docker: not in our skill list yet, so it can't be matched with your CV", and the job report will say how many requirements are in that state, so nobody is misled by a low count. They're named from the ad and can appear in the ranking. Day 5's vocabulary replaces all this. **In 3.1 only the `new:` ids and the list of unlisted skills are produced.**

I'm not letting the AI pick from the list. That would put the AI in charge of identity, and the list has 17 skills against the thousands real ads use.

## 3. The word-for-word check carries over
Same normalisation as 1.5 (lowercase, collapsed spaces). It applies to **every** quote now:
- **A requirement or a language whose quote isn't in the ad is dropped.** An `otherConditions` item is dropped the same way.
- **Title, company and city** that aren't in the ad become `null`.
- **Work mode, years and start date** each carry a quote. If the quote isn't in the ad, the value becomes `null`.
- **Two cheap extra checks:** the years number must appear in its quote as a digit or a number word (English and German up to twelve), and a start date's year must appear in its quote. A value that fails is nulled, and its quote moves to `otherConditions` if it is in the ad, so nothing is lost silently.
- **Duplicates** (same quote and same skills) are merged.
- **The removed count** now lists what was removed and why. The page note "N items removed because they weren't in your ad" stays.
- **Known limit, as agreed:** a value whose words are in the ad passes. The "Google" case stays a recorded known case.

Skill names are not filtered by the quote. "Able to explain findings clearly…" legitimately names "Communication", which isn't in the words. The eval will count names not in their quote, so we can decide in 3.3 with data.

## 4. The Zod schema under strict mode
Every field is required, absences are `.nullable()`, there are no `.optional()`s and no length limits. Nested nullable objects and arrays of objects are documented as supported.

```ts
extractedAdSchema = z.object({
  title:    z.string().nullable(),
  company:  z.string().nullable(),
  location: z.string().nullable(),          // city only, as written in the ad
  workMode: z.object({ value: z.enum(["onsite","hybrid","remote"]), quote: z.string() }).nullable(),
  minYears: z.object({ years: z.number(), quote: z.string() }).nullable(),   // lower bound
  startDate: z.object({ date: z.string(), quote: z.string() }).nullable(),   // only an exact date; "YYYY-MM-DD"
  languages: z.array(z.object({ language: z.string(), levelWording: z.string().nullable(), quote: z.string() })),
  otherConditions: z.array(z.object({ quote: z.string() })),
  requirements: z.array(z.object({
    quote: z.string(),
    importance: z.enum(["must", "nice"]),
    skills: z.array(z.object({ name: z.string() })),   // alternatives: any one counts
  })),
})
```
- **"And" and "or":** each requirement item is already one engine requirement. The prompt, with a few examples, tells the AI to split "and" into separate items and to keep "or" as alternatives. Code can't check a split, but the eval (5) measures it.
- **First thing I'll do in implementation:** one smoke call with this schema to confirm Groq accepts it. If it rejects the nested nullable objects, I'll tell you and flatten them into sibling fields (`workMode` plus `workModeQuote`).

## 5. How 3.2's eval counts, against your answer key
- **Key format:** one file per ad, with the ad text and a hand-labelled list. Each item is a requirement as the engine would hold it: exact quote, `must` or `nice`, and its skill name(s), already split by the same "and"/"or" rules. Constraints are listed too (work mode, years, start date, languages with levels, city, title, company), each `null` if the ad doesn't state it.
- **Matching (changed after review):** an extracted requirement matches a key item **by quote only**: after normalising, one quote contains the other. A different skill name is counted separately as **name differs** (compared through the same name-to-id function) and never lowers the reading score.
- **Per ad and in total, `npm run eval` prints:**
  - **Found:** key must-haves matched as `must`. This is the count the 90% target uses.
  - **Wrong importance:** matched, but the AI said `nice` or the reverse.
  - **Missed:** key must-haves with no match.
  - **Invented:** extracted items matching nothing in the key. Items accepted in the key's `acceptedExtras` list don't count, so a real line the key forgot is added once, not argued every run. Anything left is judged invented.
  - **Name differs:** matched by quote, but the AI's skill name maps to a different id than the key's. Reported on its own, never counted as missed or invented.
  - **Removed by the check:** what the word-for-word check dropped, listed separately.
  - **Constraints:** each field is right, wrong, missed, or invented (the AI gave a value where the key says "not stated").
- **Practical notes:** it makes real Groq calls, one per ad, one at a time, **waiting between calls and retrying on a rate-limit error with a short backoff** (changed after review). It needs your `.env.local` and counts against the free tier. The injection ad stays in as a recorded known case.
- **Who writes the key (decided after review):** the 3.2 step needs 10 real public ads from you. Claude drafts each key from the ad text alone, without seeing the AI's output, and the owner reviews every must-have and constraint before the key is final. A key Claude drafts isn't fully independent of how Claude reads ads, so the owner's review is what makes it hand-labelled.

## 6. Tests and order of work
1. **Hand-worked table first.** After your OK I'll show a table of conversion cases with their expected results before any code. It covers the rows above plus the failure cases: an invented quote, a years number not in its quote, a start date with no year, a "Google" injection, an unknown language, "or" versus "and", duplicates and unlisted skills.
2. **Pure code, tested without the AI.** The conversion, the wording table and the id function run on hand-made "AI output" objects. (The report change moved to 3.4.) The AI's accuracy is the eval's job, not a unit test's.
3. **One smoke call** with the schema, then the extraction with the new prompt.
4. **Check for 3.1:** one real ad you give me comes back as schema-checked JSON on the page.
5. **Break the code on purpose** a few ways, as before.

## Four questions (all answered yes; see "Answers and changes" at the top)
1. **Skill ids:** the AI gives names only, code assigns ids, and unlisted skills get `new:` ids and count as not met with a visible flag. Is that OK?
2. **Skill names are not filtered by their quote.** The eval counts them instead. Is that OK?
3. **A value that fails its check is nulled and its quote moves to `otherConditions`.** Is that OK?
4. **A real public ad for the 3.1 check:** can you paste one when we get there?

On your OK I'll write the hand-worked table first and wait once more before the code.

---

# Hand-worked conversion table (approved, with the owner's four changes applied)

Every expected result below was worked out by hand from the rules in this plan and in docs/DECISIONS.md. The tests take their expectations from this table, never from the code's output. If a test fails, the question is whether the code or this table is wrong.

**How to read it.** The input is a hand-made "AI output" and the ad text it was read from. The function under test is `buildJob(extracted, adText, skills, meta)`. It returns the engine `Job` plus `removed` (items dropped, each with a reason), `moved` (quotes appended to `otherConditions`) and `unlisted` (provisional skills). `skills` is the current list of 17 in `fixtures/skills.ts`. "Untitled job" is the title used when none can be given.

**Removal reasons:** not in the ad; no skill named; number not in its quote; number out of range (0 to 50); no full date in the quote; date doesn't match the quote; level wording not in its quote; several cities.

**Order of moves into `otherConditions`:** after the AI's own items, in the order of the schema's fields: several cities (location), years, start date, unknown language.

## 0. Matching text against the ad (the normaliser)
It lowercases, collapses all spaces and line breaks to one space, turns curly quotes and long dashes into plain ones, and turns a non-breaking space into a space.

| # | AI's text vs the ad | Result |
|---|---|---|
| N1 | AI: "Solid SQL skills"; ad: "solid  SQL\nskills" | in the ad |
| N2 | AI: "Bachelor's degree"; ad has a curly apostrophe "Bachelor’s degree" | in the ad |
| N3 | AI: "5 - 7 years"; ad has an en dash "5 – 7 years" | in the ad |
| N4 | ad has a non-breaking space between two words, AI has a normal space | in the ad |
| N5 | AI's quote is empty or only spaces | never in the ad |
| N6 | AI: "Strong SQL skills"; ad: "Strong SQL for querying large data sets." | not in the ad |

## A. The three whole sample ads (golden)
The ad texts go into `fixtures/synthetic-ad-texts.ts`, as you pasted them, with a title line and a company and city line added at the top from each ad's own header fields. The "AI output" for each is written by hand the way a good reading would look.

| # | Ad | Expected result |
|---|---|---|
| A1 | Northwind, Operations Analyst | Equals the fixture job `northwind-operations-analyst`: `en C1`; Manchester; hybrid; `minYears 3`; `startDate null`; `otherConditions` = the right-to-work sentence, then the "start within two months" sentence; requirements in order: SQL, Excel, communication (must), `[power-bi, tableau]` (nice), Python (nice). `removed`, `moved`, `unlisted` all empty. |
| A2 | Brightwater, Financial Planning Analyst | Equals the fixture job `brightwater-financial-planning-analyst`: `en B2`; Bengaluru; onsite; `minYears 2`; `otherConditions` = degree, "Knowledge of Hindi or Kannada.", "Immediate joiners are preferred."; requirements: financial-planning, financial-modelling, power-bi (must), sql (nice). All three lists empty. |
| A3 | Fjordlight, Frontend Developer | Equals the fixture job `fjordlight-frontend-developer`: `en C1` (wording "C1"); `location null`; remote; `minYears 4`; `otherConditions` = the visa sentence; requirements: typescript, react (two items, same quote), git (must), `[vitest, jest]`, accessibility (nice). All three lists empty. |

## B. Level wording to CEFR level
A stated level (A1 to C2 as a whole word) wins. Otherwise the first whole-word key found on the folded wording (lowercase, accents stripped, ß as ss), longest key first. No key means `null`.

Keys: **C2** native speaker, native, mother tongue, muttersprache, muttersprachlich. **C1** business fluent, fluent, fliessend, verhandlungssicher. **B2** good, gut, gute, guten, guter. **B1** conversational. **A2** basic, grundkenntnisse, basiskenntnisse. "advanced", "intermediate" and "upper intermediate" are deliberately not keys.

| # | Wording | Level | | # | Wording | Level |
|---|---|---|---|---|---|---|
| B1 | "C1" | C1 | | B15 | "Conversational" | B1 |
| B2 | "C1 or better" | C1 | | B16 | "intermediate" | null |
| B3 | "fluent (C1)" | C1 | | B17 | "Basic" | A2 |
| B4 | "B2" | B2 | | B18 | "Grundkenntnisse" | A2 |
| B5 | "Fluent" | C1 | | B19 | "excellent" | null |
| B6 | "business fluent" | C1 | | B20 | "working knowledge" | null |
| B7 | "fließend" | C1 | | B21 | "" or no wording | null |
| B8 | "verhandlungssicher" | C1 | | B22 | "very good" | B2 (the key "good" is found; known quirk) |
| B9 | "native speaker" | C2 | | B23 | "upper intermediate" | null |
| B10 | "Mother tongue" | C2 | | B24 | "muttersprachlich" | C2 |
| B11 | "Muttersprache" | C2 | | B25 | "gute" | B2 |
| B12 | "Good" | B2 | | B26 | "Basiskenntnisse" | A2 |
| B13 | "gut" | B2 | | B27 | "fliessend" | C1 |
| B14 | "Advanced" | null | | | | |

## C. Language names to codes
English and German names, compared with accents stripped and case ignored.

| # | Code | Names | | # | Code | Names |
|---|---|---|---|---|---|---|
| C1 | en | English, Englisch | | C14 | ro | Romanian, Rumänisch |
| C2 | de | German, Deutsch | | C15 | hu | Hungarian, Ungarisch |
| C3 | fr | French, Französisch | | C16 | uk | Ukrainian, Ukrainisch |
| C4 | es | Spanish, Spanisch | | C17 | sv | Swedish, Schwedisch |
| C5 | it | Italian, Italienisch | | C18 | da | Danish, Dänisch |
| C6 | pt | Portuguese, Portugiesisch | | C19 | no | Norwegian, Norwegisch |
| C7 | nl | Dutch, Niederländisch | | C20 | fi | Finnish, Finnisch |
| C8 | pl | Polish, Polnisch | | C21 | cs | Czech, Tschechisch |
| C9 | tr | Turkish, Türkisch | | C22 | el | Greek, Griechisch |
| C10 | ru | Russian, Russisch | | C23 | hi | Hindi |
| C11 | ar | Arabic, Arabisch | | C24 | kn | Kannada |
| C12 | zh | Chinese, Chinesisch, Mandarin | | C25 | " english " | en (spaces and case ignored) |
| C13 | ja | Japanese, Japanisch | | C26 | "Klingon" | no code |

(Korean, ko, is included too, with Koreanisch.)

## D. Languages inside `buildJob`
| # | Input | Expected |
|---|---|---|
| D1 | English, wording "Fluent", quote "Fluent English, written and spoken." (in the ad) | `{ en, C1 }` |
| D2 | German, wording `null`, quote "German required" (in the ad) | `{ de, null }` |
| D3 | Klingon, quote in the ad | not in `languages`; quote appended to `otherConditions`; `moved` has it; nothing removed |
| D4 | English, quote not in the ad | dropped; `removed`: language, not in the ad |
| D5 | English, wording "fluent", quote "English required" (wording not in its quote) | `{ en, null }`; `removed`: language level, level wording not in its quote |
| D6 | English "C1" and English "B2" both given | one entry, the first: `{ en, C1 }` |
| D7 | English C1 then German B2 | both, in that order |

## E. Skill names to ids
(list = the 17 skills in `fixtures/skills.ts`; the slug lowercases, turns `+` into "plus", `#` into "sharp", `&` into "and", strips accents, and joins words with `-`)

| # | Name | Id |
|---|---|---|
| E1 | "SQL" | `sql` |
| E2 | "  excel " and "EXCEL" | `excel` |
| E3 | "Power BI" | `power-bi` |
| E4 | "power-bi" (a listed id) | `power-bi` |
| E5 | "Financial planning and analysis" (a listed name) | `financial-planning` |
| E6 | "Financial planning" (matches the listed id) | `financial-planning` |
| E7 | "Vitest" | `vitest` |
| E8 | "MS Excel" | `new:ms-excel` |
| E9 | "Docker Compose!" | `new:docker-compose` |
| E10 | "C++" | `new:c-plus-plus` |
| E11 | "C#" | `new:c-sharp` |
| E12 | "Node.js" | `new:node-js` |
| E13 | "Führerschein" | `new:fuhrerschein` |
| E14 | "???" | no id (the alternative is dropped) |
| E15 | "Docker" in two different requirements | the same id `new:docker`, one entry in `unlisted` (name as first written) |

## F. Requirements
| # | Input | Expected |
|---|---|---|
| F1 | Two items, same quote "Strong TypeScript and React.", skills [TypeScript] and [React] | two requirements: `typescript`, `react`, same quote |
| F2 | One item, nice, skills [Power BI, Tableau] | one requirement, `skillIds` `["power-bi", "tableau"]`, nice |
| F3 | One item, skills ["Excel", "excel", " "] | `skillIds ["excel"]` |
| F4 | An item with no skills (quote in the ad) | dropped; `removed`: requirement, no skill named |
| F5 | An item whose skills are only blank | dropped; `removed`: requirement, no skill named |
| F6 | Quote not in the ad | dropped; `removed`: requirement, not in the ad |
| F7 | Quote in the ad apart from case, spacing and line breaks | kept; the quote stored is the AI's string |
| F8 | Same quote and same skills twice | one requirement |
| F9 | Same quote and same skills, once must and once nice | one requirement, `must` |
| F10 | Only skill "Docker" (not in the list) | `skillIds ["new:docker"]`; `unlisted` = `[{ id: "new:docker", name: "Docker" }]` |
| F11 | Items in the order A, B, C | requirements in the order A, B, C; `must` and `nice` kept as given |

## G. Constraints, and what happens when a check fails
For start dates, the full dates in the quote are read in these formats: ISO (`2027-03-01`), `DD.MM.YYYY` (`01.03.2027`, `1.3.2027`), `1 March 2027` (also `1st March 2027`, `1. März 2027`) and `March 1, 2027` (also `March 1st, 2027`), with English and German full month names. A date counts only if it is a real calendar day. The AI's date is accepted only if it equals one of the dates read from its quote.

| # | Input | Expected |
|---|---|---|
| G1 | work mode hybrid, quote "Hybrid: three days a week in our Manchester office." (in the ad) | `remote "hybrid"` |
| G2 | work mode with a quote not in the ad | `remote null`; `removed`: work mode, not in the ad; nothing moved |
| G3 | work mode `null` | `remote null`; nothing removed |
| G4 | years 3, quote "At least 3 years of experience in an analyst role." | `minYears 3` |
| G5 | years 2, quote "2 to 4 years of experience in financial planning and analysis." | `minYears 2` |
| G6 | years 3, quote "mindestens drei Jahre Berufserfahrung" | `minYears 3` |
| G7 | years 3, quote "at least three years" | `minYears 3` |
| G8 | years 5, quote "At least 3 years…" | `minYears null`; `removed`: years, number not in its quote; quote moved to `otherConditions` |
| G9 | years 2, quote "at least 12 years" (2 is not the number 12) | same as G8 |
| G10 | years -1, or 60, with a quote in the ad | `minYears null`; `removed`: years, number out of range; quote moved |
| G11 | years with a quote not in the ad | `minYears null`; `removed`: years, not in the ad; nothing moved |
| G12 | start "2027-03-01", quote "Start: 1 March 2027" | `startDate "2027-03-01"` |
| G12b | the same date written "01.03.2027", "1.3.2027", "March 1, 2027", "March 1st, 2027", "1st March 2027", "1. März 2027", "2027-03-01" | each accepted: `startDate "2027-03-01"` |
| G13 | start "2027-03-01", quote "ab 01.03.2027" | `startDate "2027-03-01"` |
| G14 | start "2027-03-01", quote "start in March" (no full date) | `startDate null`; `removed`: start date, no full date in the quote; quote moved |
| G15 | start "2027-02-30" (impossible), quote "Start: 1 March 2027" | `startDate null`; `removed`: start date, date doesn't match the quote; quote moved |
| G15b | start "2027-02-30", quote "Start: 30 February 2027" (not a real day) | `startDate null`; `removed`: no full date in the quote; quote moved |
| G16 | start "2027-03-15", quote "start in March 2027" | `startDate null`; `removed`: no full date in the quote; quote moved (**was a known limit; now rejected**) |
| G16b | start "2027-03-02", quote "Start: 1 March 2027" | `startDate null`; `removed`: date doesn't match the quote; quote moved |
| G16c | quote "from 1 March 2027 to 30 June 2027", AI says "2027-06-30" | accepted: `startDate "2027-06-30"` (equals one of the dates in the quote) |
| G16d | start "2027-03-01", quote "ab 03.01.2027" (read as 3 January) | `startDate null`; `removed`: date doesn't match the quote; quote moved |
| G16e | start with "01.03.27" (two-digit year) or "Q1 2027" | `startDate null`; `removed`: no full date in the quote; quote moved |
| G17 | start with a quote not in the ad | `startDate null`; `removed`: start date, not in the ad; nothing moved |
| G18 | location "Manchester", in the ad | `location "Manchester"` |
| G19 | location "Berlin", not in the ad | `location null`; `removed`: location, not in the ad |
| G20 | title in the ad / title not in the ad / title `null` | kept / `"Untitled job"` with `removed` / `"Untitled job"`, nothing removed |
| G21 | company in the ad / not in the ad | kept / `null` with `removed` |
| G22 | the injection ad: company "Google", and "Google" is in the ad | `company "Google"` kept (**known limit**, recorded in DECISIONS and SPRINT 3.2) |
| G23 | location "Berlin or Munich" (an ad naming several cities), in the ad | `location null`; `removed`: location, several cities; the text "Berlin or Munich" moved to `otherConditions` |
| G23b | the AI follows the prompt: location `null` and an `otherConditions` item "Offices in Berlin, Hamburg and Munich" | `location null`; that quote in `otherConditions`; nothing removed |
| G23c | location "Stuttgart/Karlsruhe", "Berlin & Potsdam", "Köln oder Düsseldorf", "Hamburg und Bremen" (each in the ad) | each: `location null`, removed (several cities), text moved |
| G23d | location "Frankfurt am Main", "Berlin, Germany", "Halle (Saale)" (each in the ad) | each kept as written (a comma alone is not a separator) |

## H. `otherConditions`
| # | Input | Expected |
|---|---|---|
| H1 | Three items, all quotes in the ad | all three, in order |
| H2 | An item whose quote is not in the ad | dropped; `removed`: other condition, not in the ad |
| H3 | The same quote twice (different case or spacing) | one |
| H4 | One item plus moves from G23, G8, G14 and D3 | the AI's item first, then the moved quotes in this order: several cities, years, start date, unknown language |
| H5 | A moved quote equal to one already there | not added twice, and not listed in `moved` |
| H6 | The injection sentence returned as an item (quote in the ad) | kept, so it shows under "check this yourself" (**known limit**) |

## I. An empty reading
| # | Input | Expected |
|---|---|---|
| I1 | Everything `null` or empty | title `"Untitled job"`, company/location/`remote`/`minYears`/`startDate` all `null`, `languages []`, `otherConditions []`, `requirements []`; `removed`, `moved`, `unlisted` all empty |

## J. The schema itself
| # | Check | Expected |
|---|---|---|
| J1 | The JSON schema made from the Zod schema | every object lists all its properties as required, and has `additionalProperties: false` (Groq's strict mode) |

## Decisions (all five approved, with the four changes)
1. A job with no usable title is called "Untitled job".
2. Level wording that isn't in the table gives `null`. "advanced", "intermediate", "upper intermediate", "excellent" and "working knowledge" are not guessed. "very good" gives B2.
3. Years must be between 0 and 50, as well as appear in their quote.
4. Known limits stay known: the "Google" company (G22) and an injection sentence shown under "check this yourself" (H6). The wrong-day start date is no longer a limit: dates are read out of the quote (G16).
5. A requirement keeps the AI's own string as its quote, not the ad's exact characters (F7). Storing the ad's exact span would let the page highlight each quote later (a note is in SPRINT.md).
