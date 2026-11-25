import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { forgetCodeOnDeleteAll, keepAccessCode, readAccessCode } from "@/app/accessFetch";
import { forgetConsent, getConsentSnapshot, giveConsent, readConsent, subscribeConsent } from "@/app/consent";
import { DELETE_ALL_DONE, TAB_ONLY_CONFIRM, TAB_ONLY_DONE, deleteAllMode, deleteAllShows } from "@/app/deleteAll";
import { skills } from "@/fixtures/skills";
import { buildProfile, initialConfirm } from "@/lib/cv/profile";
import { buildJob } from "@/lib/engine/fromAd";
import { fromCv } from "@/lib/engine/fromCv";
import { deleteAll, listJobs, loadProfile, saveJob, saveProfile } from "@/lib/saved/saved";
import { MemoryStore } from "@/lib/saved/store";
import { statusVisible } from "@/lib/saved/ui";

// Step 9.3, stage 2.5 (docs/PLAN-9.3.md section 5, amendments A9, A11, A13): "Delete everything saved on this device" also forgets the tick, and is
// also offered when saving is not available (then it only forgets the tab's access code and tick). Written BEFORE app/deleteAll.ts exists.
//
// HAND-WORKED EXPECTATIONS
//  D1  a MemoryStore with 1 saved profile and 2 saved ads (made-up CV line "Built weekly sales sheets in Excel", two made-up ad texts):
//      before: listJobs has 2 jobs and loadProfile holds a profile (1 + 2); deleteAll(ctx) gives { ok: true }; after: listJobs has 0 jobs, loadProfile
//      gives { ok: true, saved: null } (0 + 0).
//  D2  Part A: a fake tab store with the access code "abcdefghijklmnop" (keepAccessCode) and the tick (giveConsent): 2 keys before. After
//      forgetCodeOnDeleteAll(store) and forgetConsent(store): readAccessCode(store) is null, readConsent(store) is false, the store holds 0 keys.
//      Part B (source): in app/SavedControls.tsx, inside onDeleteAll: forgetCodeOnDeleteAll( < forgetConsent( < deleteAll( and no `await` before
//      forgetConsent( (the first await in the body is `await deleteAll(`).
//  D3  the three strings are exactly (pinned by hand):
//        DELETE_ALL_DONE  "Deleted: the saved profile and ads on this device, and the access code and the tick kept for this tab. Text still on the screen goes away when you reload the page."
//        TAB_ONLY_CONFIRM "Forget the access code and the tick for this tab?"
//        TAB_ONLY_DONE    "Forgotten: the access code and the tick kept for this tab. Text still on the screen goes away when you reload the page."
//      and SavedControls.tsx uses them: {TAB_ONLY_CONFIRM} in the confirm line, DELETE_ALL_DONE after a successful delete, TAB_ONLY_DONE in the
//      tab-only case; the normal confirm text "Delete the saved profile and everything else saved on this device?", the button
//      "Delete everything saved on this device" and the button "Yes, delete everything" are still there.
//  D4  deleteAllShows: { phase: "ready", available: true } true; { phase: "ready", available: false } true; { phase: "checking" } false.
//      deleteAllMode: ready + available + a context -> "everything"; ready + available false (context set or null) -> "tab-only"; ready + available
//      true but no context -> "tab-only" (nothing to delete in). Nothing under app/demo, lib/demo or app/DemoEntry.tsx mentions SavedDeleteAll,
//      deleteAll, app/deleteAll or one of the three strings.
//  D5  (source) in onDeleteAll the tab-only case returns BEFORE `await deleteAll(`: the body holds TAB_ONLY_DONE and a `return` before `await deleteAll(`,
//      and the condition that returns is the tab-only mode (so deleteAll is never called with a missing store context).
//
//  D6  (stage 2.5b) forgetConsent() and giveConsent() with NO argument, as onDeleteAll and the checkbox call them, use the tab's own store and tell
//      the subscribers (so the checkbox in CvBox unticks without a reload). A fake store is put in place of the tab's storage. Subscribe a spy; then
//      giveConsent(): the fake holds career-copilot.consent = "1", getConsentSnapshot() is true, the spy was called 1 time; then forgetConsent(): the
//      fake holds 0 keys, getConsentSnapshot() is false, the spy was called 2 times in all; after unsubscribing, one more giveConsent() leaves it at 2.
//  D7  (stage 2.5b) the control and the status line are drawn outside every condition. In app/page.tsx `<SavedDeleteAll` and `<SavedStatus` each
//      occur once, with nothing before the tag on its line and no `&&` or `?` at the end of the line above; the body of SavedDeleteAll has exactly one
//      `return null` and no `.available` (the pure functions decide); SavedStatus draws when `statusVisible(saved.status, currentKey)`; onDeleteAll's
//      three setStatus calls ("Deleting…", TAB_ONLY_DONE, the success or failure line)
//      each have ONE argument (no key; the exact words are pinned in D3); statusVisible({ text, key: null }, null) and (..., "some-profile-key") are true for both messages; useSaved.ts keeps
//      the default key null.
//
// COUNTS: this file has 7 tests (D1 to D7).

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const bodyOfOnDeleteAll = () => {
  const src = read("app/SavedControls.tsx");
  const start = src.indexOf("async function onDeleteAll()");
  expect(start).toBeGreaterThan(0);
  return src.slice(start, src.indexOf("\n  }\n", start));
};

