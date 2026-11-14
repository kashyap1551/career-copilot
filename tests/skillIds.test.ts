import { describe, expect, it } from "vitest";
import { skills } from "@/fixtures/skills";
import { skillIdFor } from "@/lib/engine/skillIds";

// Table section E of docs/PLAN-3.1.md, worked out by hand. The list is the
// 17 skills in fixtures/skills.ts.

const E: [string, string, string | null, boolean][] = [
  ["E1", "SQL", "sql", true],
  ["E2a", "  excel ", "excel", true],
  ["E2b", "EXCEL", "excel", true],
  ["E3", "Power BI", "power-bi", true],
  ["E4", "power-bi", "power-bi", true],
  ["E5", "Financial planning and analysis", "financial-planning", true],
  ["E6", "Financial planning", "financial-planning", true],
  ["E7", "Vitest", "vitest", true],
  ["E8", "MS Excel", "new:ms-excel", false],
  ["E9", "Docker Compose!", "new:docker-compose", false],
  ["E10", "C++", "new:c-plus-plus", false],
  ["E11", "C#", "new:c-sharp", false],
  ["E12", "Node.js", "new:node-js", false],
  ["E13", "Führerschein", "new:fuhrerschein", false],
  ["E14a", "???", null, false],
  ["E14b", "   ", null, false],
];

describe("skillIdFor", () => {
  it("the list has the 17 skills the table assumes", () => {
    expect(skills).toHaveLength(17);
  });

  it.each(E)("%s: %j gives %s", (_id, name, id, listed) => {
    const result = skillIdFor(name, skills);
    if (id === null) {
      expect(result).toBeNull();
    } else {
      expect(result).toEqual({ id, listed });
    }
  });

  it("the same unlisted name always gives the same id, however it is written", () => {
    expect(skillIdFor("Docker Compose", skills)?.id).toBe("new:docker-compose");
    expect(skillIdFor("docker-compose", skills)?.id).toBe("new:docker-compose");
    expect(skillIdFor("  DOCKER   compose ", skills)?.id).toBe("new:docker-compose");
  });
});
