// Step 4.2: the CV text as numbered lines. This runs in the browser AFTER the
// contact details are removed, so the lines the person sees, the lines the AI
// gets and the quotes the evidence is checked against are one text. Line n is
// the n-th non-empty line, counting from 1.

export function numberLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
}

// How the lines are shown to the AI: "1: first line".
export function formatNumbered(lines: string[]): string {
  return lines.map((l, i) => `${i + 1}: ${l}`).join("\n");
}
