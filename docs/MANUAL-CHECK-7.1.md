# Manual check for step 7.1 (the "What to learn" box: the gap list and the roadmap line)

For the owner. Plain words, one small action per step. Each step has **Do**, **Expect** and **Report**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is `docs/PLAN-7.1.md` (sections 1, 4, 5 and 9, and Amendments 1 to 5).

Every text and number under **Expect** was worked out by hand from the invented CV and the three invented ads below, before any run. Nothing was copied from a run.

## Before you start

- Use **only the invented text in this file.** No real CV, name, email or phone. (The Groq terms are still not checked.)
- Where: the Vercel preview of the branch `step-7.1` (find its address in the Vercel dashboard, under Deployments; it sits behind the Vercel sign-in). Use a **new private (Incognito) window** and Chrome. If the page shows an access code box, type the code into **that box only**. Do not write it anywhere else, and do not send it to anyone, including the reviewer. Never send a screenshot of Request headers.
- **AI reads this check needs: 4.** Ad A in step 2, the CV in step 3, ad B in step 4, ad C in step 5 (so 3 of them are in steps 3 to 5). The free tier allows about one large read a minute: wait about a minute between reads if the site says it is busy. Step 6 needs no extra AI read. Step 10 is optional and would cost 10 more.
- Developer tools: Cmd+Option+I, the **Network** tab (the list of every request the page sends). It is used in steps 7, 8 and 9.
- The box is called **What to learn** and sits under the "Saved ads" list. In this check the profile has three skills (SQL, Tableau, Excel) and one city (Berlin), nothing else, so only the **location** can hold an ad back.

## The invented material

**Invented CV** (the same as in `docs/MANUAL-CHECK-6.2.md`):

```
Alex Example, Reporting Analyst, Exampleville
2022-2025 Reporting Analyst, Imaginary Logistics Ltd
Wrote SQL queries to reconcile order data
Built monthly dashboards in Tableau
Kept the weekly sales sheet in Excel
2020-2022 Junior Assistant, Pretend Bakery Ltd
Answered customer questions and kept the stock list up to date
Languages: English (native), German (B2)
```

**Ad A** (Berlin):

```
Reporting Analyst
Northlake Foods Ltd, Berlin. Hybrid, two days in the office.
You write SQL queries and build dashboards in Tableau.
Excel skills are a plus.
```

**Ad B** (a city out of reach):

```
Operations Coordinator
Harbor Light Stationery, Exampleville. Hybrid, two days in the office.
You write SQL queries and build dashboards in Tableau.
```

**Ad C** (no requirements):

```
Customer Helper
Imaginary Pages Ltd. We are a friendly small team that likes good coffee.
```

**The hand count behind the Expect lines.** The profile has SQL, Tableau and Excel, all with a CV line. Ad A asks for SQL and Tableau (must-haves) and Excel (nice-to-have): all three are met, so nothing is missing and the gap list has no rows. Ad B asks for SQL and Tableau: also met, so no rows; but it is hybrid in Exampleville and the profile's only city is Berlin, which is a conflict that can't be closed soon, so ad B is held back by its location. Ad C has no requirements, so it is not counted. The roadmap (the ranking) is only shown from 10 saved ads we could judge, so the box shows one line: "You have N. Save 10 minus N more to see it."

If the AI reads an ad differently from what is described here (for example, it reads one more skill, or reads a requirement in ad C), write down exactly what the "Saved ads" row and the box say. That is a finding, not a failure of the box.

## The steps

1. **Do:** open the preview in a **new private window**. Do not paste anything.
   **Expect:** no "What to learn" box, and no "Saved ads" list. Nothing about saved ads is on the page.
   **Report:** "passed", or what you see.

