# How to write a key (accuracy test, EC-0a)

Part of docs/PLAN-EVERY-CV.md, sections 9 and 10. About 10 minutes a pair. Do the ten pairs in any order, over several days.

## What a key is, and why you write it first

A key is your own answer sheet for one pair: for every requirement sentence of the ad, what a careful person would say after reading the CV. You write all ten keys BEFORE any test run. That way nothing can be fitted to what the product says: the product is later marked against your sheet, never the other way round. The ten pairs are in `fixtures/every-cv/pair-01` to `pair-10`. Every person, employer, school and ad in them is invented.

## What is in a pair folder

- `ad.txt`: the job ad. `cv.txt`: the CV.
- `cv.numbered.txt`: the CV with its line numbers, exactly as the page numbers them. **Use these numbers.** (The page removes email addresses and phone numbers first, so those lines show as "[email removed]".)
- `key.txt`: your sheet, blank. Open it in any text editor. Do not change the quoted sentences or the R and T numbers.

## The sheet, block by block

```
R1 [must] "<the ad's sentence>"
verdict:
cv line(s):
unsure:
why:
```

One block for each requirement sentence, in the ad's order. Fill in the four lines under it:

- **verdict:** one word.
  - **met**: a CV line clearly shows it. A careful hiring manager would say yes.
  - **partly**: a line shows something close, but not all of it (for example the ad wants five years and the CV shows two).
  - **none**: no line shows it.
- **cv line(s):** the numbers of the lines that show it, from `cv.numbered.txt`. Several are fine: `4, 7` or a range `7-9`. For met and partly write at least one line. For none leave it empty.
- **unsure:** leave empty. If you are truly torn between two verdicts, pick the weaker one and write `yes` here. Unsure rows are reported on their own and are not counted in the pass bar.
- **why:** one short sentence, if you like. Optional.

A block marked `[trait, not counted]` is a personal quality ("you are a reliable team player"). Leave it alone: it has nothing to fill.

## How to judge

Judge as a hiring manager reading the CV, not as the product would. Do not run the product while you write the keys, and do not look at its output for these pairs. If the CV shows a skill in different words from the ad, that can still be a met; use your own judgement.

You do NOT write a level. The accuracy run derives the key's level from your verdicts with the same rules as the product: only the must-haves count, partly counts as missing (like none), nice-to-haves never count, and the number of missing must-haves gives the level (none missing is Strong, one is Good, two is Stretch, three or more is Long shot).

## The example

`fixtures/every-cv/example/` is a tiny pair whose key is already filled in, to show the format and the three verdicts. It is marked "EXAMPLE ONLY, format demonstration, never sent to an AI" and is not one of the ten.

## Checking your sheet

`npm test` has a check for the sheets (tests/everyCvFixtures.test.ts). It only checks that a sheet is well formed: a real verdict word, line numbers that exist, the quoted sentences unchanged. It cannot tell whether your answer is right. A sheet that is completely blank passes; a half-filled one is reported as incomplete, which is normal while you are in the middle of it.
