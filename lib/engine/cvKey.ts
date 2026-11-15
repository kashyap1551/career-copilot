import { nameWrittenIn } from "./fromCv";

// The answer key of a made-up CV (docs/PLAN-4.2-cvs.md). Lines are numbered
// after the contact details are removed. A key item says which skills a line
// supports, by accepted names; "named" means the first name is written in the
// line as a whole word, "inferred" means it is not. A line with no item
// supports nothing.

export type CvKeyItem = { line: number; names: string[]; label: "named" | "inferred" };

export type CvKey = {
  cv: string;
  status: "reviewed" | "draft";
  lineCount: number; // lines after the removal and numbering
  injectionLines: number[]; // lines that hold an injected instruction
  trapLines: number[]; // lines written to look like a skill but showing none
  items: CvKeyItem[];
};

export type CvKeyProblem = { where: string; problem: string };

// Pure checks of a key against the lines it describes. Problems name the place,
// never the CV text.
export function checkCvKey(key: CvKey, lines: string[]): CvKeyProblem[] {
  const out: CvKeyProblem[] = [];
  const add = (where: string, problem: string) => out.push({ where, problem });
  if (lines.length !== key.lineCount) add("lineCount", `the CV has ${lines.length} lines, the key says ${key.lineCount}`);
  key.items.forEach((item, i) => {
    const where = `items[${i}] (line ${item.line})`;
    if (!Number.isInteger(item.line) || item.line < 1 || item.line > lines.length) {
      add(where, "line out of range");
      return;
    }
    if (item.names.length === 0 || item.names.some((n) => n.trim() === "")) add(where, "no accepted name");
    const written = nameWrittenIn(item.names[0] ?? "", lines[item.line - 1]);
    if (item.label === "named" && !written) add(where, "marked named, but its first name is not written in the line");
    if (item.label === "inferred" && written) add(where, "marked inferred, but its first name is written in the line");
    if (key.injectionLines.includes(item.line) || key.trapLines.includes(item.line)) {
      add(where, "an injection or trap line supports nothing");
    }
  });
  for (const l of [...key.injectionLines, ...key.trapLines]) {
    if (l < 1 || l > lines.length) add(`line ${l}`, "injection or trap line out of range");
  }
  return out;
}
