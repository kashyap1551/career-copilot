# Manual check for step 6.2 (the fit level on each saved ad)

For the owner. Plain words, one small action per step. Each step has **Do** and **Expect**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is `docs/PLAN-6.2.md` (section 8).

## Before you start

- Use **only the invented text in this file.** No real CV, name, email or phone. (The Groq terms are still not checked.)
- Where: the Vercel preview of the branch `step-6.2` (to be confirmed in the dashboard), or the live site after it is merged. Chrome. If the site asks for an access code (step 6.1b), enter it when asked. Nothing in this file contains a code.
- This check makes about 5 AI calls: the CV (twice, steps 1 and 7) and three ads (step 2). The free tier allows about one large read a minute: wait between the reads.
- Developer tools: Cmd+Option+I. The **Network** tab lists every request the page sends; the **Application** tab, then IndexedDB, then `career-copilot`, shows what is stored.

## The invented material

**Invented CV** (as in `docs/MANUAL-CHECK-6.1.md`):

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

## The steps

1. **Do:** open a **new private (Incognito) window** and the page. Paste the invented CV, press **Send for reading**, keep the three skills ticked, type **Berlin** in "Cities you can work in", press **Save on this device**.
   **Expect:** "Saved on this device."
2. **Do:** read and save ads A, C and B, one after the other (**Read this ad**, then **Save this ad**; wait a minute between reads if the site says it is busy).
   **Expect:** three rows in "Saved ads". Because the profile you just confirmed is in use, they already show levels.
3. **Do:** look at the list.
   **Expect:** this order, not the date order: first "Reporting Analyst, Northlake Foods Ltd" with the line "Fit: Strong (judged: skills, location)"; then "Operations Coordinator, Harbor Light Stationery" with "Fit: Long shot (judged: skills, location)" and, under it, the quiet line "Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon."; then "Customer Helper, Imaginary Pages Ltd" with "Fit: No level (no requirements found in this ad)". (If the AI read a requirement in ad C, write down what the row says instead.)
4. **Do:** reload the page. **Do NOT press "Use this profile".** Open the Network tab first and type `api` in its filter box.
   **Expect:** the same three rows WITHOUT a "Fit:" line, in date order (newest first: Operations Coordinator, Customer Helper, Reporting Analyst), and one note above them: "No fit levels yet: no profile is in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device." The Network tab shows no request to `/api/` caused by loading the list. Press **Open** on the Operations Coordinator row and write down the first line of the report ("Fit: ..."): by the rule it is the typed-list report, not the saved profile's.
5. **Do:** press **Use this profile**.
   **Expect:** the rows now have their levels and the order of step 3. Press **Open** on each of the three rows in turn. **Expect:** the report's "Fit:" line is exactly the same text as that row's.
6. **Do:** press **Delete this profile**.
   **Expect:** the rows lose their "Fit:" lines and the note of step 4 appears. **Write down the exact wording of the opened report after "Delete this profile"** (the "Fit:" line, the first sentence under it, and whether it still says "on your profile"). Do not judge it. In IndexedDB, the box `jobs` still has three entries with the same `savedAt` as before.
7. **Do:** paste the invented CV again, send it for reading, and confirm the skills (do not save). Then untick **Tableau** on the confirm screen. Then change "Cities you can work in" to **Exampleville**.
   **Expect:** after the confirm screen is ready, the rows have levels again from the profile just confirmed. After unticking Tableau: "Reporting Analyst, Northlake Foods Ltd" becomes "Fit: Good (judged: skills, location)"; the Long shot row stays Long shot; the third row is unchanged. After changing the city to Exampleville: the rows re-rank at once: "Operations Coordinator, Harbor Light Stationery" first with "Fit: Good (judged: skills, location)", then "Reporting Analyst, Northlake Foods Ltd" with "Fit: Long shot (judged: skills, location)", then "Customer Helper". Press **Open** on the Operations Coordinator row: the report's level equals the row's.
8. **Do:** press **Delete** on one row.
   **Expect:** that row is gone, two rows are left, the order is kept.
9. **Do:** press **Delete everything saved on this device**, then **Yes, delete everything**.
   **Expect:** the list is gone. In IndexedDB both boxes are empty.
10. **Do:** open the Console tab.
    **Expect:** no red errors of ours (extension noise is known).

## What to send back

For each step: "passed", or the step number and what you saw instead. For steps 4 and 6 also write down exactly what the opened report said, even if the step passed. Also any red text from the Console.

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
