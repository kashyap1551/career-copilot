import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { keptLineText, UNLISTED_TAG } from "@/lib/cv/confirmWording";

// EC-2 part 3 (docs/PLAN-EVERY-CV.md 4.1): the confirm box no longer says an unlisted skill "can't be matched with an ad": it is kept, with its CV line,
// and checked against an ad by the AI. DRAFT wording, the owner approves it. The two places say the same thing.
const src = readFileSync(join(process.cwd(), "app/ConfirmBox.tsx"), "utf8");

describe("EC-2 the confirm box wording", () => {
  it("W1: the two strings, word for word", () => {
    expect(UNLISTED_TAG).toBe("not in our skill list yet; it is checked against an ad by the AI, with your CV line as proof");
    expect(keptLineText(3)).toBe("kept with CV line 3 (checked against an ad by the AI)");
    expect(keptLineText(12)).toBe("kept with CV line 12 (checked against an ad by the AI)");
  });

  it("W2: the skill rows use the tag, the list of unlisted names uses the kept-line text for a name from the CV, and the old sentence stays for hand-added and in-progress names", () => {
    expect(src).toContain("UNLISTED_TAG");
    expect(src).toContain("keptLineText(");
    expect(src).not.toContain("can't be matched with an ad");
    expect(src.match(/can&apos;t be matched with your CV/g)).toHaveLength(1); // only the hand-added / in-progress wording is left
    expect(src).toMatch(/added by hand/);
    expect(src).toMatch(/in progress/);
  });
});
