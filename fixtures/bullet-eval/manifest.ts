// The runs of the counted bullets eval (docs/PLAN-8.3.md amendment 0.30): every run as (cv, job, set). MAIN counts toward the pass lines; EDGE is reported separately and is
// not in the yield denominators (M1 = 0 applies to both). cv-3-injection is not used: its instruction line carries no skill, so it can never become a pair.
export type EvalSet = "main" | "edge";
export type ManifestRun = { cv: string; job: string; set: EvalSet };

const N = "northwind-operations-analyst";
const B = "brightwater-financial-planning-analyst";
const F = "fjordlight-frontend-developer";

const main = (cv: string, jobs: string[]): ManifestRun[] => jobs.map((job) => ({ cv, job, set: "main" }));

export const manifest: ManifestRun[] = [
  ...main("cv-2-german", [N, B, "nordlicht-finanzanalyst"]),
  ...main("cv-5-prose", ["eastbrook-operations-coordinator", "carrowmore-logistics-administrator", N]),
  ...main("cv-6-product", ["kestrel-product-owner", "lindqvist-product-analyst", "marlowe-associate-product-manager"]),
  ...main("cv-7-quality", ["greywater-quality-assurance-officer", "eastlake-compliance-coordinator", "brookside-quality-technician"]),
  ...main("cv-8-sales", ["tidewater-account-executive", "coppergate-business-development-representative", "westmoor-sales-support-coordinator"]),
  { cv: "cv-1-thin", job: N, set: "edge" },
  { cv: "cv-4-skills-line", job: F, set: "edge" },
  { cv: "cv-9-hidden-duty", job: "coppergate-business-development-representative", set: "edge" },
];
