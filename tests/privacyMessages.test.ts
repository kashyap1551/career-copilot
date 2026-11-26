import { describe, expect, it } from "vitest";
import { FACTS } from "@/lib/privacy/facts";
import * as messages from "@/lib/privacy/messages";

// Step 9.3, stage 2.2 (docs/PLAN-9.3.md sections 2, 4, 6 and amendments A4, A12, A13): the exact words of lib/privacy/messages.ts. DRAFT until the
// owner approves them (WORDING_APPROVED_ON). An owner edit changes the constant AND its pinned string below in ONE commit.
// Written BEFORE lib/privacy/messages.ts exists (red first, then green).
//
// HAND-WORKED EXPECTATIONS:
//  M3  messages.ts exports exactly these 38 string constants (3 info and tick lines, 12 claims, 8 headings, 7 labels of the /privacy page, 2 lines of the processors section, 3 lines of the consent stage, counted below) and one
//      non-string, WORDING_APPROVED_ON (null). Each string equals the pinned string below, copied by hand BEFORE the constants were written; the
//      test names every constant that differs, and a constant that is added or removed without a pin also fails.
//        pinned strings: CV_INFO_LINE, AD_INFO_LINE, CV_TICK (3);  CLAIM_C1, CLAIM_C2, CLAIM_C3A, CLAIM_C3B, CLAIM_C4, CLAIM_C5, CLAIM_C6, CLAIM_C7,
//        CLAIM_C8, CLAIM_C9, CLAIM_C10, CLAIM_C15 (12);  HEADING_LEAVES, HEADING_STORED, HEADING_LOGGED, HEADING_PROCESSORS, HEADING_COOKIES,
//        HEADING_CONTROLS, HEADING_DEMO, HEADING_NOT_CONFIRMED (8);  PRIVACY_TITLE, PRIVACY_DESCRIPTION, LABEL_SOURCE, LABEL_CHECKED_ON,
//        LABEL_BACK_TO_APP, LABEL_TO_DEMO, LINK_PRIVACY (7, added at stage 2.3 for the page: no sentence of the page is typed in its component).
//        PROCESSORS_INTRO, NOT_CONFIRMED_POINTER (2, added at stage 2.3c: the line that introduces the two services and the pointer to the open facts).
//        CV_TICK_NEEDED, LINK_PRIVACY_NOTICE, CLAIM_C16 (3, added at stage 2.4: the message next to the CV button, the link text in the two notices, and
//        the claim about the tick). 3 + 12 + 8 + 7 + 2 + 3 = 35 strings; EC-3b adds 3 more (CHECK_INFO_LINE, CLAIM_C17, CHECK_TICK_NEEDED): 38.
//  M5  none of GDPR, DSGVO, compliant, compliance, lawful, certified, guarantee, legally, secure, consent appears (case-insensitive) in
//      (a) any exported string constant of messages.ts, and (b) the `words` of every fact in lib/privacy/facts.ts whose kind is NOT "quoted": the
//      observed facts and the not-confirmed sentences (U1, U2b, U3, U4a, U4b, U5, U6, U9: eight facts). Read by hand, none of the eight contains
//      any of the ten words, so M5 stays green. NOT covered, on purpose (A4): the `words` of a QUOTED fact (U2a). Groq's own sentence contains
//      "compliance"; it is a quotation, shown in quotation marks with its source, and must not trip this test. (Stage 2.2b: the first version of
//      M5 read messages.ts only, so break B18 proved nothing about facts.ts; the facts are now read too.)
//
// COUNTS: this file has 2 tests (M3, M5), both pass.

