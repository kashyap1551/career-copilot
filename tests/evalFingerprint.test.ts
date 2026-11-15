import { describe, expect, it } from "vitest";
import { GENERATION_SETTINGS } from "@/lib/ai/settings";
import { evalFingerprint, type FingerprintInput } from "@/lib/engine/evalFingerprint";

// Step 3.3 part 4a. Expectations worked out by hand: the same inputs give the
// same fingerprint, and changing any one thing gives a different one.

const base = (): FingerprintInput => ({
  instructions: "Read the ad.",
  model: "openai/gpt-oss-120b",
  settings: { temperature: 0, seed: 1, providerOptions: { groq: { reasoningEffort: "medium" } } },
  ads: [
    { id: "ad-01", text: "Text one", key: { a: 1 } },
    { id: "ad-02", text: "Text two", key: { a: 2 } },
  ],
});

describe("evalFingerprint", () => {
  it("is the same for the same inputs", () => {
    expect(evalFingerprint(base())).toBe(evalFingerprint(base()));
  });

  it("changes when the temperature changes", () => {
    const x = base();
    x.settings = { temperature: 0.5, seed: 1, providerOptions: { groq: { reasoningEffort: "medium" } } };
    expect(evalFingerprint(x)).not.toBe(evalFingerprint(base()));
  });

  it("changes when the seed changes", () => {
    const x = base();
    x.settings = { temperature: 0, seed: 2, providerOptions: { groq: { reasoningEffort: "medium" } } };
    expect(evalFingerprint(x)).not.toBe(evalFingerprint(base()));
  });

  it("changes when the reasoning effort changes", () => {
    const x = base();
    x.settings = { temperature: 0, seed: 1, providerOptions: { groq: { reasoningEffort: "high" } } };
    expect(evalFingerprint(x)).not.toBe(evalFingerprint(base()));
  });

  it("changes when a setting is added or removed", () => {
    const x = base();
    x.settings = { temperature: 0, seed: 1 };
    expect(evalFingerprint(x)).not.toBe(evalFingerprint(base()));
  });

  it("still changes with the prompt, the model, an ad text or a key", () => {
    const f = evalFingerprint(base());
    const a = base(); a.instructions = "Read the ad carefully.";
    const b = base(); b.model = "openai/gpt-oss-20b";
    const c = base(); c.ads[0].text = "Text one changed";
    const d = base(); d.ads[1].key = { a: 3 };
    for (const x of [a, b, c, d]) expect(evalFingerprint(x)).not.toBe(f);
  });

  it("the real settings object is what the fingerprint sees", () => {
    const withReal = { ...base(), settings: GENERATION_SETTINGS };
    const changed = { ...base(), settings: { ...GENERATION_SETTINGS, temperature: 1 } };
    expect(evalFingerprint(withReal)).not.toBe(evalFingerprint(changed));
  });
});

describe("the settings object", () => {
  it("holds temperature 0, a fixed integer seed and a reasoning effort gpt-oss accepts", () => {
    expect(GENERATION_SETTINGS.temperature).toBe(0);
    expect(Number.isInteger(GENERATION_SETTINGS.seed)).toBe(true);
    expect(["low", "medium", "high"]).toContain(GENERATION_SETTINGS.providerOptions.groq.reasoningEffort);
  });
});
