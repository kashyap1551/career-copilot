import * as cv1 from "./cv-1-thin";
import * as cv2 from "./cv-2-german";
import * as cv3 from "./cv-3-injection";
import * as cv4 from "./cv-4-skills-line";
import * as cv5 from "./cv-5-prose";

// The five made-up CVs and their keys (docs/PLAN-4.2-cvs.md), in order.
export const cvFixtures = [cv1, cv2, cv3, cv4, cv5].map((m) => ({ id: m.key.cv, text: m.text, key: m.key }));
