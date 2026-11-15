STATUS: approved by the owner with five changes (listed below). Run 0 (no prompt change) is being built and run first. Nothing in the prompt changes until the owner says so. Careful lane.

# Plan for 3.3: tune the prompt until at least 90% of must-haves are found and nothing is invented

The check (docs/SPRINT.md): found 116 or more of 128 must-haves, invented 0, on two full runs in a row with the same fingerprint. Rules are judged on the tuning set only (ad-01 to ad-08, plus the barista known case). ad-09 and ad-10 stay the holdout.

## Changes made when the plan was approved
1. **The tuning-set goal is 94 or more of 100, invented 0, wrong importance 0** (not 90), because the final check counts the holdout too: 116 of 128 needs the holdout's 28 to be close to the tuning set's level.
2. **Every example and sample line was checked** against all ten ad files and against each other (section 6). No example word of 5 or more letters appears in any real ad or in another example.
3. **R7 is on hold.** It is added only if the tuning set is still short after run 3.
4. **Budget** (section 8): the number of Groq calls and tokens for the whole plan, and how it is split over days. If a daily limit stops a run, the run is marked incomplete and I stop and tell the owner.
5. **Rules are short**, and the size of `INSTRUCTIONS` is reported before and after each rule (section 5).

## 1. Starting point
Tuning set only (first full run, nothing tuned): found **74 of 100**, missed 25 must-haves plus 1 nice-to-have, wrong importance 1, invented 9, name differs 35.

## 2. The ad-02 key against the ad (checked)
The two quotes the AI returned that the key did not have are ad-02 **line 30** and **line 35**, under the heading **`Requirements:` (line 24)**, in the same list as every keyed requirement (lines 27 to 37). Both lines are already keyed (line 30 as "Time management" and "Prioritization", line 35 as "Best practices"), so the extras are the AI's other reading of keyed lines. By the rule of 2026-11-14 (simpler reading in the key, other reading accepted) the key should have accepted them: **a key gap, fixed by K1** (add both lines to ad-02's `acceptedExtras`).

## 3. How alternatives are represented (checked in the code)
Several names in one item mean "any one is enough": the prompt says so, the schema describes `skills` as "Alternatives", `buildJob` keeps all names in one `skillIds`, and the engine meets a requirement when any one is met. If the AI puts two required skills in one item, the fit is overstated. First run, tuning set: widened 4 times (ad-04 once, ad-07 three times), narrowed 8 times (only some alternatives kept). The eval counted both only as "name differs", which never reaches the score. C5 counts them.

## 4. Finding groups from the first run (tuning set only)

| Group | Findings | Rule |
|---|---|---|
| (a) soft traits skipped or merged | 12 missed | R2 |
| (b) several skills in one line merged | 12 missed + 1 nice, 4 widened | R1 |
| (c) alternatives split or dropped | 5 invented, 8 narrowed, 1 missed | R3, R3b |
| (d) duty lines read as requirements | 2 invented | R4 |
| (e) "#LI-" tag read as a work mode | 2 constraint inventions | C1 (code), R5 |
| (f) name from a neighbouring line | about 6 | R6 |
| (g) "is a plus" on the wrong item | 1 wrong importance | R7, **on hold** |
| key gap | 2 invented | K1 |
| vocabulary only | about 20 name differs | Day 5 |

Missed must-haves: 12 + 12 + 1 = 25. Invented: 5 + 2 + 2 = 9.

## 5. The rules (short wording; sizes of `INSTRUCTIONS`)

`INSTRUCTIONS` now: **3,347 characters**. Each rule is one bullet added to `lib/ai/readJob.ts`. R1 and R3 **replace** the two existing bullets about "and" lists and alternatives (245 characters), so the net growth is smaller. Sizes are measured again, and reported, when each rule is actually added.

