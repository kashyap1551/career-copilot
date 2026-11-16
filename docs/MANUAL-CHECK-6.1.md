# Manual check for step 6.1 (saving on this device)

For the owner. Plain words, one small action per step. Each step has **Do** and **Expect**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything.

6.1 is ticked in `docs/SPRINT.md` only after this check passes.

## Before you start

- Use the **live site**: https://career-copilot-theta-seven.vercel.app, in **Google Chrome**. First check that the deploy of the latest push has finished (Vercel dashboard, or reload the site after a minute).
- Use **only the invented text in this file.** No real CV, no real name, email or phone. (The Groq terms are still not checked, so a real CV must not go through the live reading yet.)
- Chrome's developer tools show what is stored: press **Cmd+Option+I**, open the tab **Application**, and in the left list open **IndexedDB**, then **career-copilot**. You will see two boxes, **profile** and **jobs**. After every click, right-click **career-copilot** and choose **Refresh IndexedDB** to see the newest state.
- Use a normal Chrome window for parts 1 to 4, and a private (Incognito) window for part 5.
- What this does not cover: the 15-ads check. See "The 15 ads" at the end.

## The invented material

**The invented CV** (paste all of it into the CV box):

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

**Invented ad 1:**

```
Reporting Analyst
Northlake Foods Ltd, Exampleville. Hybrid, two days in the office.
You have 2+ years of experience in reporting.
You write SQL queries and build dashboards in Tableau.
Excel skills are a plus.
You speak fluent English.
```

**Invented ad 2:**

```
Operations Coordinator
Harbor Light Stationery, Testville. On-site.
You keep stock lists accurate in Excel.
You answer customer questions clearly.
German B1 is a plus.
```

## Part 1: nothing is stored before a click

1. **Do:** Open the live site in a normal Chrome window. Open the developer tools as described above (Application, IndexedDB, career-copilot).
   **Expect:** the database `career-copilot` exists with the boxes `profile` and `jobs`, and **both are empty** (no entries). The page shows no saved-profile box and no "Saved ads" list. (The database is created empty when the page opens; nothing is written. A button "Delete everything saved on this device" is already there: that is normal.)

## Part 2: the profile

2. **Do:** Paste the invented CV into the CV box. Press **Send for reading**.
   **Expect:** after a few seconds a list of skills the AI found (for example SQL, Tableau, Excel). Nothing new in IndexedDB (both boxes still empty).
   **Also expect (the Network tab):** the Network tab of the developer tools is the list of every request the page sends to the server. To open it: Cmd+Option+I, click the tab **Network**, and type the word `cv` in the filter box. Do this BEFORE you press **Send for reading**, then press it. A row named `cv` appears: click it, open **Headers**, find **Response Headers**, and look for `Cache-Control: no-store`. (This checks live that the site keeps our no-store header on the CV answer.)
3. **Do:** On the confirm screen leave the ticked skills as they are. Type **Berlin** in "Cities you can work in" and **3** in "Years of experience".
   **Expect:** below the confirm screen a button **Save on this device** with one line next to it that ends "In a private window it is deleted when you close the window." The IndexedDB boxes are still empty.
4. **Do:** Press **Save on this device**.
   **Expect:** the line **Saved on this device.** appears. After you refresh IndexedDB: the box `profile` has **1 entry** (key `current`), the box `jobs` is still empty.
5. **Do:** Untick one skill on the confirm screen (any one).
   **Expect:** the line "Saved on this device." **disappears** (the saved copy is now the older version). Tick the skill again: the line comes back.