2. **Do:** paste **ad A** into the job ad box, press **Read this ad**, then press **Save this ad**. Do NOT read a CV yet.
   **Expect:** "Saved on this device." (or the page's saved message); one row in "Saved ads"; and under it a box **What to learn** that contains exactly one line: `What to learn needs a profile in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.` No gap list, no roadmap line.
   **Report:** "passed", or the exact lines the box shows.

3. **Do:** paste the invented CV, press **Send for reading**, keep the three skills ticked (SQL, Tableau, Excel), type **Berlin** in "Cities you can work in", then press **Save on this device**.
   **Expect:** "Saved on this device." The "What to learn" box now shows exactly these two lines and nothing else:
   - `You meet every requirement we could judge in your 1 saved ad.`
   - `The roadmap shows from 10 saved ads we could judge. You have 1. Save 9 more to see it.`

   There is no "Skills you are missing" title (nothing is missing), no "held back" line (ad A is in Berlin), and no ranking.
   **Report:** "passed", or the exact lines the box shows.

4. **Do:** paste **ad B**, press **Read this ad**, then **Save this ad**.
   **Expect:** two rows in "Saved ads". The box shows exactly these three lines, in this order:
   - `You meet every requirement we could judge in your 2 saved ads.`
   - `1 of your 2 counted saved ads is held back by something other than skills (location).`
   - `The roadmap shows from 10 saved ads we could judge. You have 2. Save 8 more to see it.`

   The held-back line has NO words after the bracket ("so learning the skills above may not open it") because there is no skill list above it.
   **Report:** "passed", or the exact lines the box shows.

5. **Do:** paste **ad C**, press **Read this ad**, then **Save this ad**.
   **Expect:** three rows in "Saved ads" (the row for ad C shows "Fit: No level (no requirements found in this ad)"). The box shows exactly these four lines, in this order:
   - `You meet every requirement we could judge in your 2 saved ads.`
   - `1 saved ad is not counted: the AI found no requirements in it.`
   - `1 of your 2 counted saved ads is held back by something other than skills (location).`
   - `The roadmap shows from 10 saved ads we could judge. You have 2. Save 8 more to see it.`

   The counts are the same as in step 4 (2), because ad C is not counted.
   **Report:** "passed", or the exact lines the box shows.

6. **Do:** on the confirm screen (still showing from step 3), **untick Tableau**. Do **NOT** press "Save on this device".
   **Expect:** the box shows exactly these six lines, in this order:
   - `Skills you are missing across your 2 saved ads`
   - `(Counted against the profile in use. Must-haves and nice-to-haves are counted apart.)`
   - `Tableau: must-have in 2 ads`
   - `1 saved ad is not counted: the AI found no requirements in it.`
   - `1 of your 2 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.`
   - `The roadmap shows from 10 saved ads we could judge. You have 2. Save 8 more to see it.`

   Then **tick Tableau again**. **Expect:** the four lines of step 5 are back.
   (Hand count: without Tableau, both ad A and ad B miss one must-have, Tableau, so there is one row and it covers 2 ads. Ad B is held back by its location, so the held-back line comes WITH its closing words this time, because a row exists above it. Ad C is not counted. This step needs no extra AI read.)
   **Report:** "passed", or the exact lines.

7. **Do:** open the **Network** tab, type `api` in its filter box and press the clear button (the circle with a line) so the list is empty. Then press **Delete** on the row **Operations Coordinator** (ad B).
   **Expect:** the row is gone, two rows are left, and the box now shows exactly these three lines:
   - `You meet every requirement we could judge in your 1 saved ad.`
   - `1 saved ad is not counted: the AI found no requirements in it.`
   - `The roadmap shows from 10 saved ads we could judge. You have 1. Save 9 more to see it.`

   The held-back line is gone (the held-back ad was deleted). The Network list stays empty: no request to `/api/` was made.
   **Report:** "passed", or the exact lines; and whether any `/api/` row appeared (yes or no).

8. **Do:** reload the page (Cmd+R). **Do NOT press "Use this profile".** Look at the box. Then press **Use this profile**.
   **Expect:** after the reload the box holds exactly one line, the note of step 2: `What to learn needs a profile in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.` After pressing **Use this profile** the box returns to the three lines of step 7. No `/api/` request in the Network tab for either change.
   **Report:** "passed", or what you see.

9. **Do:** look at the box, and then at the Network tab (filter `api`).
   **Expect, answer yes or no for each:**
   (a) Does the box contain a button, a link or an input of its own? **Expected: no.** (It is text only.)
   (b) After steps 7 and 8, does the Network tab show any `/api/` request made by changing the box? **Expected: no.** (The only `/api/` requests of the whole check are the four reads of steps 2 to 5.)
   **Report:** the two answers.

10. **OPTIONAL, skip freely.** The roadmap itself (Already Strong, Skills to build, Blocked jobs) only appears from 10 saved ads we could judge, which would need 10 short invented ads and 10 AI reads, about one a minute. It is already covered by the automated tests U3 and U12 (docs/PLAN-7.1.md, section 7). If you do it: save the ten short invented ads of `docs/MANUAL-CHECK-TEN-ADS.md` (each asks for SQL only), one at a time. **Expect:** with 9 ads the box says `You have 9. Save 1 more to see it.`; with the tenth ad it shows `Already Strong: 10 jobs (...)`, then `Skills to build, in order: none. No other saved job can become a Strong match by skills alone.` and `Blocked jobs: none`. The ten names listed under Already Strong are ten DIFFERENT titles with ten different companies, each once. If one name appears twice, stop and tell the reviewer: that is the P0 defect (ads sharing one internal id). The list of the ten names to compare with is at the top of `docs/MANUAL-CHECK-TEN-ADS.md`.
   **Report:** "skipped", or what you see.

11. **Do:** open the **Console** tab.
    **Expect:** no red errors of ours (browser-extension noise is known).
    **Report:** "passed", or the red text.

## What to send back

For each step: "passed", or the step number and what you saw instead. For steps 3, 4, 5, 6 and 7 also write down the exact lines the box shows, even if they passed. Never send the access code, and never send a screenshot of request headers.

## Manual check log

Combined sitting 2026-11-24 on build 0ac2632 (invented material): the whole 7.1 check was run as Part A and passed; step 10 (the ten ads) was not part of it and runs in the later sitting on the step-8.2 build.

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
| 10 | NOT RUN YET (optional) | |
| 11 | NOT RUN YET | |
