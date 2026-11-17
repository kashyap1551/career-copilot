import { beforeEach, describe, expect, it } from "vitest";
import {
  accessAnswerMessage,
  accessHeaders,
  forgetCodeOnDeleteAll,
  forgetAccessCode,
  getAccessUi,
  keepAccessCode,
  postJson,
  readAccessCode,
} from "@/app/accessFetch";

// Step 6.1b, the page side (docs/PLAN-ACCESS-CODE.md, sections 3 and 5): P1 to P6. Plain functions, a fake storage and a
// fake fetch: no browser, no network. Expected wording is written from the plan's table in section 3.

const NEED = "Enter the access code you were given, then press the button again.";
const WRONG = "That access code was not accepted. Check it and try again.";
const KEY = "career-copilot.access-code";

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

let store: FakeStore;
beforeEach(() => {
  store = new FakeStore();
  forgetAccessCode(blocked); // clears the memory fallback between tests
  forgetAccessCode(store);
});

describe("P1: the header", () => {
  it("no code gives no header; a code gives x-access-code", () => {
    expect(accessHeaders(null)).toEqual({});
    expect(accessHeaders("abc")).toEqual({ "x-access-code": "abc" });
  });
});

describe("P2: the messages of section 3", () => {
  it("401 with nothing sent asks for the code; 401 with a code sent says it was not accepted", () => {
    expect(accessAnswerMessage(false)).toBe(NEED);
    expect(accessAnswerMessage(true)).toBe(WRONG);
  });
});

describe("P3: where the code is kept", () => {
  it("round trip in the tab's storage under one key, then forget", () => {
    expect(keepAccessCode("abc-code", store)).toBe(true);
    expect(store.m.get(KEY)).toBe("abc-code");
    expect(readAccessCode(store)).toBe("abc-code");
    forgetAccessCode(store);
    expect(readAccessCode(store)).toBeNull();
    expect(store.m.size).toBe(0);
  });

  it("the typed code is trimmed and capped at 128 characters; an empty one is not kept", () => {
    keepAccessCode("  spaced-code  ", store);
    expect(readAccessCode(store)).toBe("spaced-code");
    keepAccessCode("x".repeat(200), store);
    expect(readAccessCode(store)?.length).toBe(128);
    forgetAccessCode(store);
    expect(keepAccessCode("   ", store)).toBe(false);
    expect(readAccessCode(store)).toBeNull();
  });

  it("a storage that throws on every call never throws out: no code, then a memory fallback, then forgotten", () => {
    expect(readAccessCode(blocked)).toBeNull();
    expect(() => keepAccessCode("memory-code", blocked)).not.toThrow();
    expect(readAccessCode(blocked)).toBe("memory-code");
    expect(() => forgetAccessCode(blocked)).not.toThrow();
    expect(readAccessCode(blocked)).toBeNull();
  });
});

const fakeFetch = (status: number) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ error: "x" }), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
};

describe("P4: postJson", () => {
  it("sends the code in the header and never in the address; no header when no code is kept", async () => {
    keepAccessCode("kept-code-1234", store);
    const a = fakeFetch(200);
    const r1 = await postJson("/api/cv", { lines: ["a"] }, { source: "cv", fetch: a.f, store });
    expect(a.calls[0].url).toBe("/api/cv");
    expect(a.calls[0].url).not.toContain("?");
    expect(a.calls[0].url).not.toContain("kept-code-1234");
    expect(a.calls[0].init.headers).toEqual({ "Content-Type": "application/json", "x-access-code": "kept-code-1234" });
    expect(a.calls[0].init.body).toBe(JSON.stringify({ lines: ["a"] }));
    expect(r1.kind).toBe("answer");

    forgetAccessCode(store);
    const b = fakeFetch(200);
    await postJson("/api/read", { text: "t" }, { source: "ad", fetch: b.f, store });
    expect(b.calls[0].init.headers).toEqual({ "Content-Type": "application/json" });
  });
});

describe("P5: a 401", () => {
  it("after a send WITH a code: the kept code is removed and the 'not accepted' message shows for that source", async () => {
    keepAccessCode("kept-code-1234", store);
    const f = fakeFetch(401);
    const r = await postJson("/api/read", { text: "t" }, { source: "ad", fetch: f.f, store });
    expect(r).toEqual({ kind: "access", message: WRONG });
    expect(readAccessCode(store)).toBeNull();
    expect(getAccessUi()).toEqual({ source: "ad", message: WRONG });
  });

  it("after a send WITHOUT a code: nothing is kept and the 'enter the code' message shows", async () => {
    const f = fakeFetch(401);
    const r = await postJson("/api/cv", { lines: [] }, { source: "cv", fetch: f.f, store });
    expect(r).toEqual({ kind: "access", message: NEED });
    expect(readAccessCode(store)).toBeNull();
    expect(store.m.size).toBe(0);
    expect(getAccessUi()).toEqual({ source: "cv", message: NEED });
  });

  it("other statuses (200, 503) are handed back as the answer, and a kept code stays", async () => {
    keepAccessCode("kept-code-1234", store);
    for (const status of [200, 503]) {
      const f = fakeFetch(status);
      const r = await postJson("/api/read", { text: "t" }, { source: "ad", fetch: f.f, store });
      expect(r.kind).toBe("answer");
      expect(r.kind === "answer" && r.res.status).toBe(status);
    }
    expect(readAccessCode(store)).toBe("kept-code-1234");
  });
});

describe("P6: pressing 'Yes, delete everything' forgets the access code (before the delete, whether or not it works)", () => {
  it("it forgets the code from the tab storage and from memory", () => {
    keepAccessCode("kept-code-1234", store);
    expect(store.m.size).toBe(1);
    forgetCodeOnDeleteAll(store);
    expect(readAccessCode(store)).toBeNull();
    expect(store.m.size).toBe(0);
    expect(readAccessCode(blocked)).toBeNull(); // the memory copy is gone too (a blocked storage reads memory)
  });

  it("a blocked storage still clears the memory copy, and never throws", () => {
    keepAccessCode("memory-code-12", blocked);
    expect(readAccessCode(blocked)).toBe("memory-code-12");
    expect(() => forgetCodeOnDeleteAll(blocked)).not.toThrow();
    expect(readAccessCode(blocked)).toBeNull();
  });

  it("with no code kept it does nothing and does not throw", () => {
    expect(() => forgetCodeOnDeleteAll(store)).not.toThrow();
    expect(readAccessCode(store)).toBeNull();
  });
});
