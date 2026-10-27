import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { buildSite, quartzConfig } from "../src/ui.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("buildSite", () => {
  const estate = () =>
    makeTree({
      "alpha/.context/wiki/index.md": "# a",
      "alpha/.context/designs/mobile/index.html": "<html>",
      "beta/.context/wiki/index.md": "# b",
    });

  test("links each wiki into the site and each designs folder into the designs root", () => {
    const root = estate();
    const out = makeTree({});
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: join(out, "site"), designsDir: join(out, "designs"), designsUrl: "http://127.0.0.1:8081", report: "r" });
    expect(readlinkSync(join(out, "site/alpha"))).toBe(join(root, "alpha/.context/wiki"));
    expect(lstatSync(join(out, "designs/alpha")).isSymbolicLink()).toBe(true);
    expect(existsSync(join(out, "designs/beta"))).toBe(false);
  });

  test("writes a home page linking each product's wiki and designs, plus the check report", () => {
    const root = estate();
    const out = makeTree({});
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: out, designsDir: join(out, "_designs"), designsUrl: "http://127.0.0.1:8081", report: "alpha  ok" });
    const home = readFileSync(join(out, "index.md"), "utf8");
    expect(home).toContain("[[alpha/index|alpha]]");
    expect(home).toContain("mobile: [flow chart](http://127.0.0.1:8081/alpha/mobile/index.html)");
    expect(home).not.toContain("http://127.0.0.1:8081/beta");
    expect(readFileSync(join(out, "canon-check.md"), "utf8")).toContain("alpha  ok");
  });

  test("links every drawn surface to its flow chart, screenshots and architecture overview", () => {
    const root = makeTree({
      "both/.context/wiki/index.md": "# both",
      "both/.context/designs/mobile/index.html": "<html>",
      "both/.context/designs/mobile/screenshots.html": "<html>",
      "both/.context/designs/mobile/routes.js": 'window.ROUTES = {\n  architecture: "architecture/overview.html",\n};',
      "both/.context/designs/mobile/architecture/overview.html": "<html>",
      "both/.context/designs/web/index.html": "<html>",
      "both/.context/designs/web/routes.js": 'window.ROUTES = {\n  "architecture": "architecture/gone.html"\n};',
    });
    const out = makeTree({});
    buildSite([join(root, "both")], { siteDir: out, designsDir: join(out, "_d"), designsUrl: "http://d", report: "" });
    const home = readFileSync(join(out, "index.md"), "utf8");
    expect(home).toContain(
      "mobile: [flow chart](http://d/both/mobile/index.html) · [screenshots](http://d/both/mobile/screenshots.html) · [architecture](http://d/both/mobile/architecture/overview.html)",
    );
    expect(home).toContain("web: [flow chart](http://d/both/web/index.html)");
    expect(home).not.toContain("architecture/gone.html");
  });

  test("gives each product with architecture rules a graph page, linked from home", () => {
    const root = estate();
    const out = makeTree({});
    const graph = (repo: string) => (repo.endsWith("alpha") ? "```mermaid\nflowchart LR\n  1[\"web\"]-->2[\"ui\"]\n```" : undefined);
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: out, designsDir: join(out, "_d"), designsUrl: "u", report: "", graph });
    expect(readFileSync(join(out, "architecture/alpha.md"), "utf8")).toContain('```mermaid\nflowchart LR\n  1["web"]-->2["ui"]\n```');
    expect(existsSync(join(out, "architecture/beta.md"))).toBe(false);
    const home = readFileSync(join(out, "index.md"), "utf8");
    expect(home).toContain("[[alpha/index|alpha]] · [[architecture/alpha|architecture graph]]");
    expect(home).not.toContain("architecture/beta");
  });

  test("rebuilding replaces old links instead of failing", () => {
    const root = estate();
    const out = makeTree({});
    const options = { siteDir: out, designsDir: join(out, "_d"), designsUrl: "u", report: "" };
    buildSite([join(root, "alpha")], options);
    expect(() => buildSite([join(root, "alpha")], options)).not.toThrow();
  });
});

describe("quartzConfig", () => {
  const defaults = "configuration:\n  pageTitle: Quartz 5\n  analytics:\n    provider: plausible\n  baseUrl: quartz.jzhao.xyz\n  ignorePatterns:\n    - private\nplugins: []\n";

  test("names the site, turns analytics off, serves locally and hides schema files", () => {
    const config = parse(quartzConfig(defaults)).configuration;
    expect(config.pageTitle).toBe("canon");
    expect(config.analytics).toBeNull();
    expect(config.baseUrl).toBe("localhost");
    expect(config.ignorePatterns).toEqual(["private", "**/CLAUDE.md", "_designs"]);
  });

  test("keeps everything else from the defaults", () => {
    expect(parse(quartzConfig(defaults)).plugins).toEqual([]);
  });
});
