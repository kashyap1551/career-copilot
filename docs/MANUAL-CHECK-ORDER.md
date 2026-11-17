# The order of the manual checks (one page, for the owner)

Three checks are waiting. Run them in this order. Tick nothing yourself: the reviewer ticks `docs/SPRINT.md` after you send the results. Use only the invented text in each file; no real CV; never write the access code into any file or chat.

## 1. First: `docs/MANUAL-CHECK-6.1.md`, steps 18 to 25, on the LIVE site

- **Needs:** nothing new. Chrome, the live site as it is today (it does not have the access code yet, and must not get it before this check is finished).
- **AI calls:** 2 to 3 (step 18 sends the CV; step 23 sends the CV and reads one ad; a repeat of the same ad text may come from the reading cache).
- **Time:** about 15 minutes. Steps 22 to 25 use a private (Incognito) window.
- **Why first:** 6.1 is ticked only when all 25 steps pass, and the merge in section 3 must wait for it. Do this before anything is merged: after the merge the live site asks for an access code and the steps would differ.

## 2. Then, on the Vercel PREVIEW of the branch `integration-check`

The branch combines the access code (6.1b) and the fit-level changes. In the Vercel dashboard open the project's Deployments and use the preview address of the branch `integration-check` (not the live address).

**Needs first:** `ACCESS_CODE` set in Vercel for **Preview** (and, before the merge of section 3, for **Production** too). Make it with `openssl rand -hex 16` in a terminal and paste it straight into the Vercel variable (mark it Sensitive if the dashboard offers it). Redeploy the branch after setting it. Never put the value in a file, a chat or this repository.

| Check | File | Steps | AI calls | Time |
|---|---|---|---|---|
| Access code | `docs/MANUAL-CHECK-6.1b.md` | 13 | 3 to 4 (the CV is sent twice with the right code, steps 4 and 12; the ad once or twice; steps 2, 3, 8 and 9 end in "access code needed" and cost nothing) | about 30 minutes, plus 10 for the Firewall rule |
| Fit levels | `docs/MANUAL-CHECK-FIT.md` | 10 | 5 to 8 (the CV once, ads A, B, the welding ad and the "Hello" text; repeats of the same ad text may come from the cache) | about 25 minutes (the free tier allows about one large read a minute) |

**Where they can share one session and one invented CV.** Use ONE new Incognito window on the preview address and the invented CV of `docs/MANUAL-CHECK-6.1.md` for both. Suggested order inside that window:
1. `MANUAL-CHECK-6.1b.md` steps 1 to 8 (they ask for the code, accept it, show it is only in a header, and forget it).
2. `MANUAL-CHECK-FIT.md` steps 1 to 10 in the same window (the code is still kept for the tab if you entered it again; the CV box and the confirm screen are already filled from step 4 of the first check, so in step 1 of the fit check just tick the three skills and set the city `Berlin`).
3. `MANUAL-CHECK-6.1b.md` step 12 (save the profile first with "Save on this device", then "Delete everything saved on this device" and "Yes, delete everything"; the next send must ask for the code again).
4. `MANUAL-CHECK-6.1b.md` step 9 last (it closes the whole window).
Then, outside the window and in any order: `MANUAL-CHECK-6.1b.md` steps 10 and 13 (a terminal; no AI call is made), and step 11 (the Vercel Logs page). Step 13 needs the rate-limit rule: when the "Rate Limiting Pricing" dialog appears, STOP and send its words to the reviewer before pressing Continue.

## 3. After 6.1 is ticked and both preview checks pass: the merge (the reviewer's CC does it)

Before the merge: `ACCESS_CODE` must be set for **Production** in Vercel (the merge deploys the live site; without the variable both AI routes answer "not set up" until it is added and the site is redeployed). Then the merge of `integration-check` into `main`, as in the reviewer's commands. After the live deploy, run step 2 of `MANUAL-CHECK-6.1b.md` once on the live address (a 401, then the code box).

## What to send back

For each file: "passed", or the number of the step that did not match and what you saw instead; for `MANUAL-CHECK-6.1b.md` step 12 and for `MANUAL-CHECK-FIT.md` step 9, write down exactly what you saw even if it passed.
