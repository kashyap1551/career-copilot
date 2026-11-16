import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { READ_CACHE_CAPACITY, ReadCache, readingKey, readThroughCache, type CachedReading } from "@/lib/ai/readCache";
import { READING_VERSION } from "@/lib/ai/readingVersion";
import { vocabHash } from "@/lib/engine/vocabHash";

// Step 5.3, the reading cache (memory only, inside the running server). Every expectation was worked out by hand before
// the code. The cache stores the reading the route answers with ({ job, removed, moved, unlisted, notCounted }), keyed by
// SHA-256 of READING_VERSION, the vocabulary hash and the cleaned ad text; capacity 20, least recently used dropped.

let n = 0;
const reading = (title = "Job"): CachedReading => ({
  job: { id: "pasted-ad", title, company: null, source: null, constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] }, requirements: [{ quote: "SQL needed", importance: "must", skillIds: ["sql"] }] },
  removed: [], moved: [], unlisted: [], notCounted: [{ quote: "team player", importance: "must" }],
  extraction: { title, company: null, location: null, workMode: null, minYears: null, startDate: null, languages: [], otherConditions: [], requirements: [] }, // 6.1: extraction added
});
const stub = () => vi.fn(async (text: string) => ({ ...reading(`Read ${++n} of ${text.length}`), usage: { inputTokens: 5, outputTokens: 6 } }));

afterEach(() => vi.restoreAllMocks());

describe("the key", () => {
  it("K1: the same text gives the same key; another text another key; the key is a 64-character hex digest, not the text", () => {
    const a = readingKey("An ad about SQL work.");
    expect(readingKey("An ad about SQL work.")).toBe(a);
    expect(readingKey("An ad about Excel work.")).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain("SQL");
  });

  it("K2 (test 9): READING_VERSION is in the key: another version, the same ad, is a miss", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = stub();
    await readThroughCache("Same ad", read, { cache, version: "v1" });
    const other = await readThroughCache("Same ad", read, { cache, version: "v2" });
    expect(other.source).toBe("miss");
    expect(read).toHaveBeenCalledTimes(2);
    expect((await readThroughCache("Same ad", read, { cache, version: "v1" })).source).toBe("hit"); // the first entry is still there
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("K3 (test 10): the vocabulary hash is in the key: another vocabulary, the same ad, is a miss", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = stub();
    await readThroughCache("Same ad", read, { cache, vocab: "aaaa" });
    expect((await readThroughCache("Same ad", read, { cache, vocab: "bbbb" })).source).toBe("miss");
    expect(read).toHaveBeenCalledTimes(2);
    expect((await readThroughCache("Same ad", read, { cache, vocab: "aaaa" })).source).toBe("hit");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("K4: by default the key uses the real READING_VERSION and the real vocabulary hash", () => {
    expect(readingKey("x")).toBe(readingKey("x", { version: READING_VERSION, vocab: vocabHash() }));
    expect(readingKey("x")).not.toBe(readingKey("x", { version: READING_VERSION, vocab: "other" }));
    expect(readingKey("x")).not.toBe(readingKey("x", { version: READING_VERSION + "-next", vocab: vocabHash() }));
  });
});

describe("hit and miss, failures, copies", () => {
  it("C1: the same ad twice: the reader is called once; miss, then hit with the same reading", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = stub();
    const first = await readThroughCache("Ad one", read, { cache });
    const second = await readThroughCache("Ad one", read, { cache });
    expect(read).toHaveBeenCalledTimes(1);
    expect([first.source, second.source]).toEqual(["miss", "hit"]);
    expect(second.reading).toEqual(first.reading);
  });

  it("C2: what is stored is the reading only: no usage, no limits", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const r = await readThroughCache("Ad one", stub(), { cache });
    expect(Object.keys(r.reading).sort()).toEqual(["extraction", "job", "moved", "notCounted", "removed", "unlisted"]); // 6.1: extraction added
    expect(JSON.stringify(cache.values())).not.toContain("usage");
  });

  it("C3 (test 4): a failure is not cached: the reader throws once, then works: two calls, the second is a miss and is correct", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = vi.fn<(t: string) => Promise<CachedReading>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(reading("Good"));
    await expect(readThroughCache("Ad one", read, { cache })).rejects.toThrow("boom");
    expect(cache.size).toBe(0);
    const again = await readThroughCache("Ad one", read, { cache });
    expect(read).toHaveBeenCalledTimes(2);
    expect(again.source).toBe("miss");
    expect(again.reading.job.title).toBe("Good");
    expect((await readThroughCache("Ad one", read, { cache })).source).toBe("hit");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("C4 (test 6): a hit returns a copy: change it, read again, the third result equals the first", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = stub();
    const first = await readThroughCache("Ad one", read, { cache });
    const snapshot = JSON.parse(JSON.stringify(first.reading));
    const second = await readThroughCache("Ad one", read, { cache });
    second.reading.job.title = "CHANGED";
    second.reading.job.requirements.push({ quote: "invented", importance: "must", skillIds: ["x"] });
    second.reading.notCounted.length = 0;
    const third = await readThroughCache("Ad one", read, { cache });
    expect(third.reading).toEqual(snapshot);
    expect(third.reading).toEqual(first.reading);
  });

  it("C6 (6.1): a hit returns the same extraction as the miss, and as a copy", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = stub();
    const first = await readThroughCache("Ad one", read, { cache });
    const second = await readThroughCache("Ad one", read, { cache });
    expect(second.reading.extraction).toEqual(first.reading.extraction);
    second.reading.extraction.title = "CHANGED";
    expect((await readThroughCache("Ad one", read, { cache })).reading.extraction).toEqual(first.reading.extraction);
  });

  it("C5: what a MISS returns is not the stored object either: changing it does not change the entry", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = stub();
    const first = await readThroughCache("Ad one", read, { cache });
    const snapshot = JSON.parse(JSON.stringify(first.reading));
    first.reading.job.title = "CHANGED";
    expect((await readThroughCache("Ad one", read, { cache })).reading).toEqual(snapshot);
  });
});