const PINNED: Record<string, string> = {
  CV_INFO_LINE:
    "When you press 'Send for reading', the numbered lines (shown above once you add your CV text) leave your device. They go to our server and on to an AI service (Groq) that reads them. An automatic check has taken out email addresses, most phone numbers and some web links, but it can miss some formats, and it does not touch your name or address. Read the lines before you send. The privacy page says what is kept.",
  AD_INFO_LINE:
    "When you press 'Read this ad', the whole text in the box leaves your device. It goes to our server and on to an AI service (Groq). It is not cleaned: an email address or phone number in it is sent as it is. Do not paste anything you do not want to send. The privacy page says what is kept.",
  CV_TICK: "I have read this, and I am sending my own text to be read by an AI service.",
  CLAIM_C1: "A CV file you choose is read on your device. Nothing from it is sent until you press 'Send for reading'.",
  CLAIM_C2:
    "'Send for reading' sends the numbered lines shown on the page. Before that, an automatic check takes out email addresses, most phone numbers and some web links. It can miss some formats. It does not remove your name or address.",
  CLAIM_C3A: "'Read this ad' sends the whole ad text from the box. It is not cleaned: an email address or phone number in it is sent as it is.",
  CLAIM_C3B:
    "Our server code has no database and writes no file. For an ad, the server keeps the reading of the ad (it holds short quotes from the ad, not the whole text) in its memory for a while, up to 20 ads, so the same ad is not read twice. For a CV and for the check it keeps nothing.",
  CLAIM_C4:
    "A saved ad and a saved profile stay in this browser (IndexedDB). Saving sends nothing. A saved ad holds the whole ad text and the AI's reading of it. A saved profile holds the skills you confirmed, with the CV line each one was found on (word for word; this includes skills that are not in our skill list yet, and a note of which ones the AI read from your wording rather than from a name written in the line), the skills you added by hand, the skills you are learning with the date you expect them, and the cities, languages, work modes, years of experience and start date you entered. It also holds the date you saved it. It does not hold your whole CV.",
  CLAIM_C5:
    "The access code is kept for this tab only. It is forgotten when you close the tab, when the server refuses it, when you press 'Forget the code', and when you press 'Yes, delete everything'. It is sent to our server with each send.",
  CLAIM_C6:
    "Our server code logs only a short fixed message, such as 'read: AI service error, status 429'. It never logs your CV, your ads or your access code.",
  CLAIM_C7: "Our code has no analytics, tracking or advertising code and sets no cookies.",
  CLAIM_C8: "The demo uses invented data. What you do in the demo is not sent anywhere and not saved.",
  CLAIM_C9:
    "'Delete everything saved on this device' removes your saved profile and all your saved ads from this browser, and forgets the access code and the tick kept in this tab. It does not delete anything held by the AI service or the hosting service.",
  CLAIM_C10:
    "When the first screen loads it opens the saved-data database in your browser (it is created empty in a new browser). Nothing is written into it until you press a save button.",
  CLAIM_C15:
    "If the AI service answers with an error or says it is busy, our server asks again up to two more times, so the same text can reach the AI service up to three times for one click.",
  HEADING_LEAVES: "What leaves your browser, and when",
  HEADING_STORED: "What is stored, and where",
  HEADING_LOGGED: "What is logged",
  HEADING_PROCESSORS: "Who processes your text",
  HEADING_COOKIES: "Cookies and analytics",
  HEADING_CONTROLS: "Your controls",
  HEADING_DEMO: "The demo",
  HEADING_NOT_CONFIRMED: "Not confirmed yet",
  PRIVACY_TITLE: "Privacy",
  PRIVACY_DESCRIPTION: "What leaves your browser, what is kept where, and what is not confirmed yet.",
  LABEL_SOURCE: "Source",
  LABEL_CHECKED_ON: "Checked on",
  LABEL_BACK_TO_APP: "Back to the app",
  LABEL_TO_DEMO: "Try the demo with invented data",
  LINK_PRIVACY: "Privacy",
  PROCESSORS_INTRO: "We use two services that handle your text. Groq runs the AI service that reads it. Vercel hosts our server, which receives it first.",
  NOT_CONFIRMED_POINTER: "Some facts about these services are not confirmed yet. They are listed under 'Not confirmed yet' at the end of this page.",
  CV_TICK_NEEDED: "Tick the box before you send your CV.",
  LINK_PRIVACY_NOTICE: "Open the privacy page in a new tab",
  CLAIM_C16:
    "When you tick the box before sending your CV or running the check, the tick is kept for this tab only. It is forgotten when you close the tab, and when you press 'Yes, delete everything'.",
  // EC-3b (DRAFT, the owner approves at the end): the check button's notice, its claim, and the message when the tick is missing.
  CHECK_INFO_LINE:
    "When you press the check button, the requirement lines of the ad and the lines of your CV, each with its line number, leave your device. They go to our server and on to an AI service (Groq) that says which CV line shows which requirement. The CV lines are the same text that was already sent when your CV was read, cleaned of email addresses and most phone numbers. The check looks at them again with the same automatic check and sends nothing if it still finds an email address, a phone number or a web link, but it can miss some formats, and it does not touch your name or address. The requirement lines come from the ad, which is not cleaned: an email address or phone number in it is sent as it is. Long lines are cut short. The privacy page says what is kept.",
  CLAIM_C17:
    "The check sends the requirement lines of the ad and the lines of your CV, each with its line number, to our server and on to an AI service (Groq). The CV lines are the same text that was sent when your CV was read. A requirement line is cut after 300 characters and a CV line after 240, and at most 30 requirement lines and 120 CV lines are sent. Our server code keeps nothing from it: no cache, no file, no database. The answers are shown on the screen and are not saved. If the AI service answers with an error or says it is busy, our server asks again up to two more times, as described above, so the same text can reach the AI service up to three times for one click.",
  CHECK_TICK_NEEDED: "Tick the box before you run the check.",
};

const FORBIDDEN = ["GDPR", "DSGVO", "compliant", "compliance", "lawful", "certified", "guarantee", "legally", "secure", "consent"];

describe("the draft words of the privacy page (PLAN-9.3 sections 2, 4, 6; A4, A12, A13)", () => {
  it("M3: every constant of messages.ts is exactly its pinned string, and none is added or removed without a pin", () => {
    expect(Object.keys(PINNED).length).toBe(38);
    const strings = Object.entries(messages).filter(([, v]) => typeof v === "string") as [string, string][];
    const names = strings.map(([k]) => k).sort();
    expect(names, "constants exported but not pinned, or pinned but not exported").toEqual(Object.keys(PINNED).sort());
    const differ = strings.filter(([k, v]) => v !== PINNED[k]).map(([k]) => k);
    expect(differ, `constants that differ from their pinned string: ${differ.join(", ")}`).toEqual([]);
    expect(Object.keys(messages).filter((k) => typeof (messages as Record<string, unknown>)[k] !== "string")).toEqual(["WORDING_APPROVED_ON"]);
  });

  it("M5: none of the forbidden words is in any constant of messages.ts or in the words of a fact that is not a quotation (quoted facts are exempt: Groq's own sentence says compliance)", () => {
    const hits = (where: string, text: string) => FORBIDDEN.filter((w) => text.toLowerCase().includes(w.toLowerCase())).map((w) => `${where} contains "${w}"`);
    const found: string[] = [];
    for (const [name, value] of Object.entries(messages)) {
      if (typeof value === "string") found.push(...hits(name, value));
    }
    const ours = FACTS.filter((f) => f.status === "not-confirmed" || f.kind !== "quoted");
    expect(ours.map((f) => f.id)).toEqual(["U1", "U2b", "U3", "U4a", "U4b", "U5", "U6", "U9"]);
    for (const f of ours) found.push(...hits(`fact ${f.id}`, f.words));
    expect(found).toEqual([]);
  });
});
