import { describe, expect, it } from "vitest";
import { skills as fixtureSkills } from "@/fixtures/skills";
import { skillIdFor } from "@/lib/engine/skillIds";
import { NOT_A_SKILL, skills, VOCAB } from "@/lib/vocab";
import { nameKeys, normalizeSkillName } from "@/lib/engine/skillIds";

// (a) Vocabulary validity (docs/PLAN-5.1.md, step 5.1). Plain checks over the typed data in lib/vocab/data.ts.

// The 17 original skills, written out by hand: tests and saved reports depend on these ids and names.
const OLD_17: [string, string][] = [
  ["sql", "SQL"], ["excel", "Excel"], ["python", "Python"], ["seo", "SEO"], ["social-media", "Social media"],
  ["canva", "Canva"], ["typescript", "TypeScript"], ["react", "React"], ["git", "Git"], ["communication", "Communication"],
  ["power-bi", "Power BI"], ["tableau", "Tableau"], ["financial-planning", "Financial planning and analysis"],
  ["financial-modelling", "Financial modelling"], ["vitest", "Vitest"], ["jest", "Jest"], ["accessibility", "Accessibility"],
];

// every term an entry answers to, as the lookup keys of the exact step
const termsOf = (e: (typeof VOCAB)[number]) => [e.id, e.name, e.de, ...e.aliases];

describe("the vocabulary data", () => {
  it("V1: 226 entries (17 original, 207 from the reviewed draft, 2 added after the vocab-check) and 55 not-a-skill phrases (50 + 4 + 1 added by item 6 of 'Changes before any measure')", () => {
    expect(VOCAB.length).toBe(226);
    expect(NOT_A_SKILL.length).toBe(55);
  });

  it("V2: ids are unique and slug-shaped", () => {
    const ids = VOCAB.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("V3: every skill has an English name and a German name", () => {
    for (const e of VOCAB) {
      expect(e.name.trim()).not.toBe("");
      expect(e.de.trim()).not.toBe("");
    }
  });

  it("V4: the 17 original ids and names are unchanged and come first", () => {
    expect(VOCAB.slice(0, 17).map((e) => [e.id, e.name])).toEqual(OLD_17);
    expect(fixtureSkills.slice(0, 17).map((s) => [s.id, s.name])).toEqual(OLD_17);
  });

  it("V5: no id, name, German name or alias belongs to two skills", () => {
    const owner = new Map<string, string>();
    const clash: string[] = [];
    for (const e of VOCAB) {
      for (const t of termsOf(e)) {
        const k = nameKeys(t).exact;
        const prev = owner.get(k);
        if (prev !== undefined && prev !== e.id) clash.push(`${t} (${e.id} and ${prev})`);
        owner.set(k, e.id);
      }
    }
    expect(clash).toEqual([]);
  });

  it("V6: dropping level and filler words never turns one skill's term into another skill's term", () => {
    const owner = new Map<string, string>();
    for (const e of VOCAB) for (const t of termsOf(e)) owner.set(nameKeys(t).exact, e.id);
    const bad: string[] = [];
    for (const e of VOCAB) {
      for (const t of termsOf(e)) {
        const k = normalizeSkillName(t);
        const hit = owner.get(k);
        if (hit !== undefined && hit !== e.id) bad.push(`${t} -> ${k} (${e.id} and ${hit})`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("V7: nothing is both a skill and a not-a-skill phrase", () => {
    const skillKeys = new Set(VOCAB.flatMap((e) => termsOf(e).map((t) => nameKeys(t).exact)));
    const both = NOT_A_SKILL.filter((n) => skillKeys.has(nameKeys(n.phrase).exact) || skillKeys.has(nameKeys(n.de).exact));
    expect(both.map((n) => n.phrase)).toEqual([]);
  });

  it("V8: only the three single-letter or very common names are exact-only: R, C and Go", () => {
    expect(VOCAB.filter((e) => e.exactOnly).map((e) => e.id).sort()).toEqual(["c-language", "go-language", "r-language"]);
  });

  it("V9: no text still carries a question mark, and doubtful aliases are kept apart", () => {
    for (const e of VOCAB) {
      for (const t of [...termsOf(e), ...e.undecided, ...e.unsure]) expect(t.endsWith("?")).toBe(false);
      // an alias in doubt never also appears among the matching aliases
      for (const u of e.undecided) expect(e.aliases).not.toContain(u);
    }
  });

  it("V10: 18 aliases are undecided, and none of them matches anything", () => {
    const all = VOCAB.flatMap((e) => e.undecided.map((u) => [e.id, u] as const));
    expect(all.length).toBe(18);
    for (const [, u] of all) expect(skillIdFor(u, skills)).toEqual({ id: `new:${nameKeys(u).exact.replace(/ /g, "-")}`, listed: false });
  });

  it("V11: every name, German name and alias resolves to its own skill (no alias is shadowed)", () => {
    const wrong: string[] = [];
    for (const e of VOCAB) {
      for (const t of termsOf(e)) {
        const r = skillIdFor(t, skills);
        if (r === null || r.id !== e.id) wrong.push(`${t} -> ${r?.id} (should be ${e.id})`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("V12: the sources are only the four allowed labels", () => {
    for (const e of VOCAB) expect(e.source).toMatch(/^(existing|test ad|CV|general)(; (test ad|CV|general))?$/);
  });
});
