import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { postJson } from "@/app/accessFetch";
import { forgetConsent, giveConsent, readConsent, sendIfAcknowledged } from "@/app/consent";
import { NEED_CODE_MESSAGE } from "@/lib/ai/accessMessages";
import { CV_TICK_NEEDED } from "@/lib/privacy/messages";

// Step 9.3, stage 2.4 (docs/PLAN-9.3.md section 4, Option C, and sections 9 and 10; amendments A9, A11, A13): the tick before the first CV send in a
// tab, the gate behind it, and the notices at the two send buttons. Written BEFORE app/consent.ts exists (red first, then green).
//
// What these tests can and cannot show. There is no browser and no new package here, so the screens are not rendered. The DECISIONS are plain
// functions in app/consent.ts, in the style of app/accessFetch.ts (an injected store, an injected fetch); C1 to C7 call them with the real
// postJson and a fake fetch. The wiring is checked as SOURCE: G1 (the first thing send() in CvBox.tsx does is the gate, before setSending and
// before postJson), C5 (the ad send has no gate) and M6 (the notices, the links, and which block each sits in). What only a browser shows: that the
// box really is ticked after a reload in the same tab and clear in a new tab, that nothing appears in the Network tab before the tick, that the link
// opens a new tab and leaves the page as it was (docs/MANUAL-CHECK-9.3.md, stage 2.6).
//
// HAND-WORKED EXPECTATIONS (the fake store is a Map; the fake fetch answers 200 {} unless stated; postJson is the real one):
//  C1  nothing ticked: sendIfAcknowledged(() => postJson("/api/cv", ...)) returns { sent: false, message: CV_TICK_NEEDED }
//      ("Tick the box before you send your CV.") and the fetch fake was called 0 times.
//  C2  after giveConsent(store): the same call returns sent: true and the fetch fake was called exactly 1 time, with the address "/api/cv".
//  C3  after giveConsent(store): store.getItem("career-copilot.consent") is "1", the store holds exactly that one key, readConsent(store) is true,
//      and a second, empty store (another tab) reads false.
//  C4  after giveConsent then forgetConsent: getItem is null, readConsent is false, the store holds 0 keys.
//  C5  the ad send has NO gate: postJson("/api/read", ...) with an unticked tick store makes exactly 1 call; and in app/page.tsx the function readAd
//      has no consent word and no gate, the page renders {AD_INFO_LINE}, and it has no checkbox. (page.tsx has no word "consent" at all.)
//  C6  ticked, the fake answers 401 and no access code is kept: the result is sent: true with the access outcome and NEED_CODE_MESSAGE
//      ("Enter the access code you were given, then press the button again."), 1 call, and readConsent(store) is STILL true.
//  C7  a store whose getItem, setItem and removeItem all throw: giveConsent does not throw; readConsent(store) is true (the memory fallback); the
//      send makes exactly 1 call; forgetConsent(store) does not throw and readConsent(store) is then false.
//  G1  in app/CvBox.tsx the body of `async function send()` starts with `const gated = await sendIfAcknowledged(`, and `setSending(true)` and
//      `postJson(` come AFTER it in that body; `postJson(` occurs once in the file.
//  G2  (stage 2.5) the checkbox wiring in app/CvBox.tsx: the input has `checked={acknowledged}` and `onChange={onTick}`; `acknowledged` is
//      `useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot)`; the body of onTick calls giveConsent() when
//      e.target.checked and forgetConsent() otherwise (the first before the second, the second after an `else`).
//  M6  app/CvBox.tsx renders {CV_INFO_LINE}, {CV_TICK} (a checkbox inside a <label>) and {CV_TICK_NEEDED}; app/page.tsx renders {AD_INFO_LINE};
//      each has a <Link href="/privacy" ... {LINK_PRIVACY_NOTICE}> with target="_blank", rel="noopener noreferrer" and prefetch={false}; in CvBox.tsx
//      the info line comes before the tick, which comes before the button (onClick={send}), and in page.tsx the info line comes before the
//      button (onClick={readAd}); between an info line and its button there is no `&&` and no `?` (no separate condition).
//
// COUNTS: this file has 10 tests: C1 to C7, G1, G2 and M6. Stage 2.4 added 9 of them (all but G2) and V7 in demoView.test.ts: 10 new tests in all.
//        Stage 2.5 added G2.

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

