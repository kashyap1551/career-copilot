import { describe, expect, it } from "vitest";
import { FACTS, type Fact } from "@/lib/privacy/facts";
import { WORDING_APPROVED_ON } from "@/lib/privacy/messages";

// Step 9.3, stage 2.2 (docs/PLAN-9.3.md section 3 and amendments A2, A3, A13): the facts the privacy page may state, and the two gates.
// Written BEFORE lib/privacy/facts.ts and lib/privacy/messages.ts exist (red first, then green).
//
// HAND-WORKED EXPECTATIONS:
//  The facts, in this order (id: status, kind):
//    U1 not-confirmed; U2a confirmed, quoted; U2b confirmed, observed; U3 not-confirmed; U4a confirmed, observed; U4b not-confirmed;
//    U5 not-confirmed; U6 not-confirmed; U9 confirmed, observed.   That is 9 facts: 4 confirmed, 5 not-confirmed (U1, U3, U4b, U5, U6).
//  F1  every fact has exactly the keys id, status, words, source, date, plus kind when it is confirmed; the ids are the 9 above in that order.
//  F2  a not-confirmed fact has the fixed sentence as `words` (pinned below), no kind, source "" and date ""; a confirmed fact has a kind that is
//      "quoted" or "observed", non-empty words and source, and a real ISO date YYYY-MM-DD; the 4 confirmed facts are pinned word for word, with
//      the kind, the source and the date 2026-11-25.
//  F3  THE GATE (skipped unless PRIVACY_GATE=1): fails while any fact is not-confirmed, and names the ids. Today it would name exactly
//      U1, U3, U4b, U5, U6.
//  F4  THE GATE (skipped unless PRIVACY_GATE=1): fails while WORDING_APPROVED_ON is null. Today it is null, so it would fail.
//
// COUNTS: this file has 4 tests: F1 and F2 run and pass; F3 and F4 are skipped in a normal run.

const NOT_CONFIRMED: Record<string, string> = {
  U1: "Not confirmed yet: whether the AI service uses what we send to train its models.",
  U3: "Not confirmed yet: the country where the AI service processes your text.",
  U4b: "Not confirmed yet: how long the hosting service keeps its logs.",
  U5: "Not confirmed yet: the region our server runs in.",
  U6: "No analytics code is in this app. Whether the hosting service adds its own is not confirmed yet.",
};

const CONFIRMED: Record<string, { kind: string; source: string; date: string; words: string }> = {
  U2a: {
    kind: "quoted",
    source: "Groq console, Data Controls page, as shown in our account",
    date: "2026-11-25",
    words:
      "Starting October 15, 2025, Groq may store inputs and outputs for up to 30 days, strictly for purposes of maintaining system reliability and compliance. Enable to opt out of storing input and output data.",
  },
  U2b: {
    kind: "observed",
    source: "Groq console, Data Controls page",
    date: "2026-11-25",
    words: "In the Groq console, Zero Data Retention for inference calls (the setting called Inference APIs ZDR) is switched on for our account.",
  },
  U4a: {
    kind: "observed",
    source: "Vercel dashboard: the Logs request detail and the Firewall Traffic view",
    date: "2026-11-25",
    words:
      "For each request the hosting service (Vercel) logs the time, the method, the path, the status, the host, your browser's user agent text, a request ID and the receiving location. Its firewall view also shows the visitor's IP address, country, network provider and browser type.",
  },
  U9: {
    kind: "observed",
    source: "Vercel Firewall rule api-rate-limit, checked live",
    date: "2026-11-25",
    words:
      "To limit abuse, the hosting service counts requests to paths that start with /api/ for each IP address in 60-second windows, and refuses a request with 'Too Many Requests' (429) after 10.",
  },
};

const ORDER = ["U1", "U2a", "U2b", "U3", "U4a", "U4b", "U5", "U6", "U9"];
const isRealIsoDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const gate = process.env.PRIVACY_GATE === "1";

describe("the facts the privacy page may state (PLAN-9.3 section 3, A2, A3, A13)", () => {
  it("F1: every fact has the shape, and the ids are the nine in order", () => {
    expect(FACTS.map((f) => f.id)).toEqual(ORDER);
    for (const f of FACTS) {
      const keys = Object.keys(f).sort();
      const expected = f.status === "confirmed" ? ["date", "id", "kind", "source", "status", "words"] : ["date", "id", "source", "status", "words"];
      expect(keys, f.id).toEqual(expected);
      expect(["confirmed", "not-confirmed"], f.id).toContain(f.status);
      for (const k of ["id", "words", "source", "date"] as const) expect(typeof f[k], `${f.id}.${k}`).toBe("string");
    }
  });

  it("F2: a not-confirmed fact has the fixed sentence and nothing else; a confirmed fact has kind, words, source and a real date", () => {
    const confirmed = FACTS.filter((f) => f.status === "confirmed").map((f) => f.id);
    expect(confirmed).toEqual(["U2a", "U2b", "U4a", "U9"]);
    for (const f of FACTS as Fact[]) {
      if (f.status === "not-confirmed") {
        expect(f.words, `${f.id} words`).toBe(NOT_CONFIRMED[f.id]);
        expect("kind" in f, `${f.id} has no kind`).toBe(false);
        expect(f.source, `${f.id} source`).toBe("");
        expect(f.date, `${f.id} date`).toBe("");
      } else {
        const want = CONFIRMED[f.id];
        expect(want, `${f.id} is a known confirmed fact`).toBeDefined();
        expect(["quoted", "observed"], `${f.id} kind`).toContain(f.kind);
        expect(f.kind, `${f.id} kind`).toBe(want.kind);
        expect(f.words.trim(), `${f.id} words`).not.toBe("");
        expect(f.source.trim(), `${f.id} source`).not.toBe("");
        expect(isRealIsoDate(f.date), `${f.id} date ${f.date}`).toBe(true);
        expect(f.words, `${f.id} words`).toBe(want.words);
        expect(f.source, `${f.id} source`).toBe(want.source);
        expect(f.date, `${f.id} date`).toBe(want.date);
      }
    }
    expect(Object.keys(NOT_CONFIRMED).sort()).toEqual(FACTS.filter((f) => f.status === "not-confirmed").map((f) => f.id).sort());
  });

  // THE GATE. Run before any other person's CV goes through the live page and before the link is shared for AI use (PLAN-9.3 A1, A7):
  //   PRIVACY_GATE=1 npx vitest run tests/privacyFacts.test.ts
  it.skipIf(!gate)("F3 (GATE): every fact is confirmed", () => {
    const open = FACTS.filter((f) => f.status !== "confirmed").map((f) => f.id);
    expect(open, `facts still not confirmed: ${open.join(", ")}`).toEqual([]);
  });

  it.skipIf(!gate)("F4 (GATE): the owner has approved the wording", () => {
    expect(WORDING_APPROVED_ON, "WORDING_APPROVED_ON is null: the owner has not approved the wording yet").not.toBeNull();
  });
});