describe("capacity and eviction (test 5, worked out by hand)", () => {
  it("E1: A1..A20 is 20 calls; A1 again is a hit (still 20); A21 is a miss (21) and drops A2; A1 is a hit (21); A2 is a miss (22)", async () => {
    expect(READ_CACHE_CAPACITY).toBe(20);
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = stub();
    const ad = (i: number) => `Ad number ${i}`;
    for (let i = 1; i <= 20; i++) expect((await readThroughCache(ad(i), read, { cache })).source).toBe("miss");
    expect(read).toHaveBeenCalledTimes(20);
    expect((await readThroughCache(ad(1), read, { cache })).source).toBe("hit"); // the hit is a use: A1 is now the newest
    expect(read).toHaveBeenCalledTimes(20);
    expect((await readThroughCache(ad(21), read, { cache })).source).toBe("miss"); // full: the oldest is A2, so A2 goes
    expect(read).toHaveBeenCalledTimes(21);
    expect((await readThroughCache(ad(1), read, { cache })).source).toBe("hit"); // A1 survived because the hit refreshed it
    expect(read).toHaveBeenCalledTimes(21);
    expect((await readThroughCache(ad(2), read, { cache })).source).toBe("miss"); // A2 was dropped; this adds A2 and drops A3
    expect(read).toHaveBeenCalledTimes(22);
    expect(cache.size).toBe(20);
  });
});

describe("no ad text anywhere (test 11)", () => {
  const AD = "We are looking for a careful analyst who writes SQL every day and explains the numbers to the whole team in plain words.";

  it("N1: nothing is logged during a miss, a hit or a failure, and no logged argument holds a 40-character slice of the ad", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    const read = stub();
    await readThroughCache(AD, read, { cache });
    await readThroughCache(AD, read, { cache });
    await readThroughCache("Another " + AD, vi.fn(async () => { throw new Error(AD); }), { cache }).catch(() => {});
    const logged = spies.flatMap((s) => s.mock.calls.flat()).map((a) => (typeof a === "string" ? a : JSON.stringify(a)));
    for (let i = 0; i + 40 <= AD.length; i++) for (const line of logged) expect(line.includes(AD.slice(i, i + 40))).toBe(false);
  });

  it("N2: the stored value, serialised, does not hold the whole cleaned text; the keys hold no 40-character slice", async () => {
    const cache = new ReadCache(READ_CACHE_CAPACITY);
    await readThroughCache(AD, stub(), { cache });
    expect(JSON.stringify(cache.values())).not.toContain(AD);
    for (const key of cache.keys()) for (let i = 0; i + 40 <= AD.length; i++) expect(key.includes(AD.slice(i, i + 40))).toBe(false);
  });
});

describe("the cached reader is only for the route (test 13)", () => {
  const root = process.cwd();
  const filesIn = (dir: string): string[] =>
    fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? filesIn(path.join(dir, e.name)) : /\.(ts|tsx|mts)$/.test(e.name) ? [path.join(dir, e.name)] : [],
    );
  const importsCache = (file: string) => /readCache|readThroughCache/.test(fs.readFileSync(path.join(root, file), "utf8"));

  it("I1: no script, and nothing in lib/engine (where the eval code lives) or lib/eval, uses the cached reader", () => {
    const dirs = ["scripts", "lib/engine", "lib/vocab", "lib/cv", "lib/schemas"].concat(fs.existsSync(path.join(root, "lib/eval")) ? ["lib/eval"] : []);
    const offenders = dirs.flatMap(filesIn).filter(importsCache);
    expect(offenders).toEqual([]);
  });

  it("I2: and the ad route does use it (so the check above is not looking at the wrong place)", () => {
    expect(importsCache("app/api/read/route.ts")).toBe(true);
  });

  it("I3: the CV route does not", () => {
    expect(importsCache("app/api/cv/route.ts")).toBe(false);
  });
});
