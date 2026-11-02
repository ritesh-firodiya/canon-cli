import { resolve } from "node:path";
import type { Command } from "commander";
import { FEATURES } from "../config/schema.ts";
import { setFeature } from "./features.ts";

export function registerFeatures(program: Command): void {
  const on = (isOn: boolean) => (name: string, repo: string) => {
    const features = setFeature(resolve(repo), name, isOn);
    console.log(`${name} ${isOn ? "on" : "off"}. On in this repo: ${features.join(", ") || "only the band"}`);
  };
  program
    .command("enable")
    .description(`turn a feature on for a repo: ${FEATURES.join(", ")}. Only the band is on by default`)
    .argument("<feature>")
    .argument("[repo]", "product repo", ".")
    .action(on(true));
  program
    .command("disable")
    .description("turn a feature off for a repo")
    .argument("<feature>")
    .argument("[repo]", "product repo", ".")
    .action(on(false));
}
