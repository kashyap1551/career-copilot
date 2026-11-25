import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as POST_CHECK } from "@/app/api/check/route";
import { containsContactDetails } from "@/lib/cv/redact";
import { CONTACT_REFUSAL, ENTRIES, EXAMPLE_ANSWERS, goodBody, post, REQUIREMENTS, setUp, state, stubFetch, tearDown, METHODS, type Spies } from "./checkRouteKit";

// EC-3b, the contact-detail refusal on the lines of the CV (docs/PLAN-EVERY-CV.md AM4; tests CS1 to CS6). /api/cv refuses a line that still holds contact
// details with `containsContactDetails` (lib/cv/redact.ts), used in lib/schemas/cv.ts:34; the check uses the same function on the entry name and the entry
// text. The ad's requirement lines are NOT cleaned (the ad is sent as it is, claim C3a). Only the reserved fakes are used.

let spies: Spies;
beforeEach(() => {
  ({ spies } = setUp());
  stubFetch({ answers: EXAMPLE_ANSWERS });
});
afterEach(tearDown);

const withEntry = (e: { name: string; text: string }) => goodBody({ entries: [e, ...ENTRIES.slice(1)] });

async function refused(body: unknown, secret: string) {
  const res = await POST_CHECK(post(body));
  const text = await res.text();
  expect(res.status).toBe(400);
  expect(JSON.parse(text)).toEqual({ error: CONTACT_REFUSAL });
  expect(text).not.toContain(secret);
  expect(state.bodies).toHaveLength(0);
  for (const m of METHODS) expect(spies[m].mock.calls, `console.${m}`).toEqual([]);
}

describe("EC-3b the check refuses CV lines with contact details", () => {
  it("CS1: an email (jane.sample@example.com) inside an entry text: 400 and the refusal sentence, 0 fetch calls, 0 console calls, the email not in the answer", async () => {
    await refused(withEntry({ name: "Sail repair", text: "Stitched torn sails, write to jane.sample@example.com" }), "jane.sample");
  });
  it("CS2: a phone number (+49 30 0000000) inside an entry text: the same", async () => {
    await refused(withEntry({ name: "Sail repair", text: "Stitched torn sails, call +49 30 0000000" }), "0000000");
  });
  it("CS3: a web link (https://example.org/jane) inside an entry text: the same", async () => {
    await refused(withEntry({ name: "Sail repair", text: "Stitched torn sails, see https://example.org/jane" }), "example.org/jane");
  });
  it("CS4: an email inside an entry NAME: the same", async () => {
    await refused(withEntry({ name: "jane.sample@example.com", text: "Stitched torn sails" }), "jane.sample");
  });

  it("CS5: an email inside a REQUIREMENT text is NOT refused (the ad is sent as it is, claim C3a): 200 and 1 fetch call", async () => {
    const res = await POST_CHECK(post(goodBody({ requirements: ["Send your application to recruiter@example.org", ...REQUIREMENTS.slice(1)] })));
    expect(res.status).toBe(200);
    expect(state.bodies).toHaveLength(1);
  });

  it("CS6: clean lines (plain words only): 200 and 1 fetch call", async () => {
    const res = await POST_CHECK(post(goodBody()));
    expect(res.status).toBe(200);
    expect(state.bodies).toHaveLength(1);
  });

  it("CS7: the route uses the same function as /api/cv for the refusal (source guard), and that function sees the three kinds", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("app/api/check/route.ts", "utf8")).toMatch(/containsContactDetails/);
    for (const t of ["jane.sample@example.com", "+49 30 0000000", "https://example.org/jane"]) expect(containsContactDetails(t)).toBe(true);
    expect(containsContactDetails("Stitched torn sails")).toBe(false);
  });
});
