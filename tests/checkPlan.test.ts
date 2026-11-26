import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildCheckPlan, extrasFor, PLAN_MAX_ENTRIES, PLAN_MAX_REQUIREMENTS, type Checked } from "@/lib/cv/checkPlan";
import { CHECK_MAX_ENTRIES, CHECK_MAX_REQUIREMENTS } from "@/lib/ai/checkInput";
import type { CvSkill } from "@/lib/engine/fromCv";
import type { Job } from "@/lib/engine/types";
import { deepFreeze, job, req } from "./support/evidenceFixtures";
import { LINES_W, P_W, personW, SENT_W } from "./support/checkWorld";

// EC-4a (docs/PLAN-EVERY-CV.md, EC-4 proposal, Part B a, b, d and Part C): the plan of what one check sends, and when its answers may be used.
// Pure code, no AI, no network, no screen. Every expectation below is worked out by hand from the world W in tests/support/checkWorld.ts:
// ad index 0 SQL, 1 Excel (listed), 2 wound care, 3 patient intake (must, unlisted), 4 kombucha (nice, unlisted); the person has SQL on CV line 2 and a
// kept unlisted "Ward nursing" on CV line 4. Excel is listed but not on the profile, so the list judges it (missing): it is NOT sent.
// EC-8a: the entries are no longer the ticked skills; they are the CV's own lines, one for each of the 4 lines of W ("CV line 1" to "CV line 4").

const plan = (j: Job = job(), p = personW(), proposals: CvSkill[] | null = null) => buildCheckPlan(j, p, skills, proposals);

