import { describe, expect, it } from "vitest";
import { skillIdFor, normalizeSkillName } from "@/lib/engine/skillIds";
import { isNotASkill, nameStatus, skills } from "@/lib/vocab";

// (b) normalisation and (c) mapping and must-not-merge, worked out by hand (docs/PLAN-5.1.md). Exact matching
// only: no close-spelling step yet (that is 5.2).

const id = (name: string) => skillIdFor(name, skills)?.id;
const listed = (name: string) => skillIdFor(name, skills)?.listed;

describe("normalizeSkillName", () => {
  const table: [string, string, string][] = [
    ["N1", "SQL-Kenntnisse", "sql"],
    ["N2", "SQL Kenntnisse", "sql"],
    ["N3", "Kenntnisse in SQL", "sql"],
    ["N4", "Excel (advanced)", "excel"],
    ["N5", "Advanced Excel", "excel"],
    ["N6", "Basic knowledge of Python", "python"],
    ["N7", "Python 3.11", "python"],
    ["N8", "Python 3", "python"],
    ["N9", "Strong SQL skills", "sql"],
    ["N10", "Grundkenntnisse in Excel", "excel"],
    ["N11", "Erfahrung mit Power BI", "power bi"],
    ["N12", "Datenanalyse", "datenanalyse"],
    ["N13", "QUALITÄTSMANAGEMENT", "qualitatsmanagement"],
    ["N14", "Öffentlichkeitsarbeit", "offentlichkeitsarbeit"],
    ["N15", "Verbesserungsmaßnahmen", "verbesserungsmassnahmen"],
    ["N16", "C++", "c plus plus"],
    ["N17", "C#", "c sharp"],
    ["N18", "P&L", "p and l"],
    ["N19", "ISO 9001", "iso 9001"],
    ["N20", "ISO 9001:2015", "iso 9001"],
    ["N21", "SQL Server 2019", "sql server"],
    ["N22", "Excel 365", "excel"],
    ["N23", "HTML5", "html5"],
    ["N24", "  Pivot-Tabellen  ", "pivot tabellen"],
  ];
  it.each(table)("%s: %j gives %j", (_n, input, want) => {
    expect(normalizeSkillName(input)).toBe(want);
  });

  it("N25: a name that is only filler words normalises to nothing", () => {
    expect(normalizeSkillName("Advanced knowledge")).toBe("");
    expect(normalizeSkillName("???")).toBe("");
  });
});

