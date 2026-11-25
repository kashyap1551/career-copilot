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

const plan = (j: Job = job(), p = personW(), proposals: CvSkill[] | null = null) => buildCheckPlan(j, p, skills, proposals);

describe("EC-4a plan: what is sent (CPL)", () => {
  it("CPL1: W sends 3 requirements (musts in the ad's order, then the nice) and 2 entries (by CV line), 0 left over; the inputs are not changed", () => {
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

  it("CPL3: a hand-added listed skill (no CV line) and an in-progress skill are not entries: still the 2 entries of W", () => {
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

  it("CPL6: the page's caps are the route's caps (30 requirements, 60 entries)", () => {
    expect(PLAN_MAX_REQUIREMENTS).toBe(CHECK_MAX_REQUIREMENTS);
    expect(PLAN_MAX_ENTRIES).toBe(CHECK_MAX_ENTRIES);
    expect([PLAN_MAX_REQUIREMENTS, PLAN_MAX_ENTRIES]).toEqual([30, 60]);
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

  it("CPL8: the inferred flag: a kept entry carries its own; a listed entry takes it from the proposals' label (unknown proposals: false)", () => {
    const inferredP: CvSkill[] = P_W.map((p) => (p.skillId === "sql" ? { ...p, label: "inferred" as const } : p));
    expect(plan(job(), personW({}, LINES_W, inferredP), inferredP).entries.map((e) => e.inferred)).toEqual([true, false]);
    expect(plan(job(), personW({}, LINES_W, inferredP), null).entries.map((e) => e.inferred)).toEqual([false, false]);
  });

  it("CPL10: entries come out by CV line, then by name, numbered 1 to 4 (Mid line 1, SQL line 2, Alpha line 3, Zeta line 3)", () => {
    const kept = (name: string, id: string, line: number, text: string) => ({ name, skillId: id, evidence: { line, text }, inferred: false });
    const person = { ...personW(), unlistedKept: [kept("Zeta", "new:zeta", 3, "zeta line"), kept("Alpha", "new:alpha", 3, "alpha line"), kept("Mid", "new:mid", 1, "mid line")] };
    const r = buildCheckPlan(job(), person, skills, null);
    expect(r.entries.map((e) => [e.n, e.name, e.line])).toEqual([[1, "Mid", 1], [2, "SQL", 2], [3, "Alpha", 3], [4, "Zeta", 3]]);
    expect(r.requirements).toEqual(SENT_W.requirements); // the open requirements stay M3, M4, N1
  });

  it("CPL11: 62 entries found (SQL on line 2, 61 kept on lines 3 to 63): 60 are sent, the first is SQL (n 1), the last is 'Kept 61' (line 61, n 60); none on line 62 or 63", () => {
    const kept = Array.from({ length: 61 }, (_, k) => ({ name: `Kept ${k + 3}`, skillId: `new:kept-${k + 3}`, evidence: { line: k + 3, text: `line ${k + 3}` }, inferred: false }));
    const r = buildCheckPlan(job(), { ...personW(), unlistedKept: kept }, skills, null);
    expect(r.entries).toHaveLength(60);
    expect([r.entries[0].n, r.entries[0].name, r.entries[0].line]).toEqual([1, "SQL", 2]);
    expect([r.entries[59].n, r.entries[59].name, r.entries[59].line]).toEqual([60, "Kept 61", 61]);
    expect(r.entries.some((e) => e.line >= 62)).toBe(false);
  });

  it("CPL9: nothing open: no requirements; no confirmed entries: no entries", () => {
    const allListed = job(job().requirements.slice(0, 2)); // SQL and Excel only
    expect(plan(allListed).requirements).toEqual([]);
    expect(plan(job(), personW({ keptIds: [] })).entries).toEqual([]);
  });
});
