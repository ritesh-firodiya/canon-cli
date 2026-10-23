import { spawnSync } from "node:child_process";
import type { Command } from "commander";

export function registerWeigh(program: Command): void {
  program
    .command("weigh")
    .description("run the decision gate on a request without doing it (calls Claude)")
    .argument("<request...>", "what you want to do")
    .action((words: string[]) => {
      const request = words.join(" ");
      const result = spawnSync("claude", ["-p", `/zeno:weigh ${request}\n\nWeigh only. Do not start the work.`], {
        stdio: "inherit",
      });
      if (result.error) throw new Error(`could not run claude: ${result.error.message}`);
      process.exitCode = result.status ?? 1;
    });
}
