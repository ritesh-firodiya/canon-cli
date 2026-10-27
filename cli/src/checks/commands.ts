import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Check, Finding } from "./types.ts";

const MAX_OUTPUT_LINES = 15;

function tail(text: string): string {
  return text.trim().split("\n").slice(-MAX_OUTPUT_LINES).join("\n");
}

/**
 * Runs each checker a repo or its estate declares under `commands:` in
 * canon.yaml. canon does not know what they check; a non-zero exit is an error
 * reported under the command's own id.
 */
export const commandChecks: Check = {
  id: "commands",
  module: null,
  description: "every checker declared under `commands:` in canon.yaml passes",
  run({ repo, config }) {
    return config.commands
      .filter((command) => !command.if || existsSync(join(repo, command.if)))
      .filter((command) => !command.module || config.modules.includes(command.module))
      .flatMap((command): Finding[] => {
        const result = spawnSync("sh", ["-c", command.run], { cwd: repo, encoding: "utf8" });
        if (result.error) {
          return [{ check: command.id, level: "error", file: command.if, message: `could not run: ${result.error.message}` }];
        }
        if (result.status === 0) return [];
        return [{ check: command.id, level: "error", file: command.if, message: tail(`${result.stdout}\n${result.stderr}`) }];
      });
  },
};
