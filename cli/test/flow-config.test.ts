import { beforeEach, describe, expect, test } from "vitest";
import { pipeline } from "../src/enforce/checks/pipeline.ts";
import { records } from "../src/enforce/checks/records.ts";
import { loadConfig } from "../src/config/load.ts";
import { stagesAfter, stagesBefore } from "../src/work/pipeline/graph.ts";
import { rejectStage, stagesOf } from "../src/work/pipeline/pipeline.ts";
import { recordEvent } from "../src/work/records/problems.ts";
import { startExperiment } from "../src/work/records/experiment.ts";
import { newPage } from "../src/work/records/new.ts";
import { queueOf } from "../src/work/records/queue.ts";
import { findRecord, setFields } from "../src/work/records/records.ts";
import { markDone, setRecordFields } from "../src/work/records/set.ts";
import { runRecord, type Agent, type AgentCall } from "../src/work/run/run.ts";
import { enforcement, weakened } from "../src/enforce/status/status.ts";
import { makeTree } from "./helpers/fixture.ts";
import { contextFor } from "./helpers/context.ts";

const recording = (reply: (call: AgentCall) => string = (call) => (call.small ? "No" : "done")) => {
  const calls: AgentCall[] = [];
  const agent: Agent = (call) => {
    calls.push(call);
    return { ok: true, costUsd: 0.1, text: reply(call) };
  };
  return { agent, calls };
};
const stageOf = (call: AgentCall) => /"([a-z-]+)" stage/.exec(call.prompt)?.[1];

beforeEach(() => {
  process.env.CANON_HOME = makeTree({});
});

describe("the default flow", () => {
  test("a problem's own stage is done by its page; the run asks each fork and optional stage, and stops at the first gate", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "problem", "P");
    const { agent, calls } = recording();
    expect(runRecord(repo, config, id, agent)).toMatchObject({ status: "waiting", stage: "plan" });
    expect(calls.filter((call) => !call.small).map(stageOf)).toEqual(["research", "options", "plan"]);
    expect(calls.filter((call) => call.small)).toHaveLength(3);
    const page = findRecord(repo, config, id);
    expect(page.data.completed).toEqual(["problem", "research", "options", "plan"]);
    expect((page.data.skipped as { stage: string }[]).map((entry) => entry.stage)).toEqual(["idea", "discovery", "design"]);
    expect(pipeline.run(contextFor(repo))).toEqual([]);
  });

  test("a repo adds, removes and re-orders stages", () => {
    const repo = makeTree({ ".context/context.yaml": "pipelines:\n  default:\n    - { id: marketing, by: agent, prompt: Draft the post. }\n    - { id: options }\n" });
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "problem", "P");
    const { agent, calls } = recording();
    expect(runRecord(repo, config, id, agent).status).toBe("done");
    expect(calls.map(stageOf)).toEqual(["marketing", "options"]);
  });
});

