import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cvFixtures } from "../fixtures/synthetic-cvs";
import { skillIdFor } from "../lib/engine/skillIds";
import { vocabHash } from "../lib/engine/vocabHash";
import { nameStatus, NOT_A_SKILL, skills } from "../lib/vocab";

// npm run vocab-check: how much of the test material the vocabulary covers (docs/PLAN-5.1.md, step 5.1).
// No AI call, no network. Two views, both counts:
//   KEYS      the skill names we wrote in the answer keys (and the five CV keys), per requirement
//   AI NAMES  the raw names the AI returned in the capture run (eval-runs/capture-names.json), per distinct name
// A name is "mapped" if the vocabulary has it, "not a skill" if it is on the not-a-skill list, "undecided" if it is an alias
// the owner has not decided, "left-unl." if the owner left it unlisted on purpose, else "unmapped".
// This is COVERAGE of the names the vocabulary was built from, not accuracy (accuracy is 5.2's question).
// Names are printed for ad-01 to ad-08 and the CVs only. For ad-09 and ad-10 counts only, never names.

const root = process.cwd();
const HOLDOUT = new Set(["ad-09", "ad-10"]);
type Kind = "mapped" | "notaskill" | "undecided" | "left" | "unmapped";
const KIND_OF = { mapped: "mapped", "not-a-skill": "notaskill", undecided: "undecided", "left-unlisted": "left", unmapped: "unmapped" } as const;
const kindOf = (name: string): Kind => KIND_OF[nameStatus(name, (n) => skillIdFor(n, skills))];

type Row = { label: string; total: number; mapped: number; notaskill: number; undecided: number; left: number; unmapped: number; unmappedNames: string[] };
const blank = (label: string): Row => ({ label, total: 0, mapped: 0, notaskill: 0, undecided: 0, left: 0, unmapped: 0, unmappedNames: [] });

// A requirement is unmapped if any of its names is; else undecided or left-unlisted if any name is; not-a-skill if all
// its names are; otherwise mapped.
function requirementKind(names: string[]): { kind: Kind; bad: string[] } {
  const kinds = names.map((n) => [n, kindOf(n)] as const);
  const bad = kinds.filter(([, k]) => k === "unmapped").map(([n]) => n);
  if (bad.length > 0) return { kind: "unmapped", bad };
  if (kinds.some(([, k]) => k === "undecided")) return { kind: "undecided", bad: [] };
  if (kinds.some(([, k]) => k === "left")) return { kind: "left", bad: [] };
  return { kind: kinds.every(([, k]) => k === "notaskill") ? "notaskill" : "mapped", bad: [] };
}

