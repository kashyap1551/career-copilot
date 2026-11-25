import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetCodeOnDeleteAll, getAccessUi } from "@/app/accessFetch";
import CheckBox from "@/app/CheckBox";
import { acceptResult, applyOutcome, liveMessage, runCheck, type CheckOutcome } from "@/app/runCheck";
import { skills } from "@/fixtures/skills";
import { NEED_CODE_MESSAGE, WRONG_CODE_MESSAGE } from "@/lib/ai/accessMessages";
import { buildCheckPlan, checkBoxState, type CheckPlan, type Checked } from "@/lib/cv/checkPlan";
import {
  CHECK_BAD_ANSWER, CHECK_BUTTON, CHECK_CONTACT, CHECK_DONE, CHECK_NO_ENTRIES, CHECK_NOT_CHECKED, CHECK_SERVER_ERROR, CHECK_STALE, CHECK_UNREACHABLE,
} from "@/lib/cv/checkWording";
import { CHECK_INFO_LINE, LINK_PRIVACY_NOTICE } from "@/lib/privacy/messages";
import { job } from "./support/evidenceFixtures";
import { LINES_W, personW, REPLY_W } from "./support/checkWorld";

// EC-4b (EC-4 proposal, Part C RC and CP rows, and the owner's tightenings): the click logic (app/runCheck.ts), the box (app/CheckBox.tsx) and the page
// wiring. No browser and no network: runCheck is driven with a fake fetch and fake stores; the box is drawn with react-dom/server; the wiring is checked
// as source. Hand-worked on the world W (tests/support/checkWorld.ts): plan = 3 requirements (wound care, patient intake, kombucha), 2 entries (SQL line 2,
// Ward nursing line 4); the route's reply is REPLY_W (3 accepted answers).

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

class FakeStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const ticked = () => { const s = new FakeStore(); s.setItem("career-copilot.consent", "1"); return s; };
const reply = (status: number, body: unknown, raw = false) =>
  vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () => new Response(raw ? String(body) : JSON.stringify(body), { status, headers: { "content-type": raw ? "text/plain" : "application/json" } }));
const planW = (): CheckPlan => buildCheckPlan(job(), personW(), skills, null);
const sentBody = (f: ReturnType<typeof reply>) => JSON.parse(String(f.mock.calls[0][1].body));
const withEntry = (plan: CheckPlan, over: Partial<CheckPlan["entries"][number]>): CheckPlan => ({ ...plan, entries: plan.entries.map((e, i) => (i === 0 ? { ...e, ...over } : e)) });
const withQuote = (plan: CheckPlan, quote: string): CheckPlan => ({ ...plan, requirements: plan.requirements.map((r, i) => (i === 0 ? { ...r, quote } : r)) });
const deps = (f: ReturnType<typeof reply>, consent: FakeStore | null = ticked(), access = new FakeStore()) => ({ post: { fetch: f as unknown as typeof fetch, store: access }, consentStore: consent });

afterEach(() => vi.restoreAllMocks());

