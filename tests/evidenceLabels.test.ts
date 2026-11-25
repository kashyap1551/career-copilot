import { describe, expect, it } from "vitest";
import { profileReport } from "@/app/fitReport";
import { fitLabelText } from "@/app/skillsOnly";
import { skills } from "@/fixtures/skills";
import { AI_BLOCK_TITLE, aiCountsSentence, aiRowText, thrownAwayLine } from "@/lib/engine/evidenceText";
import { A_INTAKE_MET, A_INTAKE_NONE, A_INTAKE_PARTLY, A_WOUND_MET, job, person, UNLISTED } from "./support/evidenceFixtures";

// EC-1, the label and the strings (docs/PLAN-EVERY-CV.md 4.4 and 4.5; rules R5 and R7; tests EL1 to EL12). Pure strings, no screen.
// Every expected text is written by hand from the table in 4.4, character by character:
//   judged by AI | not judged | level                    | label
//   0 | 0 | Strong                                       | Strong (skills only)
//   0 | 2 | Strong                                       | At best Strong (skills only; 2 must-haves not judged)
//   2 | 0 | Stretch                                      | Stretch (skills only; 2 must-haves judged by AI)
//   1 | 1 | Good                                         | At best Good (skills only; 1 must-have judged by AI; 1 must-have not judged)
//   2 | 1 | Long shot, set by location                   | Long shot (judged: skills, location; 2 must-haves judged by AI; 1 must-have not judged)
//   all must-haves unjudged | No level                    | No level (no must-have we could judge), unchanged
// Each draft sentence below is for the owner's approval (docs/PLAN-EVERY-CV.md section 6).

describe("EC-1 labels: rows of the table in 4.4 (R5 and R7)", () => {
  it("EL1: 0 judged by AI, 0 not judged, Strong: today's text, character for character", () => {
    expect(fitLabelText("Strong", null, "skills only", 0, "profile")).toBe("Strong (skills only)");
  });
  it("EL2: 0 judged by AI, 2 not judged, Strong: 'At best' (R7)", () => {
    expect(fitLabelText("Strong", null, "skills only", 2, "profile")).toBe("At best Strong (skills only; 2 must-haves not judged)");
  });
  it("EL3: 2 judged by AI, 0 not judged, Stretch: no 'At best', the AI count in the brackets (R5)", () => {
    expect(fitLabelText("Stretch", null, "skills only", 0, "profile", 2)).toBe("Stretch (skills only; 2 must-haves judged by AI)");
  });
  it("EL4: 1 judged by AI and 1 not judged, Good: both, in that order, with 'At best'", () => {
    expect(fitLabelText("Good", null, "skills only", 1, "profile", 1)).toBe("At best Good (skills only; 1 must-have judged by AI; 1 must-have not judged)");
  });
  it("EL5: 2 judged by AI and 1 not judged, Long shot set by location: Long shot keeps its plain name (nothing can lower it)", () => {
    expect(fitLabelText("Long shot", null, "judged: skills, location", 1, "profile", 2)).toBe("Long shot (judged: skills, location; 2 must-haves judged by AI; 1 must-have not judged)");
    expect(fitLabelText("Long shot", null, "judged: skills, location", 1, "profile")).toBe("Long shot (judged: skills, location; 1 must-have not judged)"); // today's, unchanged
  });
  it("EL6: a 'No level' label is unchanged whatever the counts (no 'At best', no caveat)", () => {
    expect(fitLabelText("Strong", "no-must-have-judgeable", "skills only", 3, "profile", 0)).toBe("No level (no must-have we could judge)");
    expect(fitLabelText("Strong", "no-requirements", "skills only", 0, "profile", 2)).toBe("No level (no requirements found in this ad)");
    expect(fitLabelText("Strong", "no-skills", "skills only", 2, "profile")).toBe("No level (no skills on your profile)");
    expect(fitLabelText("Strong", "no-skills", "skills only", 2, "list")).toBe("No level (no skills on your list)");
  });
  it("EL7: singular and plural follow the number: '1 must-have judged by AI', '2 must-haves judged by AI'", () => {
    expect(fitLabelText("Good", null, "skills only", 0, "list", 1)).toBe("Good (skills only; 1 must-have judged by AI)");
    expect(fitLabelText("Good", null, "skills only", 0, "list", 3)).toBe("Good (skills only; 3 must-haves judged by AI)");
  });
  it("EL8: 'At best' goes with Stretch and Good as well; the unjudged caveat alone, for Stretch", () => {
    expect(fitLabelText("Stretch", null, "skills only", 1, "profile")).toBe("At best Stretch (skills only; 1 must-have not judged)");
    expect(fitLabelText("Good", null, "judged: skills, years", 2, "profile")).toBe("At best Good (judged: skills, years; 2 must-haves not judged)");
  });
  it("EL9: with 0 judged by AI and 0 not judged the label equals today's for all four levels, in both paths", () => {
    for (const [name, inner] of [["Strong", "skills only"], ["Good", "judged: skills, location"], ["Stretch", "skills only"], ["Long shot", "judged: skills, language"]] as const) {
      for (const where of ["profile", "list"] as const) expect(fitLabelText(name, null, inner, 0, where, 0)).toBe(`${name} (${inner})`);
    }
  });
});