| Order | Rule (the draft text) | Added | Size after (adding only) |
|---|---|---|---|
| R4 | Only text about what the candidate must or should have is a requirement. Text about what the employee will do (under headings like "Typical week" or "A day on the farm") is a duty: write no items from it, even if it names a tool. | +232 | 3,579 |
| R3 | Alternatives ("A or B", "A, B or C", "A / B", "A or equivalent") are ONE item listing every alternative named. Never split them and never keep only some. | +156 | 3,735 |
| R3b | A line with years that also names fields ("4 years in A, B or C") gives the years in minYears and the fields as an item. A vague phrase ("a parallel role") is not a skill. | +174 | 3,909 |
| R1 | One item per skill: when a sentence names several skills with "and", "as well as", "both ... and" or commas, write one item for each, all with the same quote. Put several names in one item only for alternatives. | +214 | 4,123 |
| R2 | Personal qualities and ways of working that the ad asks for (being tidy, or good with animals) are requirements too: write an item for each, with a short plain name. | +168 | 4,291 |
| R5 | A hashtag (such as "#QQ-staff") is a label, not a sentence. Never use one for workMode. | +90 | 4,381 |
| R6 | Name a skill only if its own quote names or clearly means it. Never take a name from a neighbouring sentence. | +112 | 4,493 |

If R1 and R3 replace the two old bullets, the end size is about **4,250 characters** (+27%).

What each rule should fix, and how it could backfire:
- **R4** fixes 2 invented. Backfire: an ad with its real requirements under a duty-sounding heading loses items.
- **R3 and R3b** fix 5 invented, 8 narrowed (not scored), 1 missed. Backfire: a list that mixes "and" and "or" gets merged wrongly; vague "years" lines produce vague items.
- **R1** fixes up to 12 missed plus 1 nice, and the 4 widened. Realistic: 8 to 12. Backfire: a fixed phrase split in two, whose extra half counts as invented.
- **R2** fixes up to 12 missed. Realistic: 8 to 12. Backfire: qualities invented from duty text or the company description.
- **R5** (with C1) fixes 2 constraint inventions. Backfire: an ad that gives its work mode only as a tag reads as not stated (the agreed decision).
- **R6** fixes about 6 name mismatches (not scored, but wrong skill ids). Backfire: names too literal, items dropped.

## 6. Example check (change 2): result
Criterion: no word of 5 or more letters in an example may appear in any of the ten real ads (a match also counts when one word starts with the other, so "background" hits "backgrounds"), and none may appear in two different examples. The rules' own vocabulary (years, fields, skills, names, write, label, being) and plain connectors are not examples.

First candidates failed: "workshop" (a heading example), "children", "display" and "expect" (sample lines) appear in the ads, and "glass" was shared by two samples. They were replaced. **Final result: all clear, 15 of 15 examples and samples pass.**

| Where | Example or sample line |
|---|---|
| R2 | being tidy, or good with animals |
| R3 | A or B, A, B or C, A / B, A or equivalent |
| R3b | 4 years in A, B or C; a parallel role |
| R4 | headings "Typical week", "A day on the farm" |
| R5 | #QQ-staff |
| sample S1a | You can throw pots, glaze them and fire a kiln. |
| sample S1b | Able to make sourdough, laminated dough and pastry cream. |
| sample S1c | A knack for arts and crafts. |
| sample S2 | You are punctual, calm and kind to pupils. |
| sample S3 | Can lay Tuscan, Venetian or Lombard plaster. |
| sample S3b | 3+ years in pottery, tiling or glasswork. |
| sample S3c | 3+ years in an allied role. |
| sample S4 | Your assignments: Repair the greenhouse gutters. What we ask: Welding certificates. |
| sample S5 | #ZZ-telework |
| sample S6 | Holds a forklift licence. Can pickle cucumbers. |

The samples differ from the rule examples on purpose, so a sample is a real test and not a copy of the rule's own example.

## 7. Hand-worked expectations for the samples (prompt-check ads)

| Rule | Sample | Correct reading |
|---|---|---|
| R1 | S1a | 3 items (throw pots, glaze, fire a kiln), same quote |
| R1 | S1b | 3 items (sourdough, laminated dough, pastry cream) |
| R1 (not over-split) | S1c | 1 item |
| R2 | S2 | at least 1 item covering the line (split readings accepted) |
| R3 | S3 | ONE item: Tuscan, Venetian, Lombard plaster |
| R3b | S3b | years 3, plus ONE item with the three fields |
| R3b (vague) | S3c | years 3, no requirement item |
| R4 | S4 | one item, from the line under "What we ask" only |
| R5 | S5 | work mode not stated |
| R6 | S6 | the second item is named for pickling, not for the forklift or the licence |

They live in a separate committed folder, `fixtures/prompt-checks/`, run with `npm run eval -- --checks`, so the 10-ad eval keeps its 11 calls. Deliberate breaks: for each rule, run its samples with the rule removed (they should fail as the first run did) and with the rule inverted (they should fail the other way); a sample that does not flip proves nothing.

