import { jobs } from "../jobs";
import { cvFixtures } from "../synthetic-cvs";
import * as cv6 from "./cv-6-product";
import * as cv7 from "./cv-7-quality";
import * as cv8 from "./cv-8-sales";
import * as cv9 from "./cv-9-hidden-duty";
import { newJobs } from "./jobs";

// The material of the counted bullets eval (docs/PLAN-8.3.md amendment 0.30): the four new CVs (three MAIN, one EDGE) and the twelve new jobs, next to the old fixtures,
// which are untouched. Every run is listed in ./manifest.
export { manifest } from "./manifest";
export type { EvalSet, ManifestRun } from "./manifest";
export { newJobs };

export const newCvFixtures = [cv6, cv7, cv8, cv9].map((m) => ({ id: m.key.cv, text: m.text, key: m.key }));
export const bulletEvalCvFixtures = [...cvFixtures, ...newCvFixtures];
export const bulletEvalJobs = [...jobs, ...newJobs];
