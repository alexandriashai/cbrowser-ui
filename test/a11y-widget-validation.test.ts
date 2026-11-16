/**
 * The built a11y widget validates its site by origin and never sends a key.
 *
 * Until 2026-11-16 the snippet carried a full account API key (data-key) that
 * the widget posted to validate-widget, publishing a working credential on
 * every embedding site. Now the request body is empty and the server reads the
 * browser's Origin header. These tests run dist/a11y-widget.js (run
 * `bun run build` first) against a stub DOM that records what it is asked to do.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BUNDLE = join(import.meta.dir, "..", "dist", "a11y-widget.js");

/** Any property, call or construction returns another stub; nothing throws. */
function stub(): any {
  const fn = function () {};
  return new Proxy(fn, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => "";
      if (prop === "then") return undefined;
      return stub();
    },
    set() { return true; },
    apply() { return stub(); },
    construct() { return stub(); },
  });
}

type Run = { fetches: Array<{ url: string; body: unknown }>; mounted: number; warnings: string[] };

async function run(href: string, attrs: Record<string, string>, answer: { ok: boolean; status: number; body?: unknown } | "network-error"): Promise<Run> {
  const out: Run = { fetches: [], mounted: 0, warnings: [] };
  const url = new URL(href);
  const documentElement = new Proxy(stub(), {
    get(t, prop) {
      if (prop === "appendChild") return () => { out.mounted += 1; return stub(); };
      return Reflect.get(t, prop);
    },
  });
  const script = {
    getAttribute: (n: string) => (n in attrs ? attrs[n] : null),
    hasAttribute: (n: string) => n in attrs,
  };
  const document = new Proxy(stub(), {
    get(t, prop) {
      if (prop === "currentScript") return script;
      if (prop === "documentElement") return documentElement;
      if (prop === "readyState") return "complete";
      return Reflect.get(t, prop);
    },
  });
  const g = globalThis as any;
  const saved = { window: g.window, document: g.document, location: g.location, fetch: g.fetch, localStorage: g.localStorage, warn: console.warn };
  g.window = g;
  g.document = document;
  g.location = { hostname: url.hostname, protocol: url.protocol, href };
  g.localStorage = { getItem: () => null, setItem: () => {} };
  g.fetch = async (u: string, init: { body?: string }) => {
    out.fetches.push({ url: u, body: init?.body });
    if (answer === "network-error") throw new TypeError("Failed to fetch");
    return { ok: answer.ok, status: answer.status, json: async () => answer.body ?? {} };
  };
  console.warn = (...a: unknown[]) => { out.warnings.push(a.join(" ")); };
  delete g.__cbrowserA11yWidget;
  try {
    new Function(readFileSync(BUNDLE, "utf8"))();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 5));
  } finally {
    Object.assign(g, { window: saved.window, document: saved.document, location: saved.location, fetch: saved.fetch, localStorage: saved.localStorage });
    console.warn = saved.warn;
  }
  return out;
}

describe("a11y widget site validation", () => {
  test("the bundle exists (run `bun run build`)", () => {
    expect(existsSync(BUNDLE)).toBe(true);
  });

  test("a registered site: one request, empty body, widget mounts", async () => {
    const r = await run("https://shop.example/", {}, { ok: true, status: 200, body: { valid: true } });
    expect(r.fetches.length).toBe(1);
    expect(r.fetches[0].url).toBe("https://cbrowser.ai/cms/api/accounts/validate-widget");
    expect(JSON.parse(String(r.fetches[0].body))).toEqual({});
    expect(r.mounted).toBeGreaterThan(0);
  });

  test("Anti: an old data-key attribute is never sent, and the owner is told to remove it", async () => {
    const key = "cbk_0123456789abcdef0123456789abcdef";
    const r = await run("https://shop.example/", { "data-key": key }, { ok: true, status: 200 });
    expect(r.fetches.length).toBe(1);
    expect(String(r.fetches[0].body)).not.toContain(key);
    expect(String(r.fetches[0].body)).not.toContain("key");
    expect(r.warnings.some((w) => w.includes("data-key is no longer used"))).toBe(true);
  });

  test("a refused site stays disabled and says why", async () => {
    const r = await run("https://unregistered.example/", {}, { ok: false, status: 403, body: { error: "unregistered.example is not an active Pro or Enterprise site." } });
    expect(r.fetches.length).toBe(1);
    expect(r.mounted).toBe(0);
    expect(r.warnings.some((w) => w.includes("unregistered.example is not an active"))).toBe(true);
  });

  test("cbrowser.ai unreachable: the visitor keeps the controls", async () => {
    const r = await run("https://shop.example/", {}, "network-error");
    expect(r.mounted).toBeGreaterThan(0);
  });

  test("local development skips the check", async () => {
    for (const href of ["http://localhost:3000/", "http://127.0.0.1:8080/", "file:///tmp/page.html", "http://app.localhost/"]) {
      const r = await run(href, {}, { ok: false, status: 403 });
      expect(r.fetches.length, href).toBe(0);
      expect(r.mounted, href).toBeGreaterThan(0);
    }
  });
});
