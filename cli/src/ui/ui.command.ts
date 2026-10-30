import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import type { Command } from "commander";
import type { Env } from "../lib/env.ts";
import { loaderAt } from "./shell.ts";

const DESIGNS = ".context/designs";
const SERVED_SHELL = "/_shell/";
const TYPES: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".woff2": "font/woff2", ".mp4": "video/mp4",
};

/** The design set at or above `start`: the folder holding design.js. */
export function findDesigns(start: string): string | null {
  for (let folder = resolve(start); ; folder = dirname(folder)) {
    if (existsSync(join(folder, DESIGNS, "design.js"))) return join(folder, DESIGNS);
    if (dirname(folder) === folder) return null;
  }
}

/** The file a request names: canon's shell under /_shell/, the set otherwise; null outside both. */
export function fileFor(designs: string, shell: string, url: string): string | null {
  const path = decodeURIComponent(url.split(/[?#]/)[0]);
  const [base, rest] = path.startsWith(SERVED_SHELL) ? [shell, path.slice(SERVED_SHELL.length)] : [designs, path.slice(1)];
  const file = resolve(base, rest);
  if (file !== base && !file.startsWith(base + sep)) return null;
  return existsSync(file) && statSync(file).isDirectory() ? join(file, "index.html") : file;
}

export function registerUi(program: Command, env: Env): void {
  program
    .command("ui")
    .description("serve this repo's design set on localhost, with the shell from this canon")
    // Uncommon default: 8080 and 3001 are usually taken by Docker or a dev server.
    .option("--port <port>", "port", "4611")
    .action((options: { port: string }) => {
      const designs = findDesigns(process.cwd());
      if (!designs) throw new Error(`no ${DESIGNS}/design.js here or above — not a design set`);
      // Every page loads ../shell.js; serving it from here puts this canon's shell in place of the set's published one.
      const loader = loaderAt(env.canonRoot, SERVED_SHELL);
      const shell = join(env.canonRoot, "shell");
      const sizes: string[] = JSON.parse(
        readFileSync(join(designs, "design.js"), "utf8").replace("(window.BABUL ||= {}).product = ", "").replace(/;\s*$/, ""),
      ).sizes;

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
