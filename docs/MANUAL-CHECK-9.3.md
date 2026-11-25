# Manual check for step 9.3 (privacy page, the tick, delete everything)

STATUS: NOT RUN YET. Written 2026-11-25 at stage 2.6 of docs/PLAN-9.3.md. The wording on the privacy page is still DRAFT (the owner approves it at stage 2.7).

For the owner. Plain words, one small action per step. Each step has **Do** and **You should see**, and a box to tick when it matches. If what you see is not what is written, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything.

About 25 to 30 minutes. Sections A, B, C, F and G do not use the AI. Section D uses your access code but no AI call. **Section E uses the AI twice** (one CV read, one ad read).

## Before you start

- **Where to run it.** First on the **Vercel preview of the latest `step-9.3` push** (open it from the Vercel Deployments page; check it says Ready; Vercel asks you to sign in when you open a preview in a fresh private window). After the merge, repeat sections B, F and G on the live site: https://career-copilot-theta-seven.vercel.app. On a preview, cookies set by Vercel's own sign-in may show up in section F: write their names down and do not count them against the app. The cookie check that counts is the one on the live site.
- **The preview may not have the access code or the AI key.** Previews can have their own settings. If a send on the preview answers **503** with "This site is not set up to read yet." instead of 401, write that in the sign-off and run the steps that need the server's answer (B4, B6, C2, D1, D2, D6, E1 to E7) on the live address after the merge. Steps that need no server answer still count on the preview.
- **Browser.** Google Chrome. Use a **fresh private (Incognito) window** for everything, with every other private window closed (Chrome shares what a page stores between private windows until the last one is closed).
- **Invented data only.** Use only the text in this file. No real CV, no real name, no real email, no real phone number. A real CV must not go through the live page yet: what the AI service does with it is "not confirmed yet" on the privacy page itself.
- **Your access code.** Type it only into the "Access code" box on the page. **Do not write it in this file, in notes, or in a message.** Where this file says "your access code (do not write it here)", that is what it means.
- **Developer tools.** Press **Cmd+Option+I**.
  - The tab **Network** lists every request the page sends. Tick **Preserve log**, choose the filter **Fetch/XHR**, and use the clear button (the circle with a line) to empty the list before a step. To see what a request carried, click its row, then the tab **Payload** (older Chrome: **Request**).
  - The tab **Application** shows what the page stores. Open **IndexedDB** (inside it `career-copilot`, then `profile` and `jobs`), and **Cookies**. **Never open "Session storage"** (it holds your access code).
- **A request without a valid access code costs nothing.** On the live site the server answers 401 before any AI call. So sections B to D can look at what is sent without using the AI.

## The invented material

**The invented CV** (paste all of it into the CV box). The email and the two phone numbers are the reserved fake ones: the email is `jane.sample@example.com`, the first phone number has the format the app removes, the second has a format it misses.

```
Alex Example, Reporting Analyst, Exampleville
Email: jane.sample@example.com
Phone: +49 30 0000000
Mobile: 555-123-4567
2022-2025 Reporting Analyst, Imaginary Logistics Ltd
Wrote SQL queries to reconcile order data
Built monthly dashboards in Tableau
Kept the weekly sales sheet in Excel
Languages: English (native), German (B2)
```

**The invented ad** (paste all of it into "The job ad" box). It carries the reserved fake recruiter email `recruiter@example.org`.

```
Reporting Analyst at Imaginary Logistics Ltd, Exampleville. Hybrid, two days in the office.
You have strong SQL and Excel. Nice to have: Tableau.
To apply, write to recruiter@example.org.
```

## A. The privacy page (no AI)

- [ ] **A1. Do:** open the first screen. Scroll to the very bottom. Open the Network tab, clear it, then click the small underlined link **Privacy**.
  **You should see:** the page "Privacy" opens in the same tab. In the Network list there is no row whose name contains `api` (one row with `privacy` or `_rsc` in its name is fine).
- [ ] **A2. Do:** read the whole page from the top. Check the headings, in this order: **What leaves your browser, and when** / **What is stored, and where** / **What is logged** / **Who processes your text** / **Cookies and analytics** / **Your controls** / **The demo** / **Not confirmed yet**.
  **You should see:** exactly those eight headings in that order. Under "Who processes your text": a first line saying two services handle your text, then Groq's own sentence in quotation marks, each fact with "Source: ... Checked on: ..." under it, and a line saying some facts are not confirmed yet (this same line also appears under "Cookies and analytics"). Under "Not confirmed yet", five sentences, each beginning "Not confirmed yet:" except the last, which begins "No analytics code is in this app."
