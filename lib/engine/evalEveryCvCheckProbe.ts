import type { SentEntry, SentRequirement } from "./evidenceProof";

// The input of the check's PINNED request hash (tests/checkRequestHashPin.test.ts): four invented requirements and four invented CV entries. The eval script
// captures the check request from them, without any network, to print the hash the guard variable EXPECT_CHECK_REQUEST_HASH must hold. A test (EI1)
// hashes this copy and compares it with the pin's literal, so the copy cannot drift. Tooling only (docs/PLAN-EVERY-CV.md, the check eval).
const R = (n: number, quote: string): SentRequirement => ({ n, index: n - 1, quote, importance: "must" });
const E = (n: number, name: string, text: string): SentEntry => ({ n, name, skillId: `new:e${n}`, line: n + 1, text, inferred: false });

export const PROBE_REQUIREMENTS: SentRequirement[] = [
  "Mends sails and rigging",
  "Has run a ferry rota for five seasons",
  "Can polish brass or copper fittings",
  "Speaks Portuguese at work",
].map((q, i) => R(i + 1, q));

export const PROBE_ENTRIES: SentEntry[] = [
  E(1, "Sail repair", "Stitched torn sails and spliced new rope on two sloops"),
  E(2, "Crossing plans", "Drew up the fortnightly crossing plan for the island boat"),
  E(3, "Lantern care", "Polished the brass lantern of the quay beacon each dawn"),
  E(4, "Basque", "Chatted in Basque with visitors at the quay café"),
];