afterEach(() => vi.unstubAllGlobals());

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

describe("delete everything saved on this device (PLAN-9.3 section 5)", () => {
  it("D1: deleteAll empties a store that held 1 profile and 2 ads", async () => {
    const lines = ["Managed the stockroom for a bakery", "Built weekly sales sheets in Excel", "Greeted customers at the counter"];
    const cv = fromCv({ skills: [{ name: "Excel", line: 2, quote: "sales sheets in Excel" }] }, lines, skills);
    const built = buildProfile(lines, cv.skills, initialConfirm(cv.skills), skills);
    const store = new MemoryStore();
    const ctx = { store, stamps: { vocabularyHash: "test-vocabulary", readingVersion: "test-reading", adRequestHash: "test-request" } };
    expect(await saveProfile(ctx, built)).toEqual({ ok: true });
    for (const [text, skill] of [["A bakery needs SQL every week.", "SQL"], ["A shop needs Excel every day.", "Excel"]]) {
      const extraction = {
        title: null, company: null, location: null, workMode: null, minYears: null, startDate: null, languages: [], otherConditions: [],
        requirements: [{ quote: `needs ${skill}`, importance: "must" as const, skills: [{ name: skill }] }],
      };
      const job = buildJob(extraction, text, skills, { id: "pasted-ad", source: null });
      const saved = await saveJob(ctx, { adText: text, extraction, reading: { job: job.job, removed: job.removed, moved: job.moved, unlisted: job.unlisted, notCounted: job.notCounted } });
      expect(saved.ok).toBe(true);
    }
    const before = await listJobs(ctx);
    expect(before.ok && before.jobs.length).toBe(2);
    const profileBefore = await loadProfile(ctx);
    expect(profileBefore.ok && profileBefore.saved !== null).toBe(true);

    expect(await deleteAll(ctx)).toEqual({ ok: true });
    const after = await listJobs(ctx);
    expect(after.ok && after.jobs.length).toBe(0);
    expect(await loadProfile(ctx)).toEqual({ ok: true, saved: null });
  });

  it("D8 (EC-2): a saved profile that holds unlistedKept is gone after delete everything: no profile record, no entry left behind", async () => {
    const lines = ["Alex Example", "Dressed and monitored wounds on a surgical ward"];
    const proposal = { name: "Wound care", skillId: "new:wound-care", listed: false, line: 2, quote: "Dressed and monitored wounds", label: "named" as const };
    const built = buildProfile(lines, [proposal], initialConfirm([proposal]), skills);
    expect(built.unlistedKept).toHaveLength(1);
    const store = new MemoryStore();
    const ctx = { store, stamps: { vocabularyHash: "test-vocabulary", readingVersion: "test-reading", adRequestHash: "test-request" } };
    expect(await saveProfile(ctx, built)).toEqual({ ok: true });
    const before = await loadProfile(ctx);
    expect(before.ok && before.saved?.unlistedKept).toHaveLength(1);
    expect(await deleteAll(ctx)).toEqual({ ok: true });
    expect(await loadProfile(ctx)).toEqual({ ok: true, saved: null });
    expect(await store.get("profile", "current")).toBeUndefined();
  });

  it("D2: the confirm handler forgets the access code and the tick, before anything else and before it tries to delete", () => {
    // Part A: the pure part.
    const tab = new FakeStore();
    keepAccessCode("abcdefghijklmnop", tab);
    giveConsent(tab);
    expect(tab.m.size).toBe(2);
    forgetCodeOnDeleteAll(tab);
    forgetConsent(tab);
    expect(readAccessCode(tab)).toBeNull();
    expect(readConsent(tab)).toBe(false);
    expect(tab.m.size).toBe(0);
    // Part B: the wiring, as source.
    const body = bodyOfOnDeleteAll();
    const code = body.indexOf("forgetCodeOnDeleteAll(");
    const tick = body.indexOf("forgetConsent(");
    const del = body.indexOf("await deleteAll(");
    expect(code).toBeGreaterThan(-1);
    expect(tick).toBeGreaterThan(code);
    expect(del).toBeGreaterThan(tick);
    expect(body.indexOf("await"), "the first await comes after the tick is forgotten").toBeGreaterThan(tick);
    // EC-4b: the page's on-screen answers of a check are dropped right after the tick, before the tab-only branch and before any await.
    const wipe = body.indexOf("onWipe(");
    expect(wipe, "onWipe( comes after forgetConsent(").toBeGreaterThan(tick);
    expect(wipe, "onWipe( comes before the first await").toBeLessThan(body.indexOf("await"));
    expect(read("app/SavedControls.tsx").split("forgetConsent(").length - 1, "forgetConsent( is called once, in onDeleteAll").toBe(1);
  });

  it("D3: the three strings are exactly the pinned words, and the control uses them", () => {
    expect(DELETE_ALL_DONE).toBe(
      "Deleted: the saved profile and ads on this device, and the access code and the tick kept for this tab. Text still on the screen goes away when you reload the page.",
    );
    expect(TAB_ONLY_CONFIRM).toBe("Forget the access code and the tick for this tab?");
    expect(TAB_ONLY_DONE).toBe("Forgotten: the access code and the tick kept for this tab. Text still on the screen goes away when you reload the page.");
    const src = read("app/SavedControls.tsx");
    expect(src).toContain('from "./deleteAll"');
    // Used OUTSIDE the import line (an import alone proves nothing).
    const used = (name: string) => src.split("\n").filter((l) => !/^import\s/.test(l) && l.includes(name)).length;
    expect(used("TAB_ONLY_CONFIRM"), "TAB_ONLY_CONFIRM is used in the control").toBeGreaterThanOrEqual(1);
    expect(used("TAB_ONLY_DONE"), "TAB_ONLY_DONE is used in the control").toBeGreaterThanOrEqual(1);
    expect(src).toContain("{TAB_ONLY_CONFIRM}");
    // The success status is DELETE_ALL_DONE, in onDeleteAll, exactly as it stands.
    const body = bodyOfOnDeleteAll();
    expect(body).toContain('setStatus(result.ok ? DELETE_ALL_DONE : deleteStatus(result, "everything"));');
    expect(body).toContain("setStatus(TAB_ONLY_DONE);");
    expect(src).toContain("Delete the saved profile and everything else saved on this device?");
    expect(src).toContain("Delete everything saved on this device");
    expect(src).toContain("Yes, delete everything");
  });

  it("D4: the control shows when saving is available or not, never while checking; the mode says what it may touch; the demo has none of it", () => {
    expect(deleteAllShows({ phase: "ready", available: true })).toBe(true);
    expect(deleteAllShows({ phase: "ready", available: false })).toBe(true);
    expect(deleteAllShows({ phase: "checking" })).toBe(false);
    const ctx = {} as never;
    expect(deleteAllMode({ phase: "ready", available: true, ctx })).toBe("everything");
    expect(deleteAllMode({ phase: "ready", available: false, ctx })).toBe("tab-only");
    expect(deleteAllMode({ phase: "ready", available: false, ctx: null })).toBe("tab-only");
    expect(deleteAllMode({ phase: "ready", available: true, ctx: null })).toBe("tab-only");

    const files: string[] = ["app/DemoEntry.tsx"];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(root, dir))) {
        const rel = `${dir}/${name}`;
        if (statSync(join(root, rel)).isDirectory()) walk(rel);
        else files.push(rel);
      }
    };
    walk("app/demo");
    walk("lib/demo");
    for (const f of files) {
      const src = read(f);
      for (const w of ["SavedDeleteAll", "deleteAll", "DELETE_ALL_DONE", "TAB_ONLY_CONFIRM", "TAB_ONLY_DONE"]) expect(src, `${f} must not contain ${w}`).not.toContain(w);
    }
  });

  it("D5: in the tab-only case onDeleteAll returns before it calls deleteAll", () => {
    const body = bodyOfOnDeleteAll();
    const del = body.indexOf("await deleteAll(");
    const done = body.indexOf("TAB_ONLY_DONE");
    const ret = body.indexOf("return", body.indexOf("forgetConsent("));
    expect(done).toBeGreaterThan(-1);
    expect(ret).toBeGreaterThan(-1);
    expect(done).toBeLessThan(del);
    expect(ret).toBeLessThan(del);
    const before = body.slice(0, del);
    expect(before).toMatch(/tabOnly|mode === "tab-only"/);
  });

  it("D6: with no argument, giving and forgetting the tick use the tab's own store and tell the subscribers", () => {
    const fake = new FakeStore();
    vi.stubGlobal("sessionStorage", fake);
    const listener = vi.fn();
    const unsubscribe = subscribeConsent(listener);
    giveConsent();
    expect(fake.getItem("career-copilot.consent")).toBe("1");
    expect(getConsentSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    forgetConsent();
    expect(fake.m.size).toBe(0);
    expect(getConsentSnapshot()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    giveConsent();
    expect(listener).toHaveBeenCalledTimes(2);
    forgetConsent();
  });

  it("D7: the control and the status line are drawn outside every condition, and a message without a key is always visible", () => {
    const page = read("app/page.tsx");
    const lines = page.split("\n");
    for (const tag of ["<SavedDeleteAll", "<SavedStatus"]) {
      expect(page.split(tag).length - 1, `${tag} occurs once`).toBe(1);
      const at = lines.findIndex((l) => l.includes(tag));
      expect(lines[at].slice(0, lines[at].indexOf(tag)).trim(), `nothing before ${tag} on its line`).toBe("");
      const previous = lines.slice(0, at).reverse().find((l) => l.trim() !== "") ?? "";
      expect(previous, `${tag} is not inside a condition`).not.toMatch(/&&\s*\(?\s*$|\?\s*\(?\s*$/);
    }
    const src = read("app/SavedControls.tsx");
    const start = src.indexOf("export function SavedDeleteAll");
    const body = src.slice(start, src.indexOf("\n}\n", start));
    expect(body.split("return null").length - 1).toBe(1);
    expect(body).toContain('if (!deleteAllShows(state) || state.phase !== "ready") return null;');
    expect(body).not.toContain(".available");
    expect(src).toContain("return statusVisible(saved.status, currentKey) ? (");
    const handler = bodyOfOnDeleteAll();
    // Every setStatus call in onDeleteAll has ONE argument (no key), so the message is shown whatever is on screen. (The exact words are pinned in D3.)
    const calls = handler.split("\n").filter((l) => l.includes("setStatus("));
    expect(calls.length).toBe(3);
    for (const l of calls) {
      expect(l.trim(), "a status call with no key").toMatch(/^setStatus\((?:"[^"]*"|TAB_ONLY_DONE|result\.ok \? [A-Za-z_]+ : deleteStatus\(result, "everything"\))\);/);
    }
    for (const text of [DELETE_ALL_DONE, TAB_ONLY_DONE]) {
      expect(statusVisible({ text, key: null }, null)).toBe(true);
      expect(statusVisible({ text, key: null }, "some-profile-key")).toBe(true);
    }
    expect(read("app/useSaved.ts")).toContain("const setStatus = useCallback((text: string | null, key: string | null = null)");
  });
});
