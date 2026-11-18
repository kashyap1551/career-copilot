import { skills } from "@/fixtures/skills";
import { engineView } from "@/lib/cv/engineView";
import type { BuiltProfile } from "@/lib/cv/profile";
import { chooseBulletPairs, MAX_PAIRS, type BulletPair } from "@/lib/engine/bulletPairs";
import { bulletsFrom } from "@/lib/engine/bulletsFrom";
import { listedAlternatives } from "@/lib/engine/roadmapJobs";
import type { Job } from "@/lib/engine/types";
import {
  BULLETS_FAILED_LINE,
  BULLETS_TIMEOUT_LINE,
  COULD_NOT_REACH_LINE,
  serverErrorLine,
  sourceLine,
  sourceLineOnly,
} from "@/lib/saved/messages";
import { bulletRequestPairSchema, bulletsResponseSchema } from "@/lib/schemas/bullets";
import { postJson, type PostResult } from "./accessFetch";
import { fetchWithSignal } from "./timedFetch";

// Step 8.3 (docs/PLAN-8.3.md v2, stage 4, 0.26): the logic of the "CV bullets" block, in plain functions the view only wires. No AI here, no store, no clock; the one
// network path is `postJson` (the access code is added there, a 401 opens the code box). The AI writes; plain code chooses the lines, checks every bullet again and counts.

export const BULLETS_TIMEOUT_MS = 30_000;

// ---- the pairs ---------------------------------------------------------------------------------------------------------------------------------
// The candidates come from the engine view of the AD ON SCREEN (the page's own reading, never a saved job id) and the profile in use. A candidate the route would refuse is
// NOT sent and the next one takes its place, up to MAX_PAIRS; the ids sent are renumbered 1..n (the route refuses anything else) and each pair keeps its real CV line number.
export function bulletCandidates(job: Job, built: BuiltProfile | null): BulletPair[] {
  if (built === null) return [];
  const view = engineView(job, built);
  const all = chooseBulletPairs(view.engineProfile, listedAlternatives(view.engineJob), Number.MAX_SAFE_INTEGER);
  const kept: BulletPair[] = [];
  for (const pair of all) {
    if (kept.length >= MAX_PAIRS) break;
    const id = kept.length + 1;
    if (!bulletRequestPairSchema.safeParse({ id, requirement: pair.requirement, line: pair.text }).success) continue;
    kept.push({ ...pair, id });
  }
  return kept;
}

export type Candidates = { kind: "pairs"; pairs: BulletPair[] } | { kind: "failed" };

// A throw while choosing (a damaged reading, say) is a plain line in the block, never an error page.
export function bulletCandidatesSafe(job: Job, built: BuiltProfile | null): Candidates {
  try {
    return { kind: "pairs", pairs: bulletCandidates(job, built) };
  } catch {
    return { kind: "failed" };
  }
}

// Changes with the ad and with the profile, so a block that was opened for one ad never shows for another.
export function blockKey(job: Job, built: BuiltProfile | null): string {
  const reqs = (job.requirements ?? []).map((r) => `${r.importance}:${r.skillIds.join("+")}:${r.quote}`).join("~");
  const skillsKey = built
    ? built.profile.skills.map((s) => (s.kind === "have" ? `h:${s.skillId}:${s.evidence?.line ?? ""}` : `p:${s.skillId}`)).join(",")
    : "-";
  return `${job.title}|${job.company ?? ""}|${reqs}#${skillsKey}`;
}

// What is sent: the number, the requirement and the line text of each pair; no line number, no skill.
export function requestBodyFor(pairs: BulletPair[]) {
  return { pairs: pairs.map((p) => ({ id: p.id, requirement: p.requirement, line: p.text })) };
}

// ---- the answer --------------------------------------------------------------------------------------------------------------------------------
export type ShownBullet = { pair: number; line: number; text: string; source: string };

const sameWords = (a: string, b: string) => a.toLowerCase().replace(/\s+/g, " ").trim() === b.toLowerCase().replace(/\s+/g, " ").trim();

