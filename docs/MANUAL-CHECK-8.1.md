# Manual check for step 8.1 (the roadmap report on request)

For the owner. Plain words, one small action per step. Each step has **Do**, **Expect** and **Report**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is `docs/PLAN-8.1.md` (sections 1, 6 and 9).

Every text and number under **Expect** was worked out by hand from the invented CV and the ten invented ads, before any run (the hand cases R3 of `docs/PLAN-8.1.md` section 6). The lines were worked out by hand in the plan before any code existed (case R3), test T3a holds the same lines, and a dry run showed that the real code produces them.

## Before you start

- Use **only the invented text**: the CV of `docs/MANUAL-CHECK-7.1.md` and the ten ads of `docs/MANUAL-CHECK-TEN-ADS.md` (their texts are not copied here). No real CV, name, email or phone.
- Where: the Vercel preview of the branch `step-8.1` (find its address in the Vercel dashboard, under Deployments; the newest commit of the branch is the best choice; it sits behind the Vercel sign-in). Use a **new private (Incognito) window** and Chrome. The first read asks for the access code: type it into the app's **code box only**, press **Use this code**, then press the button again. Do not write the code anywhere else and do not send it to anyone, including the reviewer. Never send a screenshot of the Request headers, and do not open the Application tab's Session storage (the code is kept there).
- **AI reads this check needs: 11.** The CV once and the ten ads once each. **A new preview address has its own empty storage**, so the 11 reads are needed on this address. Every later step changes only the profile on the confirm screen and needs **no** AI read (only the optional end of step 7 would add one). The free tier allows about one large read a minute: wait about a minute between reads.
- Developer tools: Cmd+Option+I, the **Network** tab (the list of every request the page sends). It is used in steps 3 to 8.
- The "What to learn" box sits under the "Saved ads" list, and the roadmap report sits right under the box. The report exists only when the box shows its roadmap (ten saved ads we could judge and a profile in use).
- **The order of the ten names.** The box and the report name the saved ads **newest first**: the ad you saved last is named first. Save the ten ads in the order of `docs/MANUAL-CHECK-TEN-ADS.md` (Ad 1 first, Ad 10 last) and every list of ten names below reads, from first to last: **Ad 10, Ad 9, ... Ad 1**. This is fixed by the code: the saved ads are listed by save time, newest first (`lib/saved/saved.ts` line 107, and the list is read again after every save, `app/SavedControls.tsx` line 279); the "Saved ads" list shows the same order here because all ten ads have the same fit level. In the Expect lines below, **N** stands for exactly this list:

```
N = Tally Clerk, Larch Wharf Ltd; Survey Assistant, Juniper Hall Ltd; Ledger Clerk, Ivy Gate Ltd; Order Analyst, Heath Row Ltd; Billing Clerk, Gorse Lane Ltd; Stock Analyst, Fern Dock Ltd; Finance Clerk, Elm Court Ltd; Sales Analyst, Cedar Mill Ltd; Data Assistant, Birch Yard Ltd; Report Clerk, Alder Works Ltd
```

## The steps

1. **Do:** open the preview in a **new private window**. Paste the invented CV of `docs/MANUAL-CHECK-7.1.md`, press **Send for reading**, keep the three skills ticked (SQL, Tableau, Excel), type **Berlin** in "Cities you can work in", and press **Save on this device**. Then read and save the ten ads of `docs/MANUAL-CHECK-TEN-ADS.md`, one at a time, Ad 1 first (**Read this ad**, then **Save this ad**).
   **Expect:** ten rows in "Saved ads". In the box the first line is `Already Strong: 10 jobs (` N `)`, ten different titles with ten different companies, each once. If one name appears twice, stop: that is the P0 defect.
   **Report:** "passed", or what you see.

2. **Do:** look under the "What to learn" box. Do not press anything.
   **Expect:** one button, `Make my roadmap report`, and no report text. Nothing else is new on the page.
   **Report:** "passed", or what you see.

3. **Do:** first set up the Network tab: open it (Cmd+Option+I), tick **Preserve log** at its top (step 6 changes the profile and a reload would empty the list otherwise), type `api` in its filter box, and press the clear button so the list is empty. Then, on the confirm screen (still showing), **untick SQL**. Under "Skills you are learning" type `SQL` in "Skill name", pick the date **1 June 2027** (2027-06-01) in "Expected date", and press **Add** (the button next to "Expected date"). Do NOT press "Save on this device". Then press **Make my roadmap report**.
   **Expect:** the report appears, exactly these lines (the first line is the title):

