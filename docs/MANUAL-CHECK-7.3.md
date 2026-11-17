# Manual check for step 7.3 (the timeline in the "What to learn" box)

For the owner. Plain words, one small action per step. Each step has **Do**, **Expect** and **Report**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is `docs/PLAN-7.3.md` (sections 1, 6 and 9).

Every text and number under **Expect** was worked out by hand from the invented CV and the ten invented ads, before any run. Nothing was copied from a run.

## Before you start

- Use **only the invented text**: the CV of `docs/MANUAL-CHECK-7.1.md` and the ten ads of `docs/MANUAL-CHECK-TEN-ADS.md` (their texts are not copied here). No real CV, name, email or phone.
- Where: the Vercel preview of the branch `step-7.3` (find its address in the Vercel dashboard, under Deployments, the row for the commit `cc94645` or a later one; it sits behind the Vercel sign-in). Use a **new private (Incognito) window** and Chrome. The first read asks for the access code: type it into the app's **code box only**, press **Use this code**, then press the button again. Do not write the code anywhere else and do not send it to anyone, including the reviewer. Never send a screenshot of Request headers.
- **AI reads this check needs: 11.** The CV once and the ten ads once each (a preview address has its own empty storage, so the 11 reads are needed on this address. This step 1 also covers everything that step 10 of `docs/MANUAL-CHECK-7.1.md` expects (the roadmap with ten usable ads), so do that batch once, here). Every later step changes only the profile on the confirm screen and needs **no** AI read. The free tier allows about one large read a minute: wait about a minute between reads.
- Developer tools: Cmd+Option+I, the **Network** tab (the list of every request the page sends). It is used in step 7.
- The box is called **What to learn** and sits under the "Saved ads" list. In this check the profile has the city Berlin. The ten ads are all in Berlin and hybrid, so no ad is held back by anything but skills.
- The timeline is the **last list of the box**, after "Blocked jobs". It appears only when ten saved ads we could judge are there, like the roadmap.

## The steps

1. **Do:** open the preview in a **new private window**. Paste the invented CV of `docs/MANUAL-CHECK-7.1.md`, press **Send for reading**, keep the three skills ticked (SQL, Tableau, Excel), type **Berlin** in "Cities you can work in", and press **Save on this device**. Then read and save the ten ads of `docs/MANUAL-CHECK-TEN-ADS.md`, one at a time (**Read this ad**, then **Save this ad**).
   **Expect:** ten rows in "Saved ads". In the box: the line `Already Strong: 10 jobs (...)` with the ten names of the list at the top of `docs/MANUAL-CHECK-TEN-ADS.md`, **ten different titles with ten different companies, each once**; then `Skills to build, in order: none. No other saved job can become a Strong match by skills alone.`; then `Blocked jobs: none`; and last the one line `Timeline from skills in progress: none.` (no skill is in progress). The sentence "These counts assume you learn each skill by its expected date." is NOT shown. If one name appears twice, stop: that is the P0 defect.
   **Report:** "passed", or the exact lines the box shows.

2. **Do:** on the confirm screen (still showing), **untick SQL**. Under "Skills you are learning" type `SQL` in "Skill name", pick the date **1 March 2027** (2027-03-01) in "Expected date", and press **Add**. Do NOT press "Save on this device". Before you untick, open the **Network** tab, tick **Preserve log** at its top (step 6 reloads the page, and a reload empties the list otherwise), type `api` in its filter box, and press the clear button so the list is empty.
   **Expect:** the box shows, in this order:
   - `Already Strong: none`
   - `Skills to build, in order:`
   - `1. SQL (in progress, expected 2027-03-01): unlocks 10 jobs (` the ten names `). Total so far: 10 jobs.`
   - `Blocked jobs: none`
   - `Timeline from skills in progress:`
   - `These counts assume you learn each skill by its expected date.`
   - `By 2027-03-01 (SQL): 10 more Strong matches (` the ten names, ten different titles with ten different companies, each once `).`

   (Hand count: with SQL not on the CV, every ad misses its one must-have, SQL; none is Strong; all ten are reachable. SQL is in progress for 2027-03-01, and at that date all ten are covered.)
   **Report:** "passed", or the exact lines the box shows (the ten names may be left out if they are right).

3. **Do (change the date):** in the list under "Skills you are learning", press **remove** next to `SQL`, then add `SQL` again with the date **1 June 2027** (2027-06-01) and press **Add**.
   **Expect:** the same ten names, under the new date: the timeline line is `By 2027-06-01 (SQL): 10 more Strong matches (...)`, and the ranking line says `(in progress, expected 2027-06-01)`. The count stays 10.
   **Report:** "passed", or the exact lines.

4. **Do:** add a second skill the same way: `Excel`, date **10 January 2027** (2027-01-10), press **Add**. No ad asks for Excel.
   **Expect:** the timeline has two lines after the framing sentence, **in date order**:
   - `By 2027-01-10 (Excel): 0 more Strong matches. Excel doesn't unlock a job yet.`
   - `By 2027-06-01 (SQL): 10 more Strong matches (...)` with the ten names.

   (Hand count: at 2027-01-10 only Excel is learned; no ad needs it, so 0. At 2027-06-01 SQL joins it and all ten are covered. The line with 0 stays in the list.)
   **Report:** "passed", or the exact lines.

5. **Do:** press **remove** next to both `Excel` and `SQL`.
   **Expect:** the timeline is the one line `Timeline from skills in progress: none.` and the sentence "These counts assume ..." is gone.
   **Report:** "passed", or what you see.

6. **Do:** add `SQL` in progress again with the date **1 June 2027**. Press **Save on this device**. Reload the page (Cmd+R). **Do NOT press "Use this profile" yet**; look at the box; then press **Use this profile**.
   **Expect:** after the reload, before "Use this profile", the box holds the one line `What to learn needs a profile in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.` After pressing it, the timeline shows `By 2027-06-01 (SQL): 10 more Strong matches (...)` with the ten names (the date is stored, not worked out again).
   **Report:** "passed", or what you see.

7. **Do:** look at the **Network** tab (filter `api`).
   **Expect, answer yes or no:** after the clear in step 2, did any `/api/` request appear for steps 2 to 6? (The list covers steps 2 to 6 only if **Preserve log** was ticked in step 2.) **Expected: no.** (The box only reads. The only `/api/` requests of the whole check are the 11 reads of step 1.) Does the box contain a button, a link or an input of its own? **Expected: no.**
   **Report:** the two answers.

8. **Do:** press **Delete** on any one saved ad (nine are left).
   **Expect:** the whole roadmap and the timeline disappear, and the box shows the line `The roadmap shows from 10 saved ads we could judge. You have 9. Save 1 more to see it.` No timeline lines at all.
   **Report:** "passed", or the exact lines.

9. **Do:** open the **Console** tab.
   **Expect:** no red errors of ours (browser-extension noise is known).
   **Report:** "passed", or the red text.

## What to send back

For each step: "passed", or the step number and what you saw instead. For steps 1 to 6 and 8 also write down the exact lines of the timeline (the ten names may be left out if they are right), even if they passed. Never send the access code, and never send a screenshot of request headers.

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
