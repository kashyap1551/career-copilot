import type { SentEntry, SentRequirement } from "../engine/evidenceProof";

// What the AI is shown for the evidence check (docs/PLAN-EVERY-CV.md 4.3). Pure text: no provider, no node: import. The layout, with no blank line and
// no trailing newline:
//
//   Requirements:
//   R1 "<text>"
//   CV entries:
//   E1 | <name> | "<line>"
//
// Numbers are by POSITION, from 1. Only the requirement's words and each entry's name and CV line are used: no importance tag and no note about how a
// skill was found (the code knows must or nice; priority must not change the verdict). Every text: every run of whitespace becomes one space and the text
// is trimmed; a double quote inside becomes a single quote; then a requirement is cut to 300 characters and a CV line to 240, and trimmed again. In a name
// a | becomes a /. All other characters stay as they are.

export const CHECK_MAX_REQUIREMENTS = 30;
export const CHECK_MAX_ENTRIES = 120;
export const CHECK_MAX_REQUIREMENT_CHARS = 300;
export const CHECK_MAX_LINE_CHARS = 240;

// One fixed message for every refusal: it never holds any input text.
export const CHECK_INPUT_REFUSED = `The check needs 1 to ${CHECK_MAX_REQUIREMENTS} requirements and 1 to ${CHECK_MAX_ENTRIES} CV entries.`;

const tidy = (t: string) => t.replace(/\s+/g, " ").trim().replace(/"/g, "'");
const cut = (t: string, max: number) => Array.from(t).slice(0, max).join("").trim();

export function buildCheckInput(requirements: SentRequirement[], entries: SentEntry[]): string {
  if (
    requirements.length === 0 || entries.length === 0 ||
    requirements.length > CHECK_MAX_REQUIREMENTS || entries.length > CHECK_MAX_ENTRIES
  ) {
    throw new Error(CHECK_INPUT_REFUSED);
  }
  return [
    "Requirements:",
    ...requirements.map((r, i) => `R${i + 1} "${cut(tidy(r.quote), CHECK_MAX_REQUIREMENT_CHARS)}"`),
    "CV entries:",
    ...entries.map((e, i) => `E${i + 1} | ${tidy(e.name).replace(/\|/g, "/")} | "${cut(tidy(e.text), CHECK_MAX_LINE_CHARS)}"`),
  ].join("\n");
}
