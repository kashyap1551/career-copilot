# Manual check for step 8.2 (the analytics under the roadmap report)

For the owner. Plain words, one small action per step. Each step has **Do**, **Expect** and **Report**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is `docs/PLAN-8.2.md` (sections 2, 7 and 10).

Every text and number under **Expect** was worked out by hand from the invented CV and the ten invented ads (the hand cases R3d and R3 of `docs/PLAN-8.2.md` section 7), before any run of this document. The lines were worked out in the plan before any code existed, the tests T3a and T3b hold the same lines, and a comparison run (a small script, not kept) showed that the real code produces them.

## Before you start

- Use **only the invented text**: the CV of `docs/MANUAL-CHECK-7.1.md` and the ten ads of `docs/MANUAL-CHECK-TEN-ADS.md` (their texts are not copied here). No real CV, name, email or phone. No real ad.
- Where: the Vercel preview of the branch `step-8.2` (find its address in the Vercel dashboard, under Deployments; use the **newest commit of the branch**, the one whose address is pinned to that commit, and check that its state is **Ready**; it sits behind the Vercel sign-in). Use a **new private (Incognito) window** and Chrome. The first read asks for the access code: type it into the app's **code box only**, press **Use this code**, then press the button again. Do not write the code anywhere else and do not send it to anyone, including the reviewer. Never send a screenshot of the Request headers, and do not open the Application tab's Session storage (the code is kept there).
- **AI reads this check needs: 11.** The CV once and the ten ads once each. **A new preview address has its own empty storage**, so the 11 reads are needed on this address. Every later step needs **no** AI read, except the optional step 12 (one read). If you run this check in the **one sitting** with `docs/MANUAL-CHECK-7.3.md` and `docs/MANUAL-CHECK-8.1.md` (the order is at the end of `docs/MANUAL-CHECK-8.1.md`), the whole sitting needs **11 reads**, and **12** if you do the one optional re-read, which serves step 7 of 8.1 and step 12 here. The free tier allows about one large read a minute: wait about a minute between reads.
- Developer tools: Cmd+Option+I. The **Network** tab (the list of every request the page sends) is used in step 13; the **Elements** tab in step 4; the **Console** tab in step 14.
- **What the analytics are.** A block under the roadmap report: a button `Show my analytics`. Like the report, it exists only when the "What to learn" box shows its roadmap (**ten saved ads we could judge and a profile in use**). It starts **closed**. Open, it shows three things, all counted by the app: how many of your saved ads have each fit level (with one plain bar each), the skills your saved ads ask for (with where you stand on each), and your own skills that they ask for. **No job title and no company name appears in it.**
- **Words you will meet.** `Strong`, `Good`, `Stretch` and `Long shot` are the fit levels of the "Saved ads" list. A line like `Good: 10 of your 10 saved ads` counts the ads, it says nothing about your chances.
- The ten ads all ask for SQL and nothing else, so only SQL appears in the lists of skills (Tableau and Excel are asked by no ad).

## The steps

1. **Do:** open the preview in a **new private window**. Paste the invented CV of `docs/MANUAL-CHECK-7.1.md`, press **Send for reading**, keep the three skills ticked (SQL, Tableau, Excel), type **Berlin** in "Cities you can work in", and press **Save on this device**. Then read and save the ten ads of `docs/MANUAL-CHECK-TEN-ADS.md`, one at a time, Ad 1 first (**Read this ad**, then **Save this ad**).
   **Expect:** ten rows in "Saved ads", every row `Fit: Strong ...`. In the box the first line is `Already Strong: 10 jobs (` the ten names of the list of `docs/MANUAL-CHECK-TEN-ADS.md`, each once `)`. If one name appears twice, stop: that is the P0 defect.
   **Report:** "passed", or what you see.

2. **Do:** first set up the Network tab: open it (Cmd+Option+I), tick **Preserve log** at its top (step 10 reloads the page, and a reload empties the list otherwise), type `api` in its filter box, and press the clear button so the list is empty. Then look under the "What to learn" box. Do not press anything on the page.
   **Expect:** under the box, the report's button `Make my roadmap report` and, under it, a second button `Show my analytics`. No report text and no analytics text.
   **Report:** "passed", or what you see.

