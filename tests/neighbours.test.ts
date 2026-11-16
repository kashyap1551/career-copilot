import { describe, expect, it } from "vitest";
import { loadWords, neighbourPairs } from "@/lib/engine/neighbours";
import type { Skill } from "@/lib/engine/types";

// The neighbour audit (npm run neighbours): which ordinary words close spelling would map to a skill. Hand-worked on
// made-up skills and words. Only words of 6 letters or more can map (the allowance is 0 up to 5 letters).

describe("loadWords", () => {
  it("N1: lowercase letters only, once each, sorted; capitalised words, apostrophes, accents and numbers are out", () => {
    expect(loadWords("Apple\nbanana\nit's\nnaïve\nCAT\nzebra\nbanana\nab1\n\n  \nyak\n")).toEqual(["banana", "yak", "zebra"]);
  });
});

describe("neighbourPairs", () => {
  const list: Skill[] = [{ id: "tableau", name: "Tableau" }, { id: "docker", name: "Docker" }];
  const words = ["tableaus", "tablets", "tableau", "dockers", "docket", "table", "dockr", "tableu", "stable"];
  const no = () => false;

  it("N2: words within the allowance of a skill's string, not exact, 6 letters or more; sorted by skill id and word", () => {
    expect(neighbourPairs(list, words, no).map((p) => [p.id, p.word, p.via, p.distance])).toEqual([
      ["docker", "dockers", "Docker", 1],
      ["docker", "docket", "Docker", 1],
      ["tableau", "tableaus", "Tableau", 1],
      ["tableau", "tableu", "Tableau", 1],
    ]);
  });

  it("N3: not counted: 'tableau' (an exact hit), 'tablets' (distance 2), 'table' and 'dockr' (5 letters: allowance 0), 'stable'", () => {
    const found = neighbourPairs(list, words, no).map((p) => p.word);
    for (const w of ["tableau", "tablets", "table", "dockr", "stable"]) expect(found).not.toContain(w);
  });

  it("N4: a word on the not-a-skill list is set aside first, as the live path does", () => {
    expect(neighbourPairs(list, words, (w) => w === "docket").map((p) => p.word)).toEqual(["dockers", "tableaus", "tableu"]);
  });

  it("N5: a word that ties between two skills is not a neighbour; one close to a single skill is", () => {
    const l: Skill[] = [{ id: "a", name: "Pillow" }, { id: "b", name: "Billow" }];
    expect(neighbourPairs(l, ["dillow", "pillows"], no).map((p) => [p.id, p.word])).toEqual([["a", "pillows"]]);
  });

  it("N6: an exactOnly skill has no neighbours", () => {
    expect(neighbourPairs([{ id: "g", name: "Golang", exactOnly: true }], ["golangs", "golang"], no)).toEqual([]);
  });

  it("N7: a word that is already a name written without its hyphen is not a neighbour (distance 0)", () => {
    expect(neighbourPairs([{ id: "e", name: "E-commerce" }], ["ecommerce", "ecommerces"], no).map((p) => p.word)).toEqual(["ecommerces"]);
  });
});
