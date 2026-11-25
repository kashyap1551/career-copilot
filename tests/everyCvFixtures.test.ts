import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_CV_CHARS, MAX_CV_LINES, MAX_LINE_CHARS } from "@/lib/cv/limits";
import { formatNumbered, numberLines } from "@/lib/cv/numberLines";
import { containsContactDetails, removeContactDetails } from "@/lib/cv/redact";
import { MAX_AD_CHARS } from "@/lib/schemas/job";
import { isInAd } from "@/lib/engine/text";
import { checkEveryCvKey, parseEveryCvKey } from "@/lib/engine/evalEveryCvKey";

// EC-0a (docs/PLAN-EVERY-CV.md sections 9 and 10): the material of the accuracy test and the BLANK answer keys.
// Ten invented CV and ad pairs in fixtures/every-cv/pair-01 ... pair-10, and one tiny EXAMPLE pair whose key is filled
// in only to show the format. The example is outside the ten and is never sent to an AI.
//
// Checks (a) to (g) are the ones named in the task; (h) pins the sizes the task asks for (a pair's ad has 5 to 8
// requirement sentences and one personal-trait sentence, pair 08 is near the CV cap, pair 09 is very short).
// Nothing here knows an expected ANSWER: the owner writes every key, and this file only checks that a key is well formed.
//
// The key checker lives in lib/engine/evalEveryCvKey.ts since EC-0b; its own tests are in tests/everyCvKey.test.ts.

const ROOT = join(process.cwd(), "fixtures", "every-cv");
const PAIR_IDS = Array.from({ length: 10 }, (_, i) => `pair-${String(i + 1).padStart(2, "0")}`);
const FILES = ["cv.txt", "cv.numbered.txt", "ad.txt", "key.txt"] as const;

const read = (dir: string, file: string) => readFileSync(join(ROOT, dir, file), "utf8");
const pageLines = (cv: string) => numberLines(removeContactDetails(cv)); // exactly what the page does (app/CvBox.tsx)

// ---- the key checker lives in lib/engine/evalEveryCvKey.ts (EC-0b) -------------------------------------------------------------------------

const checkKeyText = checkEveryCvKey;
const parseKey = parseEveryCvKey;
const said = (r: { problems: { block: string; sentence: string }[] }) => r.problems.map((p) => `${p.block}: ${p.sentence}`).join(" | ");
const FIELD_NAMES = ["verdict", "cv line(s)", "unsure", "why"] as const;

// A blank key must carry nothing an owner would write: no verdict, no cited line, no unsure, no why.
function blankKeyHasNoAnswers(keyText: string): boolean {
  return parseKey(keyText).blocks.filter((b) => b.kind === "R").every((b) => FIELD_NAMES.every((f) => (b.fields[f] ?? "") === ""));
}

// Contact details that may appear in any fixture: the reserved fakes and nothing else.
const RESERVED = ["jane.sample@example.com", "recruiter@example.org", "+49 30 0000000"];
function leftoverContact(text: string): boolean {
  let rest = text;
  for (const r of RESERVED) rest = rest.split(r).join("");
  return containsContactDetails(rest);
}

// ---- (a) the folders ---------------------------------------------------------------------------------------------------------------------------

describe("EC-0a (a): the folders", () => {
  it("F1: pair-01 to pair-10 and the example each have cv.txt, cv.numbered.txt, ad.txt and key.txt", () => {
    for (const dir of [...PAIR_IDS, "example"]) {
      for (const f of FILES) expect(existsSync(join(ROOT, dir, f)), `${dir}/${f}`).toBe(true);
    }
  });

  it("F2: the folder holds exactly the ten pairs, the example and nothing else that looks like a pair", () => {
    expect(existsSync(ROOT)).toBe(true);
    const dirs = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    expect(dirs).toEqual([...PAIR_IDS, "example"].sort());
  });
});

// ---- (b) the CVs -------------------------------------------------------------------------------------------------------------------------------

describe("EC-0a (b): every CV is inside the page's own limits and holds only reserved contact details", () => {
  for (const dir of [...PAIR_IDS, "example"]) {
    it(`F3 ${dir}: limits, and nothing left for the contact check`, () => {
      const cv = read(dir, "cv.txt");
      const lines = pageLines(cv);
      const chars = lines.reduce((n, l) => n + l.length, 0); // what the page counts (app/CvBox.tsx)
      expect(chars).toBeLessThanOrEqual(MAX_CV_CHARS);
      expect(cv.length).toBeLessThanOrEqual(MAX_CV_CHARS); // a CV read from a file is counted on the raw text
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.length).toBeLessThanOrEqual(MAX_CV_LINES);
      for (const l of lines) expect(l.length).toBeLessThanOrEqual(MAX_LINE_CHARS);
      expect(containsContactDetails(removeContactDetails(cv))).toBe(false);
    });

    it(`F4 ${dir}: every email address, phone number or link in a fixture file is a reserved fake`, () => {
      for (const f of FILES) expect(leftoverContact(read(dir, f)), `${dir}/${f}`).toBe(false);
    });
  }
});