const KEY = "career-copilot.consent";

class FakeStore {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
const blocked = {
  getItem(): never {
    throw new Error("blocked");
  },
  setItem(): never {
    throw new Error("blocked");
  },
  removeItem(): never {
    throw new Error("blocked");
  },
};

const answer = (status: number) => vi.fn(async () => new Response("{}", { status, headers: { "content-type": "application/json" } }));
const sendCv = (tick: FakeStore | typeof blocked, access: FakeStore, f: ReturnType<typeof answer>) =>
  sendIfAcknowledged(() => postJson("/api/cv", { lines: ["a line"] }, { source: "cv", fetch: f as unknown as typeof fetch, store: access }), tick);

afterEach(() => forgetConsent(blocked)); // the memory fallback of C7 must not leak into another test

describe("the tick before the first CV send (PLAN-9.3 section 4, Option C)", () => {
  it("C1: an unticked CV send sends nothing and says what to do", async () => {
    const f = answer(200);
    const r = await sendCv(new FakeStore(), new FakeStore(), f);
    expect(r).toEqual({ sent: false, message: CV_TICK_NEEDED });
    expect(CV_TICK_NEEDED).toBe("Tick the box before you send your CV.");
    expect(f).toHaveBeenCalledTimes(0);
  });

  it("C2: a ticked CV send makes exactly one call, to /api/cv", async () => {
    const tick = new FakeStore();
    giveConsent(tick);
    const f = answer(200);
    const r = await sendCv(tick, new FakeStore(), f);
    expect(r.sent).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]).toBeDefined();
    expect((f.mock.calls[0] as unknown[])[0]).toBe("/api/cv");
  });

  it("C3: the tick is kept in the tab's store under career-copilot.consent and read back", () => {
    const tick = new FakeStore();
    giveConsent(tick);
    expect(tick.getItem(KEY)).toBe("1");
    expect([...tick.m.keys()]).toEqual([KEY]);
    expect(readConsent(tick)).toBe(true);
    expect(readConsent(new FakeStore())).toBe(false); // another tab has its own store
  });

  it("C4: taking the tick back clears it", () => {
    const tick = new FakeStore();
    giveConsent(tick);
    forgetConsent(tick);
    expect(tick.getItem(KEY)).toBeNull();
    expect(readConsent(tick)).toBe(false);
    expect(tick.m.size).toBe(0);
  });

