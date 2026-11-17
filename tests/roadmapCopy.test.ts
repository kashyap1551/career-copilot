import { describe, expect, it, vi } from "vitest";
import { copyReport, shownCopyStatus } from "@/app/roadmapReport";

// Step 8.1, T25 (docs/PLAN-8.1.md section 7): the two pure copy helpers. Hand-worked expectations; the helpers are STUBS now.
// copyReport(text, write) calls write(text) exactly once and ALWAYS resolves: "copied" when the write resolves, "failed" when it rejects or
// throws synchronously (a missing navigator.clipboard throws before any promise exists). shownCopyStatus(record, currentText) shows the
// record's status only while the text it described is the text now on screen.

describe("T25: copyReport", () => {
  it("T25a: a write that resolves gives 'copied'; write is called exactly once, with exactly the text it was given", async () => {
    const write = vi.fn(async () => {});
    expect(await copyReport("alpha\n    beta", write)).toBe("copied");
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("alpha\n    beta");
  });

  it("T25b: a write that is refused (a rejected promise) gives 'failed'", async () => {
    const write = vi.fn(() => Promise.reject(new Error("denied")));
    expect(await copyReport("alpha", write)).toBe("failed");
  });

  it("T25c: a write that throws a TypeError synchronously (a missing clipboard) gives 'failed': the promise resolves, it does not reject", async () => {
    const write = vi.fn((): Promise<void> => {
      throw new TypeError("Cannot read properties of undefined (reading 'writeText')");
    });
    await expect(copyReport("alpha", write)).resolves.toBe("failed");
  });
});

describe("T25: shownCopyStatus", () => {
  it("T25d: the status of a copy of the text now on screen is shown, 'copied' and 'failed' alike", () => {
    expect(shownCopyStatus({ status: "copied", text: "A" }, "A")).toBe("copied");
    expect(shownCopyStatus({ status: "failed", text: "A" }, "A")).toBe("failed");
  });

  it("T25e: nothing is shown after the text changed, or before any copy (green on the stub; it bites through break B24)", () => {
    expect(shownCopyStatus({ status: "copied", text: "A" }, "B")).toBe("idle");
    expect(shownCopyStatus(null, "A")).toBe("idle");
  });
});
