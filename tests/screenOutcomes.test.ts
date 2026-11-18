import { describe, expect, it } from "vitest";
import { roadmapBoxSafe } from "@/app/roadmap";
import { roadmapReportSafe } from "@/app/roadmapReport";
import { screenOutcomes } from "@/app/screenOutcomes";
import type { BuiltProfile } from "@/lib/cv/profile";
import type { Job } from "@/lib/engine/types";
import { ad, ad1, ad2, ad3, ad4, must, person, skills } from "./support/roadmapFixtures";
import { tenJobs } from "./support/tenAds";
import { adsViaPage } from "./support/viaPage";

// Step 8.2, stage 1, tests first (docs/PLAN-8.2.md D9 and section 8: T24 to T27b). The composition `screenOutcomes` works out the inputs once and returns the
// box, the report and the analytics outcomes. The expectations are literals: those of T25 to T27 are copied word for word from existing tests of the box
// and the report (provenance in the stage-1 report); T24 compares with the old safe functions, whose own tests hold the hand-worked values. The
// composition was a stub when these were written (empty outcomes), so the tests fail on an assertion. The "a" tests (box and report) turn green with the
// refactor commit; the "b" tests (analytics) stay red until the analytics commit.

const prog = (name: string, date: string) => ({ name, date });
const FOUR = () => [ad1(), ad2(), ad3(), ad4()];
const BLOCKED = () => [ad1(), ad2({ location: "Exampleville" }), ad3(), ad4()];
const r3Person = () => person({ keptIds: ["tableau", "excel"], inProgress: [prog("SQL", "2027-06-01")] });
const noSkills = () => person({ keptIds: [], inProgress: [] });
const R6_ADS = () => [
  ad("p1", "Alpha Analyst", "Invented Co Two", [must("sql", "python")]),
  ad("p2", "Beta Analyst", "Invented Co Three", [must("python")]),
  ad("p3", "Gamma Analyst", "Invented Co Four", [must("sql")]),
];

const NO_PROFILE = 'What to learn needs a profile in use. Read and confirm a CV, or press "Use this profile" if one is saved on this device.'; // tests/roadmap.test.ts:41
const THRESHOLD_9 = "The roadmap shows from 10 saved ads we could judge. You have 9. Save 1 more to see it."; // tests/roadmap.test.ts:236
const THRESHOLD_4_AT_5 = "The roadmap shows from 5 saved ads we could judge. You have 4. Save 1 more to see it."; // tests/timeline.test.ts:97
const STRONG_NONE = "Already Strong: none"; // tests/roadmapReport.test.ts:69
const STRONG_ONE = "Already Strong: 1 job (Data Clerk, Example Wharf Ltd)"; // tests/roadmapReport.test.ts:35
const EMPTY_BOX = { noProfile: null, partA: [], partB: [], counted: 0, alreadyStrongIds: [], timeline: [] }; // the plan's D9 text

const out = (built: BuiltProfile | null, jobs: Job[], gate?: number) => screenOutcomes(built, adsViaPage(jobs), skills, gate);

describe("T24: the composition equals the old safe functions", () => {
  const CASES: { name: string; built: () => BuiltProfile; jobs: () => Job[]; gate: number }[] = [
    { name: "R1", built: () => person(), jobs: FOUR, gate: 4 },
    { name: "R2", built: () => person(), jobs: BLOCKED, gate: 4 },
    { name: "R3", built: r3Person, jobs: tenJobs, gate: 10 },
    { name: "R6", built: noSkills, jobs: R6_ADS, gate: 3 },
  ];
  for (const c of CASES) {
    it(`T24: ${c.name}: .box equals roadmapBoxSafe and .report equals roadmapReportSafe, and the report is really 'ready'`, () => {
      const built = c.built();
      const o = out(built, c.jobs(), c.gate);
      expect(o.box).toEqual(roadmapBoxSafe(built, adsViaPage(c.jobs()), skills, c.gate));
      expect(o.report).toEqual(roadmapReportSafe(built, adsViaPage(c.jobs()), skills, c.gate));
      expect(o.report.kind).toBe("ready"); // not an empty outcome compared with an empty outcome
      expect(o.box.counted).toBeGreaterThan(0);
    });
  }
});