## 8. Budget (change 4)

**Limits** (Groq's rate-limit page, openai/gpt-oss-120b; the table is labelled Developer plan and the page has no separate free column): 30 requests a minute, 1,000 a day, **8,000 tokens a minute, 200,000 tokens a day**. Limits come back as HTTP 429. Run 0 reads the real limits from Groq's response headers.

**Calls for the whole plan:**

| Part | Calls |
|---|---|
| Full evals: run 0, runs 1 to 4, the final two | 7 x 11 = 77 |
| `--show` for ad-02 and ad-07 | 2 |
| Prompt-check samples: 10 samples x (3 runs of the kept version + 1 "rule removed" + 1 "rule inverted") | 50 |
| **Total** | **129** (140 if R7 is added) |

**Tokens (rough, to be replaced by the measured numbers from run 0):** a full-eval call is about 3,000 to 3,500 tokens in (prompt about 850, the schema, the ad about 1,400) and 2,000 to 4,000 out (reasoning plus the JSON), so about 5,000 to 8,000; a sample call about 2,000 to 4,000. That gives about 65,000 tokens per full run, 150,000 for the sample checks, and **about 600,000 tokens in total (range 450,000 to 900,000)**.

**Against the limits:** the 200,000-token daily limit allows about 2 full runs a day, so the plan would not fit in a day: about 3 to 5 days. The 8,000-a-minute limit means one call uses most of a minute, so a full run may take 10 to 15 minutes, not 2, with the retries (5, 15, 45 seconds) doing most of the waiting.

**How I would split it, if the limits are the ones above:**
- Day A: run 0, the two `--show` calls, run 1.
- Day B: run 2 and the R1 samples.
- Day C: run 3, run 4 and the remaining samples.
- Day D: the final two full runs.

**Cuts that save calls, if you want them:** 2 runs per sample instead of 3 (saves 10 calls), and "rule inverted" only for R1, R2 and R3 (saves 14). A daily limit that stops a run marks it incomplete: I stop and tell you, and do not rerun until you say. Before any prompt-check run I will give the measured token numbers.

## 9. Run 0 (no prompt change), in this order

1. **K1:** add ad-02 lines 30 and 35 to its `acceptedExtras`; one line in DECISIONS.md.
2. **C1:** a work-mode quote that is only hashtags is rejected (reason "tag, not a sentence"; not moved to conditions). Hand table: `#LI-onsite`, `#LI-remote`, `#remote`, `#LI-onsite #LI-VA1` rejected; `Hybrid: three days a week #LI-hybrid` and `We work remotely` accepted. Breaks: remove the guard; reject any quote containing "#"; reject only the prefix "#LI"; reject quotes with fewer than 3 words.
3. **C4:** `npm run eval -- --show <ad id>` prints the AI's reading next to the key. It refuses ad-09, ad-10 and any holdout ad **before making any AI call**. Test for the refusal and a deliberate break that removes it.
4. **C5:** "widened" and "narrowed" counts per ad and in the totals (information only, never in the target). Expected from the first run: widened 4, narrowed 8 on the tuning set.
5. **German level, option B:** intensified forms ("very good", "sehr gut", "really good", "very fluent") read as not stated (null). Hand table: very good, sehr gut, really good, very fluent give null; good, gut give B2; native gives C2; a stated level still wins ("very good (B2)" gives B2). The ad-07 key stays null.
6. **Added for the budget:** the report prints the tokens used and the rate limits Groq returned, so the budget above can be replaced by measured numbers.
7. Run the full tests, `tsc`, lint and build; run the eval once with the prompt unchanged; run `--show ad-02` and `--show ad-07`; commit and push; stop.

Expected from run 0 on the tuning set: found 74 of 100 (it can differ by a few, because the model is not deterministic), invented 7, no work-mode inventions, widened 4, narrowed 8, and ad-07's German level right.

## 10. Order of runs after run 0 (one or two rules per run, tuning set only)

| Run | Change | Expected on the tuning set (found / invented) |
|---|---|---|
| 1 | R4, R3, R3b | about 75 / 0 |
| 2 | R1 | about 83 to 87 / 0 to 2 |
| 3 | R2 | about 90 to 95 / 0 to 2 |
| 4 | R6 (R7 only if still short) | about 92 to 96 / 0 |
| 5 and 6 | no change: the final two full runs in a row | tuning set 94 or more of 100, whole set 116 or more of 128, invented 0 |

A rule is kept only if its group improves and invented does not rise elsewhere; otherwise it is reverted before the next run.

## 11. Constraint findings: prompt, code or key
- **ad-01 and ad-02 work mode ("#LI-" tag):** code first (C1), prompt second (R5).
- **ad-02 location missed:** probably the prompt (the AI most likely returned null because the ad lists "Frankfurt am Main" and "Frankfurt"); `--show ad-02` in run 0 shows what it returned.
- **ad-07 company wrong:** probably key or scoring, not the prompt (the ad writes "DSV" and "DSV Holding Germany GmbH"); `--show ad-07` shows what it returned.
- **ad-07 German level:** code (the wording table) and the key, not the prompt. Decided: option B, intensified forms read as not stated.

## 12. Keeping ad-09 and ad-10 unseen
Reports show them as one block of totals; no `--reveal`; no per-item output read; `--show` refuses them before any AI call. Every rule is judged on ad-01 to ad-08 and the known case only. The holdout totals in the report are not used to accept or reject a rule. No ad text, and nothing taken from the holdout ads, goes into the prompt; the examples and samples above were checked against all ten ads.

## 13. Run 0 result (2026-11-15, prompt unchanged)

Counts only. The holdout (ad-09, ad-10) is in the totals and nothing else.

**First run against run 0, per ad (tuning set):**

| Ad | First run: found | invented | Run 0: found | invented |
|---|---|---|---|---|
| ad-01 | 6 of 9 | 0 | 5 of 9 | 0 |
| ad-02 | 12 of 13 | 2 | 8 of 13 | 0 |
| ad-03 | 13 of 14 | 0 | 13 of 14 | 0 |
| ad-04 | 8 of 13 | 2 | 9 of 13 | 3 |
| ad-05 | 15 of 23 | 2 | 14 of 23 | 0 |
| ad-06 | 7 of 8 | 3 | 4 of 8 | 0 |
| ad-07 | 8 of 15 | 0 | 8 of 15 | 0 |
| ad-08 | 5 of 5 | 0 | 5 of 5 | 13 |
| **Tuning set** | **74 of 100** | **9** | **66 of 100** | **16** |
| Holdout (totals only) | 17 of 28 | 1 | 17 of 28 | 0 |
| **All ten ads** | **91 of 128** | **10** | **83 of 128** | **16** |

(The first run's two ad-02 "invented" were the key gap fixed by K1, so they are not model variation. Run 0 also counts the work-mode guard: the "#LI-onsite" tag was removed twice, no work-mode inventions.)

**The finding:** the same prompt gave 8 fewer found and 7 more invented on the tuning set (8 fewer found and 6 more invented on all ten ads) between two runs. Single items moved by as much as 4 found (ad-02) and 13 invented (ad-08, duty lines read as requirements). Any rule that moves the tuning set by less than about this much cannot be judged from one run. This is why the plan measures the noise first (a run with temperature 0, a fixed seed and a fixed reasoning effort, three times, on the four ads that moved most) before any rule goes into the prompt.

**Budget, redone with the measured numbers (replaces the rough numbers in section 8):**
- One full-eval call costs about **4,400 tokens** (27,567 in, 20,694 out over 11 calls).
- One full run (11 calls) is about **48,000 tokens**; the 200,000-token daily limit allows about **4 full runs a day** (fewer once `--show` calls and sample checks are added).
- The 8,000-tokens-a-minute limit is the tight one: after the 11th call only 74 tokens were left in the minute. The 3-second delay plus the retries got through with 0 failed ads.
- Whole plan: 7 full runs about 340,000 tokens, `--show` calls about 5,500 each, and 50 sample calls (a sample call still carries the prompt and schema, so about 3,500 to 4,500 tokens, not 2,000 to 4,000): about 200,000. Total about **550,000 tokens, about 3 days at the daily limit** (Day A: noise test and run 1; Day B: runs 2 and 3 and samples; Day C: run 4, samples and the final two runs).
- If a daily limit stops a run it is marked incomplete and I stop and tell the owner.

## 14. Noise test result (2026-11-15)

**What was done:** after run 0, the generation settings were fixed in one object (temperature 0, a fixed seed, reasoning effort medium; a test with the real Groq provider on a fake fetch proves all three reach the request body, and the SDK gives no warnings). Then ad-02, ad-04, ad-06 and ad-08 (the four that moved most) were read three times, prompt unchanged. 12 calls, 0 failed, no rate-limit error. Input tokens were identical in every repeat, so the prompt was the same.

| Ad | Repeat 1: found / wrong importance / invented / tokens | Repeat 2 | Repeat 3 |
|---|---|---|---|
| ad-02 | 12 of 13 / 0 / 0 / 5,337 | 12 of 13 / 0 / 0 / 5,573 | 12 of 13 / 0 / 0 / 5,107 |
| ad-04 | 11 of 13 / 0 / 2 / 5,251 | 12 of 13 / 0 / 5 / 5,456 | 7 of 13 / 0 / 0 / 4,867 |
| ad-06 | 4 of 8 / 1 / 0 / 4,135 | 6 of 8 / 1 / 0 / 4,515 | 6 of 8 / 1 / 3 / 4,598 |
| ad-08 | 5 of 5 / 0 / 5 / 4,044 | 3 of 5 / 0 / 5 / 4,329 | 5 of 5 / 0 / 6 / 4,531 |

**Criterion, fixed in advance by the owner:** with temperature 0, a fixed seed and medium effort the reader should repeat itself. **Result: failed.** ad-04 gave 7, 11 and 12 found and 0, 2 and 5 invented on the same text; ad-06 gave 0, 0 and 3 invented; ad-08 gave 3 to 5 found. Only ad-02 was stable. Output token counts differ in every repeat, so the model really answers differently. Groq documents the seed as a best effort ("determinism is not guaranteed"), and gpt-oss always reasons.

**What it means:** a single full run cannot judge a rule, with or without these settings. A change of a few found or a few invented between two runs is not evidence. The settings are kept anyway (no harm, in the fingerprint).

**The new judging method:**
- Every prompt version gets **two runs of the tuning set** (ad-01 to ad-08).
- The **baseline** at the current settings is completed for ad-01, ad-03, ad-05 and ad-07, two repeats each (ad-02, ad-04, ad-06 and ad-08 already have three), so the baseline has two or more readings of every tuning ad.
- A rule is judged **first on the lines it targets** (the items the rule is about: counted per line, over both runs), **then on the tuning-set totals**. How much improvement counts as a keep is the owner's decision, not fixed here.
- Run 1 is **R4, R3, R3b and R8** (R8: the same city written twice is one city). Then R1, R2 and R6, one version each.
- ad-09 and ad-10 stay unseen; they are in the totals of the final two full runs only.

**Budget, redone:** a tuning-set run (8 calls) is about 35,000 tokens.
- Baseline (ad-01, 03, 05, 07, two repeats = 8 calls): about 36,000
- Four versions x 2 runs x about 35,000: about 280,000
- Final two full runs (11 calls each, about 48,000): about 96,000
- Sample checks (about 50 calls): about 200,000
- Sum about 612,000; with `--show` calls and one or two reruns, **about 650,000, about 3 to 4 days** at the 200,000-a-day limit.
- Used so far today: **about 170,000** tokens. The earlier figure of 122,000 left out the first full run (about 48,000).

## 15. Keep rule and target lines for run 1 (PROPOSED, NOT YET APPROVED)

Nothing in this section is decided. The owner approves, changes or rejects it before run 1 is judged.

**Keys changed first (2026-11-15):** four quotes were added to acceptedExtras (ad-01#7, ad-04#12, ad-07#5, ad-07#7; reason in DECISIONS). All counts below are "under the current keys": an invented line that a current acceptedExtras quote covers is not counted. The saved reports predate the change, so their invented numbers are re-counted from their own invented lines (no new AI call).

### The proposed keep rule

A prompt version is kept when, **in both of its runs** of the tuning set:
1. its **target count** beats every baseline reading taken with the same settings (lower is better; if the baseline's best is 0, the version must also be 0);
2. the tuning-set **found total** is not below the baseline's lowest reading;
3. **invented outside the target** is not above the baseline's highest reading.

"Baseline reading k" means the k-th same-settings reading of each tuning ad, summed over the 8 ads, for k = 1 and 2 (the third noise repeat exists for four ads only and is used for per-ad target counts, not for totals). Only same-settings readings (temperature 0, fixed seed, medium effort) are baseline. Default-settings runs are context.

### What is counted (run 1: R4, R3, R3b, R8)

| Target | What is counted (lower is better) |
|---|---|
| **R4** (duty lines) | Invented items (not accepted by the key) whose quote lies in the ad's duty section. Each item counts, even with the same quote. Duty sections, as ad line numbers: ad-01 14-19, ad-02 15-23, ad-03 65-89, ad-04 14-23, ad-05 28-35, ad-06 33-44, ad-07 45-66, ad-08 9-15 (from the "You will", "Responsibilities", "What you'll do", "Your tasks" and "Key Responsibilities and Success Measures" sections the key notes name). |
| **R3 plus R3b** (alternatives, and years with fields) | 13 key lines: the 10 alternative lines ad-01#5, ad-03#0, ad-04#0, ad-04#3, ad-04#4, ad-05#9, ad-05#14, ad-06#0, ad-06#9, ad-07#0, and the 3 years lines ad-01#0, ad-02#0, ad-05#13. A line is a defect when its key item is missed, or narrowed (the AI gave fewer alternatives), or an invented item overlaps its quote. The count is the number of defect lines, at most 13. |
| **R8** (same city twice) | ad-02 location: 0 if the verdict is right, 1 otherwise. Guard: no other tuning ad may get a location verdict other than right or notStated (none did in any of the 15 saved readings). |
| **Outside the target** | Invented items (current keys) that are in neither the R4 count nor an overlap with an R3/R3b line. |

### Baseline readings, same settings (the 12 noise readings)

Per ad: found / R4 / R3+R3b defect lines of its lines / R8 / invented / outside.

| Ad | Reading 1 | Reading 2 | Reading 3 |
|---|---|---|---|
| ad-02 | 12 of 13 / 0 / 1 of 1 / 1 / 0 / 0 | 12 of 13 / 0 / 1 of 1 / 1 / 0 / 0 | 12 of 13 / 0 / 1 of 1 / 1 / 0 / 0 |
| ad-04 | 11 of 13 / 0 / 2 of 3 / - / 1 / 0 | 12 of 13 / 0 / 3 of 3 / - / 4 / 1 | 7 of 13 / 0 / 0 of 3 / - / 0 / 0 |
| ad-06 | 4 of 8 / 0 / 2 of 2 / - / 0 / 0 | 6 of 8 / 0 / 2 of 2 / - / 0 / 0 | 6 of 8 / 0 / 2 of 2 / - / 3 / 0 |
| ad-08 | 5 of 5 / 5 / 0 of 0 / - / 5 / 0 | 3 of 5 / 5 / 0 of 0 / - / 5 / 0 | 5 of 5 / 6 / 0 of 0 / - / 6 / 0 |
| **Sum of the four ads** | found 32, R4 5, R3+R3b 5, R8 1, invented 6, outside 0 | found 33, R4 5, R3+R3b 6, R8 1, invented 9, outside 1 | found 30, R4 6, R3+R3b 3, R8 1, invented 9, outside 0 |

**Still missing:** the baseline for ad-01, ad-03, ad-05 and ad-07 (two readings each, about 36,000 tokens). Until it exists, the 8-ad baseline cannot be computed and the keep rule cannot be applied. The numbers above cover 6 of the 13 R3/R3b lines (ad-02#0, ad-04#0, #3, #4, ad-06#0, #9); the other 7 lines are in the four missing ads.

### Context only: default settings (not baseline)

| Run | Found (8 ads) | R4 | R3+R3b lines | R8 | Invented (current keys) | Outside |
|---|---|---|---|---|---|---|
| First full run (74 of 100 found) | 74 | 2 | 6 of 13 (no narrowed data in that report, so a lower bound) | 1 | 7 | 0 |
| Run 0 (66 of 100 found) | 66 | 13 | 11 of 13 | 1 | 15 | 0 |

(The same two runs on the four noise ads only: found 32 and 26, R4 2 and 13, R3+R3b 2 and 6, invented 5 and 15.)

### Notes on the rule
- With the baseline above, R4 must come in below 5 or whatever the full baseline's best turns out to be, and R8 must be 0 (the baseline's best is 1).
- The baseline's own spread is large (R3+R3b 3 to 6, found 30 to 33 on four ads, invented 6 to 9), so criterion 1 asks for a version to beat the best baseline reading, not the average.
- The rule looks at one version at a time. For the later versions (R1, R2, R6) their own target lines are proposed when they are due.
