import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { profileReport } from "@/app/fitReport";
import ReportView from "@/app/ReportView";
import { reportFor } from "@/app/savedAdRows";
import { skills } from "@/fixtures/skills";
import type { ViewAnswer } from "@/lib/cv/engineView";
import { AI_BLOCK_TITLE } from "@/lib/engine/evidenceText";
import { job, UNLISTED } from "./support/evidenceFixtures";
import { KEPT_WARD, personW } from "./support/checkWorld";

// EC-4a (EC-4 proposal, Part B g and Part C PR1 to PR5, CP9): the report of the world W with and without the check's answers, and the block that shows
// them. Hand-worked. The ad: SQL (met, line 2), Excel (listed, not on the profile: missing), wound care and patient intake (unlisted musts), kombucha
// (unlisted nice). Today only SQL and Excel are judged: 1 of 2 met, 1 missing = Good, and 2 musts are not judged, so "At best Good (skills only; 2
// must-haves not judged)". With wound care met and patient intake partly (a partly counts as missing): 4 musts, 2 met, 2 missing = Stretch, 2 musts judged by
// the AI. With patient intake met as well: 3 met, 1 missing (Excel) = Good, 2 judged by the AI.

const WOUND_MET: ViewAnswer = { index: 2, verdict: "met", entry: KEPT_WARD, quote: "Dressed and monitored wounds" };
const INTAKE_PARTLY: ViewAnswer = { index: 3, verdict: "partly", entry: KEPT_WARD, quote: "Dressed and monitored" };
const INTAKE_MET: ViewAnswer = { ...INTAKE_PARTLY, verdict: "met" };
const KOMBUCHA_NONE: ViewAnswer = { index: 4, verdict: "none", entry: null, quote: null };

const run = (extras?: { answers?: ViewAnswer[]; thrownAway?: number }) => profileReport(job(), personW(), skills, UNLISTED, extras);
const html = (report: ReturnType<typeof run>, extra?: string) =>
  renderToStaticMarkup(createElement(ReportView, { title: "Ward Assistant", report, note: "NOTE", extra: extra ? createElement("p", null, extra) : undefined }));

describe("EC-4a report: labels with the answers (PR1, PR2)", () => {
  it("PR1: before the check 'At best Good'; after the W reply 'Stretch' with 2 of 4 met; with patient intake met 'Good'; a failed check changes nothing", () => {
    expect(run().fitLabel).toBe("At best Good (skills only; 2 must-haves not judged)");
    const after = run({ answers: [WOUND_MET, INTAKE_PARTLY, KOMBUCHA_NONE] });
    expect(after.fitLabel).toBe("Stretch (skills only; 2 must-haves judged by AI)");
    expect([after.counts.mustsMet, after.counts.mustsTotal]).toEqual([2, 4]);
    expect([after.counts.nicesMet, after.counts.nicesTotal]).toEqual([0, 1]); // the nice-to-have is judged now, and missing
    const better = run({ answers: [WOUND_MET, INTAKE_MET, KOMBUCHA_NONE] });
    expect(better.fitLabel).toBe("Good (skills only; 2 must-haves judged by AI)");
    expect([better.counts.mustsMet, better.counts.mustsTotal]).toEqual([3, 4]);
    expect(run(undefined).fitLabel).toBe("At best Good (skills only; 2 must-haves not judged)"); // the check failed: no extras at all
  });

  it("PR2: reportFor with no fifth argument is today's report (no AI fields); with extras it is exactly profileReport with them", () => {
    const reading = { job: job(), unlisted: UNLISTED };
    const none = reportFor(reading, personW(), skills);
    expect(none).toEqual(run());
    expect(none).not.toHaveProperty("aiRows");
    expect(none).not.toHaveProperty("thrownAwayLine");
    const extras = { answers: [WOUND_MET, INTAKE_PARTLY], thrownAway: 1 };
    expect(reportFor(reading, personW(), skills, [], extras)).toEqual(run(extras));
  });
});