describe("skillIdFor with the vocabulary", () => {
  it("M1: the spellings of the plan's examples", () => {
    expect(id("SQL-Kenntnisse")).toBe("sql");
    for (const n of ["MS Excel", "Microsoft Excel", "Excel (advanced)", "Advanced Excel", "Excel-Kenntnisse", "excel"]) expect(id(n)).toBe("excel");
    for (const n of ["Python 3.11", "Python 3", "Python-Kenntnisse", "PYTHON"]) expect(id(n)).toBe("python");
  });

  it("M2: German and English names of one skill, any case, any umlaut", () => {
    for (const n of ["Datenanalyse", "DATENANALYSE", "Data analysis", "data analytics"]) expect(id(n)).toBe("data-analysis");
    for (const n of ["Qualitätsmanagement", "QUALITÄTSMANAGEMENT", "Qualitatsmanagement"]) expect(id(n)).toBe("quality-management");
    for (const n of ["Öffentlichkeitsarbeit", "Offentlichkeitsarbeit", "PR", "Public relations"]) expect(id(n)).toBe("public-relations");
    for (const n of ["Verbesserungsmaßnahmen", "Verbesserungsmassnahmen"]) expect(id(n)).toBe("process-improvement");
    for (const n of ["Teamfähigkeit", "teamfahigkeit", "Teamwork"]) expect(id(n)).toBe("teamwork");
    expect(id("Lieferkettenmanagement")).toBe("supply-chain-management");
    expect(id("Spedition")).toBe("freight-forwarding");
    expect(id("Schulung")).toBe("training");
    expect(id("Pivot-Tabellen")).toBe("pivot-tables");
  });

  it("M3: level and filler words are dropped on the second try", () => {
    expect(id("Strong SQL skills")).toBe("sql");
    expect(id("Erfahrung mit Power BI")).toBe("power-bi");
    expect(id("Kenntnisse in Tableau")).toBe("tableau");
    expect(id("Basic knowledge of Python")).toBe("python");
    expect(id("Grundkenntnisse in Excel")).toBe("excel");
  });

  it("M4: a trailing version number is dropped on the third try, and only for a known skill", () => {
    expect(id("SQL Server 2019")).toBe("sql-server");
    expect(id("Angular 17")).toBe("angular");
    expect(id("ISO 9001:2015")).toBe("iso-9001");
    expect(skillIdFor("ISO 12345", skills)).toEqual({ id: "new:iso-12345", listed: false });
  });

  it("M5: single letters and very common words match only an exact alias", () => {
    expect(id("R")).toBe("r-language");
    expect(id("r")).toBe("r-language");
    expect(id("R programming")).toBe("r-language");
    expect(id("C")).toBe("c-language");
    expect(id("Go")).toBe("go-language");
    expect(id("Golang")).toBe("go-language");
    for (const n of ["R (advanced)", "Advanced R", "Basic R", "C (advanced)", "Go (advanced)", "Knowledge of Go"]) expect(listed(n)).toBe(false);
    expect(skillIdFor("Advanced R", skills)).toEqual({ id: "new:advanced-r", listed: false });
  });

  it("M5b: the rule is general: any single-letter skill, even one not marked exact-only, matches only exactly", () => {
    const list = [{ id: "q", name: "Q" }];
    expect(skillIdFor("Q", list)).toEqual({ id: "q", listed: true });
    expect(skillIdFor("Advanced Q", list)).toEqual({ id: "new:advanced-q", listed: false });
    expect(skillIdFor("Q skills", list)).toEqual({ id: "new:q-skills", listed: false });
  });

  it("M6: aliases in doubt do not match (they are undecided)", () => {
    const names: [string, string][] = [
      ["QA", "new:qa"], ["Looker Studio", "new:looker-studio"], ["GitHub Actions", "new:github-actions"], ["analytics", "new:analytics"],
      ["GTM", "new:gtm"], ["SCM", "new:scm"], ["IMS", "new:ims"], ["Node", "new:node"], ["CSM", "new:csm"], ["PG", "new:pg"],
      ["version control", "new:version-control"], ["events", "new:events"], ["inventory", "new:inventory"], ["lean", "new:lean"],
      ["sourcing", "new:sourcing"], ["coaching", "new:coaching"], ["analytical", "new:analytical"], ["Tabellen", "new:tabellen"],
    ];
    for (const [n, want] of names) expect(skillIdFor(n, skills)).toEqual({ id: want, listed: false });
  });

  it("M7: the review fixes: no 'account growth', no 'online shop development', 'revenue conversations' is not a skill", () => {
    expect(skillIdFor("account growth", skills)).toEqual({ id: "new:account-growth", listed: false });
    expect(skillIdFor("Online shop development", skills)).toEqual({ id: "new:online-shop-development", listed: false });
    expect(skillIdFor("Revenue conversations", skills)).toEqual({ id: "new:revenue-conversations", listed: false });
    expect(isNotASkill("Revenue conversations")).toBe(true);
    expect(id("E-commerce")).toBe("e-commerce");
    expect(id("ecommerce")).toBe("e-commerce");
  });

  it("M7b: the owner's vetoes: 'task management' is not time management, 'partnership development' is not relationship management", () => {
    expect(skillIdFor("task management", skills)).toEqual({ id: "new:task-management", listed: false });
    expect(skillIdFor("partnership development", skills)).toEqual({ id: "new:partnership-development", listed: false });
    expect(id("Time management")).toBe("time-management");
    expect(id("manage multiple priorities")).toBe("time-management");
    expect(id("Relationship management")).toBe("relationship-management");
  });

  it("M8: HTML and CSS are two skills; 'HTML and CSS' as one name is not merged", () => {
    expect(id("HTML")).toBe("html");
    expect(id("HTML5")).toBe("html");
    expect(id("CSS3")).toBe("css");
    expect(skillIdFor("HTML and CSS", skills)).toEqual({ id: "new:html-and-css", listed: false });
  });

  it("M9: the old list style still works: a list without aliases gives exact matches only", () => {
    const plain = [{ id: "sql", name: "SQL" }, { id: "excel", name: "Excel" }];
    expect(skillIdFor("sql", plain)).toEqual({ id: "sql", listed: true });
    expect(skillIdFor("MS Excel", plain)).toEqual({ id: "new:ms-excel", listed: false });
    expect(skillIdFor("???", plain)).toBeNull();
  });

  it("M10: an unknown name keeps the provisional id of its own text, as before", () => {
    expect(skillIdFor("Docker Compose", skills)).toEqual({ id: "new:docker-compose", listed: false });
    expect(skillIdFor("Führerschein", skills)).toEqual({ id: "new:fuhrerschein", listed: false });
  });
});

