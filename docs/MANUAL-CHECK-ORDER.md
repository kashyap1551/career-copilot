# The order of the manual checks (one page, for the owner)

ONE sitting, ONE private window, ONE preview: the preview of the branch `step-7.1`. It contains everything built so far (the access code, the fit levels, 6.2 and 7.1), so all the checks run on it. The earlier previews of `step-6.2` and `integration-check` are not used.

**Note: on this preview a "What to learn" box sits under "Saved ads" in every flow.** In the FIT and 6.2 steps, ignore it unless a step mentions it. `MANUAL-CHECK-7.1.md` covers it.

**Rules (unchanged).** Use only the invented CVs and ads in each file; never a real CV. Never type the access code anywhere except the app's code box; never write it into any file or chat. Never take a screenshot of the "Request Headers" section (in `MANUAL-CHECK-6.1b.md` step 5 you only look at it on your own screen). Report in each document's own step numbers.

## Where things stand

- **The 6.1 live check is DONE:** 25 of 25 steps passed on 2026-11-17 (the log is at the end of `docs/MANUAL-CHECK-6.1.md`). Nothing more to do there.
- **`ACCESS_CODE` is set in Vercel for Production and for Preview** (by the owner; the value is never written anywhere). If you change it, redeploy the branch before you start.
- **6.1b step 1 is already satisfied** (the variable set in Vercel, then the code deployed): `ACCESS_CODE` was set for Production and Preview on 2026-11-17, before the preview of the step-6.2 commits was built. Nothing to do; it is not repeated below.
- **Wherever a document says "the live site" or names another branch** (`step-6.2`, `step-6.1b-access-code`), use the address of this sitting instead.

## The address of this sitting (read this first)

Vercel's sign-in cookie is valid for ONE address only, so use ONE address for the whole sitting.

1. Open the Vercel dashboard, your project, **Deployments**.
2. Find the row for the commit **`b5beb0e`** on the branch `step-7.1`. (Later commits on that branch change documents only, so a later row is the same app. Whichever row you pick, use that one address from start to finish.) Use the **commit-pinned address** of that row, not the branch's short alias.
3. Open that address in a **new private (Incognito) window**, and sign in to Vercel in that window when asked.

## The checks, in this order

| # | File | Steps | AI reads | Time | What it checks |
|---|---|---|---|---|---|
| 1 | `docs/MANUAL-CHECK-6.1b.md`, steps 2 to 9 only | 8 | 3 to 4 | about 20 min | the access code: a code box after "access code needed", the code only in a header, forgetting it |
| 2 | `docs/MANUAL-CHECK-FIT.md` | 10 | 5 to 8 | about 35 min | the fit-level wording ("could not judge", the reason, "Checked and fine", no level) |
| 3 | `docs/MANUAL-CHECK-6.2.md` (with 6.1b step 12 inside its step 9) | 10 (+1 extra click) | about 5 | about 30 min | the level on each saved ad, the order, no profile in use |
| 4 | `docs/MANUAL-CHECK-7.1.md` | 11 (step 10 is optional) | 4 | about 30 min | the "What to learn" box |
| | **Total** | **38** (39 with the optional step) | **17 to 21** | **about 115 min** (two hours with a short break) | |

**AI reads** (the AI call that reads a CV or an ad): the free tier allows about one large read a minute, so wait about a minute between reads. A repeat of the same ad text may come from the reading cache and cost nothing, so the real total can be lower than 17 to 21. The times are estimates, mostly waiting between reads. The optional step 10 of `MANUAL-CHECK-7.1.md` would add 10 reads; skip it unless the reviewer asks.

**Where each of the 13 steps of `MANUAL-CHECK-6.1b.md` is run:**