describe("EC-4a plan: what is sent (CPL)", () => {
  it("CPL1: W sends 3 requirements (musts in the ad's order, then the nice) and 4 entries (the 4 CV lines), 0 left over; the inputs are not changed", () => {
    const j = deepFreeze(job());
    const p = deepFreeze(personW());
    const r = buildCheckPlan(j, p, skills, null);
    expect(r.requirements).toEqual(SENT_W.requirements);
    expect(r.entries).toEqual(SENT_W.entries);
    expect(r.notChecked).toBe(0);
    expect(typeof r.key).toBe("string");
  });

  it("CPL2: 3 nices first in the ad, then 32 musts, all open: 30 sent, all musts (indexes 3 to 32), numbered 1 to 30; 5 left over (35 - 30)", () => {
    const nices = [0, 1, 2].map((i) => req(`Nice open ${i}.`, "nice", `new:nice-${i}`));
    const musts = Array.from({ length: 32 }, (_, i) => req(`Must open ${i}.`, "must", `new:must-${i}`));
    const r = plan(job([...nices, ...musts]));
    expect(r.requirements).toHaveLength(30);
    expect(r.requirements.every((x) => x.importance === "must")).toBe(true);
    expect(r.requirements.map((x) => x.index)).toEqual(Array.from({ length: 30 }, (_, i) => i + 3));
    expect(r.requirements.map((x) => x.n)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(r.notChecked).toBe(5);
  });

  it("CPL3: a hand-added listed skill (no CV line) and an in-progress skill change nothing: still the 4 entries of W", () => {
    const r = plan(job(), personW({ added: ["Excel"], inProgress: [{ name: "Tableau", date: "2027-03-01" }] }));
    expect(r.entries).toEqual(SENT_W.entries);
  });

  it("CPL4: the plan never sees answers: the same inputs give the same key every time, and the code asks the engine view for the open requirements with no answers", () => {
    expect(plan().key).toBe(plan().key);
    const src = readFileSync(join(process.cwd(), "lib/cv/checkPlan.ts"), "utf8");
    expect(src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")).toMatch(/engineView\(job, built\)/);
    // the answers of a click, made from the plan, are usable on the plan built again from the same inputs
    const first = plan();
    const checked: Checked = { key: first.key, answers: [], thrownAway: 0, sent: first.requirements.length };
    expect(extrasFor(checked, plan())).toBeDefined();
  });

  it("CPL5: the key changes when an entry's text, an entry's line number, a requirement's words or a requirement's importance change; not when a hand-added skill is added", () => {
    const base = plan().key;
    const otherText = [...LINES_W.slice(0, 3), "Dressed and monitored wounds on a day ward"];
    expect(plan(job(), personW({}, otherText)).key).not.toBe(base);
    // the same wording one line up (swap lines 3 and 4; the kept skill now points at line 3)
    const swapped = [LINES_W[0], LINES_W[1], LINES_W[3], LINES_W[2]];
    const movedProposals = P_W.map((p) => (p.skillId === "new:ward-nursing" ? { ...p, line: 3 } : p));
    expect(plan(job(), personW({}, swapped, movedProposals)).key).not.toBe(base);
    const j = job();
    const reworded = job(j.requirements.map((r, i) => (i === 2 ? { ...r, quote: "You can care for wounds well." } : r)));
    expect(plan(reworded).key).not.toBe(base);
    const reweighted = job(j.requirements.map((r, i) => (i === 2 ? { ...r, importance: "nice" as const } : r)));
    expect(plan(reweighted).key).not.toBe(base);
    expect(plan(job(), personW({ added: ["Excel"] })).key).toBe(base);
  });

  it("CPL6: the page's caps are the route's caps (30 requirements, 120 entries)", () => {
    expect(PLAN_MAX_REQUIREMENTS).toBe(CHECK_MAX_REQUIREMENTS);
    expect(PLAN_MAX_ENTRIES).toBe(CHECK_MAX_ENTRIES);
    expect([PLAN_MAX_REQUIREMENTS, PLAN_MAX_ENTRIES]).toEqual([30, 120]);
  });

  it("CPL7: extrasFor gives the answers only while the key is the one at click time (equal: yes; different or nothing checked: undefined)", () => {
    const p = plan();
    const checked: Checked = { key: p.key, answers: [{ index: 2, verdict: "none", entry: null, quote: null }], thrownAway: 1, sent: 3 };
    expect(extrasFor(checked, p)).toEqual({ answers: checked.answers, thrownAway: 1 });
    expect(extrasFor({ ...checked, key: p.key + "x" }, p)).toBeUndefined();
    expect(extrasFor(null, p)).toBeUndefined();
    const moved = plan(job(), personW({}, [...LINES_W.slice(0, 3), "Dressed and monitored wounds on a day ward"]));
    expect(extrasFor(checked, moved)).toBeUndefined(); // a changed confirmed CV line: the answers are not shown
  });

  it("CPL8: no entry is flagged inferred: an entry is a CV line, not a skill (the proposals' labels are not used)", () => {
    const inferredP: CvSkill[] = P_W.map((p) => (p.skillId === "sql" ? { ...p, label: "inferred" as const } : p));
    expect(plan(job(), personW({}, LINES_W, inferredP), inferredP).entries.map((e) => e.inferred)).toEqual([false, false, false, false]);
  });

  it("CPL10: entries come out by CV line, numbered 1 to 4, and extra kept skills on a line change nothing (three kept skills on lines 1 and 3: still the 4 lines)", () => {
    const kept = (name: string, id: string, line: number, text: string) => ({ name, skillId: id, evidence: { line, text }, inferred: false });
    const person = { ...personW(), unlistedKept: [kept("Zeta", "new:zeta", 3, "zeta line"), kept("Alpha", "new:alpha", 3, "alpha line"), kept("Mid", "new:mid", 1, "mid line")] };
    const r = buildCheckPlan(job(), person, skills, null);
    expect(r.entries.map((e) => [e.n, e.name, e.line])).toEqual([[1, "CV line 1", 1], [2, "CV line 2", 2], [3, "CV line 3", 3], [4, "CV line 4", 4]]);
    expect(r.requirements).toEqual(SENT_W.requirements); // the open requirements stay M3, M4, N1
  });

  it("CPL11: 122 lines: 120 are sent (the first is CV line 1, the last CV line 120, n 120); the 2 after them are counted as not sent", () => {
    const lines = Array.from({ length: 122 }, (_, i) => `line ${i + 1}`);
    const r = buildCheckPlan(job(), personW({}, lines), skills, null);
    expect(r.entries).toHaveLength(120);
    expect([r.entries[0].n, r.entries[0].name, r.entries[0].line]).toEqual([1, "CV line 1", 1]);
    expect([r.entries[119].n, r.entries[119].name, r.entries[119].line]).toEqual([120, "CV line 120", 120]);
    expect([r.entriesAvailable, r.entriesNotSent]).toEqual([122, 2]);
  });

  it("CPL9: nothing open: no requirements; no CV lines at all: no entries", () => {
    const allListed = job(job().requirements.slice(0, 2)); // SQL and Excel only
    expect(plan(allListed).requirements).toEqual([]);
    const noLines = { ...personW(), profile: { ...personW().profile, cvLines: [] } };
    expect(plan(job(), noLines).entries).toEqual([]);
  });
});