describe("must NOT merge (c)", () => {
  const groups: [string, string][][] = [
    [["Java", "java"], ["JavaScript", "javascript"], ["TypeScript", "typescript"]],
    [["C", "c-language"], ["C++", "c-plus-plus"], ["C#", "c-sharp"]],
    [["SQL", "sql"], ["NoSQL", "nosql"], ["MySQL", "mysql"], ["PostgreSQL", "postgresql"], ["Microsoft SQL Server", "sql-server"], ["SQL Server", "sql-server"]],
    [["Power BI", "power-bi"], ["Power Query", "power-query"], ["Business intelligence", "business-intelligence"], ["Looker", "looker"]],
    [["Excel", "excel"], ["Spreadsheets", "spreadsheets"], ["Google Sheets", "google-sheets"], ["VBA", "vba"]],
    [["R", "r-language"], ["Rust", "rust"]],
    [["Git", "git"], ["GitHub", "github"]],
    [["React", "react"], ["Angular", "angular"], ["Vue.js", "vuejs"]],
    [["Jest", "jest"], ["Vitest", "vitest"]],
    [["Docker", "docker"], ["Kubernetes", "kubernetes"]],
    [["Communication", "communication"], ["Executive communication", "executive-communication"], ["Stakeholder management", "stakeholder-management"]],
    [["Product management", "product-management"], ["Project management", "project-management"], ["Growth product management", "growth-product-management"]],
    [["Salesforce", "salesforce"], ["Salesforce Account Engagement (Pardot)", "pardot"], ["Pardot", "pardot"]],
    [["Email marketing", "email-marketing"], ["Email outreach", "email-outreach"]],
    [["Reporting", "reporting"], ["Cost reporting", "cost-reporting"], ["Financial reporting", "financial-reporting"]],
    [["Scrum", "scrum"], ["Agile", "agile"], ["Kanban", "kanban"]],
    [["Experimentation", "experimentation"], ["A/B testing", "ab-testing"]],
    [["ISO 9001", "iso-9001"], ["ISO 14001", "iso-14001"], ["ISO 45001", "iso-45001"], ["ISO 50001", "iso-50001"], ["ISO 27001", "iso-27001"]],
  ];
  it.each(groups.map((g, i) => [i, g] as const))("X%i: every name gets its own id, and the ids differ", (_i, group) => {
    for (const [name, want] of group) expect(id(name)).toBe(want);
    // a group may name one skill twice on purpose (two spellings of it); every other pair must differ
    expect(new Set(group.map(([n]) => id(n))).size).toBe(new Set(group.map(([, want]) => want)).size);
  });

  it("X18: near misses stay unlisted: Excellent, Java Script is JavaScript, AngularJS, Shift, R&D", () => {
    expect(listed("Excellent")).toBe(false);
    expect(id("Java Script")).toBe("javascript");
    expect(id("Java Script")).not.toBe("java");
    expect(listed("AngularJS")).toBe(false);
    expect(listed("Shift")).toBe(false);
    expect(id("Swift")).toBe("swift");
    expect(listed("R&D")).toBe(false);
    expect(id("Go-to-market")).toBe("go-to-market");
    expect(id("Go-to-market")).not.toBe("go-language");
  });

  it("X19: level words never turn one skill into another: 'Advanced Java' is Java, never JavaScript", () => {
    expect(id("Advanced Java")).toBe("java");
    expect(id("Basic JavaScript knowledge")).toBe("javascript");
  });
});

describe("isNotASkill", () => {
  it("T1: phrases on the list, in any case or with level words", () => {
    expect(isNotASkill("Team player")).toBe(true);
    expect(isNotASkill("TEAM PLAYER")).toBe(true);
    expect(isNotASkill("Hands-on, fast-paced working")).toBe(true);
    expect(isNotASkill("Eigeninitiative")).toBe(true);
    expect(isNotASkill("Data analyst experience")).toBe(true);
    expect(isNotASkill("Attention to detail")).toBe(true);
  });
  it("T1b: level and filler words are dropped here too: 'Excellent team player skills' is 'team player'", () => {
    expect(isNotASkill("Excellent team player skills")).toBe(true);
    expect(isNotASkill("Strong eigeninitiative")).toBe(true);
  });
  it("T2: real skills, including soft ones, are not on it", () => {
    for (const n of ["Communication", "Teamwork", "Time management", "Problem solving", "Negotiation", "SQL", "Analytical thinking"]) {
      expect(isNotASkill(n)).toBe(false);
    }
  });
});

describe("nameStatus (the coverage check's five answers)", () => {
  const st = (n: string) => nameStatus(n, (x) => skillIdFor(x, skills));
  it("S1: a name in the vocabulary is mapped, in any wording", () => {
    for (const n of ["Docker", "SQL-Kenntnisse", "Advanced Excel", "Media and PR", "manage multiple priorities", "Scripting languages", "measuring automation"]) {
      expect(st(n)).toBe("mapped");
    }
  });
  it("S2: a phrase on the not-a-skill list", () => {
    for (const n of ["Team player", "media", "technical understanding", "adapt to new technology", "work independently"]) expect(st(n)).toBe("not-a-skill");
  });
  it("S3: an alias the owner has not decided yet is 'undecided', never mapped", () => {
    for (const n of ["analytical", "events", "QA", "Looker Studio"]) expect(st(n)).toBe("undecided");
  });
  it("S4: a name left unlisted on purpose", () => {
    for (const n of ["account growth", "Account Growth", "Online shop development", "task management", "Task Management", "partnership development"]) {
      expect(st(n)).toBe("left-unlisted");
    }
  });
  it("S5: anything else is unmapped", () => {
    for (const n of ["Origami", "Welding", "Zymurgy"]) expect(st(n)).toBe("unmapped");
  });
});
