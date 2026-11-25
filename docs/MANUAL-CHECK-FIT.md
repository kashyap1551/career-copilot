# Manual check for the fit-level changes (branch step-fit-levels)

For the owner. Plain words, one small action per step. Each step has **Do** and **Expect**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is `docs/PLAN-FIT-LEVEL.md`.

## Before you start

- Use **only the invented text in this file.** No real CV, name, email or phone. (The Groq terms are still not checked.)
- Where: the branch's own preview address in Vercel (to be confirmed in the dashboard), or the live site after the branch is merged. Chrome.
- This check presses **Read this ad** 7 times and sends the CV once, so it makes 5 to 8 AI calls: a repeat of the same ad text (steps 5, 6 and 7 repeat texts from steps 4 and 2) may come from the reading cache and cost nothing. If the site asks for an access code (step 6.1b, if it is merged), enter it when asked.
- The AI decides what a sentence in an ad is: it may call "You can weld stainless steel tanks" a must-have or a nice-to-have. Both are fine; the Expect lines say what to see in each case.

## The invented material

**Invented CV** (paste all of it into the CV box):

```
Alex Example, Reporting Analyst, Exampleville
2022-2025 Reporting Analyst, Imaginary Logistics Ltd
Wrote SQL queries to reconcile order data
Built monthly dashboards in Tableau
Kept the weekly sales sheet in Excel
Languages: English (native), German (B2)
```

**Invented ad A** (Berlin, with one requirement that is not in our skill list):

```
Reporting Analyst
Northlake Foods Ltd, Berlin. Hybrid, two days in the office.
You write SQL queries and build dashboards in Tableau.
You can weld stainless steel tanks.
Excel skills are a plus.
```

**Invented ad B** (a city out of reach):

```
Reporting Analyst
Harbor Light Stationery, Exampleville. Hybrid, two days in the office.
You write SQL queries and build dashboards in Tableau.
```

## The steps

1. **Do:** open the page. Paste the invented CV, press **Send for reading**. Keep the three skills ticked. Under "Cities you can work in" type **Berlin**.
   **Expect:** three skills (SQL, Tableau, Excel) ticked; the city is set.
2. **Do:** paste **ad A** into "The job ad", press **Read this ad**.
   **Expect:** the line "Fit: At best Strong (judged: skills, location; 1 must-have not judged)". The sentence under it says "You meet all 2 must-haves on your profile, plus 1 must-have we could not judge." (If the AI called the welding line a nice-to-have, the label is "Fit: Strong (judged: skills, location)", with no "At best" and no "not judged" part, and the sentence has no "plus".) Either way, the welding line shows the word **Could not judge** (not "Not met"), with "...not in our skill list yet, so we could not judge it.", and a yellow note says "1 requirement is not in our skill list yet, so we could not judge it. It is not counted in the level or in the counts below." The counts line ends "Could not judge: 1 must-have, 0 nice-to-haves." (or "0 must-haves, 1 nice-to-have").
3. **Do:** look under the explanation, above the must-haves.
   **Expect:** a short list "Checked and fine:" with one line: "Location: fine. The job is in Berlin, and Berlin is on your profile."
4. **Do:** paste **ad B** over ad A, press **Read this ad**.
   **Expect:** "Fit: Long shot (judged: skills, location)". The explanation starts "Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon." Under "Conflicts found in what you set" the same city conflict is listed with "(can't be closed soon)". There is no "Checked and fine" list.
5. **Do:** reload the page (Cmd+R). Do NOT read a CV. Scroll to "Or type a list of skills instead" and leave it empty. Paste **ad B** and press **Read this ad**.
   **Expect:** "Fit: No level (no skills on your list)". The explanation starts "No level yet: your list has no skills we can match. Add skills first." Both must-haves show as missing ("not on your list"). No "Checked and fine" list.
6. **Do:** type **SQL** and **Tableau** (one per line) in the list, then press **Read this ad** again on ad B.
   **Expect:** "Fit: Strong (skills only)". No "No level" sentence.
7. **Do:** paste **ad A** again and press **Read this ad** (the list still has SQL and Tableau).
   **Expect:** "Fit: At best Strong (skills only; 1 must-have not judged)" (or "Fit: Strong (skills only)" if the welding line was read as a nice-to-have), and the same "Could not judge" row and yellow note as in step 2. No "Checked and fine" list (nothing is judged on a typed list).
8. **Do:** clear the list again and paste an ad that has only the welding line as its requirement, for example the three lines "Welder / Northlake Foods Ltd, Berlin. / You can weld stainless steel tanks." and press **Read this ad**.
   **Expect (only if the AI read the welding line as a must-have):** "Fit: No level (no must-have we could judge)" and the sentence "No level can be shown: the ad's only must-have is not in our skill list yet, so it could not be judged." If the AI read it as a nice-to-have, or found no requirement, write down what you saw instead (this is the edge case; both are fine to report).
9. **Do:** paste the invented text `Hello, this is not a job ad.` into "The job ad" and press **Read this ad**.
   **Expect:** either "Fit: No level (no requirements found in this ad)" with the sentence "No level can be shown: no requirements were found in this ad, so check that the whole ad was pasted.", or a message from the reader that it found nothing to read. Whichever happens, write down exactly what you saw.
10. **Do:** in the Console tab of the developer tools (Cmd+Option+I) look after the steps above.
   **Expect:** no new red errors of ours (extension noise is known).

## What to send back

For each step: "passed", or the step number and what you saw instead. Also any red text from the Console.

## Manual check log

| Step | Result | What was seen |
|---|---|---|
| 1 | NOT RUN YET | |
| 2 | NOT RUN YET | |
| 3 | NOT RUN YET | |
| 4 | NOT RUN YET | |
| 5 | NOT RUN YET | |
| 6 | NOT RUN YET | |
| 7 | NOT RUN YET | |
| 8 | NOT RUN YET | |
| 9 | NOT RUN YET | |
| 10 | NOT RUN YET | |
