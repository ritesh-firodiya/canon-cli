// canon mcp — the search MCP server over the knowledge index (qmd's), for any MCP client.
import { spawn } from "node:child_process";
import type { Command } from "commander";

export function registerMcp(program: Command): void {
  program
    .command("mcp")
    .description("start the search MCP server over the knowledge index (stdio)")
    .action(() => {
      const server = spawn("qmd", ["mcp"], { stdio: "inherit" });
      server.on("exit", (code) => process.exit(code ?? 0));
    });
}
