import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/load.ts";
import { recordApproval } from "../pipeline.ts";

export function registerApprove(program: Command): void {
  program
    .command("approve")
    .description("record that a person reviewed and approved a pipeline gate, dated now (a person runs this, not an agent)")
    .argument("<stage>", "the gated stage's id in canon.yaml `pipeline:`")
    .argument("[repo]", "product repo", ".")
    .option("--note <text>", "what was reviewed", "")
    .action((stageId: string, repo: string, options: { note: string }) => {
      const root = resolve(repo);
      const gates = loadConfig(root).config.pipeline.filter((stage) => stage.gate).map((stage) => stage.id);
      if (!gates.includes(stageId)) {
        throw new Error(`"${stageId}" is not a gated stage here — gates: ${gates.join(", ") || "none (no pipeline: in canon.yaml)"}`);
      }
      const approval = recordApproval(root, stageId, options.note);
      console.log(`approved ${stageId} at ${approval.at}`);
    });
}
