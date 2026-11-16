import { describe, expect, it } from "vitest";
import { captureFresh, distinctNames, labelsTodo, refusalFor, summaryLines } from "@/lib/engine/captureFresh";
import { labelSheetLines } from "@/lib/vocab/labelSheet";
import { VOCAB } from "@/lib/vocab";

// The fresh-set capture, on made-up ads and a fake reader: no AI call, no real name.

describe("distinctNames", () => {
  it("F1: distinct by case-insensitive trimmed form, the first spelling kept, sorted case-insensitively, blanks dropped", () => {
    const lists = [["Excel", "  excel ", "SQL", "", "   "], ["sql", "Python", "python3?", "EXCEL"]];
    expect(distinctNames(lists)).toEqual(["Excel", "Python", "python3?", "SQL"]);
  });

  it("F1b: sorted without regard to case: 'apple' before 'Banana' before 'cherry'", () => {
    expect(distinctNames([["cherry", "Banana", "apple"]])).toEqual(["apple", "Banana", "cherry"]);
  });
});

describe("labelsTodo", () => {
  it("F2: {set: fresh, names: {name: TODO}} in the given order", () => {
    const t = labelsTodo(["Excel", "Python"]);
    expect(t).toEqual({ set: "fresh", names: { Excel: "TODO", Python: "TODO" } });
    expect(Object.keys(t.names)).toEqual(["Excel", "Python"]);
  });
});

describe("refusalFor: never overwrite labelling work", () => {
  it("F3: refused when fresh-labels-TODO.json or fresh-labels.json already exists", () => {
    expect(refusalFor([])).toBeNull();
    expect(refusalFor(["fresh-labels-TODO.json"])).toMatch(/fresh-labels-TODO\.json already exists/);
    expect(refusalFor(["fresh-labels.json"])).toMatch(/fresh-labels\.json already exists/);
    expect(refusalFor(["fresh-labels.json", "fresh-labels-TODO.json"])).toMatch(/already exists/);
    expect(refusalFor(["fresh-a.txt"])).toBeNull();
  });
});

describe("captureFresh", () => {
  const ads = [{ id: "fresh-a", text: "AD A" }, { id: "fresh-b", text: "AD B" }];

  it("F4: one call per ad, in order; counts and the distinct names", async () => {
    const calls: string[] = [];
    const r = await captureFresh({
      ads,
      read: async (text) => {
        calls.push(text);
        return text === "AD A" ? { names: ["SECRETX", "secretx", "SECRETY"], tokens: 1000 } : { names: ["SECRETZ", "SECRETX"], tokens: 1500 };
      },
    });
    expect(calls).toEqual(["AD A", "AD B"]);
    expect(r.calls).toBe(2);
    expect(r.tokens).toBe(2500);
    expect(r.perAd).toEqual([{ id: "fresh-a", names: 3 }, { id: "fresh-b", names: 2 }]);
    expect(r.failed).toEqual([]);
    expect(r.distinct).toEqual(["SECRETX", "SECRETY", "SECRETZ"]);
  });

  it("F5: a failed call stops the capture: no names are returned, so no file is written", async () => {
    let n = 0;
    const r = await captureFresh({
      ads,
      read: async () => {
        if (++n === 2) throw new Error("boom SECRET");
        return { names: ["SECRETX"], tokens: 100 };
      },
    });
    expect(n).toBe(2);
    expect(r.failed).toEqual(["fresh-b"]);
    expect(r.distinct).toBeNull();
    expect(JSON.stringify(r)).not.toContain("SECRET boom");
    expect(r.calls).toBe(1); // only the call that worked
  });

  it("F6: the summary is counts only: never a name", async () => {
    const r = await captureFresh({ ads, read: async () => ({ names: ["SECRETNAME1", "SECRETNAME2"], tokens: 700 }) });
    const text = summaryLines(r).join("\n");
    expect(text).not.toContain("SECRETNAME");
    expect(text).toContain("ads read 2");
    expect(text).toContain("calls made 2");
    expect(text).toContain("tokens 1,400");
    expect(text).toContain("distinct names 2");
    expect(text).toContain("fresh-a 2");
  });

  it("F7: no ads: nothing is read", async () => {
    const r = await captureFresh({ ads: [], read: async () => ({ names: ["X"], tokens: 1 }) });
    expect(r.calls).toBe(0);
    expect(r.distinct).toEqual([]);
  });
});

describe("labelSheetLines (npm run skill-ids)", () => {
  const lines = labelSheetLines();

  it("S1: a header, one 'id | name | German name' line per skill, then the two special labels", () => {
    expect(lines[0]).toBe("Skill ids: id | English name | German name");
    const skillLines = lines.slice(1).filter((l) => / \| .* \| /.test(l)); // the header has the same shape
    expect(skillLines.length).toBe(VOCAB.length);
    expect(lines).toContain("sql | SQL | SQL");
    expect(lines).toContain("communication | Communication | Kommunikation");
    expect(lines).toContain("excel | Excel | Excel");
  });

  it("S2: the two special labels are explained in plain words", () => {
    const text = lines.join("\n");
    expect(text).toContain('none = a real skill we do not list (it should stay unlisted)');
    expect(text).toContain("not-a-skill = a trait, a working environment or a vague phrase");
  });
});
