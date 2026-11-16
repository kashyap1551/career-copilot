import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allowanceFor, closeTargets, osaDistance, spellingForm } from "@/lib/engine/closeSpelling";
import { mapName } from "@/lib/engine/mapName";
import { lookupExact, skillIdFor } from "@/lib/engine/skillIds";
import type { Skill } from "@/lib/engine/types";
import { MUST_NOT_MERGE, MUST_NOT_MERGE_NAMES } from "@/lib/vocab/mustNotMerge";
import { isNotASkill, skills, VOCAB } from "@/lib/vocab";

// 5.2 stage 2, close spelling (docs/PLAN-5.1.md, "5.2 stage 2 rules and outcome definitions"). Every expectation
// was worked out by hand from those rules before the code. Small made-up lists test the rules; the real vocabulary
// tests the rest.

const list = (...s: Skill[]) => s;

describe("distance, allowance and the spelling form", () => {
  it("D1: insert, delete and replace each count 1; a swap of neighbours counts 1; a far swap counts 2", () => {
    expect(osaDistance("excell", "excel")).toBe(1); // delete
    expect(osaDistance("exel", "excel")).toBe(1); // insert
    expect(osaDistance("excal", "excel")).toBe(1); // replace
    expect(osaDistance("pyhton", "python")).toBe(1); // swap of neighbours
    expect(osaDistance("ab", "ba")).toBe(1);
    expect(osaDistance("abc", "cba")).toBe(2); // not neighbours
    expect(osaDistance("kitten", "sitting")).toBe(3);
    expect(osaDistance("", "abc")).toBe(3);
    expect(osaDistance("abc", "")).toBe(3);
    expect(osaDistance("same", "same")).toBe(0);
  });

  it("D2: the allowance by the length of the shorter string: 0 up to 5, 1 for 6 to 8, 2 for 9 and more (changed 2026-11-16, before any measure)", () => {
    const table: [number, number][] = [[0, 0], [1, 0], [4, 0], [5, 0], [6, 1], [8, 1], [9, 2], [10, 2], [30, 2]];
    for (const [len, want] of table) expect(allowanceFor(len)).toBe(want);
  });

  it("D3: the spelling form: folded, level and filler words and a version dropped from the NAME, then spaces, hyphens and dots dropped", () => {
    const table: [string, string][] = [
      ["Excel (advanced)", "excel"],
      ["SQL-Kenntnisse", "sql"],
      ["Python 3.11", "python"],
      ["Qualitätsmanagement", "qualitatsmanagement"],
      ["P&L", "pandl"],
      ["C++", "cplusplus"],
      [" E-Commerce ", "ecommerce"],
      ["Node.js", "nodejs"],
    ];
    for (const [input, want] of table) expect(spellingForm(input)).toBe(want);
  });
});

