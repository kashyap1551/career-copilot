import { describe, expect, it, vi } from "vitest";

// 6.1 part 2, step 1: openJob never throws. A saved record is read on every visit, so one that made openJob throw would
// break the page every time. buildJob (the only part that can throw) is replaced by one that throws.
// Hand-worked expectation: a throw from the re-check gives the SAME outcome as "no extraction": "cannot-recheck", the
// stored reading shown unchanged, a re-read offered. No exception escapes.

vi.mock("@/lib/engine/fromAd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine/fromAd")>();
  return { ...actual, buildJob: vi.fn(() => { throw new Error("buildJob blew up on a stored extraction"); }) };
});

import { skills } from "@/fixtures/skills";
import { openJob } from "@/lib/saved/openJob";
import type { SavedJob } from "@/lib/saved/types";

const STORED_READING = {
  job: { id: "pasted-ad", title: "Analyst", company: null, source: null, constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] }, requirements: [] },
  removed: [], moved: [], unlisted: [], notCounted: [],
};
const EXTRACTION = {
  title: null, company: null, location: null, workMode: null, minYears: null, startDate: null, languages: [], otherConditions: [], requirements: [],
};
const record = { schemaVersion: 1, id: "x", savedAt: "2026-11-16T10:00:00.000Z", adText: "An ad.", extraction: EXTRACTION, reading: STORED_READING, stamps: { vocabularyHash: "old", readingVersion: "2", adRequestHash: "ad-1" } } as SavedJob;

describe("openJob never throws", () => {
  it("X1: when the re-check throws, the outcome is 'cannot-recheck' with the stored reading and a re-read offered", () => {
    const stamps = { vocabularyHash: "new", readingVersion: "2", adRequestHash: "ad-1" }; // vocabulary differs: a re-check is due
    let opened: ReturnType<typeof openJob> | undefined;
    expect(() => { opened = openJob(record, { stamps, skills }); }).not.toThrow();
    expect(opened).toEqual({ kind: "cannot-recheck", reading: STORED_READING, offerReread: true });
  });

  it("X2: the other outcomes are untouched by the safety net (everything equal: as stored)", () => {
    const same = { vocabularyHash: "old", readingVersion: "2", adRequestHash: "ad-1" };
    expect(openJob(record, { stamps: same, skills })).toEqual({ kind: "as-stored", reading: STORED_READING });
  });
});