describe("EC-4b runCheck: the click (RC)", () => {
  it("RC1: ticked, the W reply: outcome done; the key is the plan's; 3 answers; one POST to /api/check with exactly the quotes and the entries' name and text", async () => {
    const f = reply(200, REPLY_W);
    const o = await runCheck(planW(), deps(f));
    expect(o.kind).toBe("done");
    if (o.kind !== "done") return;
    expect(o.checked.key).toBe(planW().key);
    expect(o.checked.answers).toHaveLength(3);
    expect(o.checked.sent).toBe(3);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][0]).toBe("/api/check");
    expect(f.mock.calls[0][1].method).toBe("POST");
    expect(sentBody(f)).toEqual({
      requirements: ["You can care for wounds.", "You can run patient intake.", "Kombucha is a plus."],
      entries: [{ name: "SQL", text: LINES_W[1] }, { name: "Ward nursing", text: LINES_W[3] }],
    });
  });

  it("RC2: a failure changes nothing: the server's sentence, a rejected fetch, a bad body; applyOutcome gives back the SAME previous answers (and keeps null)", async () => {
    const prev: Checked = { key: "k", answers: [], thrownAway: 0, sent: 1 };
    const failures = [
      await runCheck(planW(), deps(reply(502, { error: "The AI answered, but not in a good shape." }))),
      await runCheck(planW(), deps(vi.fn(async () => { throw new Error("offline"); }) as unknown as ReturnType<typeof reply>)),
      await runCheck(planW(), deps(reply(200, { answers: "no" }))),
    ];
    for (const o of failures) {
      expect(o.kind).toBe("failed");
      expect(applyOutcome(prev, o)).toBe(prev);
      expect(applyOutcome(null, o)).toBeNull();
    }
    expect(applyOutcome(prev, { kind: "tick" })).toBe(prev);
    expect(applyOutcome(prev, { kind: "access" })).toBe(prev);
    const done = await runCheck(planW(), deps(reply(200, REPLY_W)));
    expect(applyOutcome(prev, done)).toBe((done as Extract<CheckOutcome, { kind: "done" }>).checked);
  });

  it("RC3: the tick is missing: nothing is sent (0 calls) and the outcome is 'tick'", async () => {
    const f = reply(200, REPLY_W);
    expect(await runCheck(planW(), deps(f, new FakeStore()))).toEqual({ kind: "tick" });
    expect(f).toHaveBeenCalledTimes(0);
  });

  it("RC4: a 401 shows the Access code box of the check: source 'check' with the need-code message (no code kept) or the not-accepted message (a code kept); nothing else changes", async () => {
    expect(await runCheck(planW(), deps(reply(401, {})))).toEqual({ kind: "access" });
    expect(getAccessUi()).toEqual({ source: "check", message: NEED_CODE_MESSAGE });
    const kept = new FakeStore();
    kept.setItem("career-copilot.access-code", "a-made-up-code-0123456789");
    expect(await runCheck(planW(), deps(reply(401, {}), ticked(), kept))).toEqual({ kind: "access" });
    expect(getAccessUi()).toEqual({ source: "check", message: WRONG_CODE_MESSAGE });
  });

  it("RC5: 400, 429, 500, 502 and 503 show the server's own sentence exactly; anything else, or an error with no sentence, is CHECK_SERVER_ERROR(status); a rejected fetch CHECK_UNREACHABLE; a 200 with a bad or non-JSON body CHECK_BAD_ANSWER", async () => {
    for (const status of [400, 429, 500, 502, 503]) {
      const sentence = `Invented sentence for ${status}.`;
      expect(await runCheck(planW(), deps(reply(status, { error: sentence })))).toEqual({ kind: "failed", message: sentence });
    }
    expect(await runCheck(planW(), deps(reply(504, "gateway timeout", true)))).toEqual({ kind: "failed", message: CHECK_SERVER_ERROR(504) });
    expect(await runCheck(planW(), deps(reply(500, {})))).toEqual({ kind: "failed", message: CHECK_SERVER_ERROR(500) });
    expect(await runCheck(planW(), deps(reply(502, { error: 7 })))).toEqual({ kind: "failed", message: CHECK_SERVER_ERROR(502) });
    const down = vi.fn(async () => { throw new TypeError("failed to fetch"); });
    expect(await runCheck(planW(), deps(down as unknown as ReturnType<typeof reply>))).toEqual({ kind: "failed", message: CHECK_UNREACHABLE });
    expect(await runCheck(planW(), deps(reply(200, { answers: [], thrownAway: -1 })))).toEqual({ kind: "failed", message: CHECK_BAD_ANSWER });
    expect(await runCheck(planW(), deps(reply(200, "<html>", true)))).toEqual({ kind: "failed", message: CHECK_BAD_ANSWER });
  });

  it("RC6: a contact detail in an entry's text or name: nothing is sent (0 calls), CHECK_CONTACT", async () => {
    for (const plan of [withEntry(planW(), { text: "Write to jane.sample@example.com about it" }), withEntry(planW(), { name: "Mail jane.sample@example.com" })]) {
      const f = reply(200, REPLY_W);
      expect(await runCheck(plan, deps(f))).toEqual({ kind: "failed", message: CHECK_CONTACT });
      expect(f).toHaveBeenCalledTimes(0);
    }
  });

  it("RC7: a reply of an older generation changes nothing: equal generations give the new answers, different ones give the previous", () => {
    const prev: Checked = { key: "old", answers: [], thrownAway: 0, sent: 1 };
    const next: Checked = { key: "new", answers: [], thrownAway: 0, sent: 2 };
    expect(acceptResult(2, 2, prev, next)).toBe(next);
    expect(acceptResult(3, 2, prev, next)).toBe(prev);
    expect(acceptResult(3, 2, null, next)).toBeNull();
    expect(acceptResult(0, 0, null, next)).toBe(next);
  });

  it("RC9: an email address in a requirement's words is still SENT (the info line says the ad goes as it is); the same address in an entry's text is not", async () => {
    const f = reply(200, REPLY_W);
    const o = await runCheck(withQuote(planW(), "You can mail jane.sample@example.com."), deps(f));
    expect(o.kind).toBe("done");
    expect(f).toHaveBeenCalledTimes(1);
    expect(sentBody(f).requirements[0]).toBe("You can mail jane.sample@example.com.");
    const g = reply(200, REPLY_W);
    expect(await runCheck(withEntry(planW(), { text: "Mail jane.sample@example.com" }), deps(g))).toEqual({ kind: "failed", message: CHECK_CONTACT });
    expect(g).toHaveBeenCalledTimes(0);
  });

  it("RC9b: the contact check looks at what will be sent, after the cut: an address that starts after the 1,000th character of a line is cut off and does not stop the send", async () => {
    const f = reply(200, REPLY_W);
    const long = `${"x".repeat(1000)} jane.sample@example.com`;
    const o = await runCheck(withEntry(planW(), { text: long }), deps(f));
    expect(o.kind).toBe("done");
    expect(sentBody(f).entries[0].text).toBe("x".repeat(1000));
  });

  it("RC10: the cut is for sending only: a requirement of 1,200 characters goes out as its first 1,000, an entry name of 150 as 120, an entry text of 1,100 as 1,000; the plan keeps its full texts", async () => {
    const plan = withEntry(withQuote(planW(), "q".repeat(1200)), { name: "n".repeat(150), text: "t".repeat(1100) });
    const f = reply(200, REPLY_W);
    await runCheck(plan, deps(f));
    const body = sentBody(f);
    expect(body.requirements[0]).toBe("q".repeat(1000));
    expect(body.entries[0].name).toBe("n".repeat(120));
    expect(body.entries[0].text).toBe("t".repeat(1000));
    expect(plan.requirements[0].quote).toHaveLength(1200);
    expect(plan.entries[0].text).toHaveLength(1100);
  });

  it("RC11: the message under the button is ONE thing, in order: the last click's message; else the stale line; else the finished line; else nothing", () => {
    const p = planW();
    const fresh: Checked = { key: p.key, answers: [{ index: 2, verdict: "none", entry: null, quote: null }, { index: 3, verdict: "none", entry: null, quote: null }], thrownAway: 0, sent: 3 };
    const stale: Checked = { ...fresh, key: p.key + "x" };
    expect(liveMessage("Last failure.", fresh, p)).toBe("Last failure.");
    expect(liveMessage(null, stale, p)).toBe(CHECK_STALE);
    expect(liveMessage(null, fresh, p)).toBe(CHECK_DONE(2, 3)); // every accepted answer counts, a none too
    expect(liveMessage(null, null, p)).toBe("");
    expect(liveMessage("Last failure.", null, p)).toBe("Last failure.");
  });
});

