import { engineView, type ViewAnswer } from "./engineView";
import type { BuiltProfile } from "./profile";
import type { SentEntry, SentRequirement } from "../engine/evidenceProof";
import type { CvSkill } from "../engine/fromCv";
import type { Job, Skill } from "../engine/types";

// EC-4a (docs/PLAN-EVERY-CV.md, EC-4 proposal, Part B a, b and d): WHAT one evidence check sends, and when the answers of a check may be used. Pure code:
// no AI, no network, no storage, no screen.
//
// - Requirements: the ones the skill list cannot judge and the same-name match did not settle (the engine view's `couldNotJudge`, asked WITHOUT answers, so
//   the plan, and its key, are the same before and after a check). Musts first, then nice-to-haves, each in the ad's order; at most 30 (the rest stay
//   "not judged" and `notChecked` says how many).
// - Entries (EC-8a): the person's own CV lines, one for each non-empty line of `built.profile.cvLines`: exactly the lines the page sent to the CV reader
//   (contact details already removed; a saved profile keeps only the lines its skills cite, the others are empty and skipped). Named "CV line <n>" with n
//   the page's own line number; the text is the line cut to 1,000 characters. Which skills are ticked decides NOTHING here. At most 120, in line order;
//   `entriesNotSent` says how many non-empty lines came after the 120th.
// - The key is a string of EVERYTHING the answers are shown with (each requirement's place, weight and words; each entry's name, id, line number, line
//   text and inferred flag). Answers are used only while the key of the plan equals the key at the click.

// The route's limits (lib/ai/checkInput.ts); a client file may not import lib/ai, so a test pins these two to the route's.
export const PLAN_MAX_REQUIREMENTS = 30;
export const PLAN_MAX_ENTRIES = 120;
export const PLAN_MAX_LINE_CHARS = 1000; // a CV line is cut to this for sending (the route's schema allows the same)

export type CheckPlan = {
  requirements: SentRequirement[];
  entries: SentEntry[];
  entriesAvailable: number; // non-empty CV lines BEFORE the cap of 120 (the eval shows how many the cap dropped)
  entriesNotSent: number; // the non-empty CV lines past the cap: not sent
  notChecked: number; // open requirements that did not fit in one check
  key: string;
};

// What a successful check left in the page's memory.
export type Checked = { key: string; answers: ViewAnswer[]; thrownAway: number; sent: number };

// `_skills` and `_proposals` are no longer used (the entries are CV lines, not skills); they stay so every caller keeps its shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildCheckPlan(job: Job, built: BuiltProfile, _skills: Skill[], _proposals: CvSkill[] | null): CheckPlan {
  const open = engineView(job, built).couldNotJudge;
  const ordered = [
    ...open.filter((r) => r.importance === "must"),
    ...open.filter((r) => r.importance !== "must"),
  ];
  const requirements: SentRequirement[] = ordered.slice(0, PLAN_MAX_REQUIREMENTS).map((r, i) => ({
    n: i + 1,
    index: job.requirements.indexOf(r),
    quote: r.quote,
    importance: r.importance,
  }));

  const found: Omit<SentEntry, "n">[] = [];
  built.profile.cvLines.forEach((text, i) => {
    if (text.trim() === "") return;
    const line = i + 1;
    found.push({ name: `CV line ${line}`, skillId: `line:${line}`, line, text: text.slice(0, PLAN_MAX_LINE_CHARS), inferred: false });
  });
  const entries: SentEntry[] = found.slice(0, PLAN_MAX_ENTRIES).map((e, i) => ({ n: i + 1, ...e }));

  const key = JSON.stringify([
    requirements.map((r) => [r.index, r.importance, r.quote]),
    entries.map((e) => [e.name, e.skillId, e.line, e.text, e.inferred]),
  ]);
  return { requirements, entries, entriesAvailable: found.length, entriesNotSent: found.length - entries.length, notChecked: open.length - requirements.length, key };
}

// The answers a report may use: only while the plan is still the one the check was made on.
export function extrasFor(checked: Checked | null, plan: CheckPlan): { answers: ViewAnswer[]; thrownAway: number } | undefined {
  if (checked === null || checked.key !== plan.key) return undefined;
  return { answers: checked.answers, thrownAway: checked.thrownAway };
}

// What the box shows (app/CheckBox.tsx): nothing when there is no profile or nothing open to check; a note when there are open requirements but no
// CV line to send; the button otherwise.
export function checkBoxState(plan: CheckPlan, hasProfile: boolean): "hidden" | "no-entries" | "ready" {
  if (!hasProfile || plan.requirements.length === 0) return "hidden";
  return plan.entries.length === 0 ? "no-entries" : "ready";
}
