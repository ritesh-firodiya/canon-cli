import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseDocument } from "yaml";

export interface SiteOptions {
  /** Quartz content folder: one symlink per product wiki, plus the home page. */
  siteDir: string;
  /** Static folder for the design galleries: one symlink per product designs/. */
  designsDir: string;
  designsUrl: string;
  /** `zeno check --all` output, shown as its own page. */
  report: string;
}

const SURFACES = ["mobile", "web"];

function relink(target: string, link: string): void {
  rmSync(link, { force: true, recursive: false });
  symlinkSync(target, link);
}

function galleryPath(designs: string): string | undefined {
  const surface = SURFACES.find((name) => existsSync(join(designs, name, "index.html")));
  return surface && `${surface}/index.html`;
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
    const gallery = existsSync(designs) ? galleryPath(designs) : undefined;
    if (gallery) {
      relink(designs, join(options.designsDir, name));
      links.push(`[designs](${options.designsUrl}/${name}/${gallery})`);
    }
    if (links.length > 0) rows.push(`- ${links.join(" · ")}`);
  }

  writeFileSync(
    join(options.siteDir, "index.md"),
    `---\ntitle: zeno\n---\n\nEvery product's wiki, searchable and linked. Designs open the HTML gallery.\n\n${rows.join("\n")}\n\n[[zeno-check|Standards check]]\n`,
  );
  writeFileSync(
    join(options.siteDir, "zeno-check.md"),
    `---\ntitle: Standards check\n---\n\nOutput of \`zeno check --all\` when this site was built.\n\n\`\`\`\n${options.report}\n\`\`\`\n`,
  );
}

const IGNORED = ["**/CLAUDE.md", "_designs"];

/** Quartz's default config, adjusted for a private local site: no analytics, no schema files as pages. */
export function quartzConfig(defaultsYaml: string): string {
  const document = parseDocument(defaultsYaml);
  document.setIn(["configuration", "pageTitle"], "zeno");
  document.setIn(["configuration", "analytics"], null);
  document.setIn(["configuration", "baseUrl"], "localhost");
  const current = (document.getIn(["configuration", "ignorePatterns"]) as { toJSON(): string[] } | undefined)?.toJSON() ?? [];
  document.setIn(["configuration", "ignorePatterns"], [...current, ...IGNORED.filter((p) => !current.includes(p))]);
  return document.toString();
}
