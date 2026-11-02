import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { buildBand } from "../src/band/band.ts";
import { loadConfig } from "../src/config/load.ts";
import { clearRunning, markRunning, readRunning, runningFile } from "../src/run/running.ts";
import { runRecord, type Agent } from "../src/run/run.ts";
import { makeTree } from "./helpers/fixture.ts";

const YAML = `cap: 5
pipelines:
  default:
    - { id: idea, by: agent, done: [.context/ideas] }
    - { id: plan, by: agent, gate: true, done: [.context/plans] }
    - { id: code, by: agent, done: [src] }
`;

const problem = (fields: string) => `---\nid: PROB-0001\nstatus: solving\nsource: reviews\npriority: p1\n${fields}\nlast-verified: 2026-11-02\n---\n# Ads too frequent\n\n## Summary\nx\n`;

const repoWith = (fields: string, more: Record<string, string> = {}) =>
  makeTree({ ".context/context.yaml": YAML, ".context/problems/0001-ads.md": problem(fields), ".context/ideas/x.md": "x", ".context/plans/x.md": "x", ...more });

const options = (repo: string) => ({ canonRoot: repo });

beforeEach(() => {
  process.env.CANON_HOME = makeTree({});
});

describe("canon band", () => {
  test("outside a product there are no canon facts", () => {
    expect(buildBand(makeTree({}), options("/x")).product).toBeNull();
  });

  test("a subfolder of a product finds the product", () => {
    const repo = repoWith("stage: plan");
    mkdirSync(join(repo, "src", "deep"), { recursive: true });
    expect(buildBand(join(repo, "src", "deep"), options(repo)).product).toBe(repo.split("/").pop());
  });

  test("an open gate is what waits on you, with its record and every stage's state", () => {
    const band = buildBand(repoWith("stage: plan"), options("/x"));
    expect(band.stage).toBe("plan");
    expect(band.waiting).toEqual({ record: "PROB-0001", stage: "plan" });
    expect(band.problem).toMatchObject({ id: "PROB-0001", title: "Ads too frequent", source: "reviews", priority: "p1", file: ".context/problems/0001-ads.md" });
    expect(band.stages).toEqual([{ id: "idea", state: "ok" }, { id: "plan", state: "waiting" }, { id: "code", state: "todo" }]);
  });

  test("an approved gate does not wait", () => {
    const fields = "stage: plan\napprovals:\n  - { stage: plan, by: me, at: 2026-11-02T00:00:00Z }";
    expect(buildBand(repoWith(fields), options("/x")).waiting).toBeNull();
  });

  test("with no open work, the stage is the last one started", () => {
    const repo = makeTree({ ".context/context.yaml": YAML, ".context/ideas/x.md": "x", ".context/plans/x.md": "x" });
    const band = buildBand(repo, options("/x"));
    expect(band.stage).toBe("plan");
    expect(band.stages.map((stage) => stage.state)).toEqual(["ok", "here", "todo"]);
    expect(band.problem).toBeNull();
  });

  test("a live run shows its record, stage, time, spend and cap", () => {
    const repo = repoWith("stage: code\ncost: 3.4");
    markRunning(repo, "PROB-0001", new Date("2026-11-02T10:00:00Z"));
    const band = buildBand(repo, options("/x"));
    expect(band.running).toEqual({ record: "PROB-0001", stage: "code", startedAt: "2026-11-02T10:00:00.000Z", spendUsd: 3.4, capUsd: 5 });
    expect(band.stages.at(-1)).toEqual({ id: "code", state: "running" });
    expect(band.problem?.id).toBe("PROB-0001");
  });

  test("a run whose process died is not a live run", () => {
    const repo = repoWith("stage: code");
    markRunning(repo, "PROB-0001");
    const file = runningFile(repo);
    writeFileSync(file, JSON.stringify({ record: "PROB-0001", startedAt: "2026-11-02T10:00:00Z", pid: 999_999_999 }));
    expect(readRunning(repo)).toBeNull();
    expect(existsSync(file)).toBe(false);
  });

  test("a broken run file is not a live run", () => {
    const repo = repoWith("stage: code");
    markRunning(repo, "PROB-0001");
    writeFileSync(runningFile(repo), "{broken");
    expect(readRunning(repo)).toBeNull();
  });

  test("the run marks itself live while it works and clears when it stops, even after a failure", () => {
    const repo = repoWith("stage: idea");
    const seen: unknown[] = [];
    const agent: Agent = () => {
      seen.push(readRunning(repo)?.record);
      throw new Error("agent crashed");
    };
    expect(() => runRecord(repo, loadConfig(repo).config, "PROB-0001", agent)).toThrow("agent crashed");
    expect(seen).toEqual(["PROB-0001"]);
    expect(readRunning(repo)).toBeNull();
    clearRunning(repo);
  });

  test("check findings split into errors and warnings", () => {
    const repo = repoWith("stage: plan");
    const band = buildBand(repo, options("/x"));
    expect(Array.isArray(band.errors) && Array.isArray(band.warnings)).toBe(true);
    for (const finding of [...band.errors, ...band.warnings]) expect(typeof finding.message).toBe("string");
  });

  test("an unreadable config is an error to show, not a crash", () => {
    const repo = makeTree({ ".context/context.yaml": "pipelines: [broken\n" });
    const band = buildBand(repo, options("/x"));
    expect(band.product).toBe(repo.split("/").pop());
    expect(band.stages).toEqual([]);
    expect(band.errors.length).toBeGreaterThan(0);
  });
});
