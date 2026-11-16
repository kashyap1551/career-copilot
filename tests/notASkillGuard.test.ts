import { describe, expect, it } from "vitest";
import { closeMatch } from "@/lib/engine/closeSpelling";
import { vocabularyHash } from "@/lib/engine/evalFingerprint";
import { outcomeFor } from "@/lib/engine/mapMeasure";
import { mapName } from "@/lib/engine/mapName";
import type { Skill } from "@/lib/engine/types";
import { vocabHash } from "@/lib/engine/vocabHash";
import { isNotASkill, LEFT_UNLISTED, NEVER_MAP, NOT_A_SKILL, skills, VOCAB } from "@/lib/vocab";

// docs/PLAN-5.1.md, "Changes before any measure", item 6: the phrase "personal development" is a not-a-skill phrase, and
// close spelling (stage 2) never runs on a name that is flagged not-a-skill. Stage 1 (exact) is unaffected.
// Expectations worked out by hand before the code:
//  - Names are folded with spaces dropped, so "personaldevelopment" is one letter (l) from "personadevelopment"
//    (Persona development): without the entry and the guard, the name maps close at distance 1.
//  - "data analyst experience" is two letters from "Data analysis" (distance 2, shared start, accepted at the end of a
//    long word); "product analyst experience" likewise reaches "product analysis". Both are already on the list, so the
//    guard alone must stop them.

const PHRASES = ["Personal development", "personal development", "PERSONAL DEVELOPMENT", "Persönliche Weiterentwicklung"];
const OLD_LOOK_ALIKES = ["data analyst experience", "product analyst experience"];

describe("the new phrase is on the not-a-skill list", () => {
  it("G1: the entry has the decided shape: trait, German form, a note that names its source, no unsure names", () => {
    const e = NOT_A_SKILL.find((n) => n.phrase === "personal development");
    expect(e).toBeDefined();
    expect(e?.de).toBe("persönliche Weiterentwicklung");
    expect(e?.cls).toBe("trait");
    expect(e?.note).toBe("added from the reviewer's multi-word look-alike check, not from any ad");
    expect(e?.unsure).toEqual([]);
  });

  it("G2: isNotASkill is true for the English phrase in three casings and for the German form", () => {
    for (const n of PHRASES) expect(isNotASkill(n)).toBe(true);
  });

  it("G3: the real skill it looks like is not flagged and still maps exactly", () => {
    expect(isNotASkill("Persona development")).toBe(false);
    expect(mapName("Persona development", skills)).toEqual({ how: "exact", id: "persona-development", try: 1 });
  });
});

describe("close spelling never runs on a flagged name (stage 2 guard)", () => {
  it("G4: mapName gives how none for the new phrase (three casings, German) and for the two old look-alikes", () => {
    for (const n of [...PHRASES, ...OLD_LOOK_ALIKES]) expect(mapName(n, skills)).toEqual({ how: "none" });
  });

  it("G5: the guard is in closeMatch itself, not only in mapName", () => {
    for (const n of [...PHRASES, ...OLD_LOOK_ALIKES]) expect(closeMatch(n, skills)).toEqual({ how: "none" });
  });

  it("G6: it is the guard that stops the old look-alikes: the same words unflagged (made-up list) are repaired at distance 2", () => {
    // "data analyst" folds to dataanalyst (11 letters), "Data analysis" to dataanalysis (12): replace t by i, insert s = 2,
    // common start 10 >= 11 - 3, so it is accepted. With the filler word "experience" added, the name is flagged and gets none.
    const l: Skill[] = [{ id: "d", name: "Data analysis" }];
    expect(isNotASkill("Data analyst")).toBe(false);
    expect(mapName("Data analyst", l)).toEqual({ how: "close", id: "d", distance: 2, via: "Data analysis" });
    expect(isNotASkill("data analyst experience")).toBe(true);
    expect(mapName("data analyst experience", l)).toEqual({ how: "none" });
  });

  it("G7: stage 1 is unaffected: a flagged phrase that is also an exact alias still maps exactly", () => {
    const l: Skill[] = [{ id: "t", name: "Teamwork", aliases: ["team player"] }];
    expect(isNotASkill("Team player")).toBe(true);
    expect(mapName("Team player", l)).toEqual({ how: "exact", id: "t", try: 1 });
    expect(mapName("team player", l)).toEqual({ how: "exact", id: "t", try: 1 });
  });

  it("G8: an unflagged near-miss of a made-up skill is still repaired (the guard does not block everything)", () => {
    const l: Skill[] = [{ id: "p", name: "Pillow" }];
    expect(isNotASkill("Pillows")).toBe(false);
    expect(mapName("Pillows", l)).toEqual({ how: "close", id: "p", distance: 1, via: "Pillow" });
  });

  it("G9: the measure's live order gives the not-a-skill outcome for the new phrase (flag first)", () => {
    for (const n of PHRASES) expect(outcomeFor(n, skills, isNotASkill)).toEqual({ kind: "flagged" });
    for (const n of OLD_LOOK_ALIKES) expect(outcomeFor(n, skills, isNotASkill)).toEqual({ kind: "flagged" });
  });

  it("G10: with no flag function at all, the mapper alone still gives none for them (it does not rely on its caller)", () => {
    for (const n of [...PHRASES, ...OLD_LOOK_ALIKES]) expect(outcomeFor(n, skills, () => false)).toEqual({ kind: "notmapped", how: "none" });
  });
});

describe("the vocabulary hash changed and the request hashes did not", () => {
  it("G11: the not-a-skill list is 55 phrases and the new phrase is the last one", () => {
    expect(NOT_A_SKILL.length).toBe(55);
    expect(NOT_A_SKILL[NOT_A_SKILL.length - 1].phrase).toBe("personal development");
  });

  it("G12: vocabHash() is no longer cf3e44da32 and is the hash of all four parts", () => {
    expect(vocabHash().slice(0, 10)).not.toBe("cf3e44da32");
    expect(vocabHash()).toBe(vocabularyHash({ VOCAB, NOT_A_SKILL, LEFT_UNLISTED, NEVER_MAP }));
  });

  it("G13: the hash depends on the new entry: without it, it is a different hash", () => {
    const without = NOT_A_SKILL.filter((n) => n.phrase !== "personal development");
    expect(without.length).toBe(54);
    expect(vocabularyHash({ VOCAB, NOT_A_SKILL: without, LEFT_UNLISTED, NEVER_MAP })).not.toBe(vocabHash());
  });

  it("G14: the hash depends on the German form of the new entry", () => {
    const changed = NOT_A_SKILL.map((n) => (n.phrase === "personal development" ? { ...n, de: "persönliche Entwicklung" } : n));
    expect(vocabularyHash({ VOCAB, NOT_A_SKILL: changed, LEFT_UNLISTED, NEVER_MAP })).not.toBe(vocabHash());
  });

  it("G15: the never-map list is unchanged (decision 3: no new word)", () => {
    expect(NEVER_MAP.map((n) => n.word)).toEqual(["confluent", "commerce", "market", "markets", "personal", "typoscript"]);
  });
});