describe("the rules, on made-up lists", () => {
  it("C3: a 4-letter name with one typo is NOT mapped (allowance 0); nor is a 5-letter one", () => {
    expect(mapName("Jave", list({ id: "java", name: "Java" }))).toEqual({ how: "none" });
    expect(mapName("Java", list({ id: "java", name: "Java" }))).toEqual({ how: "exact", id: "java", try: 1 });
    expect(mapName("Swift", list({ id: "swift", name: "Swift" }))).toEqual({ how: "exact", id: "swift", try: 1 });
    expect(mapName("Shift", list({ id: "swift", name: "Swift" }))).toEqual({ how: "none" });
  });

  it("C4: the allowance comes from the SHORTER string: skill 'Rust' (4) and name 'Trust' (5): not mapped", () => {
    expect(mapName("Trust", list({ id: "rust", name: "Rust" }))).toEqual({ how: "none" });
    // a 5-letter skill and a 6-letter name: the shorter is 5, allowance 0: not mapped (it was mapped before 2026-11-16)
    expect(mapName("Trusty", list({ id: "trust", name: "Trust" }))).toEqual({ how: "none" });
    // a 6-letter skill and a 7-letter name: the shorter is 6, allowance 1: one change maps
    expect(mapName("Trustyy", list({ id: "trusty", name: "Trusty" }))).toEqual({ how: "close", id: "trusty", distance: 1, via: "Trusty" });
  });

  it("C5: 6 to 8 letters: one change maps, two changes do not", () => {
    const l = list({ id: "tableau", name: "Tableau" }); // 7 letters
    expect(mapName("Tableu", l)).toEqual({ how: "close", id: "tableau", distance: 1, via: "Tableau" });
    expect(mapName("Tablaeu", l)).toEqual({ how: "close", id: "tableau", distance: 1, via: "Tableau" }); // a swap
    expect(mapName("Tebleu", l)).toEqual({ how: "none" }); // two changes
  });

  it("C6: 9 or more letters: two changes map, three do not", () => {
    const l = list({ id: "kubernetes", name: "Kubernetes" }); // 10 letters
    expect(mapName("Kubarnetes", l)).toEqual({ how: "close", id: "kubernetes", distance: 1, via: "Kubernetes" });
    expect(mapName("Kubarnates", l)).toEqual({ how: "close", id: "kubernetes", distance: 2, via: "Kubernetes" });
    expect(mapName("Kubarnatas", l)).toEqual({ how: "none" }); // three changes
  });

  it("C6b: the boundaries 5/6 and 8/9, one skill each", () => {
    expect(mapName("Abxd", list({ id: "s4", name: "Abcd" }))).toEqual({ how: "none" }); // 4 letters: 0
    expect(mapName("Abcxe", list({ id: "s5", name: "Abcde" }))).toEqual({ how: "none" }); // 5 letters: 0 (was 1)
    expect(mapName("Abcdxf", list({ id: "s6", name: "Abcdef" }))).toMatchObject({ how: "close", id: "s6", distance: 1 }); // 6 letters: 1
    expect(mapName("Abcxxf", list({ id: "s6", name: "Abcdef" }))).toEqual({ how: "none" }); // 6 letters: not 2
    expect(mapName("Abcdefgx", list({ id: "s8", name: "Abcdefgh" }))).toMatchObject({ how: "close", distance: 1 }); // 8: 1
    expect(mapName("Abcdefxx", list({ id: "s8", name: "Abcdefgh" }))).toEqual({ how: "none" }); // 8 letters: not 2
    expect(mapName("Abcdefgxx", list({ id: "s9", name: "Abcdefghi" }))).toMatchObject({ how: "close", distance: 2 }); // 9: 2
    expect(mapName("Abcdefxxx", list({ id: "s9", name: "Abcdefghi" }))).toEqual({ how: "none" }); // 9 letters: not 3
  });

  it("C7: a tie: two skills whose strings are both distance 1 from the name: no mapping", () => {
    const l = list({ id: "a", name: "Pillow" }, { id: "b", name: "Billow" });
    expect(mapName("Dillow", l)).toEqual({ how: "tie", ids: ["a", "b"] });
  });

  it("C8: one skill reached through two of its own strings at the same distance is NOT a tie", () => {
    const l = list({ id: "s", name: "Pillow", aliases: ["Billow"] });
    expect(mapName("Dillow", l)).toEqual({ how: "close", id: "s", distance: 1, via: "Pillow" });
  });

  it("C9: an exactOnly entry is never reached by spelling", () => {
    expect(mapName("R programing", list({ id: "r", name: "R", exactOnly: true, aliases: ["R programming"] }))).toEqual({ how: "none" });
    expect(mapName("Golnag", list({ id: "go", name: "Go", exactOnly: true, aliases: ["Golang"] }))).toEqual({ how: "none" });
    // the same typo reaches the entry when it is NOT exactOnly: the rule is what blocks it
    expect(mapName("Golnag", list({ id: "go", name: "Go", aliases: ["Golang"] }))).toMatchObject({ how: "close", id: "go", distance: 1 });
  });

  it("C10: stage 1 wins: an exact alias of A that is also distance 1 from an alias of B maps to A, 'exact'", () => {
    const l = list({ id: "a", name: "Alpha", aliases: ["Quartz"] }, { id: "b", name: "Beta", aliases: ["Quartx"] });
    expect(mapName("Quartz", l)).toEqual({ how: "exact", id: "a", try: 1 });
    expect(mapName("quartz", l)).toEqual({ how: "exact", id: "a", try: 1 });
    expect(mapName("Quartx", l)).toEqual({ how: "exact", id: "b", try: 1 });
  });

  it("C10b: the three tries of stage 1 are reported", () => {
    const l = list({ id: "sql", name: "SQL" }, { id: "py", name: "Python" });
    expect(mapName("SQL", l)).toEqual({ how: "exact", id: "sql", try: 1 });
    expect(mapName("Advanced SQL", l)).toEqual({ how: "exact", id: "sql", try: 2 });
    expect(mapName("Python 3.11", l)).toEqual({ how: "exact", id: "py", try: 3 });
    expect(mapName("Advanced Python 3", l)).toEqual({ how: "exact", id: "py", try: 3 });
  });

  it("C10c: with fillers and a typo: the name is stripped first, then the spelling is compared", () => {
    expect(mapName("Strong Tablau skills", list({ id: "tableau", name: "Tableau" }))).toEqual({ how: "close", id: "tableau", distance: 1, via: "Tableau" });
    // a 5-letter skill is not repaired, with or without filler words
    expect(mapName("Strong Excell skills", list({ id: "excel", name: "Excel" }))).toEqual({ how: "none" });
  });

  it("C10d: the literal rule: a skill at the same smallest distance but beyond ITS OWN allowance still makes it a tie", () => {
    // 'Rusts' (5 letters, allowance 0 for the name's side) and 'Brusty' (6, allowance 1) are both distance 1 from 'Brusts'.
    const l = list({ id: "a", name: "Rusts" }, { id: "b", name: "Brusty" });
    expect(mapName("Brusts", l)).toEqual({ how: "tie", ids: ["a", "b"] });
    // a skill at distance 1 but beyond its own allowance is not mapped on its own
    expect(mapName("Brusts", list({ id: "a", name: "Rusts" }))).toEqual({ how: "none" });
  });

  it("C14b: nothing near and nothing exact: none; an empty or filler-only name: none", () => {
    expect(mapName("Zymurgy", list({ id: "a", name: "Alpha" }))).toEqual({ how: "none" });
    expect(mapName("", list({ id: "a", name: "Alpha" }))).toEqual({ how: "none" });
    expect(mapName("Advanced knowledge", list({ id: "a", name: "Alpha" }))).toEqual({ how: "none" });
  });
});

