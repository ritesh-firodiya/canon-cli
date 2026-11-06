import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { buildSite, quartzConfig } from "../src/serve/wiki/wiki.ts";
import { makeTree } from "./helpers/fixture.ts";

describe("buildSite", () => {
  const workspace = () =>
    makeTree({
      "alpha/.context/wiki/index.md": "# a",
      "beta/.context/wiki/index.md": "# b",
    });

  test("links each wiki into the site", () => {
    const root = workspace();
    const out = makeTree({});
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: out });
    expect(readlinkSync(join(out, "alpha"))).toBe(join(root, "alpha/.context/wiki"));
  });

  test("writes a home page linking each product's wiki, with no check report", () => {
    const root = workspace();
    const out = makeTree({});
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: out });
    const home = readFileSync(join(out, "index.md"), "utf8");
    expect(home).toContain("[alpha](alpha/index.md)");
    expect(home).not.toContain("canon-check");
    expect(existsSync(join(out, "canon-check.md"))).toBe(false);
  });

  test("gives each product with architecture rules a graph page, linked from home", () => {
    const root = workspace();
    const out = makeTree({});
    const graph = (repo: string) => (repo.endsWith("alpha") ? "```mermaid\nflowchart LR\n  1[\"web\"]-->2[\"ui\"]\n```" : undefined);
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: out, graph });
    expect(readFileSync(join(out, "architecture/alpha.md"), "utf8")).toContain('```mermaid\nflowchart LR\n  1["web"]-->2["ui"]\n```');
    expect(existsSync(join(out, "architecture/beta.md"))).toBe(false);
    const home = readFileSync(join(out, "index.md"), "utf8");
    expect(home).toContain("[alpha](alpha/index.md) · [architecture graph](architecture/alpha.md)");
    expect(home).not.toContain("architecture/beta");
  });

  test("rebuilding replaces old links instead of failing", () => {
    const root = workspace();
    const out = makeTree({});
    const options = { siteDir: out };
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
    expect(config.ignorePatterns).toEqual(["private", "**/CLAUDE.md"]);
  });

  test("turns social card images off and leaves other plugins alone", () => {
    const withPlugins = `configuration: {}\nplugins:\n  - source: "@quartz-community/og-image"\n    enabled: true\n  - source: "@quartz-community/favicon"\n    enabled: true\n`;
    expect(parse(quartzConfig(withPlugins)).plugins).toEqual([
      { source: "@quartz-community/og-image", enabled: false },
      { source: "@quartz-community/favicon", enabled: true },
    ]);
  });

  test("resolves Markdown links relative to the page", () => {
    const withLinks = `configuration: {}\nplugins:\n  - source: "@quartz-community/crawl-links"\n    options:\n      markdownLinkResolution: shortest\n`;
    expect(parse(quartzConfig(withLinks)).plugins[0].options.markdownLinkResolution).toBe("relative");
  });

  test("keeps everything else from the defaults", () => {
    expect(parse(quartzConfig(defaults)).plugins).toEqual([]);
  });
});
