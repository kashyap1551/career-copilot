import fs from "node:fs";
import path from "node:path";
import { skills } from "../fixtures/skills";
import { cvFixtures } from "../fixtures/synthetic-cvs";
import { captureCvRequestBody } from "../lib/ai/cvRequestBody";
import { readCvLines, INSTRUCTIONS_CV } from "../lib/ai/readCv";
import { INSTRUCTIONS, readJobAd } from "../lib/ai/readJob";
import { captureRequestBody } from "../lib/ai/requestBody";
import { numberLines } from "../lib/cv/numberLines";
import { removeContactDetails } from "../lib/cv/redact";
import { parseDuration, waitForTokens } from "../lib/engine/evalCvRun";
import { requestHash } from "../lib/engine/evalFingerprint";
import { skillIdFor } from "../lib/engine/skillIds";

// Day 5 capture run (docs/PLAN-5.1.md): read the ten real ads, the barista known case and the five made-up CVs
// with the REAL readers (exactly the requests the eval sends), and save the raw skill names the AI returned,
// names only, to eval-runs/capture-names.json (gitignored). Nothing else is kept: no ad text, no quotes.
//
// npm run capture-names -- --fingerprint   prints the two request hashes and prompt sizes. No AI call.
// EXPECT_AD_HASH=... EXPECT_AD_LEN=... EXPECT_CV_HASH=... EXPECT_CV_LEN=... npm run capture-names
//                                          the real run (16 Groq calls). Refuses unless all four are set and match.
// It prints counts only. The holdout ads (ad-09, ad-10) are captured and counted, never printed by name.

const root = process.cwd();
const wantFingerprint = process.argv.includes("--fingerprint");

if (!wantFingerprint) {
  const missing = ["EXPECT_AD_HASH", "EXPECT_AD_LEN", "EXPECT_CV_HASH", "EXPECT_CV_LEN"].filter((k) => !process.env[k]?.trim());
  if (missing.length > 0) {
    console.error(`Refused: ${missing.join(", ")} must be set before a real run (see --fingerprint). No AI call was made.`);
    process.exit(1);
  }
}
try {
  process.loadEnvFile(path.join(root, ".env.local"));
} catch {
  // No file: the variables may be set another way.
}
if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
  console.error("GROQ_API_KEY and GROQ_MODEL must be set (in .env.local). Nothing was run.");
  process.exit(1);
}

type Item = { set: "ads" | "cvs"; id: string; run: () => Promise<unknown> };

