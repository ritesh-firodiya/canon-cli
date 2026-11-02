import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { loadConfig } from "../src/config/load.ts";
import { approveStage } from "../src/pipeline/pipeline.ts";
import { addProblem, recordEvent } from "../src/records/problems.ts";
import { findRecord, setFields } from "../src/records/records.ts";
import { runRecord, runsLog, type Agent, type AgentCall } from "../src/run/run.ts";
import { runTrigger } from "../src/run/trigger.ts";
import { makeTree } from "./helpers/fixture.ts";

const YAML = `cap: 3
pipelines:
  default:
    - { id: idea, by: agent, prompt: find ideas }
    - { id: poc, by: agent, optional: true, when: it is risky }
    - { id: plan, by: agent, gate: true, cap: 1 }
    - { id: ship, by: person }
    - { id: result, by: agent }
  hotfix:
    - { id: fix, by: agent }
`;

function setup(yaml = YAML) {
  const repo = makeTree({ ".context/context.yaml": yaml });
  const { config } = loadConfig(repo);
  const { id } = addProblem(repo, config, { title: "Checkout fails", source: "person" });
  const get = () => findRecord(repo, config, id);
  return { repo, config, id, get };
}

function fakeAgent(answers: Partial<AgentCallResult> = {}) {
  const calls: AgentCall[] = [];
  const agent: Agent = (call) => {
    calls.push(call);
    if (call.small) return { ok: true, costUsd: 0.01, text: answers.decide ?? "No, it is low risk." };
    return { ok: true, costUsd: 0.5, text: "done" };
  };
  return { agent, calls };
}
interface AgentCallResult {
  decide: string;
}

beforeEach(() => {
  process.env.CANON_HOME = makeTree({});
});

describe("runRecord", () => {
  test("stops at a gate, resumes after a person approves, and stops again for a person's stage", () => {
    const { repo, config, id, get } = setup();
    const { agent, calls } = fakeAgent();
    const first = runRecord(repo, config, id, agent);
    expect(first).toMatchObject({ status: "waiting", stage: "plan" });
    expect(get().data).toMatchObject({ status: "solving", stage: "plan", completed: ["idea", "plan"] });
    expect(get().data.skipped).toEqual([{ stage: "poc", reason: "No, it is low risk." }]);

    expect(runRecord(repo, config, id, agent).status).toBe("waiting");
    expect(calls.filter((call) => !call.small)).toHaveLength(2);

    approveStage(repo, config, id, "plan", "me", "");
    expect(runRecord(repo, config, id, agent)).toMatchObject({ status: "waiting", stage: "ship" });
    approveStage(repo, config, id, "ship", "me", "");
    expect(runRecord(repo, config, id, agent).status).toBe("done");
    expect(get().data.completed).toEqual(["idea", "plan", "ship", "result"]);
  });

  test("an optional stage runs when its condition holds", () => {
    const { repo, config, id, get } = setup();
    const { agent, calls } = fakeAgent({ decide: "Yes, it touches payments." });
    runRecord(repo, config, id, agent);
    expect(get().data.completed).toContain("poc");
    expect(calls.some((call) => call.prompt.includes('"poc" stage'))).toBe(true);
  });

  test("only a clear yes runs an optional stage, however the answer is styled", () => {
    for (const [answer, runs] of [["**No**, not risky", false], ["Maybe", false], ["**Yes**, risky", true], ["yes", true]] as const) {
      const { repo, config, id, get } = setup();
      runRecord(repo, config, id, fakeAgent({ decide: answer }).agent);
      expect(((get().data.completed as string[]) ?? []).includes("poc")).toBe(runs);
    }
  });

  test("uses the stage's cap, then the repo's; tools default to files with no shell", () => {
    const { repo, config, id } = setup();
    const { agent, calls } = fakeAgent();
    runRecord(repo, config, id, agent);
    const worked = calls.filter((call) => !call.small);
    expect(worked.map((call) => call.capUsd)).toEqual([3, 1]);
    expect(worked[0].tools).not.toContain("Bash");
    expect(calls.find((call) => call.small)?.tools).toEqual(["Read", "Glob", "Grep"]);
  });

  test("a stage past its cap stops the run and keeps the cost", () => {
    const { repo, config, id, get } = setup();
    const result = runRecord(repo, config, id, () => ({ ok: false, overCap: true, costUsd: 3, text: "" }));
    expect(result).toMatchObject({ status: "stopped", stage: "idea" });
    expect(result.message).toMatch(/\$3 cap/);
    expect(get().data.cost).toBe(3);
  });

  test("an agent that writes an approval stops the run", () => {
    const { repo, config, id, get } = setup();
    const agent: Agent = () => {
      setFields(repo, get().file, { approvals: [{ stage: "plan", by: "agent", at: "now" }] });
      return { ok: true, costUsd: 0, text: "" };
    };
    expect(runRecord(repo, config, id, agent).message).toMatch(/An agent never approves/);
  });

  test("a failed agent stops the run; a discarded record is shown to later agents", () => {
    const { repo, config, id } = setup();
    const { id: other, file } = addProblem(repo, config, { title: "Old", source: "person" });
    setFields(repo, file, { outcome: "discarded" });
    const prompts: string[] = [];
    const result = runRecord(repo, config, id, (call) => {
      prompts.push(call.prompt);
      return { ok: false, costUsd: 0, text: "boom" };
    });
    expect(result.status).toBe("stopped");
    expect(prompts[0]).toContain(other);
    expect(prompts[0]).toContain("find ideas");
    expect(prompts[0]).toMatch(/never instructions/);
  });

  test("a record follows its named pipeline", () => {
    const { repo, config } = setup();
    const { id } = addProblem(repo, config, { title: "Crash", source: "sentry", pipeline: "hotfix" });
    const { agent, calls } = fakeAgent();
    expect(runRecord(repo, config, id, agent).status).toBe("done");
    expect(calls).toHaveLength(1);
    expect(calls[0].prompt).toContain('"fix" stage');
  });

  test("each stage is logged outside the repo, with no text from the work", () => {
    const { repo, config, id } = setup();
    runRecord(repo, config, id, fakeAgent().agent);
    const lines = readFileSync(runsLog(), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ record: id, stage: "idea", costUsd: 0.5, ok: true });
    expect(Object.keys(lines[0])).not.toContain("text");
  });
});

