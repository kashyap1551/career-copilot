# Manual check for step 6.1b (the access code)

For the owner. Plain words, one small action per step. Each step has **Do** and **Expect**. If what you see is not what is written under Expect, stop, write down the step number and what you saw, and send it to the reviewer. Do not try to fix anything. The design is in `docs/PLAN-ACCESS-CODE.md` (section 6 is this check).

6.1b is ticked in `docs/SPRINT.md` only after all 13 steps pass.

## Before you start

- Make the code yourself, with the machine: in a terminal run `openssl rand -hex 16`. It prints 32 random characters. Paste it into the Vercel variable `ACCESS_CODE` (Production, and Preview if you want to check on the branch's preview address; mark it Sensitive if the dashboard offers it). **Never** put the code in this file, in the repository, in a document or in a chat with me. Keep it in your password manager and send it to people privately.
- Order: set the variable FIRST, then deploy the code. Until the variable is there, the two routes answer "This site is not set up to read yet. Please try again later." (that is the safe failure, not a bug).
- Use **only the invented text** of `docs/MANUAL-CHECK-6.1.md` (the invented CV and the invented ads). No real CV.
- Chrome. Developer tools: press **Cmd+Option+I** and open the tab **Network**. The Network tab is the list of every request the page sends to the server. Open it BEFORE you press a button, and type `cv` or `read` in its filter box to find the row.
- Where: the live site once 6.1b is merged and deployed; or, before merging, the preview address Vercel gives the branch `step-6.1b-access-code` (to be confirmed in the dashboard; the variable must be set for Preview).

## The steps

1. **Do:** confirm the order above was followed (the variable is set in Vercel, then the code deployed).
   **Expect:** nothing to see yet; write "done".
2. **Do:** open the site in a **new Incognito window** (no code kept). Paste the invented CV, press **Send for reading**.
   **Expect:** no skill list; the sentence "Enter the access code you were given, then press the button again." and the **Access code** box. In the Network tab the `cv` row is **401**; its response has `Cache-Control: no-store`; its body is the one-line "The access code is missing or wrong." message and nothing else.
3. **Do:** type a wrong code, press **Use this code**, press **Send for reading** again.
   **Expect:** "That access code was not accepted. Check it and try again." The `cv` row is 401 again. The box is empty.
4. **Do:** type the right code, press **Use this code**, press **Send for reading** again.
   **Expect:** "Access code kept in this tab until you close it." and then the skill list. The `cv` row is 200.
5. **Do:** click the `cv` row, open **Headers**.
   **Expect:** under Request Headers there is `x-access-code`; the **Request URL** at the top shows `.../api/cv` with nothing after it (no code in the address). Under Response Headers: `Cache-Control: no-store`.
6. **Do:** read invented ad 1 (**Read this ad**).
   **Expect:** a report; the `read` row is 200, with `no-store`, and the code is again only in a header, not in the address.
7. **Do:** reload the page (Cmd+R), read the ad again.
   **Expect:** no question (the code is kept for this tab).
8. **Do:** press **Forget the code**, then press **Read this ad**.
   **Expect:** "The access code was forgotten." and then the "Enter the access code..." sentence; the `read` row is 401.
9. **Do:** enter the right code again, then close the whole Incognito window, open a new one, paste the CV and press **Send for reading**.
   **Expect:** asked again (the code did not outlive the tab).
10. **Do (optional, in a terminal; no AI call is made):** `curl -i -X POST <the live site>/api/read -H 'content-type: application/json' -d '{"text":"x"}'`
    **Expect:** `HTTP/2 401`, `cache-control: no-store`, and the one-line message.
11. **Do:** in the Vercel dashboard open the project's **Logs** for those requests.
    **Expect (to be confirmed by looking, not assumed):** paths and statuses, no header values and no code.
12. **Do:** with a code kept and a profile saved (save one as in `docs/MANUAL-CHECK-6.1.md`, steps 2 to 4), press **Delete everything saved on this device**, then **Yes, delete everything**.
    **Expect:** "Everything saved on this device was deleted." and the next send (**Send for reading** or **Read this ad**) asks for the access code again. (The code is forgotten as soon as you press "Yes, delete everything", even if the delete itself fails; pressing **Cancel** instead forgets nothing.)
13. **Do (the Firewall rule, plan section 4; no AI call is made, because every request is refused before the AI).** First set the rule if it is not set (Firewall tab, rate limit on `/api/`, 10 requests per 60 seconds per address; when the "Rate Limiting Pricing" dialog appears, STOP and send me its words before pressing Continue). Then, in a terminal, replacing the placeholder with the site address:
    `for i in $(seq 1 12); do curl -s -o /dev/null -w "%{http_code}\n" -X POST <the live site>/api/read -H 'content-type: application/json' -d '{"text":"x"}'; done`
    It sends 12 requests WITHOUT a code and prints only the status codes, one per line.
    **Expect:** 401 first, then 429 once the rule bites (about the 11th line; the exact switch point may differ by a request or two: the window is fixed and the counters are per region). **Also expect:** normal use (one CV and three ads in a minute, four requests) never gets 429. If the rule does not bite, report what the rule list offered and what the pricing dialog said.

## What to send back

"passed", or the number of the step that did not match and what you saw instead. Also any red text from the Console.

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
| 13 | NOT RUN YET | |