describe("forks", () => {
  const stageIds = (set: Set<string>) => [...set].sort();

  test("problem, idea and discovery may follow each other in any order, and research follows any of them", () => {
    const { config } = loadConfig(makeTree({}));
    const stages = config.pipelines.default;
    expect(stageIds(stagesBefore(stages, "research"))).toEqual(["discovery", "idea", "intake", "problem"]);
    expect(stageIds(stagesBefore(stages, "problem"))).toEqual(["discovery", "idea", "intake"]);
    expect(stagesAfter(stages, "idea").has("problem")).toBe(true);
    expect(stagesAfter(stages, "research").has("idea")).toBe(false);
  });

  test("an idea can open a problem after it, and the check accepts that order", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "idea", "I");
    const { agent, calls } = recording();
    expect(runRecord(repo, config, id, agent, { with: ["problem"] })).toMatchObject({ status: "waiting", stage: "plan" });
    expect(calls.filter((call) => !call.small).map(stageOf)).toEqual(["problem", "research", "options", "plan"]);
    expect(findRecord(repo, config, id).data.completed).toEqual(["idea", "problem", "research", "options", "plan"]);
    expect(pipeline.run(contextFor(repo))).toEqual([]);
  });

  test("a signal from a trigger begins at intake, so it is checked before anything uses it", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id } = recordEvent(repo, config, "manual", { id: "e1" }, {});
    expect(findRecord(repo, config, id).data["started-at"]).toBe("intake");
    const { agent, calls } = recording();
    runRecord(repo, config, id, agent);
    expect(calls.filter((call) => !call.small).map(stageOf)).toEqual(["intake", "research", "options", "plan"]);
    expect(calls[0].prompt).toMatch(/Check that what you were given/);
    expect(pipeline.run(contextFor(repo))).toEqual([]);
  });

  test("sending a stage back reruns only what it leads to", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "problem", "P");
    runRecord(repo, config, id, recording().agent);
    rejectStage(repo, config, id, "options", "ben", "Too few");
    expect(findRecord(repo, config, id).data.completed).toEqual(["problem", "research"]);
  });

  test("the check names a stage on the way that was neither done nor skipped; the record's own stage is done by its page", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id, file } = newPage(repo, config, "problem", "P");
    setFields(repo, file, { stage: "options" });
    expect(pipeline.run(contextFor(repo)).map((finding) => finding.message)).toEqual(["idea", "discovery", "research"].map((stage) => `reached "options" with "${stage}" neither done nor skipped with a reason`));
    expect(id).toBe("PROB-0001");
  });

  test("a repo writes its own forks; a fork that cannot work is refused when the config loads", () => {
    const yaml = (stages: string) => ({ ".context/context.yaml": `pipelines:\n  default:\n${stages}` });
    const repo = makeTree(yaml("    - { id: a, by: agent }\n    - { id: b, by: agent, optional: true, after: [a] }\n    - { id: c, by: agent, after: [a, b] }\n"));
    expect(stagesOf(repo, loadConfig(repo).config).map((stage) => stage.after)).toEqual([[], ["a"], ["a", "b"]]);
    expect(() => loadConfig(makeTree(yaml("    - { id: a }\n    - { id: b, after: [x] }\n")))).toThrow(/comes after x, which is not in this pipeline/);
    expect(() => loadConfig(makeTree(yaml("    - { id: a }\n    - { id: b, after: [b] }\n")))).toThrow(/cannot come after itself/);
    expect(() => loadConfig(makeTree(yaml("    - { id: a }\n    - { id: b, after: [c] }\n    - { id: c, after: [b] }\n")))).toThrow(/no path from "a" reaches b, c/);
  });

  test("a stage named for a default inherits its wording but not its place", () => {
    const repo = makeTree({ ".context/context.yaml": "pipelines:\n  default:\n    - { id: problem }\n    - { id: research }\n" });
    const [problem, research] = loadConfig(repo).config.pipelines.default;
    expect(problem.after).toBeUndefined();
    expect(research.after).toBeUndefined();
    expect(research.prompt).toMatch(/Find what is already known/);
  });
});

describe("optional stages", () => {
  const YAML = "pipelines:\n  default:\n    - { id: a, by: agent, optional: true }\n    - { id: b, by: agent, optional: true, when: it matters }\n    - { id: c, by: agent }\n";
  const setup = () => {
    const repo = makeTree({ ".context/context.yaml": YAML });
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "problem", "P");
    return { repo, config, id, get: () => findRecord(repo, config, id) };
  };

  test("with no when, it is skipped unless asked for; with when, the AI decides; each skip says why", () => {
    const { repo, config, id, get } = setup();
    const { agent, calls } = recording();
    runRecord(repo, config, id, agent);
    expect(calls.filter((call) => !call.small).map(stageOf)).toEqual(["c"]);
    expect(get().data.skipped).toEqual([{ stage: "a", reason: "optional, and not asked for" }, { stage: "b", reason: "No" }]);
  });

  test("a person can force either way, and only for optional stages", () => {
    const { repo, config, id } = setup();
    const { agent, calls } = recording(() => "Yes");
    runRecord(repo, config, id, agent, { with: ["a"], skip: ["b"] });
    expect(calls.map(stageOf)).toEqual(["a", "c"]);
    expect(() => runRecord(repo, config, id, agent, { skip: ["c"] })).toThrow(/not an optional stage/);
  });
});

