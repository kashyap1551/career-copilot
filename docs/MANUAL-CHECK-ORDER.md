# The order of the manual checks (one page, for the owner)

One preview, three checks. Use only the invented text in each file; no real CV; never write the access code into any file, chat or this repository.

## Where things stand

- **The 6.1 live check is DONE:** 25 of 25 steps passed on 2026-11-17 (the log is at the end of `docs/MANUAL-CHECK-6.1.md`). Nothing more to do there.
- **`ACCESS_CODE` is set in Vercel for Production and for Preview** (by the owner; the value is never written anywhere). If you change it, redeploy the branch before you start.
- **6.1b step 1 is already satisfied** (the variable set in Vercel, then the code deployed): `ACCESS_CODE` was set for Production and Preview on 2026-11-17, before the preview of the latest `step-6.2` commit was built. Nothing to do; it is not repeated below. (If you change the code in Vercel, redeploy the branch before you start; then step 1 is to be done again.)
- **One preview:** the Vercel preview of the branch `step-6.2` (open the project's Deployments and use the address of the branch `step-6.2`, not the live address). It contains the access code (6.1b), the fit levels and 6.2, so all three checks run on it. The branch `integration-check` is superseded by it.

## The three checks, in this order

| # | File | Steps | What it checks |
|---|---|---|---|
| 1 | `docs/MANUAL-CHECK-6.1b.md` | 13 | the access code (a code box after "access code needed", the code only in a header, forgetting it) |
| 2 | `docs/MANUAL-CHECK-FIT.md` | 10 | the fit-level wording ("could not judge", the reason, "Checked and fine", no level) |
| 3 | `docs/MANUAL-CHECK-6.2.md` | 10 | the level on each saved ad, the order, no profile in use |

**AI calls, each check on its own:** 6.1b 3 to 4; fit levels 5 to 8; 6.2 about 5 (the CV twice, three ads). Total if run separately: 13 to 17. **Run as below, in one window, the total is about 12 to 13** (the CV is sent 4 times, the ads about 8 to 9; a repeat of the same ad text may come from the reading cache and cost nothing). The free tier allows about one large read a minute, so wait about a minute between reads.

**Where each of the 13 steps of `MANUAL-CHECK-6.1b.md` is run:**

| 6.1b step | Where | When |
|---|---|---|
| 1 (order followed) | already satisfied, see above | before you start |
| 2 to 8 | Part A, item 1 | first, in the new Incognito window |
| 9, first sentence (enter the right code again) | Part A, item 2 | straight after step 8 |
| 12 (delete everything forgets the code) | Part A, item 4 | inside `MANUAL-CHECK-6.2.md` step 9 |
| 9, rest (close the window, new window, asked again) | Part A, item 5 | last in Part A |
| 10 and 11 (terminal; Vercel Logs) | Part B, item 6 | after Part A |
| 13 (rate-limit rule) | Part B, item 7 | last, after Part A |

## How to run them: one private window, one invented CV

Use the invented CV of `docs/MANUAL-CHECK-6.1.md` in every check.

**Part A: ONE new Incognito window on the step-6.2 preview (about 90 minutes).**
1. `MANUAL-CHECK-6.1b.md` steps 2 to 8. (Step 8 ends with the code forgotten.)
2. Enter the right code again when the box asks for it (this is the first sentence of 6.1b step 9; do NOT close the window yet).
3. `MANUAL-CHECK-FIT.md` steps 1 to 10, in the same window. The page was reloaded in 6.1b step 7, so paste the CV again in its step 1.
4. `MANUAL-CHECK-6.2.md` steps 1 to 10, in the same window. In its step 1 skip "open a new private window" (you are in one). Its step 9 ("Delete everything saved on this device", then "Yes, delete everything") ALSO does 6.1b step 12: the code is kept and a profile is saved at that moment. Straight afterwards press **Send for reading** (or **Read this ad**): **expect** the access code to be asked for again.
5. `MANUAL-CHECK-6.1b.md` step 9 LAST: enter the right code, close the whole window, open a new private window, paste the CV and press Send for reading. **Expect:** asked for the code again.

**Part B: terminal and dashboard (about 30 minutes; after Part A).**
6. `MANUAL-CHECK-6.1b.md` steps 10 and 11 (a terminal; the Vercel Logs page). No AI call is made.
7. `MANUAL-CHECK-6.1b.md` step 13 LAST (the rate-limit rule): do it after Part A, because the rule limits requests and would slow Part A down. When the "Rate Limiting Pricing" dialog appears, STOP and send its words to the reviewer before pressing Continue. No AI call is made.

## Stop rule

On any step that does not match its Expect line: **stop**, write down the step number and exactly what you saw, and send both to the reviewer. Do not try to fix anything and do not carry on to the next step.

## What to send back

For each file: "passed", or the step number that did not match and what you saw. Also write down exactly what you saw for `MANUAL-CHECK-6.1b.md` step 12, `MANUAL-CHECK-FIT.md` step 9 and `MANUAL-CHECK-6.2.md` steps 4 and 6, even if they passed.

## After the checks

When all three pass, the reviewer's CC ticks 6.1 in `docs/SPRINT.md` (and 6.2 once its check has passed) and makes ONE merge of `step-6.2` into `main`, which deploys the live site. After that deploy, run step 2 of `MANUAL-CHECK-6.1b.md` once on the live address (a 401, then the code box).
