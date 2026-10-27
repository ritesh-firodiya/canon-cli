import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import { architectureGraph } from "../checks/architecture.ts";
import { formatReports } from "../format.ts";
import { CACHE_DIR } from "../lib/system.ts";
import { findProducts, runChecks } from "../check.ts";
import { buildSite, quartzConfig } from "../ui.ts";
import { requireWorkspace, type Env } from "../lib/env.ts";

// Quartz v5 has no tagged release yet, so pin the exact commit: an unpinned
// clone could change the site under us on the next fresh install.
const QUARTZ_REPO = "https://github.com/jackyzha0/quartz";
const QUARTZ_COMMIT = "97a2d05f80c4c50534959b1d0d41cc4b3895625e";
const QUARTZ_DIR = join(CACHE_DIR, "quartz");

function must(command: string, args: string[], cwd?: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

function ensureQuartz(): void {
  if (!existsSync(join(QUARTZ_DIR, "node_modules"))) {
    if (!existsSync(QUARTZ_DIR)) must("git", ["clone", "--quiet", "--filter=blob:none", QUARTZ_REPO, QUARTZ_DIR]);
    must("git", ["checkout", "--quiet", QUARTZ_COMMIT], QUARTZ_DIR);
    must("npm", ["ci", "--silent"], QUARTZ_DIR);
  }
  const defaults = readFileSync(join(QUARTZ_DIR, "quartz.config.default.yaml"), "utf8");
  writeFileSync(join(QUARTZ_DIR, "quartz.config.yaml"), quartzConfig(defaults));
}

export function registerUi(program: Command, env: Env): void {
  program
    .command("ui")
    .description("serve every product wiki (search, backlinks, graph) and the design galleries on localhost")
    // Uncommon defaults: 8080 and 3001 are usually taken by Docker or a dev server.
    .option("--port <port>", "wiki site port", "4610")
    .option("--designs-port <port>", "design gallery port", "4611")
    .option("--ws-port <port>", "live-reload socket port", "4612")
    .action((options: { port: string; designsPort: string; wsPort: string }) => {
      ensureQuartz();
      const products = findProducts(requireWorkspace(env));
      const siteDir = join(CACHE_DIR, "site");
      const designsDir = join(CACHE_DIR, "designs");
      const designsUrl = `http://127.0.0.1:${options.designsPort}`;
      const report = formatReports(products.map((repo) => runChecks(repo, { canonRoot: env.canonRoot })));
      buildSite(products, { siteDir, designsDir, designsUrl, report, graph: architectureGraph });

      const designs = spawn("python3", ["-m", "http.server", options.designsPort, "--bind", "127.0.0.1", "--directory", designsDir], {
        stdio: "ignore",
      });
      const site = spawn("npx", ["quartz", "build", "-d", siteDir, "-o", join(CACHE_DIR, "public"), "--serve", "--port", options.port, "--wsPort", options.wsPort], {
        cwd: QUARTZ_DIR,
        stdio: "inherit",
      });
      console.log(`wiki    http://localhost:${options.port}\ndesigns ${designsUrl}`);
      const stop = () => {
        designs.kill();
        site.kill();
      };
      process.on("SIGINT", stop);
      site.on("exit", (code) => {
        designs.kill();
        process.exitCode = code ?? 0;
      });
    });
}