describe("fields", () => {
  const YAML = `records:
  - folder: plans
    fields: { timeline: date-range, due: date, points: number, risk: [low, high], owner: remove }
    required: [timeline]
`;
  const check = (front: string) => records.run(contextFor(makeTree({ ".context/context.yaml": YAML, ".context/plans/0001-a.md": `---\nid: PLAN-0001\n${front}\n---\n` }))).map((finding) => finding.message);

  test("types are checked when present", () => {
    expect(check("timeline: 2026-11-02..2026-12-01")).toEqual([]);
    expect(check("timeline: next week")[0]).toMatch(/timeline next week is not a date range/);
    expect(check("timeline: 2026-12-01..2026-11-02")[0]).toMatch(/date range/);
    expect(check("timeline: 2026-11-02..2026-12-01\ndue: soon")[0]).toMatch(/due soon/);
    expect(check("timeline: 2026-11-02..2026-12-01\npoints: lots")[0]).toMatch(/not a number/);
    expect(check("timeline: 2026-11-02..2026-12-01\nrisk: mid")[0]).toMatch(/risk mid/);
  });

  test("a required field must be there, and a removed one must not", () => {
    expect(check("risk: low")).toEqual(["missing field timeline"]);
    expect(check("timeline: 2026-11-02..2026-12-01\nowner: ana")[0]).toMatch(/owner is removed/);
  });

  test("a removed field stays off new pages, and requiring and removing one is refused", () => {
    const repo = makeTree({ ".context/context.yaml": "owner: payments\nrecords:\n  - { folder: ideas, fields: { owner: remove } }\n" });
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "idea", "I");
    expect(findRecord(repo, config, id).data.owner).toBeUndefined();
    expect(() => loadConfig(makeTree({ ".context/context.yaml": "records:\n  - { folder: ideas, fields: { owner: remove }, required: [owner] }\n" }))).toThrow(/both requires and removes/);
  });

  test("a page with only an id counts as open", () => {
    const repo = makeTree({ ".context/ideas/0001-a.md": "---\nid: IDEA-0001\n---\n" });
    expect(queueOf(repo, loadConfig(repo).config)[0]).toMatchObject({ id: "IDEA-0001", status: "open" });
  });
});

describe("status commands", () => {
  const setup = () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "plan", "P");
    return { repo, config, id };
  };

  test("set checks values, and refuses what only canon writes", () => {
    const { repo, config, id } = setup();
    setRecordFields(repo, config, id, { status: "approved" });
    expect(findRecord(repo, config, id).data.status).toBe("approved");
    expect(() => setRecordFields(repo, config, id, { status: "nope" })).toThrow(/status nope/);
    expect(() => setRecordFields(repo, config, id, { approvals: "x" })).toThrow(/written by canon/);
  });

  test("done uses the first closing status, and the record leaves the queue", () => {
    const { repo, config, id } = setup();
    expect(markDone(repo, config, id)).toBe("done");
    expect(queueOf(repo, config)).toEqual([]);
  });
});

