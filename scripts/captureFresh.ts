import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { INSTRUCTIONS, readJobAd } from "../lib/ai/readJob";
import { captureRequestBody } from "../lib/ai/requestBody";
import { captureFresh, labelsTodo, refusalFor, summaryLines } from "../lib/engine/captureFresh";
import { waitForTokens } from "../lib/engine/evalCvRun";
import { requestHash } from "../lib/engine/evalFingerprint";

// npm run capture-fresh: read each fixtures/real-ads/fresh-*.txt ONCE with the live ad reader, keep the raw skill
// names the AI returned (before any mapping or flagging), and write fixtures/real-ads/fresh-labels-TODO.json
// ({"set":"fresh","names":{"<name>":"TODO"}}, gitignored) to be filled in by hand (npm run skill-ids lists the labels).
//
//   EXPECT_AD_HASH=85357f8fac EXPECT_AD_LEN=3347 npm run capture-fresh
//
// Refuses: when fresh-labels-TODO.json or fresh-labels.json already exists (the first capture is the record), when the
// two guard variables are missing or do not match the request that would be sent (checked before any ad text is read
// or sent), and when the labels file would not be gitignored. Prints COUNTS ONLY: never a name. A failed call stops the
// capture and writes nothing. FRESH_DIR (used by the tests) replaces the folder.

const defaultDir = path.join(process.cwd(), "fixtures/real-ads");
const dir = process.env.FRESH_DIR ?? defaultDir;
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
const adFiles = files.filter((f) => /^fresh-.*\.txt$/.test(f)).sort();

if (adFiles.length === 0) {
  console.log("No fresh ads (fresh-*.txt) found. Nothing to do: add the 3 fresh ads first (at least 2 in German).");
  process.exit(0);
}

const refusal = refusalFor(files);
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const missing = ["EXPECT_AD_HASH", "EXPECT_AD_LEN"].filter((k) => !process.env[k]?.trim());
if (missing.length > 0) {
  console.error(`Refused: ${missing.join(" and ")} must be set before a real run. No AI call was made.`);
  process.exit(1);
}

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // No file: the variables may be set another way.
}
if (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL) {
  console.error("GROQ_API_KEY and GROQ_MODEL must be set (in .env.local). Nothing was run.");
  process.exit(1);
}

const target = path.join(dir, "fresh-labels-TODO.json");

async function main() {
  // The labels file must be gitignored before any name exists (only checked for the real folder).
  if (!process.env.FRESH_DIR) {
    try {
      execFileSync("git", ["check-ignore", "-q", path.relative(process.cwd(), target)], { stdio: "ignore" });
    } catch {
      console.error("Refused: fixtures/real-ads/fresh-labels-TODO.json would not be gitignored. Nothing was read.");
      process.exit(1);
    }
  }

  // The guards, before any ad text is read or sent.
  const hash = requestHash(await captureRequestBody()).slice(0, 10);
  const bad = [
    process.env.EXPECT_AD_HASH?.trim() !== hash ? `ad request hash is ${hash}` : "",
    process.env.EXPECT_AD_LEN?.trim().replace(/,/g, "") !== String(INSTRUCTIONS.length) ? `ad INSTRUCTIONS is ${INSTRUCTIONS.length}` : "",
  ].filter(Boolean);
  if (bad.length > 0) {
    console.error(`Refused: ${bad.join("; ")}. No AI call was made.`);
    process.exit(1);
  }

  // The real reader runs unchanged; only its network answer is looked at on its way back (the model's raw JSON), to
  // keep the names before the checks turn them into ids. The request is passed on untouched.
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

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let first = true;
  let biggest = 4500;
  const result = await captureFresh({
    ads: adFiles.map((f) => ({ id: f.replace(/\.txt$/, ""), text: fs.readFileSync(path.join(dir, f), "utf8") })),
    read: async (text) => {
      if (!first) await sleep(Math.max(3000, waitForTokens(lastHeaders, biggest)));
      first = false;
      lastContent = null;
      await readJobAd(text); // one call; a failure propagates and stops the capture
      const raw = JSON.parse(lastContent ?? "{}") as { requirements?: { skills?: { name: string }[] }[] };
      biggest = Math.max(biggest, lastTokens);
      return { names: (raw.requirements ?? []).flatMap((r) => (r.skills ?? []).map((s) => s.name)), tokens: lastTokens };
    },
  });
  globalThis.fetch = realFetch;

  console.log(summaryLines(result).join("\n"));
  if (result.distinct === null) process.exit(1);
  fs.writeFileSync(target, JSON.stringify(labelsTodo(result.distinct), null, 1));
  console.log(`Wrote ${path.relative(process.cwd(), target)} (${result.distinct.length} names, all TODO; gitignored). Label them with npm run skill-ids, then save it as fresh-labels.json.`);
}

main().catch(() => {
  // Never print an error's own message: it could carry text from an ad.
  console.error("The fresh capture stopped on an unexpected error. Nothing was written.");
  process.exit(1);
});
