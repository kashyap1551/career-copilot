import type { Job } from "@/lib/engine/types";

// Made-up job ads for the bullets eval (docs/PLAN-8.3.md amendment 0.30): invented companies and ads, each requirement quoted as an ad writes it, vocabulary skills only.
// Written without running any checker on them. The German one pairs only with cv-2-german.

const kestrelProductOwner: Job = {
  id: "kestrel-product-owner",
  title: "Product Owner",
  company: "Kestrel Payments",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "C1" }],
    location: "Leeds",
    remote: "hybrid",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["user-stories"], importance: "must", quote: "Write clear user stories and acceptance criteria for the engineering team." },
    { skillIds: ["user-research"], importance: "must", quote: "Talk to customers every month and turn what you learn into product decisions." },
    { skillIds: ["backlog-prioritisation"], importance: "must", quote: "Own the product backlog and decide the order of work." },
    { skillIds: ["stakeholder-management"], importance: "must", quote: "Keep senior stakeholders informed about plans and results." },
    { skillIds: ["ab-testing"], importance: "nice", quote: "Experience running A/B tests." },
    { skillIds: ["figma"], importance: "nice", quote: "Familiarity with Figma." },
  ],
};

const lindqvistProductAnalyst: Job = {
  id: "lindqvist-product-analyst",
  title: "Product Analyst",
  company: "Lindqvist Retail Tech",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "C1" }],
    location: "Bristol",
    remote: "remote",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["ab-testing"], importance: "must", quote: "Design and run A/B tests on new features." },
    { skillIds: ["metrics-definition"], importance: "must", quote: "Define the product metrics that matter and report on them." },
    { skillIds: ["sql"], importance: "must", quote: "Strong SQL for pulling your own data." },
    { skillIds: ["product-analytics"], importance: "must", quote: "Hands-on experience with product analytics." },
    { skillIds: ["looker", "tableau"], importance: "nice", quote: "Dashboard experience in Looker or Tableau." },
    { skillIds: ["user-interviews"], importance: "nice", quote: "Ability to run user interviews." },
    { skillIds: ["product-roadmapping"], importance: "nice", quote: "Contribute to the product roadmap." },
  ],
};

const marloweAssociateProductManager: Job = {
  id: "marlowe-associate-product-manager",
  title: "Associate Product Manager",
  company: "Marlowe Health Apps",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "B2" }],
    location: "Cardiff",
    remote: "hybrid",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["prototyping"], importance: "must", quote: "Test ideas quickly with prototypes before the team builds them." },
    { skillIds: ["requirements-gathering"], importance: "must", quote: "Write product requirements the engineers can build from." },
    { skillIds: ["jira"], importance: "must", quote: "Work in an agile team using Jira." },
    { skillIds: ["scrum"], importance: "must", quote: "Run scrum ceremonies with the team." },
    { skillIds: ["user-research"], importance: "nice", quote: "Knowledge of user research methods." },
    { skillIds: ["presentation-skills"], importance: "nice", quote: "Comfortable presenting to leadership." },
    { skillIds: ["mixpanel", "amplitude"], importance: "nice", quote: "Experience with Mixpanel or Amplitude." },
  ],
};

const greywaterQualityAssuranceOfficer: Job = {
  id: "greywater-quality-assurance-officer",
  title: "Quality Assurance Officer",
  company: "Greywater Dairies",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "B2" }],
    location: "Derby",
    remote: "onsite",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["audits"], importance: "must", quote: "Plan and carry out internal audits." },
    { skillIds: ["iso-9001"], importance: "must", quote: "Working knowledge of ISO 9001." },
    { skillIds: ["documentation"], importance: "must", quote: "Keep controlled documents and work instructions up to date." },
    { skillIds: ["root-cause-analysis"], importance: "must", quote: "Investigate complaints and find the cause." },
    { skillIds: ["risk-assessment"], importance: "nice", quote: "Experience with risk assessments." },
    { skillIds: ["training"], importance: "nice", quote: "Train colleagues on quality procedures." },
    { skillIds: ["process-improvement"], importance: "nice", quote: "Lead small process improvement projects." },
  ],
};

