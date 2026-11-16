import { createHash } from "node:crypto";
import { vocabHash } from "@/lib/engine/vocabHash";
import { READING_VERSION } from "./readingVersion";
import type { ReadResult } from "./readJob";

// The reading cache (step 5.3): pasting the same ad twice makes one AI call. Ad readings only; the CV route does not
// use it. Memory only, inside the running server: nothing goes to disk, a database or a log, and no ad text is logged.
//
// Key: SHA-256 of READING_VERSION, the vocabulary hash and the cleaned ad text (exactly the string sent to the AI),
// joined with a separator. Value: the reading the route answers with, never the raw ad text. Capacity 20; when full,
// the entry used least recently is dropped (a hit counts as a use). Failures are never stored. A hit returns a deep
// copy, so nothing a caller does can change what is stored.
//
// Known limits (docs/DECISIONS.md): (1) several warm server instances each have their own memory, so the same ad can
// still cost one call per instance; (2) two identical requests that arrive at the same moment are two calls; (3) the
// x-reading-cache header tells a caller the same text was read recently on that instance (accepted: job ads are public
// text). Only the ad route imports this file; scripts and the eval use the uncached reader (a test enforces it).

export const READ_CACHE_CAPACITY = 20;

// 6.1: `extraction` is the AI's raw reading, kept so a cache hit answers exactly like the miss.
export type CachedReading = Pick<ReadResult, "job" | "removed" | "moved" | "unlisted" | "notCounted" | "extraction">;
export type ReadSource = "hit" | "miss";

const SEPARATOR = "\u0000";

export type KeyParts = { version?: string; vocab?: string };

let memoVocab: string | null = null;
const currentVocab = () => (memoVocab ??= vocabHash());

export function readingKey(cleanedText: string, parts: KeyParts = {}): string {
  const version = parts.version ?? READING_VERSION;
  const vocab = parts.vocab ?? currentVocab();
  return createHash("sha256").update([version, vocab, cleanedText].join(SEPARATOR)).digest("hex");
}

export class ReadCache {
  private entries = new Map<string, CachedReading>();

  constructor(private readonly capacity: number) {}

  get size(): number {
    return this.entries.size;
  }

  // A hit counts as a use: the entry moves to the newest place. Returns a deep copy.
  get(key: string): CachedReading | undefined {
    const found = this.entries.get(key);
    if (found === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, found);
    return structuredClone(found);
  }

  set(key: string, value: CachedReading): void {
    this.entries.delete(key);
    this.entries.set(key, structuredClone(value));
    while (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  // For tests only: what is stored (never handed to a caller by the route).
  values(): CachedReading[] {
    return [...this.entries.values()];
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }
}

export const readCache = new ReadCache(READ_CACHE_CAPACITY);

export type ReadThroughOptions = KeyParts & { cache?: ReadCache };

// Look the ad up; on a miss, read it with `read` and keep the reading. If `read` throws, nothing is kept and the error
// goes on to the caller.
export async function readThroughCache(
  cleanedText: string,
  read: (text: string) => Promise<CachedReading>,
  options: ReadThroughOptions = {},
): Promise<{ reading: CachedReading; source: ReadSource }> {
  const cache = options.cache ?? readCache;
  const key = readingKey(cleanedText, options);
  const hit = cache.get(key);
  if (hit !== undefined) return { reading: hit, source: "hit" };
  const outcome = await read(cleanedText);
  const reading: CachedReading = {
    job: outcome.job,
    removed: outcome.removed,
    moved: outcome.moved,
    unlisted: outcome.unlisted,
    notCounted: outcome.notCounted,
    extraction: outcome.extraction,
  };
  cache.set(key, reading);
  return { reading, source: "miss" };
}