// ---- (c) the numbered copy ---------------------------------------------------------------------------------------------------------------------

describe("EC-0a (c): cv.numbered.txt is what the page's numbering gives for cv.txt", () => {
  for (const dir of [...PAIR_IDS, "example"]) {
    it(`F5 ${dir}`, () => {
      const expected = formatNumbered(pageLines(read(dir, "cv.txt"))) + "\n";
      expect(read(dir, "cv.numbered.txt")).toBe(expected);
    });
  }
});

// ---- (d) the ads -------------------------------------------------------------------------------------------------------------------------------

describe("EC-0a (d): every ad is within the ad limit", () => {
  for (const dir of [...PAIR_IDS, "example"]) {
    it(`F6 ${dir}`, () => {
      const ad = read(dir, "ad.txt").trim();
      expect(ad.length).toBeGreaterThan(0);
      expect(ad.length).toBeLessThanOrEqual(20_000);
      expect(MAX_AD_CHARS).toBe(20_000); // the limit this file mirrors
    });
  }
});

// ---- (e) blank keys, (f) filled keys ------------------------------------------------------------------------------------------------------------

describe("EC-0a (e): a blank key carries no answer", () => {
  for (const dir of PAIR_IDS) {
    it(`F7 ${dir}: while the key is blank: no verdict word after "verdict:", no cited line number, no unsure, no why, no problem`, () => {
      const key = read(dir, "key.txt");
      const check = checkKeyText(key, read(dir, "ad.txt"), pageLines(read(dir, "cv.txt")).length);
      // A key the owner has started is checked by F8; a key that is still blank must be completely empty.
      if (check.state === "blank") {
        expect(blankKeyHasNoAnswers(key)).toBe(true);
        expect(check.problems, said(check)).toEqual([]);
      }
    });
  }
});

describe("EC-0a (f): a complete key must be valid; a blank or half-filled key passes with a note", () => {
  for (const dir of [...PAIR_IDS, "example"]) {
    it(`F8 ${dir}`, () => {
      const lines = pageLines(read(dir, "cv.txt"));
      const check = checkKeyText(read(dir, "key.txt"), read(dir, "ad.txt"), lines.length);
      if (dir === "example") {
        expect(check.state).toBe("complete"); // the format demonstration IS filled
        expect(check.problems, said(check)).toEqual([]);
      }
      if (check.state !== "complete") {
        // A half-filled key must not turn the whole suite red: a one-line note, then pass.
        console.info(`note: ${dir}/key.txt is ${check.state} (${check.answered} of ${check.total} answered)`);
        return;
      }
      expect(check.problems, said(check)).toEqual([]);
    });
  }
});

// ---- (g) the checker itself --------------------------------------------------------------------------------------------------------------------

