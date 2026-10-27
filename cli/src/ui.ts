import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseDocument } from "yaml";

export interface SiteOptions {
  /** Quartz content folder: one symlink per product wiki, plus the home page. */
  siteDir: string;
  /** Static folder for the design galleries: one symlink per product designs/. */
  designsDir: string;
  designsUrl: string;
  /** `canon check --all` output, shown as its own page. */
  report: string;
  /** A product's architecture as markdown with mermaid graphs, or undefined when it has none. */
  graph?: (repo: string) => string | undefined;
}

const SURFACES = ["mobile", "web"];

function relink(target: string, link: string): void {
  rmSync(link, { force: true, recursive: false });
  symlinkSync(target, link);
}

// routes.js comes in two styles (`architecture: "…"` and `"architecture": "…"`);
// a regex reads both without executing the manifest.
const ARCHITECTURE_KEY = /["']?architecture["']?\s*:\s*["']([^"']+)["']/;

/** The views a drawn surface offers — flow chart, screenshots, architecture — as relative paths that exist. */
function surfaceViews(designs: string, surface: string): Array<[string, string]> {
  const dir = join(designs, surface);
  if (!existsSync(join(dir, "index.html"))) return [];
  const views: Array<[string, string]> = [["flow chart", "index.html"]];
  if (existsSync(join(dir, "screenshots.html"))) views.push(["screenshots", "screenshots.html"]);
  const routes = join(dir, "routes.js");
  const architecture = existsSync(routes) ? ARCHITECTURE_KEY.exec(readFileSync(routes, "utf8"))?.[1] : undefined;
  if (architecture && existsSync(join(dir, architecture))) views.push(["architecture", architecture]);
  return views.map(([label, path]) => [label, `${surface}/${path}`]);
}

/** Lays out the content Quartz renders and the folder the design server serves. */
export function buildSite(products: string[], options: SiteOptions): void {
  mkdirSync(options.siteDir, { recursive: true });
  mkdirSync(options.designsDir, { recursive: true });
  const rows: string[] = [];

  for (const product of products) {
    const name = basename(product);
    const wiki = join(product, ".context", "wiki");
    const designs = join(product, ".context", "designs");
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
    const surfaces = SURFACES.map((surface) => [surface, surfaceViews(designs, surface)] as const).filter(
      ([, views]) => views.length > 0,
    );
    if (surfaces.length > 0) relink(designs, join(options.designsDir, name));
    if (links.length > 0 || surfaces.length > 0) rows.push(`- ${links.join(" · ") || name}`);
    for (const [surface, views] of surfaces) {
      const linked = views.map(([label, path]) => `[${label}](${options.designsUrl}/${name}/${path})`);
      rows.push(`  - ${surface}: ${linked.join(" · ")}`);
    }
  }

  writeFileSync(
    join(options.siteDir, "index.md"),
    `---\ntitle: canon\n---\n\nEvery product's wiki, searchable and linked. Each surface opens its flow chart, screenshots and architecture overview; products with architecture rules also get an import graph.\n\n${rows.join("\n")}\n\n[[canon-check|Standards check]]\n`,
  );
  writeFileSync(
    join(options.siteDir, "canon-check.md"),
    `---\ntitle: Standards check\n---\n\nOutput of \`canon check --all\` when this site was built.\n\n\`\`\`\n${options.report}\n\`\`\`\n`,
  );
}

const IGNORED = ["**/CLAUDE.md", "_designs"];

/** Quartz's default config, adjusted for a private local site: no analytics, no schema files as pages. */
export function quartzConfig(defaultsYaml: string): string {
  const document = parseDocument(defaultsYaml);
  document.setIn(["configuration", "pageTitle"], "canon");
  document.setIn(["configuration", "analytics"], null);
  document.setIn(["configuration", "baseUrl"], "localhost");
  const current = (document.getIn(["configuration", "ignorePatterns"]) as { toJSON(): string[] } | undefined)?.toJSON() ?? [];
  document.setIn(["configuration", "ignorePatterns"], [...current, ...IGNORED.filter((p) => !current.includes(p))]);
  return document.toString();
}