6. **Do:** Reload the page (Cmd+R).
   **Expect:** at the top a box: **A profile is saved on this device (today's date)**, with a counts line such as "3 skills, 0 in progress; constraints set: location, years" and three buttons: **Use this profile**, **Delete this profile**, **Read a CV again**. Nothing is used yet: no confirm screen, no report.
7. **Do:** Press **Use this profile**.
   **Expect:** a read-only box "Your saved profile (read-only)" listing each skill with its CV line, and the constraints. No tick boxes, no typing fields. Buttons **Delete this profile** and **Read a CV again**.
8. **Do:** Scroll to "The job ad". Paste invented ad 1 and press **Read this ad**.
   **Expect:** after a few seconds a report with a fit level, judged against the saved profile. (The AI read costs one call; that is expected here.)
   **Also expect (the Network tab):** do the same as in step 2 with the word `read` in the filter box (open the Network tab and type it BEFORE you press **Read this ad**). The row named `read` has, under Response Headers, `Cache-Control: no-store`.
9. **Do:** Press **Delete this profile**.
   **Expect:** the line **The saved profile was deleted.** After you refresh IndexedDB: `profile` is empty.

## Part 3: saved ads

10. **Do:** Read invented ad 1 again (it is still in the box; press **Read this ad**). When the report appears, look at the top of the report area.
    **Expect:** a button **Save this ad** with the same one-line notice next to it.
11. **Do:** Press **Save this ad**.
    **Expect:** the line **Saved on this device.** (above the report area) and a box **Saved ads** with **1 row**: "Reporting Analyst, Northlake Foods Ltd" and today's date, with buttons **Open** and **Delete**. IndexedDB: `jobs` has 1 entry.
12. **Do:** Replace the ad text with invented ad 2, press **Read this ad**, then **Save this ad**.
    **Expect:** **2 rows**, the newest (ad 2) first. IndexedDB: `jobs` has 2 entries.
13. **Do:** Press **Save this ad** again for the same ad 2 (same text).
    **Expect:** still **2 rows** (the same ad text is one record; its date is updated).
14. **Do:** Add one sentence to the end of ad 2 ("Start as soon as possible."), press **Read this ad**, then **Save this ad**.
    **Expect:** **3 rows** (a different text is a different record).
15. **Do:** Reload the page.
    **Expect:** the box **Saved ads** still shows **3 rows**, newest first.
16. **Do:** Press **Open** on the oldest row (ad 1).
    **Expect:** the ad text appears in "The job ad" box and a report appears. There may be a line under the buttons such as "Checked again on this device with the current skill list. The saved copy was not changed, and no AI call was made." (it appears only if the skill list changed since saving). There is **no "Save this ad" button** for an opened ad. In IndexedDB the entry for that ad is unchanged (same date).
17. **Do:** Press **Delete** on one row.
    **Expect:** the line **The saved ad was deleted.** and **2 rows** left. IndexedDB: `jobs` has 2 entries.

## Part 4: delete everything

18. **Do:** Save the profile again (repeat steps 2 to 4 quickly: paste the CV, send for reading, Save on this device).
    **Expect:** IndexedDB: `profile` 1 entry, `jobs` 2 entries.
19. **Do:** Press **Delete everything saved on this device**.
    **Expect:** it does **not** delete yet: it asks "Delete the saved profile and everything else saved on this device?" with **Yes, delete everything** and **Cancel**.
20. **Do:** Press **Cancel**.
    **Expect:** nothing deleted (refresh IndexedDB: still 1 and 2).
21. **Do:** Press **Delete everything saved on this device** again, then **Yes, delete everything**.
    **Expect:** the line **Everything saved on this device was deleted.** The box "Saved ads" is gone. IndexedDB: **both boxes empty**.

## Part 5: a private window

22. **Do:** Open a **new Incognito window** in Chrome (Cmd+Shift+N) and open the live site. Open the developer tools and click the **Console** tab.
    **Expect:** **no red errors** in the Console after the page has loaded.
23. **Do:** Paste the invented CV, send it for reading, confirm, press **Save on this device**. Then read invented ad 1 and press **Save this ad**.
    **Expect:** "Saved on this device." both times (saving works in a private window).
24. **Do:** Reload the page inside the same private window.
    **Expect:** the box "A profile is saved on this device" and the "Saved ads" list with 1 row are still there.
25. **Do:** Close the private window. Open a **new** private window and the live site again.
    **Expect:** **nothing saved**: no profile box, no "Saved ads". (Private windows discard their data when closed.) The Console has no red errors.

## If saving says "not available"

If a line says "Saving is not available in this browser (private mode, blocked storage, or a page that is not secure). Everything else still works.":
- Everything else on the page still works. Nothing is broken; saving is just off.
- Try the normal (not private) Chrome window.
- Check Chrome settings > Privacy and security > Site settings > Cookies and site data: the site must be allowed to save data (not "Block all").
- A company or school computer can block it by policy; try another browser.
- Write down the exact wording and which browser, and send it to the reviewer.

## What to send back

For each part: "passed", or the number of the step that did not match and what you saw instead. Also send any red text from the Console.

## The 15 ads (how this check covers it)

The plan asks that 15 saved ads survive a reload. The check by hand uses **3 ads** (steps 11, 12, 14 and the reload in step 15): that proves the real browser database keeps several records across a reload. The count of 15 itself is covered by two logic tests that run on every build: **S1b** (15 jobs are saved in the in-memory store and 15 are listed by a fresh context, the "reload") and **R4** (15 saved ads give 15 rows, newest first). The one thing the 3-ad check does not prove is that a real IndexedDB holds 15 records as well as 3; nothing in the code treats 3 and 15 differently (one record per ad, no limit).
