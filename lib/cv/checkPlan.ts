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
// - Entries: the confirmed skills that have a CV line (listed ones and kept unlisted ones), by CV line then name; at most 60. A hand-added skill and an
//   in-progress skill have no line and are not sent.
// - The key is a string of EVERYTHING the answers are shown with (each requirement's place, weight and words; each entry's name, id, line number, line
//   text and inferred flag). Answers are used only while the key of the plan equals the key at the click.

// The route's limits (lib/ai/checkInput.ts); a client file may not import lib/ai, so a test pins these two to the route's.
export const PLAN_MAX_REQUIREMENTS = 30;
export const PLAN_MAX_ENTRIES = 60;

export type CheckPlan = {
  requirements: SentRequirement[];
  entries: SentEntry[];
  entriesAvailable: number; // confirmed entries with a CV line BEFORE the cap of 60 (the eval shows how many the cap dropped)
  notChecked: number; // open requirements that did not fit in one check
  key: string;
};

// What a successful check left in the page's memory.
export type Checked = { key: string; answers: ViewAnswer[]; thrownAway: number; sent: number };

export function buildCheckPlan(job: Job, built: BuiltProfile, skills: Skill[], proposals: CvSkill[] | null): CheckPlan {
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

  const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? id;
  const found: Omit<SentEntry, "n">[] = [];
  for (const s of built.profile.skills) {
    if (s.kind !== "have" || s.evidence === null) continue;
    found.push({
      name: nameOf(s.skillId),
      skillId: s.skillId,
      line: s.evidence.line,
      text: s.evidence.text,
      inferred: proposals?.find((p) => p.skillId === s.skillId)?.label === "inferred",
    });
  }
  for (const k of built.unlistedKept ?? []) {
    found.push({ name: k.name, skillId: k.skillId, line: k.evidence.line, text: k.evidence.text, inferred: k.inferred });
  }
  found.sort((a, b) => a.line - b.line || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const entries: SentEntry[] = found.slice(0, PLAN_MAX_ENTRIES).map((e, i) => ({ n: i + 1, ...e }));

  const key = JSON.stringify([
    requirements.map((r) => [r.index, r.importance, r.quote]),
    entries.map((e) => [e.name, e.skillId, e.line, e.text, e.inferred]),
  ]);
  return { requirements, entries, entriesAvailable: found.length, notChecked: open.length - requirements.length, key };
}

// The answers a report may use: only while the plan is still the one the check was made on.
export function extrasFor(checked: Checked | null, plan: CheckPlan): { answers: ViewAnswer[]; thrownAway: number } | undefined {
  if (checked === null || checked.key !== plan.key) return undefined;
  return { answers: checked.answers, thrownAway: checked.thrownAway };
}

// What the box shows (app/CheckBox.tsx): nothing when there is no profile or nothing open to check; a note when there are open requirements but no
// confirmed skill with a CV line; the button otherwise.
export function checkBoxState(plan: CheckPlan, hasProfile: boolean): "hidden" | "no-entries" | "ready" {
  if (!hasProfile || plan.requirements.length === 0) return "hidden";
  return plan.entries.length === 0 ? "no-entries" : "ready";
}