- [ ] **A3. Do:** look for an **Impressum**, a contact line, an email address, a postal address or a phone number anywhere on the page.
  **You should see:** none. That is on purpose: the Impressum is the owner's decision and is not built yet. At the bottom there are two links, "Back to the app" and "Try the demo with invented data".
- [ ] **A4. Do:** click **Back to the app**. Paste the invented CV into the CV box. Click the link **Open the privacy page in a new tab** under the CV notice.
  **You should see:** the privacy page opens in a **new tab**. Switch back to the first tab: the CV text is still in the box, the page was not reloaded.

## B. The tick in the CV box (no AI)

- [ ] **B1. Do:** go back to the first tab. Look at the CV box, just above the "Send for reading" button.
  **You should see:** a notice that starts "When you press 'Send for reading', the numbered lines (shown above once you add your CV text) leave your device ..." and ends "The privacy page says what is kept." followed by the link "Open the privacy page in a new tab"; under it a **checkbox, not ticked**, with the words "I have read this, and I am sending my own text to be read by an AI service."; then the button.
- [ ] **B2. Do:** look at the lines under "What will be sent" (the invented CV is still pasted).
  **You should see:** line 2 reads `Email: [email removed]`, line 3 reads `Phone: [phone removed]`, line 4 still reads `Mobile: 555-123-4567`.
- [ ] **B3. Do:** clear the Network list. With the box **not ticked**, press **Send for reading**.
  **You should see:** red text next to the button: "Tick the box before you send your CV." The Network list stays empty: **no `/api/cv` row.**
- [ ] **B4. Do:** tick the box. Press **Send for reading** (do not type any access code).
  **You should see:** the red text goes away when you tick. In the Network list exactly **one** `/api/cv` row, with status **401**. An "Access code" box appears under the button saying "Enter the access code you were given, then press the button again." No AI was used.
- [ ] **B5. Do:** reload the page (Cmd+R).
  **You should see:** the CV box is empty again (that is expected) but the checkbox is **still ticked**.
- [ ] **B6. Do:** clear the Network list. Paste the invented CV again and press **Send for reading**, without touching the checkbox.
  **You should see:** no red "Tick the box" text, and one new `/api/cv` row (401). A second send in the same tab needs no new tick.
- [ ] **B7. Do:** open a **new tab** in the same private window and type the address of the page (do not use "Duplicate").
  **You should see:** in the new tab the checkbox is **not ticked**. The tick belongs to the tab where you gave it.
- [ ] **B8. Do:** close the first tab, then open another new tab by typing the address.
  **You should see:** the checkbox is **not ticked** (closing the tab forgot the tick).

## C. What really leaves the browser, in the Network tab (no AI)

- [ ] **C1. Do:** in a tab, clear the Network list, paste the invented CV, tick the box, press **Send for reading**. Click the `/api/cv` row, then **Payload**.
  **You should see:** a body that begins `{"lines":[` and lists the numbered lines. The text `jane.sample@example.com` and `+49 30 0000000` appear **nowhere** in it (the lines say `[email removed]` and `[phone removed]`). The text `555-123-4567` is **still there**. Your name "Alex Example" is there too. This is why the notice says the check "can miss some formats" and "does not touch your name".
- [ ] **C2. Do:** clear the Network list. Paste the invented ad into "The job ad" box. Look at the notice above the "Read this ad" button, then press **Read this ad**. Click the `/api/read` row, then **Payload**.
  **You should see:** a notice starting "When you press 'Read this ad', the whole text in the box leaves your device ..." with the link "Open the privacy page in a new tab". The body is `{"text":"..."}` and it **does contain** `recruiter@example.org` (the ad is not cleaned, as the page says). The row has status 401 (no code typed): no AI was used.
- [ ] **C3. Do:** look around the ad button for a checkbox.
  **You should see:** **no checkbox and no tick** in the ad box. The ad was sent although the CV checkbox in this tab may be unticked: the ad is not gated.
