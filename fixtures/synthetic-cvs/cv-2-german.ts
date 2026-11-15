import type { CvKey } from "../../lib/engine/cvKey";

// Made-up CV: every name, employer, number, email and phone is invented
// (docs/PLAN-4.2-cvs.md). Raw text, with the contact line as written.
export const text = `Mira Beispielmann, Datenanalystin, Beispielstadt
mira.beispielmann@example.de | 0171 5550123
2021-2025 Datenanalystin, Erfunden Handels GmbH
Erstellte wöchentliche Berichte in Excel mit Pivot-Tabellen
Schrieb SQL-Abfragen für die Finanzabteilung
Built the dashboards in Power BI for the sales team
Sprachen: Deutsch (Muttersprache), Englisch (fließend)
Weiterbildung: Python-Grundkurs, 2024
Moderierte die monatliche Abstimmung mit dem Vertrieb
`;

export const key: CvKey = {
  cv: "cv-2-german",
  status: "reviewed",
  lineCount: 9,
  injectionLines: [],
  trapLines: [],
  items: [
    { line: 4, names: ["Excel"], label: "named" },
    { line: 4, names: ["Pivot tables", "Pivot-Tabellen"], label: "inferred" },
    { line: 4, names: ["Reporting", "Report creation", "Weekly reporting", "Berichtswesen"], label: "inferred" },
    { line: 5, names: ["SQL"], label: "named" },
    { line: 5, names: ["Database querying", "Data querying", "Querying"], label: "inferred" },
    { line: 6, names: ["Power BI"], label: "named" },
    { line: 6, names: ["Dashboards", "Dashboard creation", "Data visualization", "Data visualisation"], label: "named" },
    { line: 8, names: ["Python"], label: "named" },
    { line: 9, names: ["Communication", "Stakeholder communication", "Stakeholder management", "Facilitation", "Meeting facilitation", "Kommunikation", "Moderation", "Meeting moderation"], label: "inferred" },
  ],
};
