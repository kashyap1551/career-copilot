import { describe, expect, it } from "vitest";
import { toViewAnswers } from "@/lib/cv/checkBridge";
import { KEPT_WARD, REPLY_W, SENT_W } from "./support/checkWorld";

// EC-4a (EC-4 proposal, Part B f and Part C CB1 to CB5): the route's answer (positions as sent) becomes the engine view's answers (places in the ad),
// proved again on the page. Hand-worked on the world W: requirement n 1, 2, 3 are ad indexes 2, 3, 4; entry 2 is "Ward nursing", CV line 4,
// "Dressed and monitored wounds on a surgical ward".

describe("EC-4a bridge: route answer -> view answers (CB)", () => {
  it("CB1: the W reply: indexes 2, 3, 4; met, partly, none; the entry of the first two is Ward nursing on line 4; nothing thrown", () => {
    const r = toViewAnswers(SENT_W, REPLY_W);
    expect(r).toEqual({
      ok: true,
      answers: [
        { index: 2, verdict: "met", entry: KEPT_WARD, quote: "Dressed and monitored wounds" },
        { index: 3, verdict: "partly", entry: KEPT_WARD, quote: "Dressed and monitored" },
        { index: 4, verdict: "none", entry: null, quote: null },
      ],
      thrownAway: 0,
    });
  });

  it("CB2: a none answer shows no entry and no quote, even if the body carries them", () => {
    const body = { answers: [{ requirement: 3, verdict: "none", entry: 1, quote: "Wrote SQL queries" }], thrownAway: 0 };
    expect(toViewAnswers(SENT_W, body)).toEqual({ ok: true, answers: [{ index: 4, verdict: "none", entry: null, quote: null }], thrownAway: 0 });
  });

  it("CB3: a quote that is not on its line (a damaged reply) is dropped and counted: the route said 0, the page says 1; the route's own count is added", () => {
    // entry 2 is line 4; "Welded steel frames" is on line 3
    const body = { answers: [{ requirement: 1, verdict: "met", entry: 2, quote: "Welded steel frames" }], thrownAway: 0 };
    expect(toViewAnswers(SENT_W, body)).toEqual({ ok: true, answers: [], thrownAway: 1 });
    expect(toViewAnswers(SENT_W, { ...body, thrownAway: 2 })).toEqual({ ok: true, answers: [], thrownAway: 3 });
  });

  it("CB4: requirement 9 was not sent: ignored (not counted); entry 7 was not sent: thrown (counted 1)", () => {
    const body = {
      answers: [
        { requirement: 9, verdict: "none", entry: null, quote: null },
        { requirement: 1, verdict: "met", entry: 7, quote: "Dressed and monitored wounds" },
      ],
      thrownAway: 0,
    };
    expect(toViewAnswers(SENT_W, body)).toEqual({ ok: true, answers: [], thrownAway: 1 });
  });

  it("CB5: a body of the wrong shape is refused: answers not a list, thrownAway below 0, an unknown verdict, a missing field, not an object", () => {
    const bad: unknown[] = [
      { answers: "none", thrownAway: 0 },
      { answers: [], thrownAway: -1 },
      { answers: [{ requirement: 1, verdict: "maybe", entry: null, quote: null }], thrownAway: 0 },
      { answers: [{ requirement: 1, verdict: "none", entry: null }], thrownAway: 0 },
      { answers: [] },
      null,
      "text",
    ];
    for (const b of bad) expect(toViewAnswers(SENT_W, b)).toEqual({ ok: false });
  });

  it("CB6: an empty list of answers is a good answer: nothing accepted, the route's count passes through", () => {
    expect(toViewAnswers(SENT_W, { answers: [], thrownAway: 2 })).toEqual({ ok: true, answers: [], thrownAway: 2 });
  });
});
