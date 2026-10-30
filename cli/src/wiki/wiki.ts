import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseDocument, type YAMLMap, type YAMLSeq } from "yaml";

export interface SiteOptions {
  /** Quartz content folder: one symlink per product wiki, plus the home page. */
  siteDir: string;
  /** A product's architecture as markdown with mermaid graphs, or undefined when it has none. */
  graph?: (repo: string) => string | undefined;
}

function relink(target: string, link: string): void {
  rmSync(link, { force: true, recursive: false });
  symlinkSync(target, link);
}

/** Lays out the content Quartz renders. */
export function buildSite(products: string[], options: SiteOptions): void {
  mkdirSync(options.siteDir, { recursive: true });
  const rows: string[] = [];

  for (const product of products) {
    const name = basename(product);
    const wiki = join(product, ".context", "wiki");
    const links: string[] = [];
    if (existsSync(wiki)) {
      relink(wiki, join(options.siteDir, name));
      links.push(`[[${name}/index|${name}]]`);
    }
    const graph = options.graph?.(product);
    if (graph) {
      mkdirSync(join(options.siteDir, "architecture"), { recursive: true });
      writeFileSync(
        join(options.siteDir, "architecture", `${name}.md`),
        `---\ntitle: ${name} architecture\n---\n\nImports between parts of ${name}, from its \`.dependency-cruiser.cjs\`. Broken rules fail \`canon check\`.\n\n${graph}\n`,
      );
      links.push(`[[architecture/${name}|architecture graph]]`);
    }
    if (links.length > 0) rows.push(`- ${links.join(" · ")}`);
  }

  writeFileSync(
    join(options.siteDir, "index.md"),
    `---\ntitle: canon\n---\n\nEvery product's wiki, searchable and linked; products with architecture rules also get an import graph.\n\n${rows.join("\n")}\n`,
  );
  // The site folder outlives upgrades: an older canon wrote this page, and Quartz would still render it.
  rmSync(join(options.siteDir, "canon-check.md"), { force: true });
}

const IGNORED = ["**/CLAUDE.md"];

/** Quartz's default config, adjusted for a private local site: no analytics, no schema files as pages, no social card images (most of the build time). */
export function quartzConfig(defaultsYaml: string): string {
  const document = parseDocument(defaultsYaml);
  document.setIn(["configuration", "pageTitle"], "canon");
  document.setIn(["configuration", "analytics"], null);
  document.setIn(["configuration", "baseUrl"], "localhost");
  const current = (document.getIn(["configuration", "ignorePatterns"]) as { toJSON(): string[] } | undefined)?.toJSON() ?? [];
  document.setIn(["configuration", "ignorePatterns"], [...current, ...IGNORED.filter((p) => !current.includes(p))]);
  const plugins = document.get("plugins") as YAMLSeq<YAMLMap> | undefined;
  plugins?.items.find((plugin) => plugin.get("source") === "@quartz-community/og-image")?.set("enabled", false);
  return document.toString();
}
