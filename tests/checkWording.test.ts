import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECK_BAD_ANSWER, CHECK_BUTTON, CHECK_CONTACT, CHECK_DONE, CHECK_NO_ENTRIES, CHECK_NOT_CHECKED, CHECK_RUNNING, CHECK_SERVER_ERROR, CHECK_STALE, CHECK_UNREACHABLE,
} from "@/lib/cv/checkWording";

// EC-4a (EC-4 proposal, Part B k; Part C CP6 and D1 to D3): the words of the check button and its messages (DRAFT, awaiting the owner's approval), pinned
// word for word, and three sentences that are COPIES of sentences elsewhere (a test that fails here means a copy drifted).

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("EC-4a wording: pinned (CP6)", () => {
  it("CP6: every sentence is exactly its pin; the singular is used for 1", () => {
    expect(CHECK_BUTTON(3)).toBe("Check 3 requirements against my CV lines");
    expect(CHECK_BUTTON(1)).toBe("Check 1 requirement against my CV lines");
    expect(CHECK_RUNNING).toBe("Checking…");
    expect(CHECK_DONE(2, 3)).toBe("Check finished: 2 of 3 requirements judged by the AI.");
    expect(CHECK_DONE(1, 1)).toBe("Check finished: 1 of 1 requirement judged by the AI.");
    expect(CHECK_NOT_CHECKED(5)).toBe("5 requirements were not checked: one check takes at most 30.");
    expect(CHECK_NOT_CHECKED(1)).toBe("1 requirement was not checked: one check takes at most 30.");
    expect(CHECK_NO_ENTRIES).toBe("There is no CV line to check the rest against.");
    expect(CHECK_STALE).toBe("Your skills or the ad changed after the check, so its answers are not shown. Press the button again.");
    expect(CHECK_CONTACT).toBe("Some CV lines still contain an email address, a phone number or a web link, so nothing was sent. Take it out and try again.");
    expect(CHECK_UNREACHABLE).toBe("Could not reach the server. Check your connection and try again.");
    expect(CHECK_SERVER_ERROR(504)).toBe("The server returned an error (504).");
    expect(CHECK_BAD_ANSWER).toBe("The check's answer could not be read, so nothing was changed. Please try again.");
  });

  it("CP6b: the module says it is DRAFT and awaits the owner's approval", () => {
    const head = read("lib/cv/checkWording.ts").split("\n").slice(0, 12).join("\n");
    expect(head).toContain("DRAFT");
    expect(head).toMatch(/approval/i);
  });
});

describe("EC-4a wording: copies that must not drift (D1 to D3)", () => {
  it("D1: CHECK_CONTACT is the CONTACT_REFUSAL of the route, character for character", () => {
    const m = /const CONTACT_REFUSAL = "([^"]*)"/.exec(read("app/api/check/route.ts"));
    expect(m, "the literal is found in the route").not.toBeNull();
    expect(CHECK_CONTACT).toBe(m![1]);
  });

  it("D2: CHECK_UNREACHABLE is the sentence CvBox shows when the server cannot be reached", () => {
    const m = /setError\("([^"]*Could not reach the server[^"]*)"\)/.exec(read("app/CvBox.tsx"));
    expect(m, "the literal is found in CvBox").not.toBeNull();
    expect(CHECK_UNREACHABLE).toBe(m![1]);
  });

  it("D3: CHECK_SERVER_ERROR(504) is what CvBox builds for a 504", () => {
    const m = /`(The server returned an error \(\$\{res\.status\}\)\.)`/.exec(read("app/CvBox.tsx"));
    expect(m, "the template is found in CvBox").not.toBeNull();
    expect(m![1].replace("${res.status}", "504")).toBe("The server returned an error (504).");
    expect(CHECK_SERVER_ERROR(504)).toBe(m![1].replace("${res.status}", "504"));
  });
});
