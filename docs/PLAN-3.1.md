STATUS: proposed, not approved, no code written

I checked Groq's strict-mode page. These are the points that affect the schema:
- Every field must be required, and every object must be closed.
- Nullable fields, nested objects, arrays of objects, enums and numbers are all supported.
- The page lists no length or format limits, so I'll avoid them.
- Strict mode and streaming don't mix.

Here is the plan for step 3.1. I haven't written any code.

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

**What the report does with unlisted skills.** A requirement whose alternatives are all unlisted counts as **not met**, because we can't prove it from a CV. The verdict line says "Docker: not in our skill list yet, so it can't be matched with your CV". The job report also says how many requirements are in that state, so nobody is misled by a low count. They're named from the ad and can appear in the ranking. Day 5's vocabulary replaces all this.

I'm not letting the AI pick from the list. That would put the AI in charge of identity, and the list has 20 skills against the thousands real ads use.

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
- **Matching:** an extracted requirement matches a key item when their normalised quotes are equal and they share a skill id (via the same name-to-id function).
- **Per ad and in total, `npm run eval` prints:**
  - **Found:** key must-haves matched as `must`. This is the count the 90% target uses.
  - **Wrong importance:** matched, but the AI said `nice` or the reverse.
  - **Missed:** key must-haves with no match.
  - **Invented:** extracted items matching nothing in the key. Items accepted in the key's `acceptedExtras` list don't count, so a real line the key forgot is added once, not argued every run. Anything left is judged invented.
  - **Removed by the check:** what the word-for-word check dropped, listed separately.
  - **Constraints:** each field is right, wrong, missed, or invented (the AI gave a value where the key says "not stated").
- **Practical notes:** it makes real Groq calls, one per ad, one at a time. It needs your `.env.local` and counts against the free tier. The injection ad stays in as a recorded known case.
- **Who writes the key:** the 3.2 step needs 10 real public ads from you. I'd draft each key from the ad text alone, without looking at the AI's output, as I did for the three sample ads, and you'd review it. A key I draft isn't fully independent of how I read ads, so your review is what makes it hand-labelled. Your call at 3.2.

## 6. Tests and order of work
1. **Hand-worked table first.** After your OK I'll show a table of conversion cases with their expected results before any code. It covers the rows above plus the failure cases: an invented quote, a years number not in its quote, a start date with no year, a "Google" injection, an unknown language, "or" versus "and", duplicates and unlisted skills.
2. **Pure code, tested without the AI.** The conversion, the wording table, the id function and the report change run on hand-made "AI output" objects. The AI's accuracy is the eval's job, not a unit test's.
3. **One smoke call** with the schema, then the extraction with the new prompt.
4. **Check for 3.1:** one real ad you give me comes back as schema-checked JSON on the page.
5. **Break the code on purpose** a few ways, as before.

## Four questions
1. **Skill ids:** the AI gives names only, code assigns ids, and unlisted skills get `new:` ids and count as not met with a visible flag. Is that OK?
2. **Skill names are not filtered by their quote.** The eval counts them instead. Is that OK?
3. **A value that fails its check is nulled and its quote moves to `otherConditions`.** Is that OK?
4. **A real public ad for the 3.1 check:** can you paste one when we get there?

On your OK I'll write the hand-worked table first and wait once more before the code.