```
Your roadmap report
Based on 10 saved ads we could judge and the profile in use. Every number was counted by the app from them; none is a prediction.
Already Strong: none
Skills to build, in order:
1. SQL (in progress, expected 2027-06-01): unlocks 10 jobs (Tally Clerk, Larch Wharf Ltd; Survey Assistant, Juniper Hall Ltd; Ledger Clerk, Ivy Gate Ltd; Order Analyst, Heath Row Ltd; Billing Clerk, Gorse Lane Ltd; Stock Analyst, Fern Dock Ltd; Finance Clerk, Elm Court Ltd; Sales Analyst, Cedar Mill Ltd; Data Assistant, Birch Yard Ltd; Report Clerk, Alder Works Ltd). Total so far: 10 jobs.
    Asked as a must-have in 10 of your 10 saved ads.
A skill can be asked in more ads than it unlocks: an ad may need more than one skill, may already be unlocked by a skill higher up this list, or may be held back by something other than skills.
Blocked jobs: none
Timeline from skills in progress:
These counts assume you learn each skill by its expected date.
By 2027-06-01 (SQL): 10 more Strong matches (Tally Clerk, Larch Wharf Ltd; Survey Assistant, Juniper Hall Ltd; Ledger Clerk, Ivy Gate Ltd; Order Analyst, Heath Row Ltd; Billing Clerk, Gorse Lane Ltd; Stock Analyst, Fern Dock Ltd; Finance Clerk, Elm Court Ltd; Sales Analyst, Cedar Mill Ltd; Data Assistant, Birch Yard Ltd; Report Clerk, Alder Works Ltd).
```

   On the page the line starting `Asked as` may look indented or smaller instead of showing four spaces; the four spaces belong to the copied text of step 5.

   (Hand count: with SQL not on the CV every ad misses its one must-have, SQL; none is Strong; all ten are reachable. SQL is in progress and covers all ten: it unlocks 10 jobs, total 10. SQL is asked as a must-have by all 10 of the 10 ads, and by none as a nice-to-have, so that part is left out. Nothing is blocked. The timeline at 2027-06-01 covers all ten.)
   **Also compare:** the report's ranking line (the one starting `1. SQL`) and its timeline line (the one starting `By 2027-06-01`) with the same two lines in the "What to learn" box just above. They must be **the same sentences, word for word**.
   **Report:** "passed", or the exact lines the report shows (the ten names may be left out if they are right).

4. **Do:** press **Hide the roadmap report**.
   **Expect:** the report lines vanish; the button reads `Make my roadmap report` again; the box above is unchanged.
   **Report:** "passed", or what you see.

5. **Do:** press **Make my roadmap report** again, then **Copy report as text**. Open any notes app (or any plain text box) and paste.
   **Expect:** on the page, under the Copy button, the line `Copied.` is visible. The pasted text is the same as the report on the screen: the title `Your roadmap report` first; the line `Asked as a must-have in 10 of your 10 saved ads.` indented by four spaces; no empty line at the end. **Then** press **Hide the roadmap report** and **Make my roadmap report** again: the report is back and there is **no** `Copied.` line (hiding resets it).
   **Report:** "passed", or what you see (and the first and last line of what you pasted).

6. **Do:** with the report open, press **Copy report as text** (`Copied.` shows). Then, on the confirm screen, press **remove** next to `SQL` in the list under "Skills you are learning", and add `SQL` again with the date **1 March 2027** (2027-03-01), pressing **Add**. The report stays open.
   **Expect:** the report now says (and the `Copied.` line is **gone**, because the text changed):

```
1. SQL (in progress, expected 2027-03-01): unlocks 10 jobs (Tally Clerk, Larch Wharf Ltd; Survey Assistant, Juniper Hall Ltd; Ledger Clerk, Ivy Gate Ltd; Order Analyst, Heath Row Ltd; Billing Clerk, Gorse Lane Ltd; Stock Analyst, Fern Dock Ltd; Finance Clerk, Elm Court Ltd; Sales Analyst, Cedar Mill Ltd; Data Assistant, Birch Yard Ltd; Report Clerk, Alder Works Ltd). Total so far: 10 jobs.
By 2027-03-01 (SQL): 10 more Strong matches (Tally Clerk, Larch Wharf Ltd; Survey Assistant, Juniper Hall Ltd; Ledger Clerk, Ivy Gate Ltd; Order Analyst, Heath Row Ltd; Billing Clerk, Gorse Lane Ltd; Stock Analyst, Fern Dock Ltd; Finance Clerk, Elm Court Ltd; Sales Analyst, Cedar Mill Ltd; Data Assistant, Birch Yard Ltd; Report Clerk, Alder Works Ltd).
```

   The other lines are unchanged (`Based on 10 saved ads ...`, `Already Strong: none`, the `Asked as ...` line, the footnote, `Blocked jobs: none`, the framing sentence).
   **Report:** "passed", or the exact lines.

