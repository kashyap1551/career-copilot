import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm, type ConfirmState } from "@/lib/cv/profile";
import { capMessage } from "@/lib/cv/capMessage";
import { aiRowText } from "@/lib/engine/evidenceText";
import { MAX_SKILLS, type CvRemoval, type CvSkill } from "@/lib/engine/fromCv";
import { LINES } from "./support/evidenceFixtures";

// EC-2, the CV side (docs/PLAN-EVERY-CV.md 4.1 and AM5; tests PU1 to PU10). A ticked unlisted CV skill is KEPT, with its CV line, in a new list
// `unlistedKept`, and it also stays in `unmatchable` exactly as before. Invented data; every expectation is worked out by hand.
//
// The CV (lines 1 to 5, see tests/support/evidenceFixtures.ts) and the AI's proposals:
//   SQL           listed,   line 2, named      (ticked by the page's own rule)
//   Wound care    unlisted, line 3, inferred   (the words "wound care" are not in the line; not ticked until the person ticks it)
//   Patient intake unlisted, line 4, inferred
//   Welding       unlisted, line 5, named      (ticked by the page's own rule)
const prop = (name: string, skillId: string, listed: boolean, line: number, label: "named" | "inferred"): CvSkill => ({ name, skillId, listed, line, quote: "q", label });
const SQL = prop("SQL", "sql", true, 2, "named");
const WOUND = prop("Wound care", "new:wound-care", false, 3, "inferred");
const INTAKE = prop("Patient intake", "new:patient-intake", false, 4, "inferred");
const WELD = prop("Welding", "new:welding", false, 5, "named");
const PROPOSALS = [SQL, WOUND, INTAKE, WELD];
const confirm = (over: Partial<ConfirmState> = {}): ConfirmState => ({ ...initialConfirm(PROPOSALS), ...over });
const build = (over: Partial<ConfirmState> = {}, proposals = PROPOSALS) => buildProfile(LINES, proposals, confirm(over), skills);

describe("EC-2 buildProfile keeps unlisted skills (PU1 to PU9)", () => {
  it("PU1: a ticked unlisted CV skill is kept with its line and text AND stays in unmatchable, as before", () => {
    const b = build(); // the page's own rule ticks SQL and Welding
    expect(b.unlistedKept).toEqual([{ name: "Welding", skillId: "new:welding", evidence: { line: 5, text: LINES[4] }, inferred: false }]);
    expect(b.unmatchable).toEqual([{ name: "Welding", where: "cv" }]);
    expect(b.profile.skills).toEqual([{ kind: "have", skillId: "sql", evidence: { line: 2, text: LINES[1] } }]); // the listed skill only
  });

  it("PU2: an unticked unlisted skill never goes in; with nothing to keep the list is an empty list, not missing", () => {
    expect(build({ keptIds: ["sql"] }).unlistedKept).toEqual([]);
    expect(build({ keptIds: [] }).unlistedKept).toEqual([]);
  });

  it("PU3: a skill added by hand and a skill in progress never go in (they have no CV line)", () => {
    const b = build({ keptIds: ["sql"], added: ["Wound care"], inProgress: [{ name: "Patient intake", date: "2027-06-01" }] });
    expect(b.unlistedKept).toEqual([]);
    expect(b.unmatchable.map((u) => u.where)).toEqual(["hand", "progress"]);
  });

  it("PU4: two proposals with one id: the entry is there once", () => {
    const dup = [...PROPOSALS, { ...WELD, line: 4 }];
    const b = build({ keptIds: ["sql", "new:welding"] }, dup);
    expect(b.unlistedKept?.map((k) => k.skillId)).toEqual(["new:welding"]);
    expect(b.unlistedKept?.[0].evidence.line).toBe(5); // the first one wins, as for listed skills
  });

  it("PU5: the order is the order of the AI's proposals", () => {
    const b = build({ keptIds: ["new:welding", "new:wound-care", "sql"] });
    expect(b.unlistedKept?.map((k) => k.name)).toEqual(["Wound care", "Welding"]);
  });

  it("PU6: a ticked unlisted skill whose line does not exist is not kept (the same guard as for a listed one); it stays in unmatchable", () => {
    const odd = [SQL, prop("Ghost", "new:ghost", false, 9, "named"), prop("Zero", "new:zero", false, 0, "named")];
    const b = build({ keptIds: ["sql", "new:ghost", "new:zero"] }, odd);
    expect(b.unlistedKept).toEqual([]);
    expect(b.unmatchable.map((u) => u.name)).toEqual(["Ghost", "Zero"]);
  });

  it("PU8: a LISTED ticked skill is never in unlistedKept", () => {
    expect(build({ keptIds: ["sql"] }).unlistedKept).toEqual([]);
  });

  it("PU9 (AM5): a ticked unlisted skill from the inferred group has inferred true; a named one has false; the same inferred skill unticked is not there", () => {
    const b = build({ keptIds: ["sql", "new:wound-care", "new:welding"] });
    expect(b.unlistedKept?.map((k) => [k.name, k.inferred])).toEqual([["Wound care", true], ["Welding", false]]);
    expect(build({ keptIds: ["sql", "new:welding"] }).unlistedKept?.map((k) => k.name)).toEqual(["Welding"]);
  });

  it("PU10 (CV-side half): the flag survives from the confirm step to the entry, and the AI-block row shows the inferred wording for an inferred entry and not for a named one", () => {
    const b = build({ keptIds: ["sql", "new:wound-care", "new:welding"] });
    const [wound, weld] = b.unlistedKept ?? [];
    const row = (k: typeof wound) => aiRowText({ label: k.name, verdict: "met", line: k.evidence.line, quote: "x", entryName: k.name, inferred: k.inferred });
    expect(row(wound)).toBe('Wound care: met. CV line 3: "x" (Wound care; inferred from your wording, confirmed by you)');
    expect(row(weld)).toBe('Welding: met. CV line 5: "x" (Welding)');
  });
});

