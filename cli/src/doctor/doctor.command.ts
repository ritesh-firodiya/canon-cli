import type { Command } from "commander";
import { loadConfig } from "../config/load.ts";
import { runDoctor, systemProbe } from "./doctor.ts";

export function registerDoctor(program: Command): void {
  program
    .command("doctor")
    .description("check that canon's tools, and any this repo declares, are installed")
    .action(() => {
      const results = runDoctor(systemProbe, loadConfig(process.cwd()).config.doctor.tools);
      for (const result of results) {
        const mark = result.ok ? "✓" : "✗";
        const detail = result.ok ? (result.version ?? "") : `${result.version ?? "missing"} — ${result.hint}`;
        console.log(`${mark} ${result.tool.padEnd(8)} ${detail}  (${result.why})`);
      }
      process.exitCode = results.every((result) => result.ok) ? 0 : 1;
    });
}
