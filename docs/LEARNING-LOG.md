# Learning log

One line per step: what you learned, in your own words. This becomes the case study.

| Date | Step | What I learned |
| --- | --- | --- |
| 2026-11-13 | 1.1 | Groq's free key took two minutes to make, and it goes only into Vercel and .env.local, never into a chat. |
| 2026-11-13 | 1.2 | The starter app came with its own git history and a wrong package name, so I checked what it left behind before the first commit. |
| 2026-11-13 | 1.3 | A settings file blocks Claude Code from reading my .env files, so the secrets rule is backed by a setting, not only by words. |
| 2026-11-13 | 1.4 | Vercel redeploys on every push to GitHub, and the live site needs its own copy of the keys, because .env.local stays on my laptop. |
| 2026-11-13 | 1.5 | The AI can obey text hidden in an ad, but not every time. A word-for-word check stops invented facts, though it wouldn't have caught the "Google" case, because the word was in the ad. The prompt, the schema and the check each guard against something different. |
| 2026-11-14 | 2.1 | Before an ad can become data, every kind of line needs a rule written down once: "and" splits a line, "or" keeps it as alternatives, years go into one number, and anything that can't be judged stays as an exact quote. With those rules the same ad always turns into the same data, and I can check it by hand. |
| 2026-11-14 | 2.2 | I wrote down the expected level for every pairing by hand before any code existed, so when the tests passed I could trust them, and when I broke the code on purpose they failed. Working them out also showed that most realistic pairings end as Long shot, so I had to design the profiles to see the other levels. |
| 2026-11-14 | 2.3 | A job only counts as "unlocked" if skills alone make it a Strong match, so a job blocked by years or city never gets counted, and I show why it is blocked. The ranking is greedy, and I only trust its order because every tie is settled by a written rule, so the same data always gives the same list. |
| 2026-11-14 | 2.4 | A printout is only trustworthy if I decide what it should say first: I wrote Sam's and Ana's full reports by hand, and the real command had to match them character for character. Most of the work in a report is saying why: "your skills fit, but years decide this" is a different message from "you are missing skills", even when both are Long shot. |
| 2026-11-14 | Day 2 | In one day I went from a blank engine to a printed report I could read and check, because I wrote down every rule and every expected answer before the code and then tried to break the code on purpose. The part that surprised me most was that the realistic examples nearly all came out as Long shot, so the useful work was in explaining why. |
| 2026-11-15 | Day 3 | Tuning the prompt that reads job ads, every change fixed the ads it targeted but made other ads worse, so I closed 3.3 on the original prompt (75 and 76 of 100 found, target was 94, not met) instead of shipping a change that only looked better in one place. |
| 2026-11-15 | Day 3 | A rule can pass its own test and still hurt the product, so I now measure the side effects, not only the target. |
| 2026-11-15 | Day 3 | The AI reads the ad once and plain code does the matching and counting. That is why deleting a skill updates the page instantly with no new AI call, and why the page can say "not judged" instead of guessing. |
| 2026-11-15 | Day 3 | The page must not say anything the code can't know. The engine's sentence said "nothing else stands in the way" while location and language were not checked, so I had it rewritten from the counts and tested. |
| 2026-11-16 | Day 4 | Let the AI point and let code check: the AI gives a line number and a quote, plain code checks the quote is really inside that line, and the page shows the CV line, never the AI's own words. |
| 2026-11-16 | Day 4 | One text for everyone: I remove contact details first and number the lines after, so what the person sees, what the AI reads and what the evidence quotes are the same lines. |
| 2026-11-16 | Day 4 | A test must be able to fail: I broke the code on purpose 18 times and the tests caught 16. A break that survives means a missing test or code that does nothing, and I have to show which. |
| 2026-11-16 | Day 4 | Measure the number you can control: the reader is noisy even at temperature 0, so I counted invented skills (target 0), kept "found" as information only, and ran a calibration run that did not count. |
| 2026-11-16 | Day 4 | Test the combinations, not just examples: the page said "the ad does not say" about a city the ad did name, because no example had a city without a work mode. A grid over 2,048 combinations of ad and settings now checks it. |
| 2026-11-16 | Day 4 | A surviving break is a question, not a failure: it means a missing test or code that does nothing. I showed which, deleted the dead filter, and let a grid test guard the fact instead. |
| 2026-11-16 | Day 5 | Fix the pass lines before you measure: what "good enough" means (few wrong merges, no forbidden merges, at least 3 in 4 found) was written down before any result existed, so nobody can move the goalposts later. |
| 2026-11-16 | Day 5 | A score on the data you tuned on proves little: "nothing unmapped" on the tuning ads was built in; the honest number is on ads the vocabulary never saw, and that gets one look only. |
| 2026-11-16 | Day 5 | Short words are risky for fuzzy matching: "shift" became Swift. The fix was a rule (no spelling help up to 5 letters), not a patch for one word. |
| 2026-11-16 | Day 5 | Test the neighbours, not only the targets: a dictionary audit showed which ordinary words would wrongly merge ("confidence" to Confluence). A rule (a second change only at the end of a long word) cut 201 pairs to 118; a short list handles real look-alikes the rule cannot see (Confluent, TypoScript). |
| 2026-11-16 | Day 5 | Write down what a rule costs: every rule change was recorded with what it no longer repairs, so a later reader can tell a choice from a mistake. |
| 2026-11-16 | Day 5 | A deliberate break that survives is information: it is either a missing test or an equivalent change that cannot matter; both are written down. |
| 2026-11-16 | Day 5 | A dictionary check sees single words, but a two-word phrase can sit one letter from a skill ("Personal development" next to "Persona development"). Fix the cause with a structure (flagged phrases never reach spelling help) and a vocabulary entry, not a patch per phrase. |