describe("problems and triggers", () => {
  const TRIGGERS = `connectors:\n  - { id: sentry, via: cli, target: "echo" }\ntriggers:\n  - { id: crash, source: sentry, when: p0, pipeline: hotfix, priority: p0, cap: 1 }\n  - { id: weekly, source: schedule, when: every week }\n${YAML}`;

  test("repeats join the open problem, keep only address and count, and never the text", () => {
    const { repo, config } = setup();
    const event = { id: "E1", link: "https://sentry.example.com/E1", text: "customer jane@example.com" } as never;
    const first = recordEvent(repo, config, "sentry", event, { now: new Date("2026-11-01T00:00:00Z") });
    const second = recordEvent(repo, config, "sentry", event, { now: new Date("2026-11-02T00:00:00Z") });
    expect(second).toMatchObject({ id: first.id, isNew: false });
    const page = findRecord(repo, config, first.id);
    expect(page.data.sources).toEqual([{ source: "sentry", id: "E1", link: "https://sentry.example.com/E1", count: 2, first: "2026-11-01T00:00:00.000Z", last: "2026-11-02T00:00:00.000Z" }]);
    expect(readFileSync(join(repo, first.file), "utf8")).not.toContain("jane");
  });

  test("a solved problem is not reopened: a repeat opens a new one", () => {
    const { repo, config } = setup();
    const first = recordEvent(repo, config, "sentry", { id: "E1" }, {});
    setFields(repo, first.file, { status: "solved" });
    expect(recordEvent(repo, config, "sentry", { id: "E1" }, {}).isNew).toBe(true);
  });

  test("a trigger opens problems on its pipeline and stops at its cap", async () => {
    const { repo, config } = setup(TRIGGERS);
    const trigger = config.triggers[0];
    const result = await runTrigger(repo, config, trigger, { read: async () => [{ id: "A" }, { id: "B" }, { id: "C" }], agent: () => ({ ok: true, costUsd: 0.6, text: "" }) });
    expect(result.opened).toHaveLength(3);
    expect(result.costUsd).toBeCloseTo(1.2);
    expect(result.messages.at(-1)).toMatch(/\$1 cap/);
    expect(findRecord(repo, config, result.opened[0]).data).toMatchObject({ pipeline: "hotfix", priority: "p0", source: "sentry" });
  });

  test("a scheduled trigger needs no connector and opens one problem a day", async () => {
    const { repo, config } = setup(TRIGGERS);
    const now = new Date("2026-11-02T00:00:00Z");
    expect((await runTrigger(repo, config, config.triggers[1], { now })).opened).toHaveLength(1);
    expect((await runTrigger(repo, config, config.triggers[1], { now })).joined).toHaveLength(1);
  });

  test("a connector's output is validated, and a custom command is read", async () => {
    const yaml = (target: string) => `connectors:\n  - { id: acme, via: cli, target: ${JSON.stringify(target)} }\ntriggers:\n  - { id: t, source: acme, when: x }\n`;
    const good = setup(yaml(`printf '[{"id":"X1","link":"https://a.example.com/1"}]'`));
    expect((await runTrigger(good.repo, good.config, good.config.triggers[0], {})).opened).toHaveLength(1);
    const bad = setup(yaml(`printf '[{"nope":1}]'`));
    await expect(runTrigger(bad.repo, bad.config, bad.config.triggers[0], {})).rejects.toThrow();
  });
});