describe("EC-4b the box (CP3, CP8)", () => {
  beforeEach(() => forgetCodeOnDeleteAll(new FakeStore())); // the Access code box state is shared by the whole file (RC4 left it showing)
  const props = (plan: CheckPlan, over: Record<string, unknown> = {}) => ({ plan, checked: null, generation: 0, hasProfile: true, onChecked: () => {}, ...over });
  const html = (plan: CheckPlan, over: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(CheckBox, props(plan, over)));
  const text = (m: string) => m.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  it("CP8: the three states: no profile or nothing open: hidden; open requirements but no entry: no-entries; else ready", () => {
    const p = planW();
    expect(checkBoxState(p, true)).toBe("ready");
    expect(checkBoxState(p, false)).toBe("hidden");
    expect(checkBoxState({ ...p, requirements: [] }, true)).toBe("hidden");
    expect(checkBoxState({ ...p, entries: [] }, true)).toBe("no-entries");
    expect(checkBoxState({ ...p, requirements: [], entries: [] }, true)).toBe("hidden");
  });

  it("CP3a: hidden draws an empty string; no-entries draws its sentence and no button", () => {
    expect(html({ ...planW(), requirements: [] })).toBe("");
    const m = html({ ...planW(), entries: [] });
    expect(text(m)).toContain(CHECK_NO_ENTRIES);
    expect(m).not.toContain("<button");
  });

  it("CP3b: ready with 3 requirements: the info line, then the privacy link in a new tab, then the button 'Check 3 requirements…'; a polite live region; no tick box of its own; no 'not checked' line", () => {
    const m = html(planW());
    const t = text(m);
    expect(t).toContain(CHECK_INFO_LINE);
    expect(m).toMatch(/<a [^>]*href="\/privacy"[^>]*>/);
    const a = /<a [^>]*>/.exec(m)![0];
    expect(a).toContain('target="_blank"');
    expect(a).toContain('rel="noopener noreferrer"');
    expect(t).toContain(LINK_PRIVACY_NOTICE);
    expect(t).toContain(CHECK_BUTTON(3));
    expect(m.indexOf("<a ")).toBeLessThan(m.indexOf("<button"));
    expect(t.indexOf(CHECK_INFO_LINE)).toBeLessThan(t.indexOf(CHECK_BUTTON(3)));
    expect(m).toContain('aria-live="polite"');
    expect(m).not.toContain('type="checkbox"');
    expect(t).not.toContain("not checked");
    expect(m).not.toMatch(/\sdisabled(=|\s|>)/); // the button is not disabled (the class name "disabled:opacity-40" is not the attribute)
  });

  it("CP3c: with 5 left over the static line is under the button; stale answers show CHECK_STALE inside the live region; current answers show CHECK_DONE", () => {
    const p = { ...planW(), notChecked: 5 };
    const stale: Checked = { key: "something else", answers: [], thrownAway: 0, sent: 3 };
    const m = html(p, { checked: stale });
    expect(text(m)).toContain(CHECK_NOT_CHECKED(5));
    const live = /<p [^>]*aria-live="polite"[^>]*>([\s\S]*?)<\/p>/.exec(m);
    expect(live).not.toBeNull();
    expect(text(live![1])).toBe(CHECK_STALE);
    expect(m.indexOf(CHECK_NOT_CHECKED(5).slice(0, 10))).toBeGreaterThan(m.indexOf("<button"));
    const fresh: Checked = { key: p.key, answers: [{ index: 2, verdict: "none", entry: null, quote: null }], thrownAway: 0, sent: 3 };
    expect(text(/<p [^>]*aria-live="polite"[^>]*>([\s\S]*?)<\/p>/.exec(html(p, { checked: fresh }))![1])).toBe(CHECK_DONE(1, 3));
  });

  it("CP3d: the box has no sentence of its own: with everything showing, what is left after the known words are taken out is only spaces", () => {
    const p = { ...planW(), notChecked: 5 };
    let left = text(html(p, { checked: { key: "other", answers: [], thrownAway: 0, sent: 3 } }));
    for (const w of [CHECK_INFO_LINE, LINK_PRIVACY_NOTICE, CHECK_BUTTON(3), CHECK_NOT_CHECKED(5), CHECK_STALE]) left = left.replace(w, "");
    expect(left.trim()).toBe("");
  });
});

