import { describe, expect, it } from "vitest";
import { FACTS } from "@/lib/privacy/facts";
import * as messages from "@/lib/privacy/messages";

// Step 9.3, stage 2.2 (docs/PLAN-9.3.md sections 2, 4, 6 and amendments A4, A12, A13): the exact words of lib/privacy/messages.ts. DRAFT until the
// owner approves them (WORDING_APPROVED_ON). An owner edit changes the constant AND its pinned string below in ONE commit.
// Written BEFORE lib/privacy/messages.ts exists (red first, then green).
//
// HAND-WORKED EXPECTATIONS:
//  M3  messages.ts exports exactly these 32 string constants (3 info and tick lines, 12 claims, 8 headings, 7 labels of the /privacy page, 2 lines of the processors section, counted below) and one
//      non-string, WORDING_APPROVED_ON (null). Each string equals the pinned string below, copied by hand BEFORE the constants were written; the
//      test names every constant that differs, and a constant that is added or removed without a pin also fails.
//        pinned strings: CV_INFO_LINE, AD_INFO_LINE, CV_TICK (3);  CLAIM_C1, CLAIM_C2, CLAIM_C3A, CLAIM_C3B, CLAIM_C4, CLAIM_C5, CLAIM_C6, CLAIM_C7,
//        CLAIM_C8, CLAIM_C9, CLAIM_C10, CLAIM_C15 (12);  HEADING_LEAVES, HEADING_STORED, HEADING_LOGGED, HEADING_PROCESSORS, HEADING_COOKIES,
//        HEADING_CONTROLS, HEADING_DEMO, HEADING_NOT_CONFIRMED (8);  PRIVACY_TITLE, PRIVACY_DESCRIPTION, LABEL_SOURCE, LABEL_CHECKED_ON,
//        LABEL_BACK_TO_APP, LABEL_TO_DEMO, LINK_PRIVACY (7, added at stage 2.3 for the page: no sentence of the page is typed in its component).
//        PROCESSORS_INTRO, NOT_CONFIRMED_POINTER (2, added at stage 2.3c: the line that introduces the two services and the pointer to the open facts).
//        3 + 12 + 8 + 7 + 2 = 32 strings.
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
    "When you press 'Send for reading', the numbered lines shown above leave your device. They go to our server and on to an AI service (Groq) that reads them. Email addresses, phone numbers and web links are removed first. Your name and address are not. The privacy page says what is kept.",
  AD_INFO_LINE:
    "When you press 'Read this ad', the whole text in the box leaves your device. It goes to our server and on to an AI service (Groq). It is not cleaned: an email address or phone number in it is sent as it is. Do not paste anything you do not want to send. The privacy page says what is kept.",
  CV_TICK: "I have read this, and I am sending my own text to be read by an AI service.",
  CLAIM_C1: "A CV file you choose is read on your device. Nothing from it is sent until you press 'Send for reading'.",
  CLAIM_C2:
    "'Send for reading' sends the numbered lines shown on the page. Email addresses, phone numbers and web links are removed first. Your name and address are not removed.",
  CLAIM_C3A: "'Read this ad' sends the whole ad text from the box. It is not cleaned: an email address or phone number in it is sent as it is.",
  CLAIM_C3B:
    "Our server code has no database and writes no file. For an ad, the server keeps the reading of the ad (it holds short quotes from the ad, not the whole text) in its memory for a while, up to 20 ads, so the same ad is not read twice. For a CV it keeps nothing.",
  CLAIM_C4:
    "A saved ad and a saved profile stay in this browser (IndexedDB). Saving sends nothing. A saved ad holds the whole ad text. A saved profile holds the skills you confirmed, with the CV line each one was found on, and the cities, languages, work modes, years of experience and start date you entered. It does not hold your whole CV.",
  CLAIM_C5:
    "The access code is kept for this tab only. It is forgotten when you close the tab, when the server refuses it, and when you press 'Yes, delete everything'. It is sent to our server with each send.",
  CLAIM_C6:
    "Our server code logs only a short fixed message, such as 'read: AI service error, status 429'. It never logs your CV, your ads or your access code.",
  CLAIM_C7: "Our code has no analytics, tracking or advertising code and sets no cookies.",
  CLAIM_C8: "The demo uses invented data. What you do in the demo is not sent anywhere and not saved.",
  CLAIM_C9:
    "'Delete everything saved on this device' removes your saved profile and all your saved ads from this browser, and forgets the access code kept in this tab. It does not delete anything held by the AI service or the hosting service.",
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
};

const FORBIDDEN = ["GDPR", "DSGVO", "compliant", "compliance", "lawful", "certified", "guarantee", "legally", "secure", "consent"];

describe("the draft words of the privacy page (PLAN-9.3 sections 2, 4, 6; A4, A12, A13)", () => {
  it("M3: every constant of messages.ts is exactly its pinned string, and none is added or removed without a pin", () => {
    expect(Object.keys(PINNED).length).toBe(32);
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
