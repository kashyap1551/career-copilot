# The order of the manual checks (one page, for the owner)

ONE sitting, ONE private window, ONE preview: the preview of the branch `step-7.1`. It contains everything built so far (the access code, the fit levels, 6.2 and 7.1), so the three checks run on it. The earlier previews of `step-6.2` and `integration-check` are not used again.

**Note: on this preview a "What to learn" box sits under "Saved ads" in every flow.** In the FIT and 6.2 steps, ignore it unless a step mentions it. `MANUAL-CHECK-7.1.md` covers it.

**Rules (unchanged).** Use only the invented CVs and ads in each file; never a real CV. Never type the access code anywhere except the app's code box; never write it into any file or chat. Never take a screenshot of the "Request Headers" section. Report in each document's own step numbers.

## Where things stand

- **The 6.1 live check is DONE:** 25 of 25 steps passed on 2026-11-17 (the log is at the end of `docs/MANUAL-CHECK-6.1.md`). Nothing more to do there.
- **6.1b steps 1 to 9 are DONE:** the owner ran them in an Incognito window on the `step-6.2` preview (commit `5a52739`) on 2026-11-17 and reported "passed". The access-code files (`lib/ai/accessCode.ts`, `lib/ai/accessMessages.ts`, `app/AccessBox.tsx`, `app/accessFetch.ts`, `app/api/`, and the files that use them) are unchanged since `5a52739`, apart from the added "What to learn" lines in `app/page.tsx`, none of which touch the access code. They are not repeated here. **6.1b step 12 is still done inside 6.2 step 9** (below). Steps 10, 11 and 13 run after the merge on the live address (Part B).
- **`ACCESS_CODE` is set in Vercel for Production and for Preview** (by the owner; the value is never written anywhere). If you change it, redeploy the branch before you start.
- **Wherever a document says "the live site" or names another branch** (`step-6.2`, `step-6.1b-access-code`), use the address of this sitting instead.

## The address of this sitting (read this first)

Vercel's sign-in cookie is valid for ONE address only, so use ONE address for the whole sitting.

1. Open the Vercel dashboard, your project, **Deployments**.
2. Find the row for the commit **`b5beb0e`** on the branch `step-7.1`. (Later commits on that branch change documents only, so a later row is the same app. Whichever row you pick, use that one address from start to finish.) Use the **commit-pinned address** of that row, not the branch's short alias.
3. Open that address in a **new private (Incognito) window**, and sign in to Vercel in that window when asked.

**The first AI read asks for the access code.** The window starts with no code kept, so the first time you press **Send for reading** (the first step of the FIT check) the page shows "access code needed" and a code box. Type the code into the app's code box only, press **Use this code**, then press **Send for reading** again.

## The checks, in this order

| # | File | Steps | AI reads | Time | What it checks |
|---|---|---|---|---|---|
| 1 | `docs/MANUAL-CHECK-FIT.md` | 10 | 5 to 8 | about 35 min | the fit-level wording ("could not judge", the reason, "Checked and fine", no level) |
| 2 | `docs/MANUAL-CHECK-6.2.md` (with 6.1b step 12 inside its step 9) | 10 (+1 extra click) | about 5 | about 30 min | the level on each saved ad, the order, no profile in use |
| 3 | `docs/MANUAL-CHECK-7.1.md` | 11 (step 10 is optional) | 4 | about 30 min | the "What to learn" box |
| | **Total** | **30** required (31 with the optional step) | **14 to 17** | **about 95 min** (an hour and a half, with a short break) | |

These are estimates. **AI reads** (the AI call that reads a CV or an ad): the free tier allows about one large read a minute, so wait about a minute between reads. A repeat of the same ad text may come from the reading cache and cost nothing, so the real total can be lower than 14 to 17. The minutes are mostly waiting between reads. The optional step 10 of `MANUAL-CHECK-7.1.md` would add 10 reads; skip it unless the reviewer asks.

**Where each of the 13 steps of `MANUAL-CHECK-6.1b.md` is run:**

| 6.1b step | Where | When |
|---|---|---|
| 1 to 9 | DONE (owner, 2026-11-17, `step-6.2` preview `5a52739`, "passed") | not repeated |
| 12 (delete everything forgets the code) | Part A, item 2 | inside `MANUAL-CHECK-6.2.md` step 9 |
| 10, 11, 13 | **NOT in this sitting** | after the merge, on the live address (Part B below) |

## How to run them: one private window, one invented CV

Use the invented CV of `docs/MANUAL-CHECK-6.1.md` in every check.

**Part A: ONE new Incognito window on the step-7.1 preview.**
1. `MANUAL-CHECK-FIT.md` steps 1 to 10. In its step 1 the page asks for the access code the first time you send the CV (see "The first AI read asks for the code" above).
2. `MANUAL-CHECK-6.2.md` steps 1 to 10, in the same window. Two changes:
   - In its step 1 skip "open a new private window" (you are in one).
   - **Extra click before its step 9.** In 6.2 step 6 you delete the saved profile, and in step 7 you confirm the CV again "(do not save)", so at step 9 NO profile is saved. 6.1b step 12 needs "a code kept and a profile saved". So after its step 8, with the confirm screen from step 7 still on the page, press **Save on this device** (expect "Saved on this device."). Then do step 9: **Delete everything saved on this device**, then **Yes, delete everything**. That ALSO does 6.1b step 12: **expect** "Everything saved on this device was deleted." (the list is gone, both IndexedDB boxes are empty, as 6.2 says). Straight afterwards press **Send for reading** (or **Read this ad**): **expect** the access code to be asked for again. Enter the right code again to go on.
3. `MANUAL-CHECK-7.1.md` steps 1 to 11, in the same window. In its step 1 skip "open the preview in a new private window": **reload the page instead** (6.2 step 9 deleted everything saved, so the page starts empty, which is what step 1 expects). Skip its optional step 10 unless the reviewer asks.

**Part B: after the merge, on the LIVE address (about 30 minutes; NOT in this sitting).**
4. `MANUAL-CHECK-6.1b.md` step 2 once (a 401, then the code box), then steps 10 and 11 (a terminal; the Vercel Logs page). No AI call is made.
5. `MANUAL-CHECK-6.1b.md` step 13 LAST (the rate-limit rule): do it last, because the rule limits requests. When the "Rate Limiting Pricing" dialog appears, STOP and send its words to the reviewer before pressing Continue. No AI call is made.

## Stop rule

On any step that does not match its Expect line: **stop**, write down the step number and exactly what you saw, and send both to the reviewer. Do not try to fix anything and do not carry on to the next step.

**Nothing is merged until all documents are logged "passed".** If a step fails, the fix goes on the branch `step-7.1`, and only the failed step and the steps that depend on it are run again (the reviewer says which).

## What to send back

For each file: "passed", or the step number that did not match and what you saw. Also write down exactly what you saw for `MANUAL-CHECK-6.1b.md` step 12 (inside 6.2 step 9), `MANUAL-CHECK-FIT.md` step 9, `MANUAL-CHECK-6.2.md` steps 4 and 6, and the lines of the box in `MANUAL-CHECK-7.1.md` steps 3 to 7, even if they passed.

## After the checks

When Part A is logged "passed" in all three documents, the reviewer's CC ticks 6.1, 6.2 and 7.1 in `docs/SPRINT.md` (and 7.2 and 6.1b only as the reviewer decides: 6.1b needs its Part B steps on the live address) and makes ONE merge of `step-7.1` (it contains `step-6.2`) into `main`, which deploys the live site. After that deploy, run Part B above on the live address.
