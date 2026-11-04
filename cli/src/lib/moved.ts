import type { Command } from "commander";

// Commands folded into others by PLAN-0003. shortcut: kept for one release so scripts and old skills say where to go; remove after 4.0.
const MOVED: [string, string][] = [
  ["status", "canon check --status"],
  ["standards", "canon check --standards"],
  ["copies", "canon check --copies"],
  ["sync", "canon update --refresh"],
  ["experiment", "canon new experiment <name> --from <stage>"],
  ["search", "the canon-knowledge ask skill, or qmd query"],
  ["weigh", "the canon-process weigh skill"],
  ["flow", "canon learn --flow <product...>"],
  ["usage", "canon learn --cost"],
  ["work", "gone: the band follows the record a run is on, or the one waiting for you"],
];

export function registerMoved(program: Command): void {
  for (const [name, to] of MOVED) {
    program
      .command(name, { hidden: true })
      .allowUnknownOption()
      .allowExcessArguments()
      .action(() => {
        console.error(`canon ${name} is now ${to}`);
        process.exitCode = 1;
      });
  }
}