- [ ] **C4. Do (optional, 2 minutes):** save the invented CV as a plain `.txt` file, clear the Network list, then choose that file with "Choose file".
  **You should see:** the text appears in the CV box and the Network list stays empty: the file itself never leaves the browser.

## D. The access code and "delete everything" (needs your access code, no AI call)

- [ ] **D1. Do:** reload. Paste the invented CV, tick the box, press **Send for reading** (no code typed yet).
  **You should see:** the "Access code" box under the button with "Enter the access code you were given, then press the button again."
- [ ] **D2. Do:** type your access code (do not write it here) into that box and press **Use this code**. Do **not** press Send.
  **You should see:** the box now says "Access code kept in this tab until you close it." and a "Forget the code" link appears.
- [ ] **D3. Do:** scroll to the line **Delete everything saved on this device** and press it, then press **Yes, delete everything**.
  **You should see:** the confirm question "Delete the saved profile and everything else saved on this device?" and then, in the status line: "Deleted: the saved profile and ads on this device, and the access code and the tick kept for this tab. Text still on the screen goes away when you reload the page." The CV checkbox is now **not ticked**, without a reload.
- [ ] **D4. Do:** look at the CV "Access code" box, and at the whole page, for the old message.
  **You should see:** the CV "Access code" box is **gone**, and the message "Access code kept in this tab until you close it." is **nowhere on the page**. (A page with a delete button must not say something that is no longer true: delete everything resets what the box says.) Write down anything that is still on screen about the access code.
- [ ] **D5. Do:** look at the ad box (under the job ad).
  **You should see:** if an "Access code" box was showing there only because a code was kept, it is gone now, and so is any "Forget the code" link.
- [ ] **D6. Do:** clear the Network list. Press **Send for reading** once with the box **not ticked**, then tick it and press again.
  **You should see, in this order:** first the red "Tick the box before you send your CV." and no request; then, after you tick and press, one `/api/cv` row with status **401** and the code box with "Enter the access code you were given, then press the button again." The code is asked for again at the **next send**, not at once, and for the CV the tick message comes first.

## E. Save and delete (needs your access code; uses the AI twice)

- [ ] **E1. Do:** type your access code (do not write it here) in the CV "Access code" box and press **Use this code**. (If no Access code box is showing, paste the CV, tick the box and press **Send for reading** once: the answer is 401 and the box appears. No AI is used for that press.) Paste the invented CV, tick the box, press **Send for reading**. (**AI call 1.**) Leave the ticked skills as they are and press nothing else.
  **You should see:** "N skills found. Confirm them below." and, below the confirm box, a button **Save on this device** with this line under it: "Saved on this device, in this browser only. Saving does not send it anywhere, and anyone who can use this browser can see it. You can delete it at any time. In a private window it is deleted when you close the window."
- [ ] **E2. Do:** press **Save on this device**. In the Application tab open IndexedDB, `career-copilot`, `profile` (refresh the panel), and open the one record (key `current`).
  **You should see:** the line "Saved on this device." and exactly **one** record. Inside it, the `skills` each carry one **cited line** (for example "Wrote SQL queries to reconcile order data"). Lines such as `Email:`, `Phone:`, `Mobile:` and "Alex Example, Reporting Analyst, Exampleville" are **not** in the record, and the whole CV is not there. The record also has a `savedAt` date.
- [ ] **E3. Do:** paste the invented ad into "The job ad" box and press **Read this ad**. (**AI call 2.**) Then press **Save this ad** and open IndexedDB, `jobs`.
  **You should see:** the same notice line under **Save this ad**, and exactly **one** record in `jobs` that holds the whole ad text (the email `recruiter@example.org` is in it, as the page says) and the AI's reading of it.
- [ ] **E4. Do:** press **Delete everything saved on this device**, then press **Cancel**.
  **You should see:** nothing changed: the CV checkbox is still ticked, the code is still kept (the ad box still has its "Forget the code" link), and IndexedDB still has 1 record in `profile` and 1 in `jobs`.
- [ ] **E5. Do:** press **Delete everything saved on this device**, then **Yes, delete everything**.
  **You should see:** the status line "Deleted: the saved profile and ads on this device, and the access code and the tick kept for this tab. Text still on the screen goes away when you reload the page." The "Saved ads" box is gone, the CV checkbox is **not ticked** (no reload needed), and the "Forget the code" link is gone.