const eastlakeComplianceCoordinator: Job = {
  id: "eastlake-compliance-coordinator",
  title: "Compliance Coordinator",
  company: "Eastlake Pharma",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "C1" }],
    location: "Reading",
    remote: "hybrid",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["documentation"], importance: "must", quote: "Maintain compliance records and documentation." },
    { skillIds: ["audits"], importance: "must", quote: "Support audits by customers and certification bodies." },
    { skillIds: ["deviation-management"], importance: "must", quote: "Manage non-conformities and see corrective actions through to closure." },
    { skillIds: ["risk-assessment"], importance: "must", quote: "Carry out risk assessments." },
    { skillIds: ["iso-14001", "iso-45001"], importance: "nice", quote: "ISO 14001 or ISO 45001 knowledge." },
    { skillIds: ["process-improvement"], importance: "nice", quote: "Interest in continuous improvement." },
  ],
};

const brooksideQualityTechnician: Job = {
  id: "brookside-quality-technician",
  title: "Quality Technician",
  company: "Brookside Packaging",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "B2" }],
    location: "Sheffield",
    remote: "onsite",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["quality-assurance"], importance: "must", quote: "Carry out quality checks on the production line." },
    { skillIds: ["root-cause-analysis"], importance: "must", quote: "Find the root cause of problems and help fix them." },
    { skillIds: ["process-improvement"], importance: "must", quote: "Help improve processes and reduce waste." },
    { skillIds: ["compliance"], importance: "must", quote: "Follow hygiene and safety rules every day." },
    { skillIds: ["iso-9001"], importance: "nice", quote: "Basic knowledge of ISO 9001." },
    { skillIds: ["training"], importance: "nice", quote: "Train new operators." },
  ],
};

const tidewaterAccountExecutive: Job = {
  id: "tidewater-account-executive",
  title: "Account Executive",
  company: "Tidewater Software",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "C1" }],
    location: "Birmingham",
    remote: "hybrid",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["account-management"], importance: "must", quote: "Manage a portfolio of accounts and build lasting relationships." },
    { skillIds: ["cold-calling"], importance: "must", quote: "Find new customers through cold calling." },
    { skillIds: ["negotiation"], importance: "must", quote: "Negotiate prices and contracts." },
    { skillIds: ["salesforce", "hubspot"], importance: "must", quote: "Work in a CRM such as Salesforce or HubSpot." },
    { skillIds: ["linkedin-sales-navigator"], importance: "nice", quote: "Experience with LinkedIn Sales Navigator." },
    { skillIds: ["pre-sales"], importance: "nice", quote: "Run product demos for prospects." },
  ],
};

const coppergateBusinessDevelopmentRepresentative: Job = {
  id: "coppergate-business-development-representative",
  title: "Business Development Representative",
  company: "Coppergate Cloud",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "C1" }],
    location: "Newcastle",
    remote: "remote",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["lead-generation"], importance: "must", quote: "Generate leads through outbound calls and email." },
    { skillIds: ["email-outreach"], importance: "must", quote: "Write outreach emails that get replies." },
    { skillIds: ["crm-systems"], importance: "must", quote: "Keep the CRM and the pipeline accurate." },
    { skillIds: ["pipedrive", "salesforce"], importance: "nice", quote: "Experience with Pipedrive or Salesforce." },
    { skillIds: ["pre-sales"], importance: "nice", quote: "Comfortable giving product demos." },
    { skillIds: ["excel"], importance: "nice", quote: "Good Excel skills." },
  ],
};

