import { PLAN_MAX_REQUIREMENTS } from "./checkPlan";

// DRAFT wording of the check button and its messages (EC-4a; the button itself comes with EC-4b). Awaiting the owner's approval: nothing here is final,
// and no sentence may be shown to a person as approved until the owner says so (docs/PLAN-EVERY-CV.md, "DRAFT wording awaiting the owner's approval").
// Pinned word for word by tests/checkWording.test.ts. Three sentences are copies of sentences elsewhere; tests D1 to D3 fail if a copy drifts:
// CHECK_CONTACT (app/api/check/route.ts), CHECK_UNREACHABLE and CHECK_SERVER_ERROR (app/CvBox.tsx).

const noun = (n: number) => (n === 1 ? "requirement" : "requirements");

export const CHECK_BUTTON = (n: number) => `Check ${n} ${noun(n)} against my CV lines`;
export const CHECK_RUNNING = "Checking…";
export const CHECK_DONE = (judged: number, sent: number) => `Check finished: ${judged} of ${sent} ${noun(sent)} judged by the AI.`;
export const CHECK_NOT_CHECKED = (n: number) => `${n} ${noun(n)} ${n === 1 ? "was" : "were"} not checked: one check takes at most ${PLAN_MAX_REQUIREMENTS}.`;
export const CHECK_NO_ENTRIES = "To check the rest against your CV, confirm at least one skill that has a CV line.";
export const CHECK_STALE = "Your skills or the ad changed after the check, so its answers are not shown. Press the button again.";
export const CHECK_CONTACT = "Some CV lines still contain an email address, a phone number or a web link, so nothing was sent. Take it out and try again.";
export const CHECK_UNREACHABLE = "Could not reach the server. Check your connection and try again.";
export const CHECK_SERVER_ERROR = (status: number) => `The server returned an error (${status}).`;
export const CHECK_BAD_ANSWER = "The check's answer could not be read, so nothing was changed. Please try again.";