describe("T25: a throw while working out the inputs", () => {
  // The record of S1 (tests/roadmap.test.ts) and T9 (tests/roadmapReport.test.ts): a reading with no `requirements`; roadmapBasis throws.
  const broken = () => ({ id: "z", job: { ...ad1(), requirements: undefined } as never });
  const healthy = () => ({ id: "h", job: ad("h", "Clerk", "Invented Co", [must("sql")]) });

  it("T25a: no exception; the box shows its failure line and the report its failed outcome", () => {
    const o = screenOutcomes(person(), [broken(), healthy()], skills);
    expect(o.box).toEqual({ noProfile: null, partA: ["What to learn could not be worked out."], partB: [], counted: 0, alreadyStrongIds: [], timeline: [] }); // tests/roadmap.test.ts:374-378
    expect(o.report).toEqual({ kind: "failed", line: "The roadmap report could not be worked out." }); // tests/roadmapReport.test.ts:293
  });

  it("T25b: the same input: the analytics outcome is 'failed' with its own line", () => {
    const o = screenOutcomes(person(), [broken(), healthy()], skills);
    expect(o.analytics).toEqual({ kind: "failed", line: "The analytics could not be worked out." });
  });
});

describe("T26: the four edges through the composition", () => {
  it("T26a: no ads; no profile; 9 counted ads at gate 10; exactly 10 (box and report)", () => {
    const none = out(person(), []);
    expect(none.box).toEqual(EMPTY_BOX);
    expect(none.report).toEqual({ kind: "none" });

    const noProfile = out(null, FOUR(), 4);
    expect(noProfile.box.noProfile).toBe(NO_PROFILE);
    expect(noProfile.box.partA).toEqual([]);
    expect(noProfile.box.partB).toEqual([]);
    expect(noProfile.report).toEqual({ kind: "none" });

    const nine = out(r3Person(), tenJobs().slice(0, 9));
    expect(nine.box.counted).toBe(9);
    expect(nine.box.partB).toEqual([THRESHOLD_9]);
    expect(nine.report).toEqual({ kind: "none" });

    const ten = out(r3Person(), tenJobs());
    expect(ten.box.counted).toBe(10);
    expect(ten.box.partB[0]).toBe(STRONG_NONE);
    expect(ten.report.kind).toBe("ready");
  });

  it("T26b: the same four edges, analytics: none, none, none, ready", () => {
    expect(out(person(), []).analytics).toEqual({ kind: "none" });
    expect(out(null, FOUR(), 4).analytics).toEqual({ kind: "none" });
    expect(out(r3Person(), tenJobs().slice(0, 9)).analytics).toEqual({ kind: "none" });
    expect(out(r3Person(), tenJobs()).analytics.kind).toBe("ready");
  });
});

describe("T27: the gate number is honoured", () => {
  it("T27a: R1 at gate 4 shows the roadmap and the report; the same four ads at gate 5 show the threshold line and no report", () => {
    const at4 = out(person(), FOUR(), 4);
    expect(at4.box.partB[0]).toBe(STRONG_ONE);
    expect(at4.report.kind).toBe("ready");
    const at5 = out(person(), FOUR(), 5);
    expect(at5.box.partB).toEqual([THRESHOLD_4_AT_5]);
    expect(at5.report).toEqual({ kind: "none" });
  });

  it("T27b: the analytics at gate 4 are 'ready'; at gate 5 'none'", () => {
    expect(out(person(), FOUR(), 4).analytics.kind).toBe("ready");
    expect(out(person(), FOUR(), 5).analytics).toEqual({ kind: "none" });
  });
});