- [ ] **E6. Do:** reload the page, then refresh the IndexedDB panel.
  **You should see:** the checkbox is still **not ticked**, and both `profile` and `jobs` have **no entries**.
- [ ] **E7. Do:** with nothing saved, look for the line **Delete everything saved on this device**, press it and then **Yes, delete everything**.
  **You should see:** the control is **still shown**, and the same "Deleted: ..." text appears.

## F. Cookies and other hosts (no AI)

- [ ] **F1. Do:** in a **normal** Chrome window (not private) open the site, open Application, **Cookies**, and the site's address.
  **You should see:** **no cookie** for the site. If any appears, write its name down (do not count Vercel sign-in cookies on a preview).
- [ ] **F2. Do:** the same in the **private** window.
  **You should see:** no cookie for the site (same note for a preview).
- [ ] **F3. Do:** in the private window open the Network tab, choose the filter **All**, clear it, and reload the first screen.
  **You should see:** every row comes from the site's own address. No other host, and no row whose name contains `insights`, `analytics` or `gtag`.

## G. The demo (no AI)

- [ ] **G1. Do:** clear the Network list (filter Fetch/XHR). On the first screen press **Try a demo with invented data**.
  **You should see:** the demo page. At most one row with `demo` or `_rsc` in its name; **no row with `api`**.
- [ ] **G2. Do:** look over the whole demo page.
  **You should see:** **no checkbox, no "Save on this device", no "Save this ad", no "Delete everything saved on this device", no Delete buttons, and no text box for a CV or an ad** (the small boxes of the confirm area, such as the cities box, are expected).
- [ ] **G3. Do:** untick one skill in the confirm box, open one ad with its **Open** button, tick the skill again.
  **You should see:** the levels change and a report opens, and the Network list shows **no new row at all**.

## H. What cannot be checked by hand

- **The case where saving is not available** (the saved-data database cannot be used, for example a browser that blocks it). Then "Delete everything saved on this device" should still show and should only forget the tab's code and tick. Real browsers rarely let you make this happen on demand, so it is covered only by the tests D2, D4, D5 and D7 in `tests/deleteMyData.test.ts`.
- **The setting that keeps `/privacy` static** (`export const ensureStatic = "navigation"`). It was watched on 2026-11-25 by temporarily asking the page for request-time data and running `npm run build`; the change was undone afterwards. What was seen: (1) with the setting, asking for request data directly: the build fails with an error naming "/privacy" and saying "This route is configured to be fully static, but some data requires rendering at request time."; (2) without the setting, the same change: the build also fails, with a different error ("uncached or runtime data during prerendering ... accessed outside of `<Suspense>`"); (3) without the setting, request data placed inside `<Suspense>`: the build **passes** and the route list shows `/privacy` as `◐` (partly rendered per request) instead of `○`; (4) with the setting, the same `<Suspense>` change: the build fails with the "configured to be fully static" error. So the setting does protect the page beyond Next's general rule. You cannot see this in a browser.
- **What the tab's storage holds.** The only two session-storage keys are `career-copilot.access-code` and `career-copilot.consent`. That is pinned by test I5, which reads the code, not a browser. Session storage is never opened in this check (it holds your access code).
- **What the AI service and the hosting service do with your text:** the page says it is "not confirmed yet" for five points. The reviewer and the owner settle those at stage 2.7; nothing in this check can show them.

## I. For the reviewer: the privacy gate (Claude Code runs it and pastes the output; the reviewer reads it)

The command is `PRIVACY_GATE=1 npx vitest run tests/privacyFacts.test.ts`. Expected today (2026-11-25): F1 and F2 pass; **F3 fails** naming the facts not yet confirmed (U1, U3, U4b, U5, U6); **F4 fails** because `WORDING_APPROVED_ON` is null. Without `PRIVACY_GATE` the same file passes with F3 and F4 skipped. After stage 2.7 the gate command must pass.

Pasted output and date: ______________________________

## Sign-off

Date: ____________  Who: ____________  Address used (preview or live): ____________

| Section | What I saw that differs from this file (write "nothing" if it all matched) |
|---|---|
| A. The privacy page | |
| B. The tick in the CV box | |
| C. What leaves the browser | |
| D. The access code and delete everything (step D4: anything about the code still on screen) | |
| E. Save and delete | |
| F. Cookies and other hosts | |
| G. The demo | |
| Red text in the Console tab (any step) | |