  it("C5: the ad send has no gate and shows its info line", async () => {
    const f = answer(200);
    await postJson("/api/read", { text: "an ad" }, { source: "ad", fetch: f as unknown as typeof fetch, store: new FakeStore() });
    expect(f).toHaveBeenCalledTimes(1); // no tick in any store: the ad is not gated
    const src = code("app/page.tsx");
    const start = src.indexOf("async function readAd()");
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, src.indexOf("\n  }\n", start));
    expect(body).toContain('postJson("/api/read"');
    for (const w of ["consent", "Acknowledged", "gate"]) expect(body.toLowerCase(), `readAd must not mention ${w}`).not.toContain(w.toLowerCase());
    expect(src.toLowerCase()).not.toContain("consent");
    expect(src).not.toContain('type="checkbox"');
    expect(src).toContain("{AD_INFO_LINE}");
  });

  it("C6: a 401 after the tick shows the access message and the tick stays given", async () => {
    const tick = new FakeStore();
    giveConsent(tick);
    const f = answer(401);
    const r = await sendCv(tick, new FakeStore(), f);
    expect(f).toHaveBeenCalledTimes(1);
    expect(r.sent).toBe(true);
    if (r.sent) expect(r.value).toEqual({ kind: "access", message: NEED_CODE_MESSAGE });
    expect(readConsent(tick)).toBe(true);
  });

  it("C7: storage that throws: the memory fallback works and the send still goes", async () => {
    expect(() => giveConsent(blocked)).not.toThrow();
    expect(readConsent(blocked)).toBe(true);
    const f = answer(200);
    const r = await sendCv(blocked, new FakeStore(), f);
    expect(r.sent).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    expect(() => forgetConsent(blocked)).not.toThrow();
    expect(readConsent(blocked)).toBe(false);
  });

  it("G1: in CvBox.tsx the first thing send() does is the gate, before setSending and before postJson", () => {
    const src = code("app/CvBox.tsx");
    const start = src.indexOf("async function send()");
    expect(start).toBeGreaterThan(0);
    const open = src.indexOf("{", start);
    let depth = 0;
    let end = open;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}" && --depth === 0) {
        end = i;
        break;
      }
    }
    const body = src.slice(open + 1, end);
    expect(body.trimStart().startsWith("const gated = await sendIfAcknowledged(")).toBe(true);
    const gateAt = body.indexOf("sendIfAcknowledged(");
    expect(body.indexOf("setSending(true)")).toBeGreaterThan(gateAt);
    expect(body.indexOf("postJson(")).toBeGreaterThan(gateAt);
    expect(src.split("postJson(").length - 1).toBe(1);
  });

  it("M6: each send button has its info line and a link to the privacy page in a new tab, in the same block, with no condition between", () => {
    const linkOf = (src: string) => {
      const links = [...src.matchAll(/<Link\b[^>]*?href="\/privacy"[\s\S]*?<\/Link>/g)].map((m) => m[0]).filter((l) => l.includes("{LINK_PRIVACY_NOTICE}"));
      expect(links.length, "one notice link").toBe(1);
      return links[0];
    };
    for (const link of [linkOf(code("app/CvBox.tsx")), linkOf(code("app/page.tsx"))]) {
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener noreferrer"');
      expect(link).toContain("prefetch={false}");
    }

    const cv = code("app/CvBox.tsx");
    const at = (s: string, token: string) => {
      expect(s.includes(token), `${token} is rendered`).toBe(true);
      return s.indexOf(token);
    };
    const info = at(cv, "{CV_INFO_LINE}");
    const tick = at(cv, "{CV_TICK}");
    const button = at(cv, "onClick={send}");
    expect(info).toBeLessThan(tick);
    expect(tick).toBeLessThan(button);
    expect(cv).toContain('type="checkbox"');
    expect(cv).toContain("{CV_TICK_NEEDED}");
    expect(cv.slice(Math.max(0, cv.lastIndexOf("<label", tick)), tick)).toContain('type="checkbox"');
    expect(cv.slice(info, button), "no condition between the CV notice and its button").not.toMatch(/&&|\?\s*\(|\?\s*</);

    const ad = code("app/page.tsx");
    const adInfo = at(ad, "{AD_INFO_LINE}");
    const adButton = at(ad, "onClick={readAd}");
    expect(adInfo).toBeLessThan(adButton);
    expect(ad.slice(adInfo, adButton), "no condition between the ad notice and its button").not.toMatch(/&&|\?\s*\(|\?\s*</);
  });

  it("G2: the checkbox shows the stored tick and ticking and unticking call giveConsent and forgetConsent", () => {
    const src = code("app/CvBox.tsx");
    expect(src).toContain("checked={acknowledged}");
    expect(src).toContain("onChange={onTick}");
    expect(src).toContain("const acknowledged = useSyncExternalStore(subscribeConsent, getConsentSnapshot, getConsentServerSnapshot);");
    const start = src.indexOf("function onTick(");
    expect(start).toBeGreaterThan(0);
    const body = src.slice(start, src.indexOf("\n  }\n", start));
    const give = body.indexOf("if (e.target.checked) giveConsent();");
    const forget = body.indexOf("else forgetConsent();");
    expect(give).toBeGreaterThan(-1);
    expect(forget).toBeGreaterThan(give);
  });
});