| 6.1b step | Where | When |
|---|---|---|
| 1 (order followed) | already satisfied, see above | before you start |
| 2 to 8 | Part A, item 1 | first, in the new Incognito window |
| 9, first sentence (enter the right code again) | Part A, item 2 | straight after step 8 |
| 12 (delete everything forgets the code) | Part A, item 4 | inside `MANUAL-CHECK-6.2.md` step 9 |
| 9, rest (close the window, new window, asked again) | Part A, item 6 | last in the sitting |
| 10, 11, 13 | **NOT in this sitting** | after the merge, on the live address (Part B below) |

## How to run them: one private window, one invented CV

Use the invented CV of `docs/MANUAL-CHECK-6.1.md` in every check.

**Part A: ONE new Incognito window on the step-7.1 preview.**
1. `MANUAL-CHECK-6.1b.md` steps 2 to 8. (Step 8 ends with the code forgotten.)
2. Enter the right code again when the box asks for it (this is the first sentence of 6.1b step 9; do NOT close the window yet).
3. `MANUAL-CHECK-FIT.md` steps 1 to 10, in the same window. The page was reloaded in 6.1b step 7, so paste the CV again in its step 1.
4. `MANUAL-CHECK-6.2.md` steps 1 to 10, in the same window. Two changes:
   - In its step 1 skip "open a new private window" (you are in one).
   - **Extra click before its step 9.** In 6.2 step 6 you delete the saved profile, and in step 7 you confirm the CV again "(do not save)", so at step 9 NO profile is saved. 6.1b step 12 needs "a code kept and a profile saved". So after its step 8, with the confirm screen from step 7 still on the page, press **Save on this device** (expect "Saved on this device."). Then do step 9: **Delete everything saved on this device**, then **Yes, delete everything**. That ALSO does 6.1b step 12: **expect** "Everything saved on this device was deleted." (the list is gone, both IndexedDB boxes are empty, as 6.2 says). Straight afterwards press **Send for reading** (or **Read this ad**): **expect** the access code to be asked for again. Enter the right code again to go on.
5. `MANUAL-CHECK-7.1.md` steps 1 to 11, in the same window. In its step 1 skip "open the preview in a new private window": **reload the page instead** (6.2 step 9 deleted everything saved, so the page starts empty, which is what step 1 expects). Skip the optional step 10 unless the reviewer asks.
6. `MANUAL-CHECK-6.1b.md` step 9 LAST: enter the right code, close the whole window, open a new private window on the same address (sign in to Vercel again if it asks), paste the CV and press Send for reading. **Expect:** asked for the code again.

**Part B: after the merge, on the LIVE address (about 30 minutes; NOT in this sitting).**
7. `MANUAL-CHECK-6.1b.md` step 2 once (a 401, then the code box), then steps 10 and 11 (a terminal; the Vercel Logs page). No AI call is made.
8. `MANUAL-CHECK-6.1b.md` step 13 LAST (the rate-limit rule): do it last, because the rule limits requests. When the "Rate Limiting Pricing" dialog appears, STOP and send its words to the reviewer before pressing Continue. No AI call is made.

## Stop rule

On any step that does not match its Expect line: **stop**, write down the step number and exactly what you saw, and send both to the reviewer. Do not try to fix anything and do not carry on to the next step.

**Nothing is merged until all documents are logged "passed".** If a step fails, the fix goes on the branch `step-7.1`, and only the failed step and the steps that depend on it are run again (the reviewer says which).

## What to send back

For each file: "passed", or the step number that did not match and what you saw. Also write down exactly what you saw for `MANUAL-CHECK-6.1b.md` step 12, `MANUAL-CHECK-FIT.md` step 9, `MANUAL-CHECK-6.2.md` steps 4 and 6, and the lines of the box in `MANUAL-CHECK-7.1.md` steps 3 to 7, even if they passed.

## After the checks

When Part A is logged "passed" in all four documents, the reviewer's CC ticks 6.1, 6.2 and 7.1 in `docs/SPRINT.md` (and 7.2 and 6.1b only as the reviewer decides: 6.1b needs its Part B steps on the live address) and makes ONE merge of `step-7.1` (it contains `step-6.2`) into `main`, which deploys the live site. After that deploy, run Part B above on the live address.
