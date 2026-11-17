import { describe, expect, it } from "vitest";
import { roadmapAds } from "@/app/roadmap";
import type { OpenedAd } from "@/app/savedAdRows";
import type { SavedReading } from "@/lib/saved/types";
import { ad1, ad2 } from "./support/roadmapFixtures";

// Step 7.1 (docs/PLAN-7.1.md section 2): which opened saved ads the "What to learn" box reads. Invented ads only.
const reading = (job: ReturnType<typeof ad1>) => ({ job, removed: [], moved: [], unlisted: [], notCounted: [] }) as unknown as SavedReading;
const opened = (id: string, o: OpenedAd["opened"]): OpenedAd => ({ id, savedAt: "2026-11-17T10:00:00Z", titleLine: id, date: "2026-11-17", opened: o });

describe("roadmapAds: the saved ads the box can read", () => {
  it("R1: every way of opening that gives a reading is an ad, in the list's order (hand count: 4 of 4)", () => {
    const r = reading(ad1());
    const list = [
      opened("s1", { kind: "as-stored", reading: r }),
      opened("s2", { kind: "rechecked", reading: r }),
      opened("s3", { kind: "older-instructions", reading: r, offerReread: true }),
      opened("s4", { kind: "cannot-recheck", reading: r, offerReread: true }),
    ];
    expect(roadmapAds(list).map((a) => a.id)).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("R2: a record that could not be opened, and one saved by a newer app, are not ads here (hand count: 1 of 3)", () => {
    const list = [
      opened("ok", { kind: "as-stored", reading: reading(ad2()) }),
      opened("bad", { kind: "failed" }),
      opened("new", { kind: "newer-version" }),
    ];
    const ads = roadmapAds(list);
    expect(ads.map((a) => a.id)).toEqual(["ok"]);
    expect(ads[0].job.title).toBe("BI Developer");
  });
});
