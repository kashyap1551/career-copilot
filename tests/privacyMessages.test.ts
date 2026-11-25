import { describe, expect, it } from "vitest";
import * as messages from "@/lib/privacy/messages";

// Step 9.3, stage 2.2 (docs/PLAN-9.3.md sections 2, 4, 6 and amendments A4, A12, A13): the exact words of lib/privacy/messages.ts. DRAFT until the
// owner approves them (WORDING_APPROVED_ON). An owner edit changes the constant AND its pinned string below in ONE commit.
// Written BEFORE lib/privacy/messages.ts exists (red first, then green).
//
// HAND-WORKED EXPECTATIONS:
//  M3  messages.ts exports exactly these 23 string constants (3 info and tick lines, 12 claims, 8 headings, counted below) and one
//      non-string, WORDING_APPROVED_ON (null). Each string equals the pinned string below, copied by hand BEFORE the constants were written; the
//      test names every constant that differs, and a constant that is added or removed without a pin also fails.
//        pinned strings: CV_INFO_LINE, AD_INFO_LINE, CV_TICK (3);  CLAIM_C1, CLAIM_C2, CLAIM_C3A, CLAIM_C3B, CLAIM_C4, CLAIM_C5, CLAIM_C6, CLAIM_C7,
//        CLAIM_C8, CLAIM_C9, CLAIM_C10, CLAIM_C15 (12);  HEADING_LEAVES, HEADING_STORED, HEADING_LOGGED, HEADING_PROCESSORS, HEADING_COOKIES,
//        HEADING_CONTROLS, HEADING_DEMO, HEADING_NOT_CONFIRMED (8).   3 + 12 + 8 = 23 strings.
//  M5  none of GDPR, DSGVO, compliant, compliance, lawful, certified, guarantee, legally, secure, consent appears (case-insensitive) in any exported
//      string constant of messages.ts. NOT covered, on purpose (A4): the `words` of a QUOTED fact in lib/privacy/facts.ts. Groq's own sentence (U2a)
//      contains "compliance"; it is a quotation, shown in quotation marks with its source, and must not trip this test.
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
};

const FORBIDDEN = ["GDPR", "DSGVO", "compliant", "compliance", "lawful", "certified", "guarantee", "legally", "secure", "consent"];

describe("the draft words of the privacy page (PLAN-9.3 sections 2, 4, 6; A4, A12, A13)", () => {
  it("M3: every constant of messages.ts is exactly its pinned string, and none is added or removed without a pin", () => {
    expect(Object.keys(PINNED).length).toBe(23);
    const strings = Object.entries(messages).filter(([, v]) => typeof v === "string") as [string, string][];
    const names = strings.map(([k]) => k).sort();
    expect(names, "constants exported but not pinned, or pinned but not exported").toEqual(Object.keys(PINNED).sort());
    const differ = strings.filter(([k, v]) => v !== PINNED[k]).map(([k]) => k);
    expect(differ, `constants that differ from their pinned string: ${differ.join(", ")}`).toEqual([]);
    expect(Object.keys(messages).filter((k) => typeof (messages as Record<string, unknown>)[k] !== "string")).toEqual(["WORDING_APPROVED_ON"]);
  });

  it("M5: none of the forbidden words is in any constant of messages.ts (the words of a quoted fact are exempt: Groq's own sentence says compliance)", () => {
    for (const [name, value] of Object.entries(messages)) {
      if (typeof value !== "string") continue;
      for (const w of FORBIDDEN) expect(value.toLowerCase().includes(w.toLowerCase()), `${name} must not contain "${w}"`).toBe(false);
    }
  });
});
