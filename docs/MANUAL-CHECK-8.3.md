# Manual check for step 8.3 (CV bullets for the ad on screen)

For the owner. Plain words, one small action per step. Each step has **Do**, **Expect** and **Send back**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is `docs/PLAN-8.3.md` (sections 2, 5 and 12).

Use invented text only: no real CV and no real ad goes into this check (rule D2), and the access code is never pasted anywhere except the app's own code box.

Never open the **Request headers** section of a request in the developer tools, and never open **Session storage** (the access code is kept there). Never send a screenshot of either.

Every number and sentence under **Expect** was worked out by hand before any run of this document: the five pairs below come from the invented CV's answer key and the invented ad's requirements (a hand table, then the engine's own answer, which was the same), and every on-screen sentence is copied by a test from the code's own constants, never retyped.

## Before you start

- **Which address.** Use the Vercel preview of the branch `step-8.3`, pinned to one commit. In the Vercel dashboard open the project, then **Deployments**, and find the newest deployment of the branch `step-8.3`. Its commit (the short hash next to it) must be the hash the reviewer gave you, and its state must say **Ready** (if it says Building or Queued, wait; if it says Error, stop and tell the reviewer). Open **that deployment's own address** (the one with the commit in it), not an address that moves with the branch. It sits behind the Vercel sign-in.
- **One window, one address, the whole sitting.** Use **one new private (Incognito) window** in Chrome, and stay on that one address until the end. The browser keeps its storage for each address apart, and a private window forgets everything when you close it.
- **The access code.** The first AI call asks for it. Type it into the app's **own code box only**, press the button next to it, then press the button you were pressing before. Do not write the code anywhere else and do not send it to anyone, the reviewer included.
- AI calls this check needs: **5**. The CV once, AD A once, AD B once, and the bullets button twice (steps 3, 4, 6, 13 and 16). The free tier of the AI service allows only a limited amount of text a minute, so **wait about a minute between two AI calls**. A call made too soon may answer with the busy line (see the table at the end); that is not a defect, wait and try once more. A press that the server turns away because of the access code (step 11) is **not** an AI call.
- **Developer tools:** Cmd+Option+I. The **Network** tab is the list of every request the page sends. Its **Fetch/XHR** button filters the list to the page's own requests; you only count lines, you never open a line.
- **What this block is.** Under the report of the ad on screen, a block called `CV bullets for this ad`. It starts **closed**: one button and one sentence. Pressing the button sends the ad's requirement sentences and up to 5 lines of your CV to the AI, which writes one short bullet for each. The app then **checks** every bullet by plain code against the CV line it came from, and **drops** (throws away, never repairs) a bullet that the checks do not accept. At most 3 bullets are shown.
- **Words you will meet.**
  - **Pair:** one requirement of the ad together with the one CV line that shows you meet it. The app asks the AI for one bullet per pair, 5 pairs at most.
  - **Source line:** the line of your CV a bullet was built from, shown under the bullet as `from your CV line N` with the line's words.
  - **Evidence line:** the line the report itself names as showing a skill (the app counts it, not the AI).
  - **Limiting word:** a word of the CV line that makes the claim smaller, such as *helped*, *assisted*, *only*, *about*, *some*. A bullet that drops it says more than the line does.
  - **The checks:** plain code, not the AI. A bullet is kept only if every word comes from the cited line, the words keep the line's order, no number, date, tool or title is new, and no limiting word was lost.

## The invented material

Copy the texts below exactly. They are made up: the person, the company, the places and the phone and email are invented and belong to no one.

### The CV

Open a plain-text editor (on a Mac: TextEdit, then **Format → Make Plain Text**), paste the twelve lines below, and save the file as `riley-cv.txt` on your Desktop.

CV text:

```text
Riley Fictional, Product Owner, Madeupton
riley.fictional@example.com | 0161 555 0142
2019-2024 Product Owner, Fabricated Apps Ltd
Wrote user stories and acceptance criteria for a team of 8 developers
Ran customer interviews every month and summarised what we heard
Helped the designers build clickable prototypes in Figma
Kept the backlog in Jira and agreed the order of work with the team each sprint
Ran A/B tests on sign-up pages
Presented the product roadmap and the release dates to senior stakeholders every quarter and answered their questions about priorities and risks
Defined the weekly product metrics and built a simple dashboard in Looker
Currently studying for a product analytics certificate in the evenings
Languages: English (native), Spanish (B1)
```

When the page shows the CV it removes the contact details, so line 2 reads `[email removed] | [phone removed]`. That is right. The page numbers the lines 1 to 12, in the order above.

### AD A (a job this CV meets in part)

AD A:

```text
Product Owner
Kestrel Payments, Leeds (hybrid: three days in the office, two days at home)

Kestrel Payments builds a small app that lets shops take card payments. You will join a team of six engineers and two designers and work with them every day.

What you will need
- Write clear user stories and acceptance criteria for the engineering team.
- Talk to customers every month and turn what you learn into product decisions.
- Own the product backlog and decide the order of work.
- Keep senior stakeholders informed about plans and results.

Nice to have
- Experience running A/B tests.
- Familiarity with Figma.

Fluent English is needed. Salary and start date to be agreed.
```

### AD B (a job this CV meets nothing of)

AD B:

```text
Garden Maintenance Assistant
Fernbank Gardens, Harrogate (on site, outdoors)

Fernbank Gardens looks after the gardens of homes and small offices around Harrogate. We are a team of five and we are looking for a helper to join us for the spring and summer season.

What you will need
- Mow lawns and trim hedges.
- Plant and water flower beds and pots.
- Drive a small van and load tools and plants.
- Work outdoors in all weathers.

Nice to have
- A basic first aid certificate.
- Knowledge of garden plants.

Early starts, Monday to Friday. Pay to be agreed.
```

## What the block should ask for (AD A with this CV)

Worked out by hand from the CV and AD A, with no AI: the order is the must-haves first, then the nice-to-haves, each in the ad's order; one pair for each CV line; at most 5 pairs. The Figma line (line 6) would be the sixth pair and is left out by the cap of 5. Line 11 is never used: it says you are *currently studying*, and a line about something you are only learning is never sent.

| id | CV line | The ad's requirement | The CV line |
|---|---|---|---|
| 1 | 4 | Write clear user stories and acceptance criteria for the engineering team. | Wrote user stories and acceptance criteria for a team of 8 developers |
| 2 | 5 | Talk to customers every month and turn what you learn into product decisions. | Ran customer interviews every month and summarised what we heard |
| 3 | 7 | Own the product backlog and decide the order of work. | Kept the backlog in Jira and agreed the order of work with the team each sprint |
| 4 | 9 | Keep senior stakeholders informed about plans and results. | Presented the product roadmap and the release dates to senior stakeholders every quarter and answered their questions about priorities and risks |
| 5 | 8 | Experience running A/B tests. | Ran A/B tests on sign-up pages |

**Read this plainly:** the AI that reads your CV and the ad on the page may read them slightly differently from the table (a skill it does not list, or a different line for one skill). **The page's own report is the reference, not this table.** For each bullet you check, compare the `from your CV line N` under it with the evidence line that the report shows for the same requirement; the two must agree. The table only tells you what to expect if the reading is the same.

## The steps

1. **Open the preview and set up the Network list.**
   **Do:** open the pinned preview address in a **new private window**. Open the developer tools (Cmd+Option+I), go to the **Network** tab, tick **Preserve log** (a reload empties the list otherwise), click the **Fetch/XHR** button, and press the clear button so the list is empty.
   **Expect:** the page loads with a box for the CV and no bullets block. The Network list is empty.
   **Send back:** "passed", or what you see.

2. **Choose the CV file.**
   **Do:** press **Choose file** and pick `riley-cv.txt`. Do not press anything else.
   **Expect:** the 12 lines of the CV are shown, numbered 1 to 12, and line 2 reads `[email removed] | [phone removed]`. Nothing is sent yet: the Network list stays empty.
   **Send back:** "passed", or what you see.

3. **The access code box, then the CV read (AI call 1 of 5).**
   **Do:** press **Send for reading**. The access code box opens. Type the access code into **that box only** and press the button next to it, then press **Send for reading** again. Wait for the answer.
   **Expect:** after the first press the box shows Text: `Enter the access code you were given, then press the button again.` and a field with the label Text: `Access code` and a button Text: `Use this code`. After the code, the box shows Text: `Access code kept in this tab until you close it.` After the second press the page shows **Reading…** and then the confirm screen with the skills the AI found in your CV. Keep every skill ticked; add nothing; do **not** press **Save on this device**. (A line in the Network list with status 401 after the first press is expected: the server turned it away for want of a code, and it was **not** an AI call.)
   **Send back:** "passed", or what you see. Never the code.

4. **Paste AD A and read it (AI call 2 of 5; wait about a minute after step 3).**
   **Do:** paste AD A into the box for an ad and press **Read this ad**. Wait for the answer.
   **Expect:** the report of the ad appears with its requirements, and under it the bullets block. Look at the report: next to each requirement you meet it names the evidence line of your CV. Write down the evidence line number for the user-stories, backlog and stakeholders requirements; you compare them with the bullets in step 8.
   **Send back:** "passed", or what you see, and the three evidence line numbers.

5. **The closed block, before any click.**
   **Do:** look under the report. Do not press the bullets button yet. Clear the Network list (the clear button).
   **Expect:** the closed block and nothing else of it: a button Text: `Write CV bullets for this ad` and, under it, one sentence, Text: `This sends the ad's requirement lines and up to 5 lines of your own CV to the AI service (Groq). We store nothing and do not log the text.` No bullet is on screen. The Network list is still empty.
   **Send back:** the two on-screen texts as you see them, and "passed" or what differs.

6. **Press once: the waiting text, the disabled button, and the count of requests (AI call 3 of 5; wait about a minute after step 4).**
   **Do:** press `Write CV bullets for this ad` once. At once press the same button **two or three more times** while it still says it is working. Wait for the answer.
   **Expect:** right after the first press the button reads Text: `Writing bullets...` and is greyed out; the extra clicks do nothing. In the Network list, **filter the names by typing `bullets`**: **exactly one request** whose name holds `bullets`, however often you clicked. Count lines only.
   **Send back:** the number of `bullets` requests (expected: 1), and "passed" or what you see.

7. **The result.**
   **Do:** look at the block when it opens.
   **Expect:** a framed block with the title Text: `CV bullets for this ad` and a button Text: `Hide the bullets`; under them the sentence Text: `Each bullet is built from the words of the CV line shown under it. Read each one before you use it.` Then **1 to 3 bullets**, each followed by a quieter line `from your CV line N: "..."` that holds the source line's words (when a bullet is the same as its source line, the line is shown **once**, as `from your CV line N` alone: that is right). Five pairs were asked and at most 3 bullets are shown. If the checks dropped a bullet, one sentence says so: for one, Text: `1 bullet was dropped by the checks: it did not stay close enough to your CV line.` and for two or more, Text: `2 bullets were dropped by the checks: they did not stay close enough to your CV line.` (with the number that applies). Bullets that were only left out because the block shows 3 at most are **not** counted as dropped. Last, a button Text: `Copy bullets as text`. If no bullet passed, you see instead Text: `No bullet passed the checks, so none is shown. You can try again, or use your CV lines as they are.` which is a valid outcome (see the table at the end): then press the bullets button once more (a sixth AI call, after a minute) and carry on with what you get.
   **Send back:** the on-screen words of the title line, the sentence under it, each bullet with its source line, and the dropped sentence if there is one.

8. **Read each bullet next to its source line.**
   **Do:** for **each** bullet, read it next to the line under it, and answer these four questions with yes or no:
   (a) Does **every word from the line**? (Each word of the bullet is a word of the CV line, or a plain form of one, such as *report* for *reports*.)
   (b) Are the words in the **line's order**?
   (c) Is any **limiting word** of the line lost, such as *helped*, *assisted*, *only*, *about*, *some*? (A bullet that says "built clickable prototypes" for the line "Helped the designers build clickable prototypes" has lost *helped*.)
   (d) Does the bullet hold any **new fact**: an employer, a title, a number, a date, a tool or a result that the line does not say?
   Also compare the line number under each bullet with the evidence line in the report (step 4).
   **Expect:** (a) yes, (b) yes, (c) no, (d) no, for every bullet, and the line numbers agree with the report. A "no" on (a) or (b), or a "yes" on (c) or (d), is a **finding**: write the bullet and its source line down word for word and send them back. That is exactly what this check is for.
   **Send back:** for each bullet, its number and the four answers, for example "bullet 1: yes, yes, no, no", and every finding in full.

9. **Copy the bullets as text.**
   **Do:** press `Copy bullets as text`. Open a notes app (on a Mac: Notes, with an empty scratch note) and paste (Cmd+V). Then press Cmd+Down arrow to go to the end of the note.
   **Expect:** next to the button the page says Text: `Copied.` In the note, each bullet is on its own line with `- ` in front, and nothing else: no line numbers, no `from your CV line` lines, and **no empty line after the last bullet** (the cursor at the end sits at the end of the last bullet). Delete the scratch note afterwards.
   **Send back:** "passed", or what the pasted text looked like (the invented bullets may be pasted).

10. **Hide the bullets.**
    **Do:** press `Hide the bullets`. Do not clear the Network list.
    **Expect:** the bullets disappear and the block is closed again: the button Text: `Write CV bullets for this ad` and the same notice sentence as in step 5. The number of `bullets` requests is still the same as in step 6 (Hiding sends nothing).
    **Send back:** "passed", or what you see.

11. **A wrong access code (no AI call is made).**
    **Do:** near the **Read this ad** button press the button Text: `Forget the code`. Then press `Write CV bullets for this ad`. The access code box opens in the bullets block. Type the words `this is wrong on purpose` into it, press `Use this code`, and press the bullets button again. Then type the **real** access code into the same box, press `Use this code`, and **do not** press the bullets button again yet.
    **Expect:** after "Forget the code" the page says Text: `The access code was forgotten.` After the first press of the bullets button the box shows Text: `Enter the access code you were given, then press the button again.` After the wrong words the box shows Text: `That access code was not accepted. Check it and try again.` **Nothing else is lost:** the CV, the confirm screen, the report of AD A and the closed bullets block are all still there, and no bullet is shown. After the real code the box shows Text: `Access code kept in this tab until you close it.` In the Network list the `bullets` requests that were turned away show status 401; they made no AI call.
    **Send back:** "passed", or what you see (the words the box showed, never the code).

12. **The offline test.**
    **Do:** in the **Network** tab open the throttling list (it says **No throttling**) and choose **Offline**. Press `Write CV bullets for this ad`. Then set the list back to **No throttling**.
    **Expect:** the block shows one plain line, Text: `Could not reach the server. Check your connection and try again.` The button is still there, no bullet is shown, and nothing else on the page changed. No AI call was made. (A red failed line in the Network list is expected.)
    **Send back:** "passed", or what you see.

13. **Press again, online (AI call 4 of 5; wait about a minute after step 6).**
    **Do:** with the connection back on, press `Write CV bullets for this ad`. This is a **second AI call**, and it is allowed: a second press is a second, visible call, never an automatic one.
    **Expect:** the block opens again with bullets and their source lines. They may differ from the first time; that is normal. Do step 8's four questions once more for each bullet.
    **Send back:** the four answers for each bullet, and any finding in full.

14. **The words guard.**
    **Do:** with the bullets showing, look through everything **inside the framed block** (the title, the sentences, the bullets, the buttons) for these words: ready, tailored, improve, boost, optimise (and the American spelling optimize). Use Cmd+F if you like, and look only at highlights inside the frame.
    **Expect:** none of them appears anywhere in the block. (They may appear in a bullet only if the CV line itself holds that word; none of the CV lines above does.)
    **Send back:** "passed", or the word and where you saw it.

15. **A narrow window.**
    **Do:** open the device toolbar of the developer tools (Cmd+Shift+M) and choose a width of about 375 px (a phone). Look at the block, especially the source line of the longest CV line (line 9).
    **Expect:** every line wraps inside the page: no sideways scrolling, no text cut off, and the buttons stay inside the frame. Then close the device toolbar.
    **Send back:** "passed", or what you see and which line.

16. **Switch to AD B: nothing to write from (AI call 5 of 5; wait about a minute after step 13).**
    **Do:** clear the ad box, paste AD B, and press **Read this ad**.
    **Expect:** the report of AD B shows, and the old bullets are **gone**: where the block was there is one sentence, Text: `No requirement of this ad is met by a line of your CV, so there is nothing to write from.` and no button. (The AI could in theory find a requirement your CV meets in this ad; if you see the closed block instead, send back the report's list of requirements.)
    **Send back:** "passed", or what you see.

17. **Count the requests.**
    **Do:** look at the **Network** list (Fetch/XHR, with **Preserve log** on since step 1). Clear the name filter and count by name.
    **Expect:** answer with numbers. Requests to the CV read (`cv` in the name): **1**. Requests to the ad read (`ad`): **2** (steps 4 and 16). Requests to `bullets` that came back with status 200: **2** (steps 6 and 13). Requests to `bullets` turned away with status 401: up to 2 (step 11). One failed request to `bullets` from the offline step is expected. **No request** for Hide, Copy, switching the ad, the narrow window or the words search.
    **Send back:** the four numbers (cv, ad, bullets with 200, bullets with 401).

18. **Reload: nothing is kept.**
    **Do:** reload the page (Cmd+R). Then in the developer tools open the **Application** tab and, under **Storage**, expand **IndexedDB** (the database names only). **Do not open Session storage.**
    **Expect:** the page starts empty: no CV, no ad, no report and no bullets anywhere (nothing about bullets is stored, and you saved nothing in this check). IndexedDB holds no row with any bullet text; it may hold nothing at all.
    **Send back:** "passed", or what you see.

19. **The Console.**
    **Do:** open the **Console** tab.
    **Expect:** no red errors of ours. (The red line from the offline step 12 is expected; browser-extension noise is known.)
    **Send back:** "passed", or the red text (never a request header).

## What you might see and what it means

| You see | What it means |
|---|---|
| Text: `The AI service is busy right now. Please try again in a minute.` | You made an AI call too soon after another one, and the free tier's limit was reached. Not a defect: wait a minute and press the button once more. |
| Text: `The AI did not answer in time. Please try again.` | The page gave up after 30 seconds and ignores a late answer. Press the button again after a minute. If it happens twice in a row, send the step number back. |
| Text: `No bullet passed the checks, so none is shown. You can try again, or use your CV lines as they are.` | A valid outcome, not a bug: the AI's bullets did not stay close enough to your CV lines and every one was dropped. It is the checks working. Press again once if you need bullets for the next steps, and send this back. |
| A bullet with the same words as its source line, and only `from your CV line N` under it | Valid: when a bullet is the same as its line, the line is shown once. |
| A line saying the AI reading is paused, or not set up yet | The reviewer switched the AI off, or the code is not set up on the server. Stop and tell the reviewer. |
| A line saying the AI answered, but not in the expected shape | The AI's answer was unusable. Not a defect of the checks; press again after a minute and send it back if it repeats. |
| Fewer bullets than pairs asked (5 asked, at most 3 shown) | Normal: the block shows 3 at most, and a dropped bullet is never repaired. |

## What to send back

- For each step: "passed", or the step number and what you saw instead.
- The on-screen words of each state you reached: step 5 (the button and the notice), step 7 (the title line, the sentence under it, the dropped sentence), step 9 (the word after the copy), step 11 (what the code box said), step 12 (the offline line), step 16 (the nothing-to-write sentence).
- The per-bullet answers of step 8 and step 13: for each bullet "yes, yes, no, no" or the answers you gave, with the bullet and its source line word for word whenever any answer is not the expected one. (These are invented lines, so pasting them is fine.)
- The Network counts of step 6 and step 17.
- Anything odd, however small: a line that looks wrong, a button that did nothing, a wait of more than a minute.

## What NOT to send back

- The access code, in any form, and any screenshot or text of the **Request headers** section.
- Anything from **Session storage**, tokens, cookies or keys.
- Anything real: a real CV, a real ad, a real name, email, phone or address. This check uses the invented material above only.

## Result

Results are recorded with the commit of the preview you used: commit ______ .

- [ ] All 19 steps passed
- [ ] Every bullet answered (a) yes, (b) yes, (c) no, (d) no
- [ ] Findings to send back (list the step numbers): ______
- [ ] Not run (say why): ______