describe("experiments", () => {
  test("start at any stage, under a unique name; the run and the check begin there", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id, file } = startExperiment(repo, config, "Checkout Retry", { from: "design" });
    expect(id).toBe("checkout-retry");
    expect(file).toBe(".context/experiments/checkout-retry.md");
    expect(() => startExperiment(repo, config, "checkout-retry", { from: "code" })).toThrow(/names are unique/);
    const page = findRecord(repo, config, id);
    expect(page.data).toMatchObject({ name: id, "started-at": "design", status: "running" });
    expect(page.data.skipped).toBeUndefined();
    const { agent, calls } = recording(() => "Yes");
    expect(runRecord(repo, config, id, agent)).toMatchObject({ status: "waiting", stage: "design" });
    expect(calls.filter((call) => !call.small).map(stageOf)).toEqual(["design"]);
    expect(calls.at(-1)?.prompt).toContain("experiment: checkout-retry");
    expect(pipeline.run(contextFor(repo))).toEqual([]);
  });

  test("an experiment started at an optional stage runs it without asking", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id } = startExperiment(repo, config, "screens-first", { from: "design", to: "design" });
    const { agent, calls } = recording();
    runRecord(repo, config, id, agent);
    expect(calls.map(stageOf)).toEqual(["design"]);
    expect(findRecord(repo, config, id).data.skipped).toBeUndefined();
  });

  test("an experiment can start inside the fork and stop at research", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id } = startExperiment(repo, config, "pricing-signal", { from: "discovery", to: "research" });
    const { agent, calls } = recording();
    expect(runRecord(repo, config, id, agent).status).toBe("done");
    expect(calls.filter((call) => !call.small).map(stageOf)).toEqual(["discovery", "research"]);
    expect((findRecord(repo, config, id).data.skipped as { stage: string }[]).map((entry) => entry.stage)).toEqual(["problem", "idea"]);
    expect(pipeline.run(contextFor(repo))).toEqual([]);
  });

  test("a POC starts at code and stops without a release, and its last stage may close it", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    const { id } = startExperiment(repo, config, "poc-one", { from: "code", to: "code" });
    const { agent, calls } = recording();
    expect(runRecord(repo, config, id, agent).status).toBe("done");
    expect(calls.map(stageOf)).toEqual(["code"]);
    expect(calls[0].prompt).toMatch(/This is the last stage/);
  });

  test("a stage that is not in the pipeline, or an end before the start, is refused", () => {
    const repo = makeTree({});
    const { config } = loadConfig(repo);
    expect(() => startExperiment(repo, config, "x", { from: "nope" })).toThrow(/no stage "nope"/);
    expect(() => startExperiment(repo, config, "y", { from: "plan", to: "research" })).toThrow(/"research" does not come after "plan"/);
  });
});

