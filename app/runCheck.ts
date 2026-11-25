import { containsContactDetails } from "@/lib/cv/redact";
import { toViewAnswers } from "@/lib/cv/checkBridge";
import { extrasFor, type CheckPlan, type Checked } from "@/lib/cv/checkPlan";
import { CHECK_BAD_ANSWER, CHECK_CONTACT, CHECK_DONE, CHECK_SERVER_ERROR, CHECK_STALE, CHECK_UNREACHABLE } from "@/lib/cv/checkWording";
import { postJson } from "./accessFetch";
import { sendIfAcknowledged, type TabStore } from "./consent";

// EC-4b (docs/PLAN-EVERY-CV.md, EC-4 proposal, Part B c): the click of the check button, as plain functions (tested with a fake fetch, in the style of
// app/consent.ts). This is the ONE place the page sends the check, and it runs only from a click (app/CheckBox.tsx, onCheck).
//
//  - The gate is the first thing that happens: unticked, nothing below runs and nothing is sent. The tick is the CV box's own; there is no second one.
//  - The body is exactly { requirements, entries: [{ name, text }] }. Each text is cut for SENDING only (a requirement to 1,000, a name to 120, a CV
//    line to 1,000, on UTF-16 length like the route's schema); the plan keeps the full texts.
//  - The contact check runs on the entry names and texts as they will be sent (after the cut). Never on the requirements: they come from the ad, and the
//    info line says an ad goes as it is.
//  - Nothing is stored, nothing is logged.

export type CheckOutcome =
  | { kind: "done"; checked: Checked }
  | { kind: "tick" } // the box was not ticked: the box shows CHECK_TICK_NEEDED
  | { kind: "access" } // a 401: the Access code box says what to do
  | { kind: "failed"; message: string };

const MAX_REQUIREMENT = 1000;
const MAX_NAME = 120;
const MAX_TEXT = 1000;

// How the request is made (the helper's own options, minus the source): only the tests pass anything here.
type PostOptions = Omit<Parameters<typeof postJson>[2], "source">;

export async function runCheck(plan: CheckPlan, deps: { post?: Partial<PostOptions>; consentStore?: TabStore | null } = {}): Promise<CheckOutcome> {
  const gated = await sendIfAcknowledged(async (): Promise<CheckOutcome> => {
    const body = {
      requirements: plan.requirements.map((r) => r.quote.slice(0, MAX_REQUIREMENT)),
      entries: plan.entries.map((e) => ({ name: e.name.slice(0, MAX_NAME), text: e.text.slice(0, MAX_TEXT) })),
    };
    if (body.entries.some((e) => containsContactDetails(e.name) || containsContactDetails(e.text))) return { kind: "failed", message: CHECK_CONTACT };
    let res: Response;
    try {
      const sent = await postJson("/api/check", body, { ...deps.post, source: "check" });
      if (sent.kind === "access") return { kind: "access" };
      res = sent.res;
    } catch {
      return { kind: "failed", message: CHECK_UNREACHABLE };
    }
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const sentence = typeof data === "object" && data !== null && "error" in data ? (data as { error: unknown }).error : null;
      return { kind: "failed", message: typeof sentence === "string" && sentence !== "" ? sentence : CHECK_SERVER_ERROR(res.status) };
    }
    const bridged = toViewAnswers({ requirements: plan.requirements, entries: plan.entries }, data);
    if (!bridged.ok) return { kind: "failed", message: CHECK_BAD_ANSWER };
    return { kind: "done", checked: { key: plan.key, answers: bridged.answers, thrownAway: bridged.thrownAway, sent: plan.requirements.length } };
  }, deps.consentStore);
  return gated.sent ? gated.value : { kind: "tick" };
}

// What the page keeps after a click: a success replaces the answers; every other outcome gives back the SAME previous value (a failure changes nothing).
export function applyOutcome(prev: Checked | null, outcome: CheckOutcome): Checked | null {
  return outcome.kind === "done" ? outcome.checked : prev;
}

// A reply that belongs to an older generation (the person deleted everything, read a new ad or CV, or used a saved profile since the click) changes nothing.
export function acceptResult(currentGen: number, clickGen: number, prev: Checked | null, next: Checked | null): Checked | null {
  return currentGen === clickGen ? next : prev;
}

// The ONE line under the button: the last click's message; else the stale line; else the finished line; else nothing.
export function liveMessage(last: string | null, checked: Checked | null, plan: CheckPlan): string {
  if (last !== null) return last;
  if (checked === null) return "";
  if (extrasFor(checked, plan) === undefined) return CHECK_STALE;
  return CHECK_DONE(checked.answers.length, checked.sent);
}
