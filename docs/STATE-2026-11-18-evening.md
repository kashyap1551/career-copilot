# State of 2026-11-18, evening (8.3 checkpoint)

Written on step-8.3. Read next to docs/STATE-2026-11-18.md (the day-end file on step-8.1), docs/HANDOFF.md and docs/PLAN-8.3.md.

## 1. Branch tips and the live site

Real tips read from origin on 2026-11-18:

| Branch | Tip |
|---|---|
| main | f7b2a0c |
| step-6.2 | 5a52739 |
| step-6.1b-access-code | 322f3c8 |
| step-fit-levels | a286681 |
| integration-check | 1137377 (keep) |
| step-7.1 | 0ac2632 |
| step-7.3 | e8b8748 |
| step-8.1 | 3831e02 |
| step-8.2 | 3401fdd |
| step-8.3 | d914db9 (2,068 tests, 111 files) |

- main is live.
- The work on the other branches is NOT live yet.

## 2. 8.3 status

- Stages 0 to 4 are done.
- Prompt v2 is 3,011 characters and names all 83 limiting words.
- The bullets request hash is pinned: 5e3da9fa30 (T23).
- Unchanged pins: ad 85357f8fac, CV 193e02ee3f, vocabulary hash e96370fe4c, READING_VERSION "3".
- W8 counts only pairs a check dropped, never pairs left out by the cap of 3 (0.27).
- The block has its own access source "bullets".
- The eval counts accepted bullets BEFORE the cap (accepted = asked - dropped.length), with the shown number beside it.

## 3. Next for 8.3, in order

1. Stage 5: the eval script and its guards, no AI call.
   - NOTE: writeBullets needs an optional `show` parameter, default 3, so the eval can count accepted bullets before the cap. The route keeps 3.
2. Stage 6: deliberate breaks. B41 to B45 are already run.
3. Stage 7: docs/MANUAL-CHECK-8.3.md.
4. Stage 8: a calibration run (not counted), then the counted eval on invented material with real AI calls. The owner and the reviewer decide first.

Open risks:
- Groq strict-mode acceptance of the answer schema is untested.
- Real 429 timing is untested.
- Yield is unknown.
- The "currently" learning marker costs yield.
- Skill-list lines give trivial bullets.
- Many bullets may equal their line (the UNCHANGED metric).

## 4. Parked manual sittings

Plan: one batched checklist each, done in one sitting.

- Batch 4:
  - The 7.1 leftovers, on the commit-pinned address https://career-copilot-1k882y3u3-chinmay-rk.vercel.app.
  - 3 AI reads.
  - HANDOFF item 16 last.
- Sitting B:
  - The step-8.2 preview at commit 3401fdd. Check that it is Ready first.
  - MANUAL-CHECK-7.3, 8.1 and 8.2 in one sitting.
  - 11 AI reads, 12 with the optional re-read.

## 5. Merge order after the sittings pass

1. step-7.1 first (it carries 6.1b, fit levels and 6.2).
2. Then 7.3.
3. Then 8.1.
4. Then 8.2.
5. Then 8.3.

- 8.1 never goes before the 7.3 manual check passes.
- The owner then runs the live steps: 6.1b step 2, then 10 and 11, then 13 last.
- The reviewer writes the merge-time prompt.

## 6. Owner homework

- Groq training terms and Zero Data Retention. Needed before any real CV, and to make "We store nothing" fully true.
- The Vercel Firewall rate rule. Stop at the "Rate Limiting Pricing" dialog and send its words to the reviewer.
- Check whether the GitHub repo is public.
- Delete the emailed copy of the access code once the private copy is confirmed.
- The open 7.3 step 5b opinion.
- Blog post 13 needs the post 5 link.

## 7. Rough edges seen today

- After "Hide the bullets", the block's access box may show an old "code kept" line.
- A requirement that the route refuses cannot pass its CV line to a second requirement (chooseBulletPairs keeps one pair per line).
- When the page rejects one of the 3 bullets the route sent, fewer than 3 are shown even if valid bullets were capped. Idea: the route returns up to 5 and the page caps at 3.
- Red-test commits make a Vercel PREVIEW fail by design. Ignore those emails; main is not touched.