describe("EC-4a report: the block (PR3, PR4, PR5)", () => {
  it("PR3: the page text holds the heading, the ad's words, the CV line number and the quote of each answered requirement", () => {
    const m = html(run({ answers: [WOUND_MET, INTAKE_PARTLY, KOMBUCHA_NONE] }));
    expect(m).toContain(AI_BLOCK_TITLE);
    expect(m).toContain("You can care for wounds.");
    expect(m).toContain("CV line 4:");
    expect(m).toContain("Dressed and monitored wounds");
    expect(m).toContain("Patient intake: partly.");
    expect(m).toContain("Kombucha brewing: no evidence found");
    expect(html(run())).not.toContain(AI_BLOCK_TITLE);
  });

  it("PR4: only a thrown-away count (no accepted answer): the line shows, the label is today's, and no heading is drawn; with no count nothing is drawn", () => {
    const r = run({ thrownAway: 1 });
    expect(r.fitLabel).toBe("At best Good (skills only; 2 must-haves not judged)");
    expect(r.thrownAwayLine).toBe("1 answer was not accepted because its quote was not on the CV line.");
    const m = html(r);
    expect(m).toContain("1 answer was not accepted because its quote was not on the CV line.");
    expect(m).not.toContain(AI_BLOCK_TITLE);
    expect(html(run({ thrownAway: 0 }))).not.toContain("not accepted");
  });

  it("PR5: the block comes before {extra}, as an h3 like the other sections; with no rows and no count the page text is exactly what it was", () => {
    const m = html(run({ answers: [WOUND_MET, INTAKE_PARTLY] }), "EXTRA-MARK");
    expect(m).toContain(`<h3 class="font-semibold">${AI_BLOCK_TITLE}</h3>`);
    expect(m).toContain('<h3 class="font-semibold">Must-haves</h3>'); // the same heading level as the sections already there
    expect(m.indexOf(AI_BLOCK_TITLE)).toBeLessThan(m.indexOf("EXTRA-MARK"));
    expect(m.indexOf('<h3 class="font-semibold">Must-haves</h3>')).toBeLessThan(m.indexOf(AI_BLOCK_TITLE));
    const plain = run();
    const withEmpty = { ...plain, aiRows: [], aiJudged: { musts: 0, nices: 0 }, thrownAwayLine: null };
    expect(html(withEmpty, "EXTRA-MARK")).toBe(html(plain, "EXTRA-MARK"));
    expect(html(plain, "EXTRA-MARK")).not.toContain("judged by the AI");
  });
});

describe("EC-4a /demo (CP9)", () => {
  const root = process.cwd();
  const walk = (rel: string, out: string[] = []): string[] => {
    for (const name of readdirSync(join(root, rel))) {
      const p = `${rel}/${name}`;
      if (statSync(join(root, p)).isDirectory()) walk(p, out);
      else out.push(p);
    }
    return out;
  };
  const demoFiles = [...walk("app/demo"), ...walk("lib/demo"), "app/DemoEntry.tsx"];

  it("CP9: the demo has no check: no demo file names the check parts, and its reportFor call has four arguments, so it never gets the AI block", () => {
    for (const f of demoFiles) {
      const src = readFileSync(join(root, f), "utf8");
      for (const w of ["CheckBox", "runCheck", "api/check", "checkPlan", "checkBridge", "checkWording", "extrasFor"]) expect(src, `${f} must not mention ${w}`).not.toContain(w);
    }
    const page = readFileSync(join(root, "app/demo/page.tsx"), "utf8");
    expect(page).toContain("reportFor(shown, built, skills, demo.cv.result.unlisted)");
    // and what that call gives, drawn: no block
    expect(html(reportFor({ job: job(), unlisted: UNLISTED }, personW(), skills, []))).not.toContain(AI_BLOCK_TITLE);
  });
});