describe("the real vocabulary", () => {
  it("C1: 'Excell' is no longer repaired (Excel has 5 letters, allowance 0): how none, goes to the review list", () => {
    expect(mapName("Excell", skills)).toEqual({ how: "none" });
    expect(mapName("Excel", skills)).toEqual({ how: "exact", id: "excel", try: 1 });
  });

  it("C1b: the 5/6-letter boundary on real skills: Docker and Kanban (6 letters) are repaired, Scrum (5) is not", () => {
    expect(mapName("Dokcer", skills)).toEqual({ how: "close", id: "docker", distance: 1, via: "Docker" });
    expect(mapName("Kanbab", skills)).toEqual({ how: "close", id: "kanban", distance: 1, via: "Kanban" });
    expect(mapName("Dockr", skills)).toEqual({ how: "none" });
    expect(mapName("Scrun", skills)).toEqual({ how: "none" });
    expect(mapName("Scrum", skills)).toEqual({ how: "exact", id: "scrum", try: 1 });
  });

  it("C2: 'Pyhton' maps to python (a swap counts 1)", () => {
    expect(mapName("Pyhton", skills)).toEqual({ how: "close", id: "python", distance: 1, via: "Python" });
  });

  it("C9b: an undecided alias is never reached: no target is an undecided string, and none of them maps by spelling", () => {
    const undecided = VOCAB.flatMap((e) => e.undecided.map((u) => [e.id, u] as const));
    expect(undecided.length).toBe(18);
    const targets = closeTargets(skills);
    for (const [id, u] of undecided) {
      expect(targets.some((t) => t.id === id && t.text.toLowerCase() === u.toLowerCase())).toBe(false);
      expect(mapName(u, skills).how).toBe("none"); // not exact (undecided), and nothing within the allowance
    }
  });

  it("C9c: the not-a-skill phrases are never targets", () => {
    const targets = new Set(closeTargets(skills).map((t) => t.form));
    for (const phrase of ["teamplayer", "empathy", "biasforaction", "eigeninitiative"]) {
      expect(targets.has(phrase)).toBe(false);
    }
  });

  it("C11: a German name written with 'a' for 'ä' is exact; written with 'ae' it is close; the same real skill", () => {
    expect(mapName("Qualitatsmanagement", skills)).toEqual({ how: "exact", id: "quality-management", try: 1 });
    expect(mapName("Qualitätsmanagement", skills)).toEqual({ how: "exact", id: "quality-management", try: 1 });
    expect(mapName("Qualitaetsmanagement", skills)).toEqual({ how: "close", id: "quality-management", distance: 1, via: "Qualitätsmanagement" });
    expect(mapName("Oeffentlichkeitsarbeit", skills)).toEqual({ how: "close", id: "public-relations", distance: 1, via: "Öffentlichkeitsarbeit" });
    expect(mapName("Teamfaehigkeit", skills)).toEqual({ how: "close", id: "teamwork", distance: 1, via: "Teamfähigkeit" });
  });

  it("C12: a plural or inflected form of a real entry maps to it (English and German)", () => {
    expect(mapName("Dashboard", skills)).toEqual({ how: "close", id: "dashboards", distance: 1, via: "Dashboards" });
    expect(mapName("Prozessoptimierungen", skills)).toEqual({ how: "close", id: "process-improvement", distance: 2, via: "Prozessoptimierung" });
  });

  it("C14: 'Team playr' (a misspelt not-a-skill phrase) is neither flagged nor mapped", () => {
    expect(isNotASkill("Team playr")).toBe(false);
    expect(mapName("Team playr", skills)).toEqual({ how: "none" });
  });

  it("C15: single letters and exactOnly names (R, C, Go) are unaffected", () => {
    expect(mapName("R", skills)).toEqual({ how: "exact", id: "r-language", try: 1 });
    expect(mapName("r", skills)).toEqual({ how: "exact", id: "r-language", try: 1 });
    expect(mapName("C", skills)).toEqual({ how: "exact", id: "c-language", try: 1 });
    expect(mapName("Go", skills)).toEqual({ how: "exact", id: "go-language", try: 1 });
    expect(mapName("Golang", skills)).toEqual({ how: "exact", id: "go-language", try: 1 });
    for (const n of ["Rr", "Cc", "Gp", "Golng", "R programing", "Advanced R"]) expect(mapName(n, skills).how).toBe("none");
  });
});

