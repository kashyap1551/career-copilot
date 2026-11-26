import { randomUUID } from "node:crypto";
import { runCheck } from "../app/runCheck";
import { POST } from "../app/api/check/route";
import { INSTRUCTIONS_CHECK } from "../lib/ai/checkEvidence";
import { buildCheckInput } from "../lib/ai/checkInput";
import { captureCheckRequestBody } from "../lib/ai/checkRequestBody";
import { captureCvRequestBody } from "../lib/ai/cvRequestBody";
import { READING_VERSION } from "../lib/ai/readingVersion";
import { captureRequestBody } from "../lib/ai/requestBody";
import { GENERATION_SETTINGS } from "../lib/ai/settings";
import { cannedGroqFetch, type answersFromKey } from "../lib/engine/evalEveryCvCheckCanned";
import { installCountingFetch, summarizeCall } from "../lib/engine/evalEveryCvCheckFetch";
import { PROBE_ENTRIES, PROBE_REQUIREMENTS } from "../lib/engine/evalEveryCvCheckProbe";
import { vocabHash } from "../lib/engine/vocabHash";
import type { CheckChain } from "./everyCvCheckMain";

// The chain of `npm run eval-check` (docs/PLAN-EVERY-CV.md, the check eval): ONE real check call is the PAGE'S OWN click (app/runCheck.ts) into the REAL
// route (app/api/check/route.ts), called in this process, which runs the real checkEvidence and the real proof. Nothing here copies the page's rules.
//
//  - The page's fetch is an in-process call of the route's POST (no server, no network of its own); the only real network is the AI call itself, which goes
//    through the counting wrapper (lib/engine/evalEveryCvCheckFetch.ts) and is replaced by a fake model in the dry mode.
//  - The access code of the route is a fresh random value for this process only: it is kept in memory, never printed, never written.
//  - Everything this file changes (fetch, three environment variables) is put back by close().

type Dry = Parameters<typeof cannedGroqFetch>[0] | null;

const STORE_ACCESS = "career-copilot.access-code";
const STORE_CONSENT = "career-copilot.consent";
const memoryStore = (entries: Record<string, string>) => {
  const m = new Map(Object.entries(entries));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

export async function makeChain(opts: { dry: Dry }): Promise<CheckChain | { refusal: string }> {
  const saved = { key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL, access: process.env.ACCESS_CODE };
  const restoreEnv = () => {
    for (const [name, value] of [["GROQ_API_KEY", saved.key], ["GROQ_MODEL", saved.model], ["ACCESS_CODE", saved.access]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  if (opts.dry === null && (!process.env.GROQ_API_KEY || !process.env.GROQ_MODEL)) {
    return { refusal: "GROQ_API_KEY and GROQ_MODEL must be set (in the environment file). Nothing was run." };
  }
  if (opts.dry !== null) {
    process.env.GROQ_API_KEY = "dry-run-not-a-key";
    process.env.GROQ_MODEL = "openai/gpt-oss-120b";
  }
  const accessCode = `${randomUUID()}${randomUUID()}`;
  process.env.ACCESS_CODE = accessCode;

  const originalFetch = globalThis.fetch;
  try {
    // what the guards and the fingerprint need, captured on a fake fetch (no network), BEFORE any wrapper is installed
    const probeBody = await captureCheckRequestBody(PROBE_REQUIREMENTS, PROBE_ENTRIES);
    const cvRequest = opts.dry === null ? await captureCvRequestBody() : null;
    const adRequest = opts.dry === null ? await captureRequestBody() : null;
    if (opts.dry !== null) globalThis.fetch = cannedGroqFetch(opts.dry);
    const counter = installCountingFetch();
    const accessStore = memoryStore({ [STORE_ACCESS]: accessCode });
    const consentStore = memoryStore({ [STORE_CONSENT]: "1" }); // the tick: this is the eval, the owner's go is the consent
    const inProcess = (async (url: string, init?: RequestInit) => POST(new Request(`http://eval.invalid${url}`, init))) as unknown as typeof fetch;

    return {
      cvRequest,
      adRequest,
      vocabulary: vocabHash(),
      probe: { body: probeBody, instructionsLength: INSTRUCTIONS_CHECK.length },
      model: process.env.GROQ_MODEL ?? "",
      settings: GENERATION_SETTINGS,
      readingVersion: READING_VERSION,
      buildPrompt: (plan) => buildCheckInput(plan.requirements, plan.entries),
      async callCheck(plan) {
        counter.begin();
        const outcome = await runCheck(plan, { post: { fetch: inProcess, store: accessStore }, consentStore });
        const record = counter.end();
        return { outcome, call: summarizeCall(record), limits: record.limits };
      },
      close() {
        counter.restore();
        globalThis.fetch = originalFetch;
        restoreEnv();
      },
    };
  } catch (error) {
    globalThis.fetch = originalFetch;
    restoreEnv();
    throw error;
  }
}

export type { answersFromKey };