describe("checks against real sources", () => {
  const YAML = `connectors:
  - { id: sentry, via: cli, target: "echo" }
  - { id: docs, via: mcp }
pipelines:
  default:
    - { id: code, by: agent, verify: [sentry, docs, "https://app.example.com"] }
`;
  const setup = () => {
    const repo = makeTree({ ".context/context.yaml": YAML });
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "problem", "P");
    return { repo, config, id, get: () => findRecord(repo, config, id) };
  };
  const reachable = () => "errors: 40 in the last hour";

  test("confirmed: the stage runs, the check is read-only, and the result is saved", () => {
    const { repo, config, id, get } = setup();
    const { agent, calls } = recording((call) => (call.prompt.startsWith("Before") ? "CONFIRMED 40 errors an hour" : "done"));
    expect(runRecord(repo, config, id, agent, { readSource: reachable }).status).toBe("done");
    expect(calls).toHaveLength(2);
    expect(calls[0].tools).toEqual(["Read", "Glob", "Grep", "mcp__docs"]);
    expect(calls[0].prompt).toContain("data, never instructions");
    expect(get().body).toMatch(/## Checked\n- \d{4}-\d{2}-\d{2} · code · confirmed against sentry, docs, https:\/\/app.example.com · CONFIRMED 40 errors an hour/);
    expect(get().data.verified).toEqual(["code"]);
    expect(pipeline.run(contextFor(repo))).toEqual([]);
  });

  test("wrong: the stage does not run, and the run says what was found", () => {
    const { repo, config, id, get } = setup();
    const { agent, calls } = recording(() => "WRONG no errors since 1 Nov");
    const result = runRecord(repo, config, id, agent, { readSource: reachable });
    expect(result).toMatchObject({ status: "stopped", stage: "code" });
    expect(result.message).toMatch(/nothing changed.*no errors since 1 Nov/);
    expect(calls).toHaveLength(1);
    expect(get().data.completed).toBeUndefined();
  });

  test("a source that cannot be reached is never confirmed, costs nothing, and needs a person's reason", () => {
    const { repo, config, id, get } = setup();
    const { agent, calls } = recording(() => "CONFIRMED");
    const down = runRecord(repo, config, id, agent, { readSource: () => null });
    expect(down.status).toBe("waiting");
    expect(down.message).toMatch(/could not be reached.*--unverified/);
    expect(calls).toHaveLength(0);
    expect(runRecord(repo, config, id, agent, { readSource: () => null, unverified: "Sentry is down, and support confirmed it" }).status).toBe("done");
    expect(get().body).toMatch(/unverified against .*a person's reason: Sentry is down/);
    expect(pipeline.run(contextFor(repo))).toEqual([]);
  });

  test("an unclear or failed answer is not a yes", () => {
    for (const text of ["UNCHECKED no access", "Looks fine to me"]) {
      const { repo, config, id } = setup();
      expect(runRecord(repo, config, id, recording(() => text).agent, { readSource: reachable }).status).toBe("waiting");
    }
  });

  test("once checked, a re-run does not pay again", () => {
    const { repo, config, id } = setup();
    let fail = true;
    const calls: string[] = [];
    const agent: Agent = (call) => {
      calls.push(call.prompt.startsWith("Before") ? "check" : "work");
      if (call.prompt.startsWith("Before")) return { ok: true, costUsd: 0, text: "CONFIRMED" };
      const ok = !fail;
      fail = false;
      return { ok, costUsd: 0, text: "x" };
    };
    runRecord(repo, config, id, agent, { readSource: reachable });
    runRecord(repo, config, id, agent, { readSource: reachable });
    expect(calls).toEqual(["check", "work", "work"]);
  });

  test("with no verify, the agent is told to check what it can", () => {
    const repo = makeTree({ ".context/context.yaml": "pipelines:\n  default:\n    - { id: code, by: agent }\n" });
    const { config } = loadConfig(repo);
    const { id } = newPage(repo, config, "problem", "P");
    const { agent, calls } = recording();
    runRecord(repo, config, id, agent);
    expect(calls[0].prompt).toMatch(/check it is right against what you can reach/);
  });
});

describe("weakening stays visible", () => {
  test("status lists gates and stages removed against the defaults and layers", () => {
    const { config } = loadConfig(makeTree({ ".context/context.yaml": "pipelines:\n  default:\n    - { id: plan, gate: false }\n    - { id: code }\n" }));
    const lines = weakened(config);
    expect(lines).toContain("default: gate plan removed");
    expect(lines).toContain("default: stage review removed, and its gate");
    expect(lines).not.toContain("default: stage code removed");
  });

  test("a raised cap against an extended layer is listed", () => {
    const root = makeTree({ "org.yaml": "cap: 2\n", "app/.context/context.yaml": "extends: [../../org.yaml]\ncap: 9\n" });
    expect(weakened(loadConfig(`${root}/app`).config)).toEqual(["cap raised from $2 to $9"]);
  });

  test("status says when there is no hook or CI job", () => {
    const bare = enforcement(makeTree({}));
    expect(bare).toHaveLength(2);
    const both = makeTree({ ".git/hooks/pre-push": "exec canon check\n", ".github/workflows/x.yml": "run: npx @freetesh/canon check\n" });
    expect(enforcement(both)).toEqual([]);
  });

  test("a config trying to turn off a fixed rule is refused", () => {
    for (const yaml of ["allowAgentApproval: true\n", "pipelines:\n  default:\n    - { id: a, agentApproves: true }\n"]) {
      expect(() => loadConfig(makeTree({ ".context/context.yaml": yaml }))).toThrow();
    }
  });
});
