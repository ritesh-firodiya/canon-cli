import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Command } from "commander";
import type { Env } from "../../lib/env.ts";
import { productRoot } from "../../lib/files.ts";
import { gate } from "./gate.ts";

export function registerGate(program: Command, env: Env): void {
  program
    .command("gate")
    .description("check a page before it is written to .context: the content on stdin, judged by every rule, for what it would newly break")
    .argument("<file>", "where the page would be written")
    .action((file: string) => {
      const path = resolve(file);
      const repo = productRoot(path);
      if (!repo) throw new Error(`${file} is in no product: no .context above it`);
      const findings = gate(repo, path, readFileSync(0, "utf8"), env.canonRoot);
      for (const f of findings) console.log(`${f.level}  ${f.file ?? ""}  ${f.message}`);
      process.exitCode = findings.length ? 1 : 0;
    });
}
