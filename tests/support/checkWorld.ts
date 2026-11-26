import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type BuiltProfile, type ConfirmState } from "@/lib/cv/profile";
import type { KeptEntry } from "@/lib/cv/engineView";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { SentEntry, SentRequirement } from "@/lib/engine/evidenceProof";

// Invented material for the EC-4a tests (the world W of docs/PLAN-EVERY-CV.md, EC-4 proposal, Part C). Not a test file. Everything is made up.
// The ad is `job()` of ./evidenceFixtures: index 0 SQL (must, listed), 1 Excel (must, listed), 2 wound care (must, unlisted), 3 patient intake (must,
// unlisted), 4 kombucha (nice, unlisted). The CV, as the page numbers it:
//   1 Alex Example
//   2 Wrote SQL queries for the weekly report
//   3 Welded steel frames in a workshop
//   4 Dressed and monitored wounds on a surgical ward
export const LINES_W = [
  "Alex Example",
  "Wrote SQL queries for the weekly report",
  "Welded steel frames in a workshop",
  "Dressed and monitored wounds on a surgical ward",
];
export const P_W: CvSkill[] = [
  { name: "SQL", skillId: "sql", listed: true, line: 2, quote: "Wrote SQL queries", label: "named" },
  { name: "Ward nursing", skillId: "new:ward-nursing", listed: false, line: 4, quote: "Dressed and monitored wounds", label: "named" },
];

export const confirmW = (over: Partial<ConfirmState> = {}): ConfirmState => ({ ...initialConfirm(P_W), keptIds: ["sql", "new:ward-nursing"], ...over });
export const personW = (over: Partial<ConfirmState> = {}, lines = LINES_W, proposals = P_W): BuiltProfile => buildProfile(lines, proposals, confirmW(over), skills);

export const KEPT_WARD: KeptEntry = { name: "Ward nursing", skillId: "new:ward-nursing", evidence: { line: 4, text: LINES_W[3] }, inferred: false };

// What the plan must hold for W, written by hand.
export const SENT_W: { requirements: SentRequirement[]; entries: SentEntry[] } = {
  requirements: [
    { n: 1, index: 2, quote: "You can care for wounds.", importance: "must" },
    { n: 2, index: 3, quote: "You can run patient intake.", importance: "must" },
    { n: 3, index: 4, quote: "Kombucha is a plus.", importance: "nice" },
  ],
  // EC-8a: the entries are the CV's own lines, one for each of the 4 lines of W, named by their line numbers.
  entries: [
    { n: 1, name: "CV line 1", skillId: "line:1", line: 1, text: LINES_W[0], inferred: false },
    { n: 2, name: "CV line 2", skillId: "line:2", line: 2, text: LINES_W[1], inferred: false },
    { n: 3, name: "CV line 3", skillId: "line:3", line: 3, text: LINES_W[2], inferred: false },
    { n: 4, name: "CV line 4", skillId: "line:4", line: 4, text: LINES_W[3], inferred: false },
  ],
};

// The route's answer for W (what /api/check sends: accepted answers only, positions as sent).
export const REPLY_W = {
  answers: [
    { requirement: 1, verdict: "met", entry: 4, quote: "Dressed and monitored wounds" },
    { requirement: 2, verdict: "partly", entry: 4, quote: "Dressed and monitored" },
    { requirement: 3, verdict: "none", entry: null, quote: null },
  ],
  thrownAway: 0,
};
