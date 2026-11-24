# Manual check for step 9.1 (demo mode)

For the owner. Plain words, one small action per step. Each step has **Do** and **Expect**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is in `docs/PLAN-9.1.md` (revision 2 with its amendments; A1, A2, A4 and A9 matter here).

This check makes **no AI read** and needs **no access code, no CV and nothing to paste**. Everything on the demo screen is invented.

## Before you start

- Chrome, a **fresh private (Incognito) window**. Use the address of this sitting: the Vercel preview of the branch `step-9.1` (the owner opens it from the Vercel Deployments page and checks that it is Ready first), or the live address after the merge.
- Developer tools: press **Cmd+Option+I**. The tab **Network** is the list of every request the page sends. The tab **Application** shows what the page stores. In the Application tab look at **IndexedDB only. Never open "Session storage"**: on the real page it holds the access code (standing rule).
- **Expected, and not the demo's doing:** the first screen opens the browser's database `career-copilot` when it loads (the saved-on-this-device read of step 6.1), which creates it EMPTY in a fresh window. So in step 2 you may see the database listed with empty stores.
- The invented person is "Alex Example". Every company and job title in the demo is made up.

## The steps

1. **Do:** open the first screen. Do not type any code.
   **Expect:** the page as before, and near the top a button **Try a demo with invented data** with the line **No upload and no access code. About one minute.** under it. No access-code box is shown.
2. **Do:** open the developer tools. In **Application**, open **IndexedDB** and, if the database `career-copilot` is listed, open it. Then open the tab **Network**, tick **Preserve log**, choose the filter **Fetch/XHR** and press the clear button (the circle with a line).
   **Expect:** the database (if listed) has its two stores `profile` and `jobs` with no entries. The Network list is empty.
3. **Do:** press **Try a demo with invented data**.
   **Expect (the click itself, plan A1):** within a minute the demo page. In the Network list there may be one row whose name contains `demo` or `_rsc`: that is the browser's own page navigation, not the demo's code, and is fine. There must be **no row whose name contains `api`**, and no request to any address other than this site.
4. **Do:** look at the top of the demo page.
   **Expect:** a bar that stays at the top with the words **Demo: invented data. The person, the CV and the ten job ads are made up. Nothing you do here is saved or sent anywhere.** and a button **Leave the demo**. Under the title **Career Co-pilot demo** the two sentences: **The AI readings in this demo were prepared in advance and are part of this page. No AI is used here, and nothing you do in the demo is sent anywhere. The live version reads your own CV and ads with AI.** and **Untick a skill below and watch the fit levels change.**
5. **Do:** look at the rest of the page, from the top.
   **Expect:** "The invented CV" with a closed line to show its eight lines; below it the confirm box with three skills ticked (SQL, Tableau, Excel) and **Berlin** in the cities box. Then a box **Saved ads** with ten rows, in this order, each with its date (2026-11-24) and a **Fit:** line, and each with an **Open** button and **no Delete button**:
   1. Insight Analyst, Quillon Foods Ltd: Fit: Strong (judged: skills, location)
   2. Records Clerk, Marrowby Freight Ltd: Fit: Strong (judged: skills, location)
   3. Revenue Analyst, Tarnbridge Mills Ltd: Fit: Strong (judged: skills, location)
   4. BI Engineer, Pellwick Print Ltd: Fit: Good (judged: skills, location)
   5. Budget Analyst, Ostrander Glass Ltd: Fit: Good (judged: skills, location)
   6. Dashboard Specialist, Corvane Tools Ltd: Fit: Good (judged: skills, location)
   7. Management Reporting Lead, Haldane Paper Ltd: Fit: Good (judged: skills, location)
   8. Data Platform Engineer, Fenwick Quarry Ltd: Fit: Stretch (judged: skills, location)
   9. Campaign Analyst, Yarrowdale Games Ltd: Fit: Stretch (judged: skills, location)
   10. Site Coordinator, Wexcombe Textiles Ltd: Fit: Long shot (judged: skills, location), and under it: Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon.
   That is three Strong, four Good, two Stretch and one Long shot. There is no Save button, no text box for a CV or an ad, and no "Read this ad" button anywhere on the page.