describe("EC-1 strings of 4.5", () => {
  it("EL10: the counts sentence with the AI count: met of total, the AI count, the missing names, the could-not-judge tail", () => {
    expect(aiCountsSentence(4, 2, ["Excel", "Patient intake"], 2, 0)).toBe("You meet 2 of 4 must-haves (2 judged by AI), missing: Excel, Patient intake.");
    expect(aiCountsSentence(4, 3, ["Excel"], 2, 1)).toBe("You meet 3 of 4 must-haves (2 judged by AI), missing: Excel, plus 1 must-have we could not judge.");
    expect(aiCountsSentence(3, 3, [], 1, 0)).toBe("You meet 3 of 3 must-haves (1 judged by AI).");
    expect(aiCountsSentence(3, 3, [], 1, 2)).toBe("You meet 3 of 3 must-haves (1 judged by AI), plus 2 must-haves we could not judge.");
  });

  it("EL11: the rows of the block 'Judged by the AI from your CV lines (read each quote)', with the inferred wording", () => {
    expect(AI_BLOCK_TITLE).toBe("Judged by the AI from your CV lines (read each quote)");
    expect(aiRowText({ label: "Wound care", verdict: "met", line: 3, quote: "Dressed and monitored wounds", entryName: "Wound care", inferred: false })).toBe(
      'Wound care: met. CV line 3: "Dressed and monitored wounds" (Wound care)',
    );
    expect(aiRowText({ label: "Patient intake", verdict: "partly", line: 4, quote: "Gave intake interviews", entryName: "Patient intake", inferred: true })).toBe(
      'Patient intake: partly. CV line 4: "Gave intake interviews" (Patient intake; inferred from your wording, confirmed by you)',
    );
    expect(aiRowText({ label: "Patient intake", verdict: "none", line: null, quote: null, entryName: null, inferred: false })).toBe("Patient intake: no evidence found");
  });

  it("EL12: the thrown-away line: none for 0, singular for 1, plural for more", () => {
    expect(thrownAwayLine(0)).toBeNull();
    expect(thrownAwayLine(1)).toBe("1 answer was not accepted because its quote was not on the CV line.");
    expect(thrownAwayLine(2)).toBe("2 answers were not accepted because their quote was not on the CV line.");
  });
});

describe("EC-1 the report built from the worked example of 4.4", () => {
  it("EL13: with the two answers (Wound care met, Patient intake partly): Stretch, the AI count, the sentence, the rows apart, the counts", () => {
    const r = profileReport(job(), person(), skills, UNLISTED, { answers: [A_WOUND_MET, A_INTAKE_PARTLY] });
    expect(r.fitLabel).toBe("Stretch (skills only; 2 must-haves judged by AI)");
    expect(r.level).toBe("stretch");
    expect(r.explanation).toBe(
      "You meet 2 of 4 must-haves (2 judged by AI), missing: Excel, Patient intake. Location, language, work mode, years and start date are not judged here.",
    );
    expect(r.counts).toEqual({ mustsMet: 2, mustsTotal: 4, nicesMet: 0, nicesTotal: 0 });
    expect(r.rows.map((x) => `${x.importance} | ${x.status} | ${x.detail}`)).toEqual([
      'must | met | SQL: CV line 2: "Wrote SQL queries for the weekly report"',
      "must | missing | Excel: not on your profile",
      "nice | unlisted | Kombucha brewing: not in our skill list yet, so we could not judge it.",
    ]);
    expect(r.aiRows?.map((x) => x.text)).toEqual([
      'Wound care: met. CV line 3: "Dressed and monitored wounds" (Wound care)',
      'Patient intake: partly. CV line 4: "Gave intake interviews" (Patient intake; inferred from your wording, confirmed by you)',
    ]);
    expect(r.aiJudged).toEqual({ musts: 2, nices: 0 });
    expect(r.couldNotJudge).toEqual({ musts: 0, nices: 1 });
  });

  it("EL14: Patient intake met as well: Good with the AI count; no answers at all: 'At best Good' with today's sentence", () => {
    const met = profileReport(job(), person(), skills, UNLISTED, { answers: [A_WOUND_MET, A_INTAKE_MET] });
    expect(met.fitLabel).toBe("Good (skills only; 2 must-haves judged by AI)");
    expect(met.explanation).toBe("You meet 3 of 4 must-haves (2 judged by AI), missing: Excel. Location, language, work mode, years and start date are not judged here.");
    const none = profileReport(job(), person(), skills, UNLISTED);
    expect(none.fitLabel).toBe("At best Good (skills only; 2 must-haves not judged)");
    expect(none.explanation).toBe("One must-have is missing: Excel, plus 2 must-haves we could not judge. Location, language, work mode, years and start date are not judged here.");
    expect(none.aiRows).toBeUndefined();
  });

  it("EL15: 'no evidence found' counts as missing and shows no quote; the thrown-away line is in the report when answers were thrown away", () => {
    const r = profileReport(job(), person(), skills, UNLISTED, { answers: [A_WOUND_MET, A_INTAKE_NONE], thrownAway: 2 });
    expect(r.aiRows?.[1].text).toBe("Patient intake: no evidence found");
    expect(r.thrownAwayLine).toBe("2 answers were not accepted because their quote was not on the CV line.");
    expect(r.fitLabel).toBe("Stretch (skills only; 2 must-haves judged by AI)");
  });
});