describe("EC-0a (g): the key checker rejects what it should", () => {
  const AD = "We need someone who can plan shifts. Experience with rotas is a plus.";
  const head = (n: number, tag: string, q: string) => `R${n} [${tag}] "${q}"`;
  const good = [
    head(1, "must", "We need someone who can plan shifts."),
    "verdict: met",
    "cv line(s): 2, 4-5",
    "unsure:",
    "why:",
    "",
    head(2, "nice", "Experience with rotas is a plus."),
    "verdict: none",
    "cv line(s):",
    "unsure: yes",
    "why: nothing close",
  ].join("\n");

  it("G0: the good key above is accepted", () => {
    expect(checkKeyText(good, AD, 6)).toMatchObject({ state: "complete", problems: [] });
  });

  it("G1: a line number past the end of the CV is rejected", () => {
    const r = checkKeyText(good.replace("2, 4-5", "2, 7"), AD, 6);
    expect(r.state).toBe("complete");
    expect(said(r)).toContain("R1: line 7 does not exist");
  });

  it("G2: a verdict of 'maybe' is rejected", () => {
    const r = checkKeyText(good.replace("verdict: met", "verdict: maybe"), AD, 6);
    expect(r.state).toBe("complete");
    expect(said(r)).toContain("met, partly or none");
  });

  it("G3: an ad quote that is not in the ad is rejected", () => {
    const r = checkKeyText(good.replace("We need someone who can plan shifts.", "We need someone who can plan weekends."), AD, 6);
    expect(r.state).toBe("complete");
    expect(said(r)).toContain("not in the ad");
  });

  it("G4: met with no cited line, none with a cited line, and unsure 'maybe' are rejected", () => {
    expect(said(checkKeyText(good.replace("cv line(s): 2, 4-5", "cv line(s):"), AD, 6))).toContain("needs at least one cited line");
    expect(said(checkKeyText(good.replace("cv line(s):\nunsure: yes", "cv line(s): 3\nunsure: yes"), AD, 6))).toContain("cites no line");
    expect(said(checkKeyText(good.replace("unsure: yes", "unsure: maybe"), AD, 6))).toContain('unsure must be empty or "yes"');
  });

  it("G5: a half-filled key (one verdict, one empty) and a missing field are rejected", () => {
    const half = good.replace("verdict: none", "verdict:").replace("unsure: yes", "unsure:").replace("why: nothing close", "why:");
    const h = checkKeyText(half, AD, 6);
    expect(h.state).toBe("incomplete");
    expect(said(h)).toContain("R2: no verdict");
    expect(said(checkKeyText(good.replace("why:\n", ""), AD, 6))).toContain('the field "why:" is missing');
  });

  it("G6: a completely blank key is 'blank', and lines cited without a verdict are not blank", () => {
    const blank = [head(1, "must", "We need someone who can plan shifts."), "verdict:", "cv line(s):", "unsure:", "why:"].join("\n");
    expect(checkKeyText(blank, AD, 6).state).toBe("blank");
    expect(blankKeyHasNoAnswers(blank)).toBe(true);
    const sneaky = blank.replace("cv line(s):", "cv line(s): 3");
    expect(blankKeyHasNoAnswers(sneaky)).toBe(false);
    const sn = checkKeyText(sneaky, AD, 6);
    expect(sn.state).toBe("blank");
    expect(said(sn)).toContain("lines are cited but there is no verdict");
  });

  it("G7: a trait block must be tagged and has nothing to fill", () => {
    const trait = `T1 [trait, not counted] "Experience with rotas is a plus."`;
    expect(checkKeyText([head(1, "must", "We need someone who can plan shifts."), "verdict:", "cv line(s):", "unsure:", "why:", trait].join("\n"), AD, 6).state).toBe("blank");
    expect(checkKeyText([head(1, "must", "We need someone who can plan shifts."), "verdict:", "cv line(s):", "unsure:", "why:", `${trait}\nverdict: met`].join("\n"), AD, 6).problems.length).toBeGreaterThan(0);
  });

  it("G8: the reserved fakes are the only contact details allowed, and a real-looking one is caught", () => {
    expect(leftoverContact("Mail jane.sample@example.com or call +49 30 0000000, or recruiter@example.org")).toBe(false);
    expect(leftoverContact("Mail anna.beispiel@mailbox.test")).toBe(true);
    expect(leftoverContact("Call +49 151 2345678")).toBe(true);
  });
});

// ---- (h) the sizes the task asks for -----------------------------------------------------------------------------------------------------------

describe("EC-0a (h): sizes", () => {
  const counts = (dir: string) => {
    const blocks = parseKey(read(dir, "key.txt")).blocks;
    return { req: blocks.filter((b) => b.kind === "R").length, trait: blocks.filter((b) => b.kind === "T").length };
  };

  for (const dir of PAIR_IDS) {
    it(`F9 ${dir}: 5 to 8 requirement blocks and exactly one trait block, each quoted sentence is in the ad`, () => {
      const c = counts(dir);
      expect(c.req).toBeGreaterThanOrEqual(5);
      expect(c.req).toBeLessThanOrEqual(8);
      expect(c.trait).toBe(1);
      const ad = read(dir, "ad.txt");
      for (const b of parseKey(read(dir, "key.txt")).blocks) expect(isInAd(b.quote, ad), `${dir} ${b.kind}${b.n}`).toBe(true);
    });
  }

  it("F10: pair-08 is near the cap (11,000 to 11,900 characters as the page counts them, at most 400 lines)", () => {
    const lines = pageLines(read("pair-08", "cv.txt"));
    const chars = lines.reduce((n, l) => n + l.length, 0);
    expect(chars).toBeGreaterThanOrEqual(11_000);
    expect(chars).toBeLessThanOrEqual(11_900);
    expect(lines.length).toBeLessThanOrEqual(400);
  });

  it("F11: pair-09 is very short (6 to 10 lines, 400 to 700 characters) and its ad has 6 requirement sentences", () => {
    const lines = pageLines(read("pair-09", "cv.txt"));
    const chars = lines.reduce((n, l) => n + l.length, 0);
    expect(lines.length).toBeGreaterThanOrEqual(6);
    expect(lines.length).toBeLessThanOrEqual(10);
    expect(chars).toBeGreaterThanOrEqual(400);
    expect(chars).toBeLessThanOrEqual(700);
    expect(counts("pair-09").req).toBe(6);
  });

  it("F12: the example is tiny: a 6-line CV and 3 requirement sentences", () => {
    expect(pageLines(read("example", "cv.txt")).length).toBe(6);
    expect(counts("example").req).toBe(3);
  });

  it("F13: the example says it is a format demonstration only", () => {
    for (const f of ["key.txt", "ad.txt", "README.txt"]) expect(read("example", f)).toContain("EXAMPLE ONLY, format demonstration, never sent to an AI");
  });
});
