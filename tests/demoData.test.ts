import { describe, expect, it } from "vitest";
import { roadmapAds, roadmapBox } from "@/app/roadmap";
import { openedReadings, rankedAdRows } from "@/app/savedAdRows";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type ConfirmState } from "@/lib/cv/profile";
import { buildJob } from "@/lib/engine/fromAd";
import { fromCv } from "@/lib/engine/fromCv";
import { jobIdFor } from "@/lib/saved/jobId";
import { extractedCvSchema } from "@/lib/schemas/cv";
import { extractedAdSchema } from "@/lib/schemas/job";
import type * as DataModule from "@/lib/demo/data";
import type * as StartModule from "@/lib/demo/start";

// Step 9.1, demo mode (docs/PLAN-9.1.md, revision 2). Tests written BEFORE any code (section 6; stage 2 of Day 9).
// Every expected text and count is copied from the plan (section 3 as amended by A4 and A5), never from running anything.
// The modules lib/demo/data and lib/demo/start do not exist yet: they are loaded inside each test, so a missing module fails
// that test alone. The export names used here are the interface this file proposes to the build stage:
//   lib/demo/data:  DEMO_CV_LINES: string[]; DEMO_EXTRACTED_CV: ExtractedCv;
//                   DEMO_ADS: { title; company; text: string; extraction: ExtractedAd }[]  (ads 1 to 10, in the order of A4)
//   lib/demo/start: startDemo(): Promise<{ cv: { lines: string[]; result: CvBuildResult }; ctx: SavedContext; ads: SavedJob[] }>
const load = async <T>(spec: string): Promise<T> => (await import(/* @vite-ignore */ spec)) as T;
const data = () => load<typeof DataModule>("@/lib/demo/data");
const start = () => load<typeof StartModule>("@/lib/demo/start");

type Level = "Strong" | "Good" | "Stretch" | "Long shot";
// The table of PLAN-9.1 A4 (ads 1 to 10). City is Berlin except ad 9 (Exampleville).
const ADS: { title: string; company: string; city: string; musts: string[]; nices: string[]; level: Level }[] = [
  { title: "Insight Analyst", company: "Quillon Foods Ltd", city: "Berlin", musts: ["sql", "tableau"], nices: ["excel"], level: "Strong" },
  { title: "Records Clerk", company: "Marrowby Freight Ltd", city: "Berlin", musts: ["excel"], nices: ["python", "power-bi"], level: "Strong" },
  { title: "Revenue Analyst", company: "Tarnbridge Mills Ltd", city: "Berlin", musts: ["sql", "excel"], nices: [], level: "Strong" },
  { title: "BI Engineer", company: "Pellwick Print Ltd", city: "Berlin", musts: ["sql", "python"], nices: ["tableau"], level: "Good" },
  { title: "Budget Analyst", company: "Ostrander Glass Ltd", city: "Berlin", musts: ["excel", "python"], nices: [], level: "Good" },
  { title: "Data Platform Engineer", company: "Fenwick Quarry Ltd", city: "Berlin", musts: ["sql", "python", "power-bi"], nices: [], level: "Stretch" },
  { title: "Dashboard Specialist", company: "Corvane Tools Ltd", city: "Berlin", musts: ["power-bi", "tableau"], nices: ["sql"], level: "Good" },
  { title: "Management Reporting Lead", company: "Haldane Paper Ltd", city: "Berlin", musts: ["power-bi", "excel"], nices: [], level: "Good" },
  { title: "Site Coordinator", company: "Wexcombe Textiles Ltd", city: "Exampleville", musts: ["sql", "tableau"], nices: [], level: "Long shot" },
  { title: "Campaign Analyst", company: "Yarrowdale Games Ltd", city: "Berlin", musts: ["python", "power-bi"], nices: [], level: "Stretch" },
];
const LABEL = (i: number) => `${ADS[i].title}, ${ADS[i].company}`;
const LABELS = ADS.map((_, i) => LABEL(i));
// Row order of the list (A4): by level, then newest first: ads 1, 2, 3, 4, 5, 7, 8, 6, 10, 9.
const ROW_ORDER = [1, 2, 3, 4, 5, 7, 8, 6, 10, 9].map((n) => LABEL(n - 1));
// With Tableau unticked (A4): levels of ads 1 to 10.
const LEVELS_NO_TABLEAU: Level[] = ["Good", "Strong", "Strong", "Good", "Good", "Stretch", "Stretch", "Good", "Long shot", "Stretch"];

