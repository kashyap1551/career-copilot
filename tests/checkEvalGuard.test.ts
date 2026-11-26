import { describe, expect, it, vi } from "vitest";
import { checkHashRefusal, firstCheckRefusal } from "@/lib/engine/evalEveryCvCheckGuard";
import { checkEveryCvKey } from "@/lib/engine/evalEveryCvKey";

// EC-5a (docs/PLAN-EVERY-CV.md, the check eval; tests EG1 to EG3): the conditions of a REAL run of `npm run eval-check`. Pure code. Each answers null
// (allowed) or one sentence; the first failing one is reported, in the owner's order: the guard variables, EVERY_CV_GO, ten complete keys, no
// uncommitted change under fixtures/every-cv, the baseline, no example pair; then (a counted run) no --pairs.

const complete = (id: string) => ({ id, check: checkEveryCvKey('R1 [must] "A."\nverdict: met\ncv line(s): 1\nunsure:\nwhy:', "A.", 3) });
const blank = (id: string) => ({ id, check: checkEveryCvKey('R1 [must] "A."\nverdict:\ncv line(s):\nunsure:\nwhy:', "A.", 3) });
const ten = (mk = complete) => Array.from({ length: 10 }, (_, i) => mk(`pair-${String(i + 1).padStart(2, "0")}`));
const ENV = { EXPECT_CHECK_REQUEST_HASH: "61d7628d46", EXPECT_CHECK_INSTRUCTIONS_LEN: "2665", EVERY_CV_GO: "yes" };
const facts = (over: Record<string, unknown> = {}) => ({
  env: { ...ENV } as Record<string, string | undefined>,
  tenKeys: ten(),
  gitDirty: () => false,
  baseline: () => null as string | null,
  runList: ten().map((k) => k.id),
  counted: true,
  pairsGiven: false,
  ...over,
});

describe("EC-5a the guards (EG)", () => {
  it("EG1: all conditions hold: allowed. Each failing condition gives its own sentence, and they are asked in the owner's order", () => {
    expect(firstCheckRefusal(facts())).toBeNull();
    expect(firstCheckRefusal(facts({ env: {} }))).toMatch(/EXPECT_CHECK_REQUEST_HASH, EXPECT_CHECK_INSTRUCTIONS_LEN must be set.*No AI call was made/);
    expect(firstCheckRefusal(facts({ env: { EXPECT_CHECK_REQUEST_HASH: "61d7628d46", EXPECT_CHECK_INSTRUCTIONS_LEN: "2665" } }))).toMatch(/EVERY_CV_GO=yes is not set/);
    expect(firstCheckRefusal(facts({ tenKeys: [...ten().slice(0, 9), blank("pair-10")] }))).toMatch(/not all ten keys are complete/);
    expect(firstCheckRefusal(facts({ gitDirty: () => true }))).toMatch(/uncommitted changes under fixtures\/every-cv/);
    expect(firstCheckRefusal(facts({ baseline: () => "Refused: the baseline does not match today's fingerprint. No AI call was made." }))).toMatch(/baseline does not match/);
    expect(firstCheckRefusal(facts({ runList: ["example"] }))).toMatch(/example pair/);
    // order: everything wrong at once reports the guard variables first; fix them and the next one is reported
    const allWrong = facts({ env: {}, tenKeys: ten(blank), gitDirty: () => true, baseline: () => "baseline", runList: ["example"] });
    expect(firstCheckRefusal(allWrong)).toMatch(/EXPECT_CHECK/);
    expect(firstCheckRefusal({ ...allWrong, env: { ...ENV, EVERY_CV_GO: "" } })).toMatch(/EVERY_CV_GO/);
    expect(firstCheckRefusal({ ...allWrong, env: { ...ENV } })).toMatch(/ten keys/);
    expect(firstCheckRefusal({ ...allWrong, env: { ...ENV }, tenKeys: ten() })).toMatch(/uncommitted/);
    expect(firstCheckRefusal({ ...allWrong, env: { ...ENV }, tenKeys: ten(), gitDirty: () => false })).toBe("baseline");
    expect(firstCheckRefusal({ ...allWrong, env: { ...ENV }, tenKeys: ten(), gitDirty: () => false, baseline: () => null })).toMatch(/example/);
  });

  it("EG1b: the baseline question is asked only when the earlier conditions hold (it may need the readers to be loaded)", () => {
    const baseline = vi.fn(() => null as string | null);
    firstCheckRefusal(facts({ env: {}, baseline }));
    firstCheckRefusal(facts({ gitDirty: () => true, baseline }));
    expect(baseline).not.toHaveBeenCalled();
    firstCheckRefusal(facts({ baseline }));
    expect(baseline).toHaveBeenCalledTimes(1);
  });

  it("EG2: a wrong hash or a wrong length is refused with 'No AI call was made'; the right ones are allowed", () => {
    const env = { EXPECT_CHECK_REQUEST_HASH: "61d7628d46", EXPECT_CHECK_INSTRUCTIONS_LEN: "2,665" };
    expect(checkHashRefusal(env, "61d7628d46", 2665)).toBeNull();
    expect(checkHashRefusal(env, "0123456789", 2665)).toMatch(/request hash is 0123456789, expected 61d7628d46.*No AI call was made/);
    expect(checkHashRefusal(env, "61d7628d46", 2664)).toMatch(/INSTRUCTIONS is 2664 characters, expected 2665.*No AI call was made/);
  });

  it("EG3: a counted run needs all ten pairs: --pairs with a counted run is refused; a calibration run may use it", () => {
    expect(firstCheckRefusal(facts({ counted: true, pairsGiven: true }))).toMatch(/counted run needs all ten pairs/);
    expect(firstCheckRefusal(facts({ counted: false, pairsGiven: true }))).toBeNull();
  });
});