async function main() {
  // ---- KEYS
  const keyRows: Row[] = [];
  const keyDir = path.join(root, "fixtures/answer-keys");
  if (fs.existsSync(keyDir)) {
    for (const f of fs.readdirSync(keyDir).filter((f) => /^ad-\d+\.ts$/.test(f)).sort()) {
      const id = f.replace(".ts", "");
      const mod = (await import(pathToFileURL(path.join(keyDir, f)).href)) as { key?: { requirements: { skills: string[] }[] } };
      const row = blank(id);
      for (const r of mod.key?.requirements ?? []) {
        const { kind, bad } = requirementKind(r.skills);
        row.total++;
        row[kind]++;
        row.unmappedNames.push(...bad);
      }
      keyRows.push(row);
    }
  }
  const cvKeyRow = blank("five CV keys");
  for (const cv of cvFixtures) {
    for (const item of cv.key.items) {
      const { kind, bad } = requirementKind([item.names[0]]);
      cvKeyRow.total++;
      cvKeyRow[kind]++;
      cvKeyRow.unmappedNames.push(...bad);
    }
  }

  // ---- AI NAMES
  const aiRows: Row[] = [];
  const capFile = path.join(root, "eval-runs/capture-names.json");
  if (fs.existsSync(capFile)) {
    const cap = JSON.parse(fs.readFileSync(capFile, "utf8")) as { ads: Record<string, string[]>; cvs: Record<string, string[]> };
    const rowOf = (label: string, names: string[]) => {
      const row = blank(label);
      for (const n of [...new Map(names.map((x) => [x.trim().toLowerCase(), x.trim()])).values()]) {
        const k = kindOf(n);
        row.total++;
        row[k]++;
        if (k === "unmapped") row.unmappedNames.push(n);
      }
      return row;
    };
    for (const [id, names] of Object.entries(cap.ads)) if (/^ad-\d+$/.test(id)) aiRows.push(rowOf(id, names));
    aiRows.push(rowOf("five CVs", Object.values(cap.cvs).flat()));
  }

  const sumOf = (label: string, rows: Row[]): Row => {
    const s = blank(label);
    for (const r of rows) {
      s.total += r.total; s.mapped += r.mapped; s.notaskill += r.notaskill; s.undecided += r.undecided; s.left += r.left; s.unmapped += r.unmapped;
      s.unmappedNames.push(...r.unmappedNames);
    }
    return s;
  };
  const line = (r: Row) =>
    `${r.label.padEnd(14)} ${String(r.total).padStart(5)} ${String(r.mapped).padStart(7)} ${String(r.notaskill).padStart(11)} ${String(r.undecided).padStart(9)} ${String(r.left).padStart(10)} ${String(r.unmapped).padStart(9)}`;
  const section = (title: string, unit: string, rows: Row[], extra: Row[]) => {
    console.log(`\n${title}`);
    console.log(`${"".padEnd(14)} ${unit.padStart(5)}  mapped  not-a-skill  undecided  left-unl.  unmapped`);
    const tuning = rows.filter((r) => /^ad-0[1-8]$/.test(r.label));
    const hold = rows.filter((r) => HOLDOUT.has(r.label));
    for (const r of tuning) console.log(line(r));
    if (tuning.length > 0) console.log(line(sumOf("ads 01-08", tuning)));
    if (hold.length > 0) console.log(line(sumOf("ads 09-10 *", hold)));
    for (const r of extra) console.log(line(r));
  };
  console.log(`VOCAB CHECK (no AI call) | vocab ${vocabHash().slice(0, 10)} | vocabulary: ${skills.length} skills, ${NOT_A_SKILL.length} not-a-skill phrases`);
  section("KEYS (the names we wrote; one row per requirement)", "reqs", keyRows, [cvKeyRow]);
  if (aiRows.length > 0) section("AI NAMES (capture run, distinct names)", "names", aiRows.filter((r) => r.label !== "five CVs"), aiRows.filter((r) => r.label === "five CVs"));
  console.log("* ad-09 and ad-10: counts only, their names are never printed.");

  // The names to fix, for the tuning ads and the CVs only.
  const shown = [...keyRows.filter((r) => /^ad-0[1-8]$/.test(r.label)), cvKeyRow, ...aiRows.filter((r) => r.label === "five CVs" || /^ad-0[1-8]$/.test(r.label))];
  const where = (r: Row, i: number) => (i < keyRows.filter((x) => /^ad-0[1-8]$/.test(x.label)).length + 1 ? `key ${r.label}` : `AI ${r.label}`);
  const lines = shown.flatMap((r, i) => (r.unmappedNames.length > 0 ? [`  ${where(r, i)}: ${[...new Set(r.unmappedNames)].join(" | ")}`] : []));
  console.log(`\nUNMAPPED NAMES (ad-01 to ad-08 and the CVs): ${lines.length === 0 ? "none" : ""}`);
  for (const l of lines) console.log(l);

  const tuningKeys = sumOf("t", keyRows.filter((r) => /^ad-0[1-8]$/.test(r.label)));
  const aiTuning = sumOf("a", aiRows.filter((r) => /^ad-0[1-8]$/.test(r.label) || r.label === "five CVs"));
  const unmapped = tuningKeys.unmapped + cvKeyRow.unmapped + aiTuning.unmapped;
  console.log(
    `\nPASS 5.1 (unmapped 0 on ad-01 to ad-08 and the CVs): ${unmapped === 0 ? "yes" : "NO"} | key requirements unmapped ${tuningKeys.unmapped + cvKeyRow.unmapped}, AI names unmapped ${aiTuning.unmapped}`,
  );
  console.log("This is coverage of the names the vocabulary was built from, not accuracy.");
}

main().catch(() => {
  // Never print an error's own message: it could carry text from an ad.
  console.error("The vocabulary check stopped on an unexpected error.");
  process.exit(1);
});
