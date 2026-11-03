import type { Command } from "commander";
import { formatModels, writeModels } from "./models.ts";

export function registerModels(program: Command): void {
  program
    .command("models")
    .description("find the models this machine can run and their prices, and write ~/.canon/models.json for routing, the band and canon usage")
    .option("--json", "print the file instead of a table")
    .action(async (options: { json?: boolean }) => {
      const file = await writeModels();
      console.log(options.json ? JSON.stringify(file, null, 2) : formatModels(file));
    });
}
