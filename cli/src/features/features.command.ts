import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import type { Command } from "commander";
import { FEATURES } from "../config/schema.ts";
import { pluginCommand, setFeature, setUserFeature } from "./features.ts";

export function registerFeatures(program: Command): void {
  const on = (isOn: boolean) => (name: string, repo: string, options: { user?: boolean }) => {
    const root = resolve(repo);
    const features = options.user ? setUserFeature(name, isOn) : setFeature(root, name, isOn);
    const args = pluginCommand(name, isOn, options.user ? "user" : "project");
    console.log(`${name} ${isOn ? "on" : "off"}. On ${options.user ? "across this machine" : "in this repo"}: ${features.join(", ") || "only the band"}`);
    if (!args) return;
    const run = spawnSync("claude", args, { cwd: root, encoding: "utf8" });
    if (run.status === 0) return;
    console.error(`could not change the plugin. Run this in the repo: claude ${args.join(" ")}`);
    process.exitCode = 1;
  };
  program
    .command("enable")
    .description(`turn a feature on for a repo: ${FEATURES.join(", ")}. Only the band is on by default`)
    .argument("<feature>")
    .argument("[repo]", "product repo", ".")
    .option("--user", "across this machine: every repo and any other folder")
    .action(on(true));
  program
    .command("disable")
    .description("turn a feature off for a repo")
    .argument("<feature>")
    .argument("[repo]", "product repo", ".")
    .option("--user", "across this machine: every repo and any other folder")
    .action(on(false));
}
