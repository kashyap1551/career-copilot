import { describe, expect, it } from "vitest";
import { ALL_DELETED, deleteStatus, openMessage } from "@/lib/saved/messages";
import { adStatusKey, canSaveAd, jobRows, listNotice, openView, statusVisible } from "@/lib/saved/ui";
import type { SavedJob } from "@/lib/saved/types";

// 6.1 part 3c: the words and decisions for saved ads, as plain functions (the components only wire them). Hand-worked
// expectations are in the comments.

const job = (id: string, savedAt: string, title: string, company: string | null): SavedJob =>
  ({
    schemaVersion: 1, id, savedAt, adText: `Ad ${id}`, extraction: null,
    reading: { job: { id: "pasted-ad", title, company, source: null, constraints: { languages: [], location: null, remote: null, minYears: null, startDate: null, otherConditions: [] }, requirements: [] }, removed: [], moved: [], unlisted: [], notCounted: [] },
    stamps: { vocabularyHash: "v", readingVersion: "3", adRequestHash: "a" },
  }) as SavedJob;

describe("jobRows: newest first, one plain row each", () => {
  // By hand: A saved 2026-11-15 08:00, B 2026-11-16 09:00, C 2026-11-16 18:00. Newest first: C, B, A.
  const A = job("a", "2026-11-15T08:00:00.000Z", "Analyst", "Acme");
  const B = job("b", "2026-11-16T09:00:00.000Z", "Designer", null);
  const C = job("c", "2026-11-16T18:00:00.000Z", "Planner", "Beta GmbH");

  it("R1: the order is 18:00, 09:00, then the day before, whatever order they are listed in", () => {
    for (const input of [[A, B, C], [C, B, A], [B, A, C]]) expect(jobRows(input).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("R2: the label is 'Title, Company', or only 'Title' when the company is null; the date is the first 10 characters of savedAt", () => {
    expect(jobRows([A, B, C])).toEqual([
      { id: "c", label: "Planner, Beta GmbH", date: "2026-11-16" },
      { id: "b", label: "Designer", date: "2026-11-16" },
      { id: "a", label: "Analyst, Acme", date: "2026-11-15" },
    ]);
  });

  it("R3: the same savedAt is ordered by id, so the list never jumps", () => {
    const x = job("x", "2026-11-16T09:00:00.000Z", "T", null);
    const y = job("y", "2026-11-16T09:00:00.000Z", "T", null);
    expect(jobRows([y, x]).map((r) => r.id)).toEqual(["x", "y"]);
  });

  it("R4: 15 saved ads: 15 rows, newest first (the 15-ad check of the plan, in logic)", () => {
    const many = Array.from({ length: 15 }, (_, i) => job(`id${String(i).padStart(2, "0")}`, `2026-11-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`, `Job ${i}`, null));
    const rows = jobRows(many);
    expect(rows).toHaveLength(15);
    expect(rows[0].id).toBe("id14");
    expect(rows[14].id).toBe("id00");
  });

  it("R5: no ads, no rows", () => {
    expect(jobRows([])).toEqual([]);
  });
});

describe("listNotice", () => {
  it("L1: nothing to say when both counts are 0", () => {
    expect(listNotice(0, 0)).toBeNull();
  });
  it("L2: ads that could not be read: singular and plural", () => {
    expect(listNotice(1, 0)).toEqual(["1 saved ad could not be read."]);
    expect(listNotice(3, 0)).toEqual(["3 saved ads could not be read."]);
  });
  it("L3: ads from a newer version: singular and plural", () => {
    expect(listNotice(0, 1)).toEqual(["1 saved ad was saved by a newer version of the app and is left untouched."]);
    expect(listNotice(0, 2)).toEqual(["2 saved ads were saved by a newer version of the app and are left untouched."]);
  });
  it("L4: both kinds: both lines, the unreadable one first", () => {
    expect(listNotice(2, 1)).toEqual([
      "2 saved ads could not be read.",
      "1 saved ad was saved by a newer version of the app and is left untouched.",
    ]);
  });
});

describe("openMessage and openView: the five outcomes of openJob", () => {
  it("O1: exact strings (the outcome names are those of lib/saved/openJob.ts)", () => {
    expect(openMessage("newer-version")).toBe("This ad was saved by a newer version of the app, so it is left untouched.");
    expect(openMessage("as-stored")).toBeNull();
    expect(openMessage("rechecked")).toBe("Checked again on this device with the current skill list. The saved copy was not changed, and no AI call was made.");
    expect(openMessage("older-instructions")).toBe("This ad was read with older instructions for the AI, so you see the old reading. You can read it again with the AI (one AI call).");
    expect(openMessage("cannot-recheck")).toBe("This saved ad cannot be checked again here, so you see the old reading. You can read it again with the AI (one AI call).");
  });

  // By hand: newer-version shows only the message and opens nothing; as-stored and rechecked show the reading like a fresh
  // one; older-instructions and cannot-recheck show the OLD reading and offer "Read it again with the AI" (nothing is
  // called until that click). Only those two offer a re-read.
  it("O2: what the page does for each outcome", () => {
    expect(openView("newer-version")).toEqual({ showReading: false, offerReread: false, message: openMessage("newer-version") });
    expect(openView("as-stored")).toEqual({ showReading: true, offerReread: false, message: null });
    expect(openView("rechecked")).toEqual({ showReading: true, offerReread: false, message: openMessage("rechecked") });
    expect(openView("older-instructions")).toEqual({ showReading: true, offerReread: true, message: openMessage("older-instructions") });
    expect(openView("cannot-recheck")).toEqual({ showReading: true, offerReread: true, message: openMessage("cannot-recheck") });
  });
});

describe("a status about a saved ad is tied to the ad text on screen", () => {
  it("A1: the key is the trimmed ad text: outer spaces do not matter, a different ad is a different key", () => {
    expect(adStatusKey("  An ad about SQL.\n")).toBe("An ad about SQL.");
    expect(adStatusKey("An ad about SQL.")).toBe(adStatusKey("  An ad about SQL.  "));
    expect(adStatusKey("An ad about SQL.")).not.toBe(adStatusKey("An ad about Excel."));
  });

  it("A2: a message about an ad is shown only while that ad's text is on screen (statusVisible, with the keys of what is on screen)", () => {
    const status = { text: "Saved on this device.", key: adStatusKey("An ad about SQL.") };
    expect(statusVisible(status, [adStatusKey("An ad about SQL."), "some-profile-key"])).toBe(true);
    expect(statusVisible(status, [adStatusKey("An ad about Excel."), "some-profile-key"])).toBe(false);
    expect(statusVisible(status, [null, null])).toBe(false);
    expect(statusVisible({ text: ALL_DELETED, key: null }, [adStatusKey("Anything.")])).toBe(true);
  });
});

describe("deleting one ad", () => {
  it("D1: the texts: success, and a failure that never says 'saving did not work'", () => {
    expect(deleteStatus({ ok: true }, "ad")).toBe("The saved ad was deleted.");
    const failed = deleteStatus({ ok: false, reason: "failed" }, "ad");
    expect(failed).toBe("Could not delete the saved ad. Try again, or clear this site's data in your browser settings.");
    expect(failed.toLowerCase()).not.toContain("saving did not work");
  });
});

describe("canSaveAd", () => {
  it("S1: the Save this ad button is shown only when saving is available AND the ad on screen was just read by the AI", () => {
    expect(canSaveAd(true, true)).toBe(true);
    expect(canSaveAd(true, false)).toBe(false); // an opened saved ad: saving it again would be a write-back
    expect(canSaveAd(false, true)).toBe(false);
    expect(canSaveAd(false, false)).toBe(false);
  });
});