async function main() {
  const adHash = requestHash(await captureRequestBody()).slice(0, 10);
  const cvHash = requestHash(await captureCvRequestBody()).slice(0, 10);
  if (wantFingerprint) {
    console.log(`AD request ${adHash} | INSTRUCTIONS ${INSTRUCTIONS.length}\nCV request ${cvHash} | INSTRUCTIONS ${INSTRUCTIONS_CV.length}`);
    return;
  }
  const e = process.env;
  const bad = [
    e.EXPECT_AD_HASH?.trim() !== adHash ? `ad request hash is ${adHash}` : "",
    e.EXPECT_AD_LEN?.trim() !== String(INSTRUCTIONS.length) ? `ad INSTRUCTIONS is ${INSTRUCTIONS.length}` : "",
    e.EXPECT_CV_HASH?.trim() !== cvHash ? `CV request hash is ${cvHash}` : "",
    e.EXPECT_CV_LEN?.trim() !== String(INSTRUCTIONS_CV.length) ? `CV INSTRUCTIONS is ${INSTRUCTIONS_CV.length}` : "",
  ].filter(Boolean);
  if (bad.length > 0) {
    console.error(`Refused: ${bad.join("; ")}. No AI call was made.`);
    process.exit(1);
  }

  // The real readers run unchanged. Only their network answer is looked at on its way back (the model's raw
  // JSON), to keep the names before the checks turn them into ids. The request is passed on untouched.
  const realFetch = globalThis.fetch;
  let lastContent: string | null = null;
  let lastHeaders: Record<string, string> = {};
  let lastTokens = 0;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const res = await realFetch(input, init);
    try {
      const body = (await res.clone().json()) as { choices?: { message?: { content?: string } }[]; usage?: { total_tokens?: number } };
      lastContent = body.choices?.[0]?.message?.content ?? null;
      lastTokens = body.usage?.total_tokens ?? 0;
      lastHeaders = Object.fromEntries([...res.headers.entries()].filter(([k]) => k.toLowerCase().startsWith("x-ratelimit")));
    } catch {
      lastContent = null;
    }
    return res;
  }) as typeof fetch;

  const items: Item[] = [];
  const adDir = path.join(root, "fixtures/real-ads");
  for (const f of fs.readdirSync(adDir).filter((f) => /^ad-\d+\.txt$/.test(f)).sort()) {
    const text = fs.readFileSync(path.join(adDir, f), "utf8");
    items.push({ set: "ads", id: f.replace(".txt", ""), run: () => readJobAd(text) });
  }
  const barista = path.join(root, "fixtures/known-cases/barista-injection.txt");
  if (fs.existsSync(barista)) {
    const text = fs.readFileSync(barista, "utf8");
    items.push({ set: "ads", id: "barista-injection", run: () => readJobAd(text) });
  }
  for (const cv of cvFixtures) {
    const lines = numberLines(removeContactDetails(cv.text));
    items.push({ set: "cvs", id: cv.id, run: () => readCvLines(lines) });
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const captured: { ads: Record<string, string[]>; cvs: Record<string, string[]> } = { ads: {}, cvs: {} };
  const failed: string[] = [];
  let totalTokens = 0;
  let calls = 0;
  let biggest = 4500;

  for (const [i, item] of items.entries()) {
    if (i > 0) await sleep(Math.max(3000, waitForTokens(lastHeaders, biggest)));
    let attempt = 0;
    let serverRetried = false;
    for (;;) {
      lastContent = null;
      try {
        await item.run();
        const raw = JSON.parse(lastContent ?? "{}") as { requirements?: { skills?: { name: string }[] }[]; skills?: { name: string }[] };
        const names =
          item.set === "ads"
            ? (raw.requirements ?? []).flatMap((r) => (r.skills ?? []).map((s) => s.name))
            : (raw.skills ?? []).map((s) => s.name);
        captured[item.set][item.id] = names;
        calls++;
        totalTokens += lastTokens;
        biggest = Math.max(biggest, lastTokens);
        break;
      } catch (error) {
        const status = typeof error === "object" && error !== null && "status" in error ? (error as { status?: number }).status : undefined;
        const msg = error instanceof Error ? error.message : "";
        if (status === 429 && attempt < 2) {
          await sleep([15000, 45000][attempt++]);
          continue;
        }
        const quoted = /\(status (\d{3})\)/.exec(msg);
        const code = quoted ? Number(quoted[1]) : status;
        if (code !== undefined && code >= 500 && !/expected shape/.test(msg) && !serverRetried) {
          serverRetried = true;
          await sleep(20000);
          continue;
        }
        failed.push(`${item.id} (${code === 429 ? "rate limited" : code !== undefined ? `status ${code}` : "unexpected error"})`);
        break;
      }
    }
  }
  globalThis.fetch = realFetch;

  fs.mkdirSync(path.join(root, "eval-runs"), { recursive: true });
  fs.writeFileSync(path.join(root, "eval-runs/capture-names.json"), JSON.stringify(captured));

  // Counts only.
  const listed = (n: string) => skillIdFor(n, skills)?.listed === true;
  console.log("CAPTURE RUN (names only, saved to eval-runs/capture-names.json, gitignored)");
  console.log("set               names  distinct  map to the 17 skills (distinct)");
  const rowOf = (label: string, names: string[]) => {
    const d = [...new Set(names.map((n) => n.trim().toLowerCase()))];
    const m = d.filter((n) => listed(n)).length;
    console.log(`${label.padEnd(17)} ${String(names.length).padStart(5)} ${String(d.length).padStart(9)} ${String(m).padStart(6)}`);
  };
  for (const [id, names] of Object.entries(captured.ads)) rowOf(id, names);
  const tuning = Object.entries(captured.ads).filter(([k]) => /^ad-0[1-8]$/.test(k)).flatMap(([, v]) => v);
  const hold = Object.entries(captured.ads).filter(([k]) => k === "ad-09" || k === "ad-10").flatMap(([, v]) => v);
  rowOf("ads 01-08", tuning);
  rowOf("ads 09-10", hold);
  for (const [id, names] of Object.entries(captured.cvs)) rowOf(id, names);
  rowOf("five CVs", Object.values(captured.cvs).flat());
  rowOf("everything", [...Object.values(captured.ads).flat(), ...Object.values(captured.cvs).flat()]);
  console.log(`CALLS: ${calls} of ${items.length}${failed.length ? ` | FAILED: ${failed.join(", ")} (the run is INCOMPLETE)` : " | none failed"} | TOKENS: ${totalTokens.toLocaleString("en-US")}`);
  void parseDuration;
}

main().catch(() => {
  // Never print an error's own message: it could carry text from an ad or a CV.
  console.error("The capture stopped on an unexpected error.");
  process.exit(1);
});