const confirmWith = (keptIds: string[]): ConfirmState => ({
  keptIds, added: [], inProgress: [], languages: [], cities: "Berlin", workModes: [], years: "", availableFrom: "",
});

// The demo as the page gets it: the state from startDemo, the profile for the given ticks, the saved ads as the list opens them.
async function world(keptIds: string[]) {
  const { startDemo } = await start();
  const demo = await startDemo();
  const built = buildProfile(demo.cv.lines, demo.cv.result.skills, confirmWith(keptIds), skills);
  const opened = openedReadings(demo.ads, { stamps: demo.ctx.stamps, skills });
  return { demo, built, opened };
}
const levelOf = (levelLine: string | null) => (levelLine ?? "").replace(/^Fit: /, "").replace(/ \(.*$/, "");

describe("the bundled readings (PLAN-9.1 sections 2.1, 2.2, 3)", () => {
  // D1 (section 6): the bundled objects have the shape the AI returns.
  it("D1: the ten ads parse with extractedAdSchema and the CV with extractedCvSchema", async () => {
    const d = await data();
    expect(d.DEMO_ADS.length).toBe(10);
    expect(d.DEMO_ADS.filter((a) => extractedAdSchema.safeParse(a.extraction).success).length).toBe(10);
    expect(extractedCvSchema.safeParse(d.DEMO_EXTRACTED_CV).success).toBe(true);
  });

  // D2 (section 6, section 3 "The person", section 2.2): the CV through fromCv.
  it("D2: the CV gives SQL line 3, Tableau line 4, Excel line 5, all listed and named, nothing removed, and three ticked at the start", async () => {
    const d = await data();
    expect(d.DEMO_CV_LINES.length).toBe(8);
    expect(d.DEMO_CV_LINES[2]).toBe("Wrote SQL queries to reconcile order data");
    expect(d.DEMO_CV_LINES[3]).toBe("Built monthly dashboards in Tableau");
    expect(d.DEMO_CV_LINES[4]).toBe("Kept the weekly sales sheet in Excel");
    const r = fromCv(d.DEMO_EXTRACTED_CV, d.DEMO_CV_LINES, skills);
    expect(r.skills.map((s) => [s.skillId, s.line, s.listed, s.label])).toEqual([
      ["sql", 3, true, "named"],
      ["tableau", 4, true, "named"],
      ["excel", 5, true, "named"],
    ]);
    expect(r.removed).toEqual([]);
    expect(r.unlisted).toEqual([]);
    expect(initialConfirm(r.skills).keptIds).toEqual(["sql", "tableau", "excel"]);
  });

  // D3 (section 6, A4 table): each ad through buildJob.
  it("D3: each ad through buildJob gives the title, company, city and skills of the table, and nothing removed, moved, unlisted or not counted", async () => {
    const d = await data();
    d.DEMO_ADS.forEach((ad, i) => {
      const r = buildJob(ad.extraction, ad.text, skills, { id: "pasted-ad", source: null });
      expect([r.job.title, r.job.company, r.job.constraints.location], `ad ${i + 1}`).toEqual([ADS[i].title, ADS[i].company, ADS[i].city]);
      const ids = (importance: "must" | "nice") => r.job.requirements.filter((q) => q.importance === importance).flatMap((q) => q.skillIds).sort();
      expect(ids("must"), `ad ${i + 1} musts`).toEqual([...ADS[i].musts].sort());
      expect(ids("nice"), `ad ${i + 1} nices`).toEqual([...ADS[i].nices].sort());
      expect([r.removed.length, r.moved.length, r.unlisted.length, r.notCounted.length], `ad ${i + 1} leftovers`).toEqual([0, 0, 0, 0]);
    });
  });
});

describe("the demo through the page's own code (PLAN-9.1 sections 2.3, 3; A4)", () => {
  // D4 (section 6, section 3, A4): the levels and the order of the list, all three skills ticked.
  it("D4: levels Strong 3, Good 4, Stretch 2, Long shot 1, and the rows in the order of A4", async () => {
    const { built, opened } = await world(["sql", "tableau", "excel"]);
    const { rows } = rankedAdRows(opened, built, skills);
    expect(rows.map((r) => r.titleLine)).toEqual(ROW_ORDER);
    ADS.forEach((a, i) => {
      const row = rows.find((r) => r.titleLine === LABEL(i));
      expect(row?.levelLine?.startsWith(`Fit: ${a.level} (`), `ad ${i + 1}: ${row?.levelLine}`).toBe(true);
    });
    const count = (l: Level) => rows.filter((r) => levelOf(r.levelLine) === l).length;
    expect([count("Strong"), count("Good"), count("Stretch"), count("Long shot")]).toEqual([3, 4, 2, 1]);
    // The two texts that the live check of 6.2 showed word for word (docs/MANUAL-CHECK-6.2.md step 3):
    expect(rows.find((r) => r.titleLine === LABEL(0))?.levelLine).toBe("Fit: Strong (judged: skills, location)");
    const ad9 = rows.find((r) => r.titleLine === LABEL(8));
    expect(ad9?.levelLine).toBe("Fit: Long shot (judged: skills, location)");
    expect(ad9?.namedReason).toBe(
      "Long shot because of location: The job is in Exampleville; the cities on your profile are: Berlin. That can't be closed soon.",
    );
  });

  // D5 (section 6, A4): the box, all three ticked, line for line.
  it("D5: Part A and Part B of the box are the texts of A4; ten counted; the Already Strong ids are those of ads 1, 2, 3", async () => {
    const { demo, built, opened } = await world(["sql", "tableau", "excel"]);
    const box = roadmapBox(built, roadmapAds(opened), skills);
    expect(box.noProfile).toBeNull();
    expect(box.counted).toBe(10);
    expect(box.partA).toEqual([
      "Skills you are missing across your 10 saved ads",
      "(Counted against the profile in use. Must-haves and nice-to-haves are counted apart.)",
      "Power BI: must-have in 4 ads, nice-to-have in 1 ad",
      "Python: must-have in 4 ads, nice-to-have in 1 ad",
      "1 of your 10 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.",
    ]);
    expect(box.partB).toEqual([
      "Already Strong: 3 jobs (Insight Analyst, Quillon Foods Ltd; Records Clerk, Marrowby Freight Ltd; Revenue Analyst, Tarnbridge Mills Ltd)",
      "Skills to build, in order:",
      "1. Power BI: unlocks 2 jobs (Dashboard Specialist, Corvane Tools Ltd; Management Reporting Lead, Haldane Paper Ltd). Total so far: 2 jobs.",
      "2. Python: unlocks 4 jobs (BI Engineer, Pellwick Print Ltd; Budget Analyst, Ostrander Glass Ltd; Data Platform Engineer, Fenwick Quarry Ltd; Campaign Analyst, Yarrowdale Games Ltd). Total so far: 6 jobs.",
      "Blocked jobs (skills alone can't make these Strong): 1",
      "- Site Coordinator, Wexcombe Textiles Ltd: blocked by 1 thing; it can't be closed soon",
      "(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin.",
    ]);
    const d = await data();
    const strongIds = await Promise.all([0, 1, 2].map((i) => jobIdFor(d.DEMO_ADS[i].text)));
    expect(box.alreadyStrongIds).toEqual(strongIds);
    expect(demo.ads.length).toBe(10);
  });

  // D6 (section 6, A4 "With Tableau unticked"): the untick case.
  it("D6: with Tableau unticked the counts are Strong 2, Good 4, Stretch 3, Long shot 1, Part A has the three rows of A4, and Part B has the Skills to build and blocked lines", async () => {
    const { built, opened } = await world(["sql", "excel"]);
    const { rows } = rankedAdRows(opened, built, skills);
    ADS.forEach((_, i) => {
      const row = rows.find((r) => r.titleLine === LABEL(i));
      expect(levelOf(row?.levelLine ?? null), `ad ${i + 1}`).toBe(LEVELS_NO_TABLEAU[i]);
    });
    const count = (l: Level) => rows.filter((r) => levelOf(r.levelLine) === l).length;
    expect([count("Strong"), count("Good"), count("Stretch"), count("Long shot")]).toEqual([2, 4, 3, 1]);
    const box = roadmapBox(built, roadmapAds(opened), skills);
    expect(box.partA).toEqual([
      "Skills you are missing across your 10 saved ads",
      "(Counted against the profile in use. Must-haves and nice-to-haves are counted apart.)",
      "Power BI: must-have in 4 ads, nice-to-have in 1 ad",
      "Python: must-have in 4 ads, nice-to-have in 1 ad",
      "Tableau: must-have in 3 ads, nice-to-have in 1 ad",
      "1 of your 10 counted saved ads is held back by something other than skills (location), so learning the skills above may not open it.",
    ]);
    expect(box.partB[0]).toBe("Already Strong: 2 jobs (Records Clerk, Marrowby Freight Ltd; Revenue Analyst, Tarnbridge Mills Ltd)");
    // Hand-worked by the reviewer (prompt B1). The names inside a line follow the order the ads were saved, newest first.
    expect(box.partB.slice(1)).toEqual([
      "Skills to build, in order:",
      "1. Python: unlocks 2 jobs (BI Engineer, Pellwick Print Ltd; Budget Analyst, Ostrander Glass Ltd). Total so far: 2 jobs.",
      "2. Power BI: unlocks 3 jobs (Data Platform Engineer, Fenwick Quarry Ltd; Management Reporting Lead, Haldane Paper Ltd; Campaign Analyst, Yarrowdale Games Ltd). Total so far: 5 jobs.",
      "3. Tableau: unlocks 2 jobs (Insight Analyst, Quillon Foods Ltd; Dashboard Specialist, Corvane Tools Ltd). Total so far: 7 jobs.",
      "Blocked jobs (skills alone can't make these Strong): 1",
      "- Site Coordinator, Wexcombe Textiles Ltd: blocked by 1 thing; it can't be closed soon",
      "(can't be closed soon) The job is in Exampleville; the cities on your profile are: Berlin.",
    ]);
  });

  // D7 (section 6, lesson of defect P0, A5): shared job ids, distinct saved ids, the fixed times, no repeated name.
  it("D7: every job carries the id pasted-ad, the ten saved ids are ten different 16-hex strings, the times are those of A5, and each Already Strong label appears once", async () => {
    const { demo, built, opened } = await world(["sql", "tableau", "excel"]);
    expect(demo.ads.map((a) => a.reading.job.id)).toEqual(Array(10).fill("pasted-ad"));
    const ids = demo.ads.map((a) => a.id);
    expect(ids.every((id) => /^[0-9a-f]{16}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(10);
    // A5: ad number i is saved at 10:(10 - i):00 on 2026-11-24, so the list (newest first) is ad 1 to ad 10.
    expect(demo.ads.map((a) => a.savedAt)).toEqual([
      "2026-11-24T10:09:00.000Z", "2026-11-24T10:08:00.000Z", "2026-11-24T10:07:00.000Z", "2026-11-24T10:06:00.000Z",
      "2026-11-24T10:05:00.000Z", "2026-11-24T10:04:00.000Z", "2026-11-24T10:03:00.000Z", "2026-11-24T10:02:00.000Z",
      "2026-11-24T10:01:00.000Z", "2026-11-24T10:00:00.000Z",
    ]);
    expect(demo.ads.map((a) => `${a.reading.job.title}, ${a.reading.job.company}`)).toEqual(LABELS);
    const line = roadmapBox(built, roadmapAds(opened), skills).partB[0];
    for (const i of [0, 1, 2]) expect(line.split(LABEL(i)).length - 1, LABEL(i)).toBe(1);
  });
});