describe("EC-4b the wiring, as source (CP1, CP2, CP4, CP5, CP7, CP10)", () => {
  const bodyOf = (src: string, head: string) => {
    const start = src.indexOf(head);
    expect(start, `${head} is found`).toBeGreaterThan(-1);
    return src.slice(start, src.indexOf("\n  }\n", start));
  };

  it("CP1: the send happens only inside the gate, and only from a click: runCheck.ts calls sendIfAcknowledged( before postJson( (once); CheckBox calls runCheck( once, inside onCheck, and onCheck is used only as onClick", () => {
    const run = code("app/runCheck.ts");
    expect(run.split("postJson(").length - 1).toBe(1);
    expect(run.indexOf("sendIfAcknowledged(")).toBeGreaterThan(-1);
    expect(run.indexOf("sendIfAcknowledged(")).toBeLessThan(run.indexOf("postJson("));
    const box = code("app/CheckBox.tsx");
    expect(box.split("runCheck(").length - 1).toBe(1);
    const onCheck = bodyOf(box, "function onCheck()");
    expect(onCheck).toContain("runCheck(");
    expect((box.match(/\bonCheck\b/g) ?? []).length, "onCheck: its definition and one onClick").toBe(2);
    expect(box).toContain("onClick={onCheck}");
  });

  it("CP2: no effect in a file that sends or draws the button, nor in the page or CvBox", () => {
    for (const f of ["app/CheckBox.tsx", "app/runCheck.ts", "app/CvBox.tsx", "app/page.tsx"]) {
      expect(code(f), `${f} must have no effect hook`).not.toMatch(/\buse(Layout|Insertion)?Effect\b/);
    }
  });

  it("CP4: the new files store and log nothing: no session or local storage, no IndexedDB, no cookie, no console, no save or delete call", () => {
    for (const f of ["app/CheckBox.tsx", "app/runCheck.ts", "lib/cv/checkPlan.ts", "lib/cv/checkBridge.ts", "lib/cv/checkWording.ts"]) {
      expect(code(f), f).not.toMatch(/sessionStorage|localStorage|indexedDB|document\.cookie|\bconsole\.|saveProfile|saveJob|deleteAll|deleteJob|deleteProfile/);
    }
  });

  it("CP5: the page drops the answers on a new ad, an opened ad, a new CV reading, a saved profile in use and Delete everything; the box is remounted by key; onWipe is required and runs right after the tick is forgotten, before the first await", () => {
    const page = code("app/page.tsx");
    expect(page).toMatch(/<CheckBox\s+key=\{generation\}/);
    expect(bodyOf(page, "async function readAd()")).toContain("dropCheck()");
    expect(bodyOf(page, "async function onOpenAd(")).toContain("dropCheck()");
    expect(bodyOf(page, "function onCvRead(")).toContain("dropCheck()");
    expect(bodyOf(page, "function onUseProfile(")).toContain("dropCheck()");
    expect(page).toContain("onUse={onUseProfile}");
    expect(page).toContain("onWipe={dropCheck}");
    const saved = code("app/SavedControls.tsx");
    expect(saved).toMatch(/onWipe: \(\) => void/); // required: no question mark
    const del = bodyOf(saved, "async function onDeleteAll()");
    const tick = del.indexOf("forgetConsent(");
    const wipe = del.indexOf("onWipe(");
    expect(wipe).toBeGreaterThan(tick);
    expect(wipe).toBeLessThan(del.indexOf("await"));
    expect(wipe).toBeLessThan(del.indexOf("if (tabOnly"));
  });

  it("CP7: one polite live region, the button is disabled while it runs and shows the running text, and nothing moves the focus", () => {
    const box = code("app/CheckBox.tsx");
    expect(box.split('aria-live="polite"').length - 1).toBe(1);
    expect(box).toContain("disabled={running}");
    expect(box).toContain("CHECK_RUNNING");
    expect(box).not.toMatch(/\.focus\(/);
  });

  it("CP10: the access box and the helper know a 'check' source and the box sits under the button", () => {
    expect(code("app/accessFetch.ts")).toMatch(/type AccessSource = "cv" \| "ad" \| "check"/);
    expect(code("app/CheckBox.tsx")).toContain('<AccessBox source="check" />');
    expect(code("app/runCheck.ts")).toContain('source: "check"');
  });

  it("CP12: the box is drawn through ReportView's extra, only for the CV report", () => {
    expect(code("app/page.tsx")).toMatch(/report\.kind === "cv" && plan/);
  });
});
