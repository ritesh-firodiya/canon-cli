import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import type { Command } from "commander";
import { architectureJson } from "../../enforce/checks/diagrams.ts";
import type { Env } from "../../lib/env.ts";
import { loaderAt } from "./shell.ts";

const DESIGNS = ".context/designs";
const SERVED_SHELL = "/_shell/";
const DIAGRAMS_URL = "/_architecture.json";
// The view belongs to no set: a set holds designs and nothing else.
const ARCHITECTURE_PAGE = /^\/[^/]+\/architecture\.html$/;
const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".woff2": "font/woff2", ".mp4": "video/mp4",
};

/** The folders holding a page of their own (index.html): a design with no design.js, such as a terminal design. */
function pages(designs: string): string[] {
  if (!existsSync(designs)) return [];
  return readdirSync(designs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(designs, entry.name, "index.html")))
    .map((entry) => entry.name)
    .sort();
}

/** The designs at or above `start`: a set (design.js) or plain pages (a folder with an index.html). */
export function findDesigns(start: string): string | null {
  for (let folder = resolve(start); ; folder = dirname(folder)) {
    const designs = join(folder, DESIGNS);
    if (existsSync(join(designs, "design.js")) || pages(designs).length > 0) return designs;
    if (dirname(folder) === folder) return null;
  }
}

/** What to serve: a set's sizes, or else each plain page. */
export function sizesOf(designs: string): string[] {
  if (!existsSync(join(designs, "design.js"))) return pages(designs);
  return JSON.parse(readFileSync(join(designs, "design.js"), "utf8").replace("(window.BABUL ||= {}).product = ", "").replace(/;\s*$/, "")).sizes;
}

/** Plain pages have no design.js; the shell still needs a product, so the repo's name stands in. */
export function plainDesignJs(designs: string): string {
  const product = { name: basename(dirname(dirname(designs))), sizes: pages(designs) };
  return `(window.BABUL ||= {}).product = ${JSON.stringify(product)};`;
}

/** The file a request names: canon's shell under /_shell/, the set otherwise; null outside both. */
export function fileFor(designs: string, shell: string, url: string): string | null {
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  if (ARCHITECTURE_PAGE.test(path)) return join(shell, "architecture.html");
  const [base, rest] = path.startsWith(SERVED_SHELL) ? [shell, path.slice(SERVED_SHELL.length)] : [designs, path.slice(1)];
  const file = resolve(base, rest);
  if (file !== base && !file.startsWith(base + sep)) return null;
  return existsSync(file) && statSync(file).isDirectory() ? join(file, "index.html") : file;
}

export function registerUi(program: Command, env: Env): void {
  program
    .command("ui")
    .description("serve this repo's designs on localhost: a set with the shell from this canon, or plain pages as they are")
    // Uncommon default: 8080 and 3001 are usually taken by Docker or a dev server.
    .option("--port <port>", "port", "4611")
    .action((options: { port: string }) => {
      const designs = findDesigns(process.cwd());
      if (!designs) throw new Error(`no ${DESIGNS} here or above holds a design.js or a folder with an index.html`);
      // Every page loads ../shell.js; serving it from here puts this canon's shell in place of the set's published one.
      const loader = loaderAt(env.canonRoot, SERVED_SHELL);
      const shell = join(env.canonRoot, "shell");
      const sizes = sizesOf(designs);

      const server = createServer((request, response) => {
        const url = request.url ?? "/";
        if (url === "/") {
          response.writeHead(302, { location: `/${sizes[0]}/index.html` }).end();
          return;
        }
        if (url.split(/[?#]/)[0] === "/shell.js") {
          response.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-store" }).end(loader);
          return;
        }
        if (url.split(/[?#]/)[0] === "/design.js" && !existsSync(join(designs, "design.js"))) {
          response.writeHead(200, { "content-type": TYPES[".js"], "cache-control": "no-store" }).end(plainDesignJs(designs));
          return;
        }
        if (url.split(/[?#]/)[0] === DIAGRAMS_URL) {
          response.writeHead(200, { "content-type": TYPES[".json"], "cache-control": "no-store" }).end(architectureJson(dirname(dirname(designs))));
          return;
        }
        const file = fileFor(designs, shell, url);
        if (!file || !existsSync(file)) {
          response.writeHead(404).end("not found");
          return;
        }
        response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" }).end(readFileSync(file));
      });
      server.listen(Number(options.port), "127.0.0.1", () => {
        console.log(sizes.map((size) => `${size.padEnd(8)}http://127.0.0.1:${options.port}/${size}/index.html`).join("\n"));
      });
    });
}
