import { describe, expect, test } from "vitest";
import { agentFor } from "../src/work/run/agents.ts";
import { claudeAgent } from "../src/work/run/run.ts";

const call = { prompt: "hi there", tools: [], capUsd: 1, cwd: process.cwd() };

describe("agentFor", () => {
  test("uses Claude Code when nothing is named", () => {
    expect(agentFor(undefined)).toBe(claudeAgent);
    expect(agentFor("claude")).toBe(claudeAgent);
  });
  test("runs a custom command with the prompt and model filled in", () => {
    const agent = agentFor({ command: "echo", args: ["{prompt}"], modelArgs: ["m={model}"], smallModel: "tiny" });
    expect(agent(call)).toMatchObject({ ok: true, text: "hi there\n" });
    expect(agent({ ...call, small: true }).text).toBe("hi there m=tiny\n");
  });
  test("reports a missing command", () => {
    expect(agentFor({ command: "no-such-agent-xyz", args: ["{prompt}"] })(call).ok).toBe(false);
  });
});
