import { beforeEach, describe, expect, it, vi } from "vitest";

// Step 3.3 part 4a: readJobAd asks the model with the one settings object.
// generateText is a fake, so no AI is called.

const generateText = vi.fn();
vi.mock("ai", async (importActual) => {
  const actual = await importActual<typeof import("ai")>();
  return { ...actual, generateText: (...args: unknown[]) => generateText(...args) };
});
vi.mock("@/lib/ai/model", () => ({
  getModel: () => "fake-model",
  MissingSettingError: class extends Error {},
}));

import { readJobAd } from "@/lib/ai/readJob";
import { GENERATION_SETTINGS } from "@/lib/ai/settings";

const emptyReading = {
  title: null, company: null, location: null, workMode: null, minYears: null, startDate: null,
  languages: [], otherConditions: [], requirements: [],
};

describe("readJobAd call settings", () => {
  beforeEach(() => {
    generateText.mockReset();
    generateText.mockResolvedValue({ output: emptyReading, usage: { inputTokens: 1, outputTokens: 2 }, response: { headers: {} } });
  });

  it("passes temperature, seed and the reasoning effort from the settings object", async () => {
    await readJobAd("A job ad text.");
    const call = generateText.mock.calls[0][0];
    // Each one must really be there: a missing setting would equal a missing setting.
    expect(call.temperature).toBe(0);
    expect(Number.isInteger(call.seed)).toBe(true);
    expect(call.providerOptions).toEqual({ groq: { reasoningEffort: "medium" } });
    expect(call.temperature).toBe(GENERATION_SETTINGS.temperature);
    expect(call.seed).toBe(GENERATION_SETTINGS.seed);
    expect(call.providerOptions).toEqual(GENERATION_SETTINGS.providerOptions);
  });
});
