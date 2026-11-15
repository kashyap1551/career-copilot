import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import type { AnswerKey } from "@/lib/engine/answerKey";
import { formatShow, showRefusal } from "@/lib/engine/evalShow";
import type { EvalAd } from "@/lib/engine/evalRun";
import type { BuildResult } from "@/lib/engine/fromAd";

// C4 (docs/PLAN-3.3.md): `npm run eval -- --show <ad id>` prints the AI's
// reading next to the key, for tuning ads only. It must refuse the holdout
// before any AI call. Expected results were worked out by hand.

const HOLDOUT = new Set(["ad-09", "ad-10"]);

describe("showRefusal: the holdout is refused before anything is read", () => {
  it.each(["ad-09", "ad-10", "AD-09", " ad-10 "])("%j is refused", (id) => {
    const message = showRefusal(id, HOLDOUT);
    expect(message).not.toBeNull();
    expect(message).toContain("holdout");
  });

  it.each(["ad-01", "ad-08", "barista-injection"])("%j is allowed", (id) => {
    expect(showRefusal(id, HOLDOUT)).toBeNull();
  });

  it("the refusal does not repeat anything but the id", () => {
    expect(showRefusal("ad-09", HOLDOUT)).toBe("Refused: ad-09 is a holdout ad. --show only works on tuning ads, and the holdout stays unseen until the owner says tuning is done.");
  });
});

const key: AnswerKey = {
  ad: "ad-02", status: "reviewed", title: "Role A", company: "Acme", location: "Frankfurt am Main",
  workMode: null, minYears: { years: 3, quote: "3 years" }, startDate: null,
  languages: [{ code: "de", level: "C1", quote: "Fluent German" }],
  otherConditions: [{ quote: "Degree required." }],
  requirements: [
    { quote: "SQL needed", importance: "must", skills: ["SQL"] },
    { quote: "Python helps", importance: "nice", skills: ["Python"] },
  ],
  acceptedExtras: [{ quote: "Docker is welcome" }],
};
const result: BuildResult = {
  job: {
    id: "x", title: "Role A", company: "Acme GmbH", source: null,
    constraints: {
      languages: [{ code: "de", level: "B2" }], location: null, remote: null, minYears: 3, startDate: null,
      otherConditions: [{ quote: "Degree required." }, { quote: "Frankfurt am Main, Frankfurt" }],
    },
    requirements: [
      { skillIds: ["sql"], importance: "must", quote: "SQL needed" },
      { skillIds: ["new:docker"], importance: "nice", quote: "Docker is welcome" },
      { skillIds: ["new:kubernetes"], importance: "must", quote: "Kubernetes wanted" },
    ],
  },
  removed: [{ what: "workMode", why: "tag-not-sentence", text: "#LI-onsite" }],
  moved: [], unlisted: [],
};
const ad: EvalAd = { id: "ad-02", text: "x", key, holdout: false, known: false };

describe("formatShow", () => {
  const text = formatShow(ad, result, skills);

  it("puts the key and the AI side by side for each constraint", () => {
    expect(text).toContain('location   : key "Frankfurt am Main" | AI nothing');
    expect(text).toContain('company    : key "Acme" | AI "Acme GmbH"');
    expect(text).toContain("years      : key 3 | AI 3");
    expect(text).toContain("languages  : key de C1 | AI de B2");
  });

  it("shows the conditions of both sides", () => {
    expect(text).toContain('key: "Degree required."');
    expect(text).toContain('AI: "Degree required."; "Frankfurt am Main, Frankfurt"');
  });

  it("shows each key item as paired or missed, and each extra as accepted or invented", () => {
    expect(text).toContain('paired  must "SQL needed" [SQL] <-> AI must "SQL needed" [sql]');
    expect(text).toContain('MISSED  nice "Python helps" [Python]');
    expect(text).toContain('EXTRA (accepted) nice "Docker is welcome" [new:docker]');
    expect(text).toContain('EXTRA (invented) must "Kubernetes wanted" [new:kubernetes]');
  });

  it("lists what the check removed", () => {
    expect(text).toContain('workMode (tag-not-sentence): "#LI-onsite"');
  });

  it("refuses to format a holdout ad, whatever the caller says", () => {
    expect(() => formatShow({ ...ad, holdout: true }, result, skills)).toThrow(/holdout/);
  });
});