// D9: every bullet the route kept is checked AGAIN against its own pair's line. The dropped count is every asked pair that has no shown bullet, whoever dropped it.
export function checkAnswer(answer: { bullets: { pair: number; text: string }[] }, pairs: BulletPair[]): { shown: ShownBullet[]; dropped: number } {
  const checked = bulletsFrom(answer, pairs, skills);
  const shown = checked.bullets.map((b) => {
    const pair = pairs.find((p) => p.id === b.pair) as BulletPair;
    return { pair: b.pair, line: b.line, text: b.text, source: sameWords(b.text, pair.text) ? sourceLineOnly(pair.line) : sourceLine(pair.line, pair.text) };
  });
  return { shown, dropped: checked.dropped.length };
}

export function bulletsAsText(bullets: { text: string }[]): string {
  return bullets.map((b) => `- ${b.text}`).join("\n");
}

// ---- the call ----------------------------------------------------------------------------------------------------------------------------------
export type BulletsOutcome =
  | { kind: "shown"; bullets: ShownBullet[]; dropped: number }
  | { kind: "none-passed" }
  | { kind: "failed"; line: string }
  | { kind: "access" }; // postJson has opened the access code box; the block goes back to its closed state

export type BulletsPhase =
  | { kind: "idle" }
  | { kind: "waiting" }
  | { kind: "shown"; bullets: ShownBullet[]; dropped: number }
  | { kind: "none-passed" }
  | { kind: "failed"; line: string };

type Post = (body: unknown, signal: AbortSignal) => Promise<PostResult>;

// The real sender: postJson with the abort signal given to the browser's call. `source: "ad"` opens the code box of the ad, as the ad reading does.
export function makePost(opts: { fetch?: typeof fetch; store?: Parameters<typeof postJson>[2]["store"] } = {}): Post {
  return (body, signal) => postJson("/api/bullets", body, { source: "ad", fetch: fetchWithSignal(signal, opts.fetch), store: opts.store });
}

const failed = (line: string): BulletsOutcome => ({ kind: "failed", line });

// ONE call, given up after `timeoutMs` (default 30 s); an answer that comes later is ignored. No retry here.
export async function askBullets(pairs: BulletPair[], deps: { post?: Post; timeoutMs?: number } = {}): Promise<BulletsOutcome> {
  const post = deps.post ?? makePost();
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<BulletsOutcome>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(failed(BULLETS_TIMEOUT_LINE));
    }, deps.timeoutMs ?? BULLETS_TIMEOUT_MS);
  });

  const work = (async (): Promise<BulletsOutcome> => {
    try {
      let sent: PostResult;
      try {
        sent = await post(requestBodyFor(pairs), controller.signal);
      } catch {
        return failed(controller.signal.aborted ? BULLETS_TIMEOUT_LINE : COULD_NOT_REACH_LINE);
      }
      if (sent.kind === "access") return { kind: "access" };
      const res = sent.res;
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof (data as { error?: unknown } | null)?.error === "string" ? ((data as { error: string }).error) : serverErrorLine(res.status);
        return failed(message);
      }
      const parsed = bulletsResponseSchema.safeParse(data);
      if (!parsed.success) return failed(BULLETS_FAILED_LINE);
      const checked = checkAnswer({ bullets: parsed.data.bullets }, pairs);
      return checked.shown.length > 0 ? { kind: "shown", bullets: checked.shown, dropped: checked.dropped } : { kind: "none-passed" };
    } catch {
      return failed(BULLETS_FAILED_LINE);
    }
  })();

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// One call per press and none while one is waiting.
export function createBulletsRunner(ask: (pairs: BulletPair[]) => Promise<BulletsOutcome> = (pairs) => askBullets(pairs)) {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    press(pairs: BulletPair[]): Promise<BulletsOutcome> | null {
      if (busy) return null;
      busy = true;
      return (async () => {
        try {
          return await ask(pairs);
        } catch {
          return failed(BULLETS_FAILED_LINE);
        } finally {
          busy = false;
        }
      })();
    },
  };
}