describe("EC-2 the 60-skill message (PU7)", () => {
  const cut = (...names: string[]): CvRemoval[] => names.map((name, i) => ({ name, line: i + 1, quote: "q", why: "too-many" as const }));

  it("PU7a: the cap is still 60; nothing to say when nothing was cut; a removal for another reason is not a cap message", () => {
    expect(MAX_SKILLS).toBe(60);
    expect(capMessage([])).toBeNull();
    expect(capMessage([{ name: "Zeta", line: 2, quote: "q", why: "quote-not-in-line" }])).toBeNull();
  });

  it("PU7b: the message names the skills that were left out, with the number", () => {
    expect(capMessage(cut("Tool 61", "Tool 62", "Tool 63"))).toBe(
      "Your CV showed 3 more skills than the 60 we keep. These were left out: Tool 61, Tool 62, Tool 63. Pick the ones that matter by unticking others and sending again, or shorten the CV.",
    );
    expect(capMessage(cut("Tool 61"))).toBe(
      "Your CV showed 1 more skill than the 60 we keep. It was left out: Tool 61. Pick the ones that matter by unticking others and sending again, or shorten the CV.",
    );
  });

  it("PU7c: a long list of names is cut after 20, and says how many more", () => {
    const names = Array.from({ length: 25 }, (_, i) => `Tool ${61 + i}`);
    const m = capMessage(cut(...names)) as string;
    expect(m.startsWith("Your CV showed 25 more skills than the 60 we keep. These were left out: Tool 61, Tool 62,")).toBe(true);
    expect(m).toContain("Tool 80, and 5 more.");
    expect(m).not.toContain("Tool 81");
  });

  it("PU7d: the CV box shows it as its own line, and the list of failed checks leaves the cap out (source guard)", () => {
    const src = readFileSync(join(process.cwd(), "app/CvBox.tsx"), "utf8");
    expect(src).toContain("capMessage(");
    expect(src).toMatch(/why !== "too-many"/);
  });
});