describe("must NOT merge (C13)", () => {
  // The groups are in docs/VOCAB-REVIEW.md ("Must-not-merge pairs"). The data in lib/vocab/mustNotMerge.ts must match it.
  const doc = fs.readFileSync(path.join(process.cwd(), "docs/VOCAB-REVIEW.md"), "utf8");
  const paragraph = doc.slice(doc.indexOf("Each group must never map onto one another:") + "Each group must never map onto one another:".length);
  const docGroups = paragraph
    .split("\n")[0]
    .replace(/\.$/, "")
    .split(";")
    .map((g) => g.split("|").map((m) => m.trim()));

  it("X1: the doc lists 19 groups, the last one being Swift | the word 'shift'", () => {
    expect(docGroups.length).toBe(19);
    expect(docGroups[18]).toEqual(["Swift", 'the word "shift"']);
  });

  it("X2: the data equals the doc: 18 groups of skill ids, and 'shift' must not become swift", () => {
    const fromDoc = docGroups.slice(0, 18).map((g) => g.map((name) => mapName(name, skills)).map((r) => (r.how === "exact" ? r.id : "?")));
    expect(fromDoc.flat().includes("?")).toBe(false);
    expect([...MUST_NOT_MERGE].map((g) => [...g].sort()).sort()).toEqual(fromDoc.map((g) => [...g].sort()).sort());
    expect(MUST_NOT_MERGE_NAMES).toEqual([{ name: "shift", notId: "swift" }]);
    expect(mapName("Swift", skills)).toEqual({ how: "exact", id: "swift", try: 1 });
  });

  it("X3: every member name maps to itself, exactly, and to no other member of its group", () => {
    for (const group of MUST_NOT_MERGE) {
      for (const id of group) {
        const entry = VOCAB.find((e) => e.id === id)!;
        const r = mapName(entry.name, skills);
        expect(r).toEqual({ how: "exact", id, try: 1 });
        for (const other of group.filter((o) => o !== id)) expect(r).not.toMatchObject({ id: other });
      }
    }
  });

  it("X4: the word 'Shift' is not Swift: how none (5 letters allow no change since 2026-11-16; it mapped before)", () => {
    expect(mapName("Shift", skills)).toEqual({ how: "none" });
    expect(mapName("Shifts", skills).how).not.toBe("exact");
    expect(mapName("Swift", skills)).toEqual({ how: "exact", id: "swift", try: 1 });
  });

  it("X5: a one-letter typo of a member's name never lands BY SPELLING on ANOTHER member of its group (an exact hit on another skill's own alias, such as MSSQL, is stage 1's)", () => {
    const bad: string[] = [];
    for (const group of MUST_NOT_MERGE) {
      for (const id of group) {
        const form = spellingForm(VOCAB.find((e) => e.id === id)!.name);
        const typos = new Set<string>();
        for (let i = 0; i < form.length; i++) {
          typos.add(form.slice(0, i) + form.slice(i + 1)); // delete
          if (i < form.length - 1) typos.add(form.slice(0, i) + form[i + 1] + form[i] + form.slice(i + 2)); // swap
          for (const c of "abcdefghijklmnopqrstuvwxyz0123456789") typos.add(form.slice(0, i) + c + form.slice(i + 1)); // replace
        }
        for (const t of typos) {
          if (t === form || t === "") continue;
          const r = mapName(t, skills);
          if (r.how === "close" && group.includes(r.id) && r.id !== id) bad.push(`${id}: ${t} -> ${r.id}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("the live path is untouched (C16)", () => {
  const sample = [
    ...VOCAB.flatMap((e) => [e.name, e.de, ...e.aliases, ...e.undecided]),
    "MS Excel", "Advanced Excel", "Python 3.11", "SQL Server 2019", "Excell", "Pyhton", "Team player", "Origami", "R (advanced)",
    "Advanced R", "Qualitaetsmanagement", "???", "  ", "Docker Compose", "task management", "account growth",
  ];

  it("Y1: skillIdFor says 'listed' exactly when stage 1 of mapName finds the name, with the same id", () => {
    for (const name of sample) {
      const live = skillIdFor(name, skills);
      const mapped = mapName(name, skills);
      if (mapped.how === "exact") expect(live).toEqual({ id: mapped.id, listed: true });
      else expect(live === null || live.listed === false).toBe(true);
    }
  });

  it("Y2: lookupExact is what skillIdFor uses: same answer, and the try is reported", () => {
    for (const name of sample) {
      const hit = lookupExact(name, skills);
      const live = skillIdFor(name, skills);
      expect(hit === null ? !live?.listed : live?.id === hit.id && live.listed).toBe(true);
    }
    expect(lookupExact("Excel (advanced)", skills)).toEqual({ id: "excel", try: 1 }); // an alias as written
    expect(lookupExact("Strong Excel skills", skills)).toEqual({ id: "excel", try: 2 });
  });

  it("Y3: nothing in the live path imports the mapper: fromAd, fromCv, the routes, the pages and lib/ai", () => {
    const root = process.cwd();
    const files: string[] = ["lib/engine/fromAd.ts", "lib/engine/fromCv.ts"];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = path.join(dir, f.name);
        if (f.isDirectory()) walk(rel);
        else if (/\.(ts|tsx)$/.test(f.name)) files.push(rel);
      }
    };
    walk("app");
    walk("lib/ai");
    expect(files.length).toBeGreaterThan(20);
    for (const f of files) {
      const text = fs.readFileSync(path.join(root, f), "utf8");
      expect(`${f}: ${/mapName|closeSpelling/.test(text)}`).toBe(`${f}: false`);
    }
  });
});