7. **Do:** press **Delete** (the button next to **Open**, in the row of the saved ad) on any one saved ad (nine are left).
   **Expect:** the button and the report are gone, and the box shows the line `The roadmap shows from 10 saved ads we could judge. You have 9. Save 1 more to see it.` and no ranking.
   *Optional, one more AI read:* read and save the deleted ad again. **Expect:** the button `Make my roadmap report` is back and the report is **closed** (a report that goes away and comes back starts closed).
   **Report:** "passed", or the exact lines (and "skipped" for the optional part).

8. **Do:** look at the **Network** tab (filter `api`).
   **Expect, answer yes or no:** after the clear in step 3, did any `/api/` request appear for steps 3 to 7 (apart from the one read of the optional part of step 7)? **Expected: no.** (Making, hiding and copying the report only read what is on the page.) Does the "What to learn" box itself contain a button, a link or an input of its own? **Expected: no.** (The two buttons under it belong to the report.)
   **Report:** the two answers.

9. **Do:** open the **Console** tab.
   **Expect:** no red errors of ours (browser-extension noise is known).
   **Report:** "passed", or the red text.

## What to send back

For each step: "passed", or the step number and what you saw instead. For steps 3 and 6 also write down the exact lines of the report (the ten names may be left out if they are right), and for step 5 the first and the last line of the text you pasted, even if they passed. Never send the access code, and never send a screenshot of request headers.

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

## One sitting for 7.3 and 8.1

The preview of the newest `step-8.1` commit also contains step 7.3, unchanged. So `docs/MANUAL-CHECK-7.3.md` and this document can be run in ONE sitting on ONE profile and ONE set of ten saved ads: **11 AI reads in all**, not 22. Each item below names the document and its OWN step number; the Expect lines stay where they are written.

1. `MANUAL-CHECK-7.3.md` step 1 and `MANUAL-CHECK-8.1.md` step 1: the same setup, done ONCE. Check both Expects.
2. `MANUAL-CHECK-8.1.md` step 2 (the button under the box, before any profile change).
3. The Network setup, done ONCE (the first sentence of `MANUAL-CHECK-8.1.md` step 3 and of `MANUAL-CHECK-7.3.md` step 2 is the same action): Preserve log ticked, filter `api`, list cleared.
4. `MANUAL-CHECK-7.3.md` step 2 (untick SQL, SQL at 2027-03-01; skip its Network sentence, done in item 3).
5. `MANUAL-CHECK-7.3.md` step 3 (SQL again, at 2027-06-01). The profile is now the one `MANUAL-CHECK-8.1.md` step 3 needs.
6. `MANUAL-CHECK-8.1.md` steps 3, 4 and 5 (skip the unticking and adding of SQL in step 3: already done in item 5).
7. `MANUAL-CHECK-8.1.md` step 6 (changes SQL to 2027-03-01 with the report open).
8. `MANUAL-CHECK-7.3.md` step 3 **a second time** (remove SQL and add it at 2027-06-01 again): this puts the profile back where 7.3 step 4 expects it, and its Expect can be checked a second time; write the result of this repeat under 7.3 step 3 as "repeat".
9. `MANUAL-CHECK-7.3.md` steps 4 and 5 (and the optional 5b).
10. `MANUAL-CHECK-7.3.md` step 6 (adds SQL at 2027-06-01, saves, reloads, "Use this profile"). After the reload there is no confirm screen, so every item that needs the confirm screen is already done.
11. ONE deletion of a saved ad: `MANUAL-CHECK-7.3.md` step 8 **and** `MANUAL-CHECK-8.1.md` step 7 (without its optional part). Check both Expects against the same page.
12. ONE look at the Network list: `MANUAL-CHECK-7.3.md` step 7 and `MANUAL-CHECK-8.1.md` step 8 (the list has been running since item 3 and Preserve log kept it through the reload).
13. ONE look at the Console: `MANUAL-CHECK-7.3.md` step 9 and `MANUAL-CHECK-8.1.md` step 9.

**The conflicts, and how this order avoids them.**
- Both documents start with the same setup and the same Network setup: done once (items 1 and 3).
- 8.1 step 3 needs SQL at 2027-06-01 and 8.1 step 6 changes it to 2027-03-01, while 7.3 step 4 expects 2027-06-01 again: item 8 puts the date back before 7.3 step 4.
- 7.3 step 6 saves and reloads, after which the confirm screen is gone: every step that edits skills on the confirm screen (7.3 steps 2 to 5b, 8.1 steps 3 to 6) comes before item 10.
- 7.3 step 8 and 8.1 step 7 both delete one ad: done once (item 11), and it is last among the state changes. The optional end of 8.1 step 7 (one more read) is left out of the sitting; if done, it adds one `/api/` request to the Network list of item 12.
- The two Network questions (7.3 step 7, 8.1 step 8) are about the same list: answered together (item 12).

**Records.** Results are recorded **per document**, in its own log table, with the commit of the preview you used. This changes nothing in the 7.3 document: it stays a document of its own, and its log is filled in by its own steps.
