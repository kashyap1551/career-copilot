import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type BuiltProfile } from "@/lib/cv/profile";
import type { KeptEntry, ViewAnswer } from "@/lib/cv/engineView";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job, Requirement } from "@/lib/engine/types";

// Invented material for the EC-1 tests (docs/PLAN-EVERY-CV.md section 4.4, the worked example). Not a test file. Everything is made up.
//
// The CV, as the page numbers it:
//   1 Alex Example
//   2 Wrote SQL queries for the weekly report
//   3 Dressed and monitored wounds on a surgical ward
//   4 Gave intake interviews to new patients
//   5 Welded steel frames in a workshop
export const LINES = [
  "Alex Example",
  "Wrote SQL queries for the weekly report",
  "Dressed and monitored wounds on a surgical ward",
  "Gave intake interviews to new patients",
  "Welded steel frames in a workshop",
];
export const P: CvSkill[] = [{ name: "SQL", skillId: "sql", listed: true, line: 2, quote: "Wrote SQL queries", label: "named" }];

// Skills that are not on our list yet, with the names the page shows for them.
export const UNLISTED = [
  { id: "new:wound-care", name: "Wound care" },
  { id: "new:patient-intake", name: "Patient intake" },
  { id: "new:kombucha-brewing", name: "Kombucha brewing" },
  { id: "new:welding", name: "Welding" },
];
export const nameOf = (id: string) => skills.find((s) => s.id === id)?.name ?? UNLISTED.find((s) => s.id === id)?.name ?? id;

export const req = (quote: string, importance: "must" | "nice", ...skillIds: string[]): Requirement => ({ quote, importance, skillIds });
export const SQL = req("You write SQL queries.", "must", "sql"); // index 0
export const EXCEL = req("You know Excel.", "must", "excel"); // index 1
export const WOUND = req("You can care for wounds.", "must", "new:wound-care"); // index 2
export const INTAKE = req("You can run patient intake.", "must", "new:patient-intake"); // index 3
export const KOMBUCHA = req("Kombucha is a plus.", "nice", "new:kombucha-brewing"); // index 4

export const job = (requirements: Requirement[] = [SQL, EXCEL, WOUND, INTAKE, KOMBUCHA]): Job => ({
  id: "invented-ad",
  title: "Ward Assistant",
  company: "Brindle Clinic",
  source: null,
  constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] },
  requirements,
});

// The person: SQL ticked from the CV (line 2), nothing else, nothing set.
export const person = (): BuiltProfile => buildProfile(LINES, P, { ...initialConfirm(P), keptIds: ["sql"] }, skills);

// The kept unlisted skills the page will hold after EC-2 (the plan's shape).
export const KEPT_WOUND: KeptEntry = { name: "Wound care", skillId: "new:wound-care", evidence: { line: 3, text: LINES[2] }, inferred: false };
export const KEPT_INTAKE: KeptEntry = { name: "Patient intake", skillId: "new:patient-intake", evidence: { line: 4, text: LINES[3] }, inferred: true };

// Verified answers (what the proof accepts), by index in the ad's requirement list.
export const A_WOUND_MET: ViewAnswer = { index: 2, verdict: "met", entry: KEPT_WOUND, quote: "Dressed and monitored wounds" };
export const A_INTAKE_PARTLY: ViewAnswer = { index: 3, verdict: "partly", entry: KEPT_INTAKE, quote: "Gave intake interviews" };
export const A_INTAKE_NONE: ViewAnswer = { index: 3, verdict: "none", entry: null, quote: null };
export const A_INTAKE_MET: ViewAnswer = { index: 3, verdict: "met", entry: KEPT_INTAKE, quote: "Gave intake interviews" };

export const deepFreeze = <T,>(x: T): T => {
  if (x !== null && typeof x === "object" && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x as object)) deepFreeze(v);
  }
  return x;
};
