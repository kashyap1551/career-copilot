import { jobs } from "../fixtures/jobs";
import { skills } from "../fixtures/skills";
import { cvFixtures } from "../fixtures/synthetic-cvs";
import { checkCvKey } from "../lib/engine/cvKey";
import { buildEvalItems, evalCvs, type BulletsEvalItem } from "../lib/engine/evalBulletsProfile";
import { droppedLines, formatBulletsReport, perRunLines, reviewSheet } from "../lib/engine/evalBulletsReport";
import { runBulletsEval, type BulletsWriter } from "../lib/engine/evalBulletsRun";
import { missingGuard, mismatchGuard } from "../lib/engine/evalCvGuard";

// The logic of `npm run eval-bullets` (docs/PLAN-8.3.md v2, section 4, "The eval"; stage 5). Everything the script touches from the outside is PASSED IN: the
// settings loader, the fingerprint, the writer (the thing that calls the AI), the clock, the sleeper, the file saver and the two output channels. So the tests run
// this whole function with fakes and no AI call is possible. The real writer is wired only in scripts/evalBullets.ts, the command-line entry; nothing here
// imports lib/ai.
//
//   npm run eval-bullets -- --fingerprint   prints the fingerprint line and stops. No AI call (the request is captured on a fake fetch). No EXPECT_ variable needed.
//   npm run eval-bullets -- --calibration   a real run, marked "not counted" (the first run of PLAN-8.3).
//   npm run eval-bullets                    a real run. REFUSES to start unless EXPECT_REQUEST_HASH and EXPECT_INSTRUCTIONS_LEN are set and match.

export type BulletsMainDeps = {
  args: string[];
  env: Record<string, string | undefined>; // process.env (the entry's loader fills it from .env.local; its contents are never printed)
  loadEnv: () => void;
  fingerprint: (items: BulletsEvalItem[]) => Promise<{ hash10: string; instructionsLength: number; line: string }>;
  write: BulletsWriter;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  save: (name: string, text: string) => string; // saves under eval-runs/ and returns the path to show
  out: (text: string) => void;
  err: (text: string) => void;
};

// Returns the exit code. It never prints an error's own message: it could carry text from a CV.
export async function evalBulletsMain(deps: BulletsMainDeps): Promise<number> {
  try {
    const onlyFingerprint = deps.args.includes("--fingerprint");
    const counted = !deps.args.includes("--calibration");

    // A real run needs both guard variables. This is the first thing that happens: nothing is loaded and no key is read before it.
    if (!onlyFingerprint) {
      const refusal = missingGuard(deps.env, "eval-bullets");
      if (refusal) {
        deps.err(refusal + "\n");
        return 1;
      }
    }

    deps.loadEnv();
    if (!onlyFingerprint && (!deps.env.GROQ_API_KEY || !deps.env.GROQ_MODEL)) {
      deps.err("GROQ_API_KEY and GROQ_MODEL must be set (in .env.local). Nothing was run.\n");
      return 1;
    }

    const cvs = evalCvs(cvFixtures);
    for (const c of cvs) {
      const problems = checkCvKey(c.key, c.lines);
      if (problems.length > 0) {
        deps.err(`Key problems in ${c.id} at: ${problems.map((p) => p.where).join(", ")}. Nothing was run.\n`);
        return 1;
      }
    }
    const items = buildEvalItems(cvs, jobs, skills);

    const fingerprint = await deps.fingerprint(items);
    if (onlyFingerprint) {
      deps.out(fingerprint.line);
      return 0;
    }

    const refusal = mismatchGuard(deps.env, fingerprint.hash10, fingerprint.instructionsLength);
    if (refusal) {
      deps.err(refusal + "\n");
      return 1;
    }

    const run = await runBulletsEval(items, {
      write: deps.write,
      sleep: deps.sleep,
      now: deps.now,
      minGapMs: 3000,
      backoffsMs: [15000, 45000],
    });

    const report = formatBulletsReport(run, counted) + fingerprint.line;
    const stamp = new Date(deps.now()).toISOString().replace(/[:.]/g, "-");
    const dropped = droppedLines(run);
    const full = report + "\n" + perRunLines(run).join("\n") + "\n" + (dropped.length > 0 ? "\n" + dropped.join("\n") + "\n" : "");
    const fullPath = deps.save(`bullets-${stamp}.txt`, full);
    const sheetPath = deps.save(`bullets-review-${stamp}.md`, reviewSheet(run));
    deps.out(report + `(saved to ${fullPath})\n(review sheet: ${sheetPath})\n`);
    return 0;
  } catch {
    deps.err("The bullets eval stopped on an unexpected error.\n");
    return 1;
  }
}
