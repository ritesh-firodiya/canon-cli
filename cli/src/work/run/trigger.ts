import { spawnSync } from "node:child_process";
import { z } from "zod";
import type { Config, ConnectorSpec, TriggerSpec } from "../../config/schema.ts";
import { eventSchema, recordEvent, type TriggerEvent } from "../records/problems.ts";
import { runRecord, type Agent } from "./run.ts";

const COMMAND_TIMEOUT_MS = 120_000;
const eventsSchema = z.array(eventSchema);

/** Reads events from a connector. What it returns is outside input: only ids and links are kept. */
export type ReadEvents = (repo: string, connector: ConnectorSpec) => Promise<TriggerEvent[]>;

export const readEvents: ReadEvents = async (repo, connector) => {
  if (!connector.target) throw new Error(`connector ${connector.id} has no target to read from`);
  if (connector.via === "cli" || connector.via === "tool") {
    const run = spawnSync(connector.target, { cwd: repo, shell: true, encoding: "utf8", timeout: COMMAND_TIMEOUT_MS });
    if (run.status !== 0) throw new Error(`connector ${connector.id} failed: ${(run.stderr || "no output").slice(0, 300)}`);
    return eventsSchema.parse(JSON.parse(run.stdout));
  }
  if (connector.via === "api") {
    const token = connector.env?.[0] ? process.env[connector.env[0]] : undefined;
    if (connector.env?.[0] && !token) throw new Error(`connector ${connector.id} needs ${connector.env[0]} in the environment`);
    const response = await fetch(connector.target, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!response.ok) throw new Error(`connector ${connector.id} answered ${response.status}`);
    return eventsSchema.parse(await response.json());
  }
  throw new Error(`connector ${connector.id} is reached over MCP, which only an agent can use. As a trigger, give it a cli or api target`);
};

export interface TriggerResult {
  trigger: string;
  opened: string[];
  joined: string[];
  costUsd: number;
  messages: string[];
}

/** Turns one trigger's events into problems, and with an agent, runs the new ones until its cap. */
export async function runTrigger(repo: string, config: Config, trigger: TriggerSpec, options: { read?: ReadEvents; agent?: Agent; now?: Date }): Promise<TriggerResult> {
  const connector = config.connectors.find((entry) => entry.id === trigger.source);
  const today = (options.now ?? new Date()).toISOString().slice(0, 10);
  const events = connector ? await (options.read ?? readEvents)(repo, connector) : [{ id: `${trigger.id}-${today}` }];
  const result: TriggerResult = { trigger: trigger.id, opened: [], joined: [], costUsd: 0, messages: [] };
  const created = events.map((event) => recordEvent(repo, config, trigger.source, event, { priority: trigger.priority, pipeline: trigger.pipeline, now: options.now }));
  for (const problem of created) (problem.isNew ? result.opened : result.joined).push(problem.id);
  if (!options.agent) return result;
  for (const id of result.opened) {
    if (trigger.cap && result.costUsd >= trigger.cap) {
      result.messages.push(`stopped at the $${trigger.cap} cap: ${id} and later problems wait`);
      break;
    }
    const run = runRecord(repo, config, id, options.agent);
    result.costUsd += run.costUsd;
    result.messages.push(`${id}: ${run.message}`);
  }
  return result;
}