const westmoorSalesSupportCoordinator: Job = {
  id: "westmoor-sales-support-coordinator",
  title: "Sales Support Coordinator",
  company: "Westmoor Distribution",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "B2" }],
    location: "Nottingham",
    remote: "onsite",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["pricing"], importance: "must", quote: "Prepare quotes and prices for customers." },
    { skillIds: ["crm-systems"], importance: "must", quote: "Keep customer records up to date in the CRM." },
    { skillIds: ["excel"], importance: "must", quote: "Strong Excel skills." },
    { skillIds: ["negotiation"], importance: "nice", quote: "Some negotiation experience." },
    { skillIds: ["event-management"], importance: "nice", quote: "Help organise customer events." },
  ],
};

const eastbrookOperationsCoordinator: Job = {
  id: "eastbrook-operations-coordinator",
  title: "Operations Coordinator",
  company: "Eastbrook Distribution",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "B2" }],
    location: "Coventry",
    remote: "onsite",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["scheduling"], importance: "must", quote: "Plan driver rotas and shifts." },
    { skillIds: ["invoice-checking"], importance: "must", quote: "Check supplier invoices against orders." },
    { skillIds: ["spreadsheets"], importance: "must", quote: "Keep shared spreadsheets in good order." },
    { skillIds: ["delivery-planning"], importance: "must", quote: "Coordinate daily deliveries." },
    { skillIds: ["documentation"], importance: "nice", quote: "Write simple procedures and guides." },
    { skillIds: ["training"], importance: "nice", quote: "Train new starters." },
  ],
};

const carrowmoreLogisticsAdministrator: Job = {
  id: "carrowmore-logistics-administrator",
  title: "Logistics Administrator",
  company: "Carrowmore Freight",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "en", level: "B2" }],
    location: "Southampton",
    remote: "onsite",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["delivery-planning"], importance: "must", quote: "Organise routes and deliveries for a small fleet." },
    { skillIds: ["cost-reporting"], importance: "must", quote: "Produce monthly cost summaries." },
    { skillIds: ["training"], importance: "must", quote: "Train and support new colleagues." },
    { skillIds: ["excel"], importance: "must", quote: "Confident with Excel." },
    { skillIds: ["freight-management-systems"], importance: "nice", quote: "Experience with freight management systems." },
  ],
};

const nordlichtFinanzanalyst: Job = {
  id: "nordlicht-finanzanalyst",
  title: "Finanzanalyst (m/w/d)",
  company: "Nordlicht Handels GmbH",
  source: "synthetic sample",
  constraints: {
    languages: [{ code: "de", level: "C1" }],
    location: "Hamburg",
    remote: "hybrid",
    minYears: null,
    startDate: null,
    otherConditions: [],
  },
  requirements: [
    { skillIds: ["excel"], importance: "must", quote: "Sehr gute Excel-Kenntnisse." },
    { skillIds: ["sql"], importance: "must", quote: "Sichere SQL-Abfragen für eigene Auswertungen." },
    { skillIds: ["power-bi"], importance: "must", quote: "Erfahrung mit Power BI." },
    { skillIds: ["reporting"], importance: "must", quote: "Regelmäßige Berichte für die Geschäftsführung erstellen." },
    { skillIds: ["communication"], importance: "nice", quote: "Gute Zusammenarbeit mit dem Vertrieb." },
    { skillIds: ["python"], importance: "nice", quote: "Python-Kenntnisse sind von Vorteil." },
  ],
};

export const newJobs: Job[] = [
  kestrelProductOwner,
  lindqvistProductAnalyst,
  marloweAssociateProductManager,
  greywaterQualityAssuranceOfficer,
  eastlakeComplianceCoordinator,
  brooksideQualityTechnician,
  tidewaterAccountExecutive,
  coppergateBusinessDevelopmentRepresentative,
  westmoorSalesSupportCoordinator,
  eastbrookOperationsCoordinator,
  carrowmoreLogisticsAdministrator,
  nordlichtFinanzanalyst,
];