3. **Do:** press `Show my analytics`.
   **Expect:** the button now reads `Hide the analytics`, and under it exactly these lines (the first is the title). The profile has the three skills, none in progress:

```
Your analytics
Based on 10 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Fit levels across your saved ads
(These are the levels shown on your saved ads, counted against the profile in use.)
Strong: 10 of your 10 saved ads
Good: 0 of your 10 saved ads
Stretch: 0 of your 10 saved ads
Long shot: 0 of your 10 saved ads
Skills asked across your 10 saved ads
SQL (on your profile): must-have in 10 ads
Skills of yours that are asked for in your 10 saved ads
SQL (on your profile): must-have in 10 ads
```

   (Hand count: all three skills are on the profile, so every ad's one must-have, SQL, is met and no conflict exists: all ten ads are Strong. SQL is asked as a must-have by all ten ads and by none as a nice-to-have, so that part is left out. Tableau and Excel are asked by no ad, so they have no row. SQL is on your profile, so it also stands in the list of your skills. There is no "No level" line because every ad has a level.)
   **Also compare:** the box above says `Already Strong: 10 jobs (...)`, and every row of the "Saved ads" list reads `Fit: Strong ...`. No job title or company name appears anywhere in the analytics.
   **Report:** "passed", or the exact lines the block shows.

4. **Do:** look at the four bars (one under each level line). Then open the **Elements** tab (Cmd+Option+I), click the small arrow at its top left, and click the bar under `Strong`. Look at the bar's two `div` elements; do the same for the bar under `Good`.
   **Expect:** the bar under `Strong` is full length and the three others are empty (only their light track shows). In Elements, the outer `div` of the Strong bar has `aria-hidden="true"` and `data-bar="10/10"`, and the inner `div` has `style="width: 100%"`. The outer `div` of the Good bar has `data-bar="0/10"` and the inner one `style="width: 0%"`. The bar carries no number of its own: the number is in the printed line (`Strong: 10 of your 10 saved ads`), so nothing is carried by length or colour alone. (The in-between widths, for example 3 of 4, are checked by the automatic test T18, not by hand: all ten ads here are alike.)
   **Report:** "passed", or what you see (and the `data-bar` and `width` of the Strong bar).

5. **Do:** press `Hide the analytics`. Look. Then press `Show my analytics` again.
   **Expect:** after Hide the lines vanish, the button reads `Show my analytics` again and the report's button above is unchanged. After the second Show the same lines as in step 3 are back. Leave the analytics **open** for the next steps.
   **Report:** "passed", or what you see.

6. **Do:** on the confirm screen (still showing) **untick SQL**. Under "Skills you are learning" type `SQL` in "Skill name", pick the date **1 June 2027** (2027-06-01) in "Expected date", and press **Add**. Do NOT press "Save on this device". Leave the report open if it is open (press `Make my roadmap report` if you want it open for step 7).
   **Expect:** the analytics block stays open and redraws with exactly these lines:

```
Your analytics
Based on 10 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Fit levels across your saved ads
(These are the levels shown on your saved ads, counted against the profile in use.)
Strong: 0 of your 10 saved ads
Good: 10 of your 10 saved ads
Stretch: 0 of your 10 saved ads
Long shot: 0 of your 10 saved ads
Skills asked across your 10 saved ads
SQL (you are learning it, expected 2027-06-01): must-have in 10 ads
Skills of yours that are asked for in your 10 saved ads: none.
```

   (Hand count: with SQL not on the CV every ad misses its one must-have, SQL: one missing must-have and no conflict, so all ten are Good, none Strong. SQL is asked by all ten as a must-have; it is in progress, so it carries the learning note and it is not one of "your skills" (the list of your skills holds only skills with a CV line): that list is empty and says so in one line. The `Good` bar is now full length and the `Strong` bar empty.)
   **Report:** "passed", or the exact lines.

7. **Do:** with the analytics open and the report open (`Make my roadmap report` if it is closed), compare four pairs of lines, word for word.
   **Expect:** (a) the analytics' first sentence (`Based on 10 saved ads ...`) equals the report's first sentence after its title. (b) The analytics' SQL row `SQL (you are learning it, expected 2027-06-01): must-have in 10 ads` equals the row in the box's own list under `Skills you are missing across your 10 saved ads`. (c) The report's line `Asked as a must-have in 10 of your 10 saved ads.` says the same number as the SQL row (10). (d) `Good: 10 of your 10 saved ads` matches the "Saved ads" list: all ten rows read `Fit: Good ...`.
   **Report:** "passed", or which pair differs and the two lines.

8. **Do:** on the confirm screen press **remove** next to `SQL` in the list under "Skills you are learning", and add `SQL` again with the date **1 March 2027** (2027-03-01), pressing **Add**. The analytics stay open.
   **Expect:** only the SQL row changes: `SQL (you are learning it, expected 2027-03-01): must-have in 10 ads`. Every other line is as in step 6.
   **Report:** "passed", or the exact lines.

9. **Do:** with the analytics open, make the window **phone-narrow**: open the device toolbar of the developer tools (Cmd+Shift+M) and choose a width of about 375 px (or drag the window narrow). Look at the analytics. Then switch to **dark appearance**: either set your Mac to Dark in System Settings, or in the developer tools press Cmd+Shift+P, type `Rendering`, choose "Show Rendering" and set "Emulate CSS media feature prefers-color-scheme" to `dark`. Look again. Then set both back.
   **Expect:** at 375 px every line wraps inside the page: no sideways scrolling and no text cut off, and the bars still span the width of their track. In dark appearance the text is readable and each bar is visible against its track (the `Good` bar clearly lighter than its track).
   **Report:** "passed", or what you see (which of the two, and which line).

10. **Do:** put `SQL` in progress back at **1 June 2027** (remove and add as in step 6). Press **Save on this device** (this replaces the saved profile; the app keeps only one). Reload the page (Cmd+R). **Do NOT press "Use this profile" yet**; look under the box; then press **Use this profile**.
    **Expect:** after the reload, before "Use this profile", neither the report's button nor the analytics button is there (the box holds the line `What to learn needs a profile in use. ...`). After pressing "Use this profile" both buttons are there, the analytics button reads `Show my analytics` (the block is **closed**), and after pressing it the lines are exactly those of step 6 (the date is stored, not worked out again).
    **Report:** "passed", or what you see.

11. **Do:** press **Delete** (the button next to **Open**, in the row of the saved ad) on any one saved ad (nine are left).
    **Expect:** both buttons, `Make my roadmap report` and `Show my analytics`, are gone, and with them any open report and any open analytics; the box shows the line `The roadmap shows from 10 saved ads we could judge. You have 9. Save 1 more to see it.` and no ranking.
    **Report:** "passed", or the exact lines.

12. **Do (optional, one more AI read):** read and save the deleted ad again (**Read this ad**, then **Save this ad**).
    **Expect:** both buttons are back, and both blocks are **closed**: the analytics button reads `Show my analytics` and no analytics text is shown (a block that goes away and comes back starts closed). Press it once: the lines of step 6 appear again.
    **Report:** "passed", or the exact lines (and "skipped" if you skipped it).

13. **Do:** look at the **Network** tab (filter `api`).
    **Expect, answer yes or no:** after the clear in step 2 (the list covers steps 2 to 11 only if **Preserve log** was ticked in step 2), did any `/api/` request appear for showing, hiding or redrawing the analytics, for the profile edits, the save, the reload or the deletion (apart from the one read of the optional step 12)? **Expected: no.** (The analytics only read what is on the page.)
    **Report:** the answer.

14. **Do:** open the **Console** tab.
    **Expect:** no red errors of ours (browser-extension noise is known).
    **Report:** "passed", or the red text.

## What to send back

For each step: "passed", or the step number and what you saw instead. For steps 3 and 6 also write down the exact lines of the block, and for step 4 the `data-bar` and `width` of the Strong bar, even if they passed. Never send the access code, and never send a screenshot of request headers.

## Manual check log

Results are recorded with the commit of the preview you used: commit ______ .

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
| 11 | NOT RUN YET | |
| 12 | NOT RUN YET (optional) | |
| 13 | NOT RUN YET | |
| 14 | NOT RUN YET | |
