import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { buildSite, quartzConfig } from "../src/wiki.ts";
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
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: out, report: "r" });
    expect(readlinkSync(join(out, "alpha"))).toBe(join(root, "alpha/.context/wiki"));
  });

  test("writes a home page linking each product's wiki, plus the check report", () => {
    const root = workspace();
    const out = makeTree({});
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: out, report: "alpha  ok" });
    expect(readFileSync(join(out, "index.md"), "utf8")).toContain("[[alpha/index|alpha]]");
    expect(readFileSync(join(out, "canon-check.md"), "utf8")).toContain("alpha  ok");
  });

  test("gives each product with architecture rules a graph page, linked from home", () => {
    const root = workspace();
    const out = makeTree({});
    const graph = (repo: string) => (repo.endsWith("alpha") ? "```mermaid\nflowchart LR\n  1[\"web\"]-->2[\"ui\"]\n```" : undefined);
    buildSite([join(root, "alpha"), join(root, "beta")], { siteDir: out, report: "", graph });
    expect(readFileSync(join(out, "architecture/alpha.md"), "utf8")).toContain('```mermaid\nflowchart LR\n  1["web"]-->2["ui"]\n```');
    expect(existsSync(join(out, "architecture/beta.md"))).toBe(false);
    const home = readFileSync(join(out, "index.md"), "utf8");
    expect(home).toContain("[[alpha/index|alpha]] · [[architecture/alpha|architecture graph]]");
    expect(home).not.toContain("architecture/beta");
  });

  test("rebuilding replaces old links instead of failing", () => {
    const root = workspace();
    const out = makeTree({});
    const options = { siteDir: out, report: "" };
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

  test("keeps everything else from the defaults", () => {
    expect(parse(quartzConfig(defaults)).plugins).toEqual([]);
  });
});
