import { describe, expect, it } from "vitest";
import { profileReport } from "@/app/fitReport";
import { roadmapBox } from "@/app/roadmap";
import { skills } from "@/fixtures/skills";
import type { BuiltProfile } from "@/lib/cv/profile";
import { roadmapBasis } from "@/lib/engine/roadmapJobs";
import type { Job } from "@/lib/engine/types";
import { FOUR, person as roadmapPerson } from "./support/roadmapFixtures";
import { EXCEL, INTAKE, job, KEPT_WOUND, person, SQL, UNLISTED, WOUND } from "./support/evidenceFixtures";

// EC-2 addition, part B: the roadmap's rule for which saved ads count (roadmapBasis) and its "(N must-haves not judged)" caveat now use what
// engineView says (couldNotJudge), so a same-name match is "met" in the roadmap exactly as in the report. Invented data; hand-worked.
//
// The person has SQL (line 2) and a kept "Wound care" (line 3). Every ad below is the same four must-haves unless a case says otherwise:
// SQL (met), Excel (missing), Wound care (unlisted, same-name match with the kept entry), Patient intake (unlisted, nothing keeps it).

const withKept = (): BuiltProfile => ({ ...person(), unlistedKept: [KEPT_WOUND] }) as BuiltProfile;
const ward = (n: string, requirements = [SQL, EXCEL, WOUND, INTAKE]): { id: string; job: Job } => ({ id: `ad-${n}`, job: { ...job(requirements), id: `ad-${n}`, title: `Ward ${n}` } });
const FOUR_WARDS = () => ["A", "B", "C", "D"].map((n) => ward(n));

describe("EC-2 addition B: the roadmap and the report agree on a same-name requirement", () => {
  it("RB1: the caveat count in the roadmap equals the report's not-judged count: 1 with the kept entry (Patient intake only), 2 without it", () => {
    const j = FOUR_WARDS()[0].job;
    expect(profileReport(j, withKept(), skills, UNLISTED).couldNotJudge.musts).toBe(1);
    expect(profileReport(j, person(), skills, UNLISTED).couldNotJudge.musts).toBe(2);
    // Excel is the only skill missing among the judged must-haves, so the roadmap lists the four ads as brought to Strong by Excel, each with its caveat.
    const lines = (b: BuiltProfile) => roadmapBox(b, FOUR_WARDS(), skills, 4).partB.join("\n");
    expect(lines(withKept())).toContain("Ward A, Brindle Clinic (1 must-have not judged)");
    expect(lines(withKept())).not.toContain("2 must-haves not judged");
    expect(lines(person())).toContain("Ward A, Brindle Clinic (2 must-haves not judged)");
  });

  it("RB2: an ad whose ONLY must-have is the same-name requirement counts with the kept entry, and is left out without it", () => {
    const ads = [ward("A"), ward("B"), ward("C"), ward("D", [WOUND])];
    const withIt = roadmapBox(withKept(), ads, skills, 4);
    expect(withIt.counted).toBe(4);
    expect(withIt.partA.some((l) => l.includes("is not counted"))).toBe(false);
    const without = roadmapBox(person(), ads, skills, 4);
    expect(without.counted).toBe(3);
    expect(without.partA).toContain("1 saved ad is not counted: the AI found no must-have we could judge in it.");
  });

  it("RB3: roadmapBasis(job) with no profile is what it was; with a profile that keeps nothing it is the same (every existing roadmap fixture)", () => {
    const rp = roadmapPerson();
    for (const j of [...FOUR(), job(), job([WOUND])]) {
      expect(roadmapBasis(j, rp.profile ? (roadmapPerson() as BuiltProfile) : null)).toEqual(roadmapBasis(j));
    }
  });

  it("RB4: with no kept entries the roadmap box is identical to today's for the four ads of the roadmap fixtures (and for an empty kept list)", () => {
    const rp = roadmapPerson();
    const asSaved = (jobs: Job[]) => jobs.map((j) => ({ id: j.id, job: j }));
    const plain = roadmapBox(rp, asSaved(FOUR()), skills, 4);
    expect(roadmapBox({ ...rp, unlistedKept: [] } as BuiltProfile, asSaved(FOUR()), skills, 4)).toEqual(plain);
    expect(plain.counted).toBe(4);
  });
});
