import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, test } from "vitest";

const SHELL = join(dirname(fileURLToPath(import.meta.url)), "../../shell");
const store = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};

/** Runs one shell script against a stub browser: just enough window and document for its top level. */
function runShell(file: string, globals: Record<string, unknown>) {
  const frames: string[] = [];
  const listeners: Array<() => void> = [];
  const documentElement = { dataset: {} as Record<string, string> };
  const sandbox: Record<string, unknown> = {
    console: { warn() {} },
    clearTimeout() {},
    setTimeout: () => 0,
    document: {
      documentElement,
      head: { appendChild() {} },
      body: { appendChild() {} },
      createElement: (tag: string) => { frames.push(tag); return { remove() {} }; },
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    },
    addEventListener() {},
    ...globals,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(readFileSync(join(SHELL, file), "utf8"), sandbox);
  return { sandbox, frames, listeners, documentElement };
}

const themed = (name: string, saved: Record<string, string>) =>
  runShell("theme.js", {
    BABUL: { tokens: { color: {} }, product: { name, themes: ["light", "dark"] } },
    BABUL_SHELL: {},
    tailwind: {},
    localStorage: store(saved),
  });

describe("the shell's theme", () => {
  test("a choice saved by one product does not set another's", () => {
    const run = themed("Alpha", { "babul-theme:Beta": "dark" });
    expect(run.documentElement.dataset.theme).toBe("light");
  });

  test("a product's own saved choice is used", () => {
    const run = themed("Beta", { "babul-theme:Beta": "dark" });
    expect(run.documentElement.dataset.theme).toBe("dark");
  });
});

describe("the shell's crawl", () => {
  const CACHE = "babul-crawl:http://x/mobile";
  const model = { pages: [{ id: "a" }], links: [], journeys: [], components: {}, assets: {}, errors: [] };
  const crawl = (view: string, session: ReturnType<typeof store>) => {
    let built = false;
    const shell = { root: "http://x/", size: "mobile", view, lucideVersion: "0", buildModel: () => { built = true; } };
    const describe = { Collector: () => ({ errors: [], finish: () => model }), startOf: () => "a" };
    const run = runShell("crawl.js", { BABUL_SHELL: shell, BABUL_DESCRIBE: describe, BABUL: { product: {}, tokens: {} }, sessionStorage: session });
    run.listeners.forEach((fn) => fn());
    return { ...run, built: () => built, shell };
  };

  test("a page reuses the crawl the journey stored, without loading a frame", async () => {
    const run = crawl("", store({ [CACHE]: JSON.stringify(model) }));
    await (run.sandbox.BABUL_SHELL as { ready: Promise<void> }).ready;
    expect(run.built()).toBe(true);
    expect(run.frames).not.toContain("iframe");
  });

  test("the journey always reads the set again", () => {
    const run = crawl("journey", store({ [CACHE]: JSON.stringify(model) }));
    expect(run.frames).toContain("iframe");
  });
});