6. **Do:** read the box **What to learn**.
   **Expect** these lines, in this order:
   - Skills you are missing across your 10 saved ads
   - (Counted against the profile in use. Must-haves and nice-to-haves are counted apart.)
   - Power BI: must-have in 4 ads, nice-to-have in 1 ad
   - Python: must-have in 4 ads, nice-to-have in 1 ad
   - 1 of your 10 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.
   - Already Strong: 3 jobs (Insight Analyst, Quillon Foods Ltd; Records Clerk, Marrowby Freight Ltd; Revenue Analyst, Tarnbridge Mills Ltd)
   - Skills to build, in order:
   - 1. Power BI: unlocks 2 jobs (Dashboard Specialist, Corvane Tools Ltd; Management Reporting Lead, Haldane Paper Ltd). Total so far: 2 jobs.
   - 2. Python: unlocks 4 jobs (BI Engineer, Pellwick Print Ltd; Budget Analyst, Ostrander Glass Ltd; Data Platform Engineer, Fenwick Quarry Ltd; Campaign Analyst, Yarrowdale Games Ltd). Total so far: 6 jobs.
   - Blocked jobs (skills alone can't make these Strong): 1
   - - Site Coordinator, Wexcombe Textiles Ltd: blocked by 1 thing; it can't be closed soon
   - (can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin.
7. **Do:** now that the whole screen is shown, go to **Network** (filter **Fetch/XHR**) and press the clear button. Then untick **Tableau** in the confirm box, look at the page, and tick it again.
   **Expect with Tableau unticked:** two Strong, four Good, three Stretch and one Long shot. The rows in this order: Records Clerk (Strong), Revenue Analyst (Strong), Insight Analyst (Good), BI Engineer (Good), Budget Analyst (Good), Management Reporting Lead (Good), Data Platform Engineer (Stretch), Dashboard Specialist (Stretch), Campaign Analyst (Stretch), Site Coordinator (Long shot). In the box: three missing-skill rows, in this order: Power BI: must-have in 4 ads, nice-to-have in 1 ad; Python: must-have in 4 ads, nice-to-have in 1 ad; Tableau: must-have in 3 ads, nice-to-have in 1 ad; and the line Already Strong: 2 jobs (Records Clerk, Marrowby Freight Ltd; Revenue Analyst, Tarnbridge Mills Ltd). **Expect after ticking it again:** exactly the lists of steps 5 and 6.
8. **Do:** press **Open** on the first row (Insight Analyst) and then on the last row (Site Coordinator).
   **Expect:** a report under the box each time, titled with the ad's title and company, whose **Fit:** line is the same text as that row's. **In the Network list (cleared in step 7): no row at all**, after the unticking, the ticking and both opens.
9. **Do:** in **Application**, look at **IndexedDB** again (press refresh in the Application panel if needed).
   **Expect:** exactly as in step 2: the stores `profile` and `jobs` have no entries. Do not open Session storage.
10. **Do:** press **Leave the demo**, then reload the page.
    **Expect:** the first screen of step 1, with the demo button. No "Saved ads" box, no banner, nothing from the demo. (No profile or ad was saved: you did not save anything and the demo cannot.)
11. **Do (only if this browser already has a saved profile or saved ads on this address; a fresh window has none, then write "none" and go on):** before step 3 and again after step 10, write down the line "A profile is saved on this device (date)" and the number of rows in "Saved ads".
    **Expect:** identical before and after.
12. **Do:** write down every word on the demo screen that could make a visitor think the data is their own, or that the AI read it live.
    **Expect:** none. If you find one, quote it.

## What to send back

"passed", or the number of the first step that did not match and what you saw instead. Also, even if all passed:
- the banner text you saw (step 4) and the two sentences under the title;
- the order of the ten rows with their **Fit:** lines (step 5);
- the lines of the **What to learn** box (step 6);
- the counts and the order with Tableau unticked (step 7);
- what the Network list showed after the click (step 3) and after step 8, and what IndexedDB showed in steps 2 and 9;
- any word that suggests the data is the visitor's own (step 12);
- any red text in the Console tab.

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
| 11 | NOT RUN YET | |
| 12 | NOT RUN YET | |
