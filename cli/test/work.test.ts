import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { buildBand } from "../src/band/band.ts";
import { loadConfig } from "../src/config/load.ts";
import { followEdit, readWork, selectWork, setStage } from "../src/work/work.ts";
import { makeTree } from "./helpers/fixture.ts";

const YAML = `pipelines:
  default:
    - { id: problem, done: [.context/problems] }
    - { id: plan, by: agent, gate: true, done: [.context/plans] }
    - { id: design, by: agent, optional: true, gate: true, done: [.context/designs] }
    - { id: code, by: agent, done: [src] }
    - { id: marketing, by: agent, optional: true, done: [.context/marketing] }
`;

const page = (id: string, fields = "") => `---\nid: ${id}\nstatus: open\n${fields}last-verified: 2026-11-02\n---\n# ${id} title\n\n## Summary\nx\n`;
const PROBLEM = ".context/problems/0001-ads.md";
const PLAN = ".context/plans/0001-ads.md";

const repoWith = (fields = "") =>
  makeTree({ ".context/context.yaml": YAML, [PROBLEM]: page("PROB-0001", fields), [PLAN]: page("PLAN-0001"), ".context/marketing/x.md": "x", ".context/designs/x.html": "x" });

const band = (repo: string) => buildBand(repo, { canonRoot: "/x" });
const config = (repo: string) => loadConfig(repo).config;
const follow = (repo: string, path: string) => followEdit(repo, config(repo), join(repo, path));
const APPROVED_PLAN = "approvals:\n  - { stage: plan, by: me, at: 2026-11-02T00:00:00Z }\n";

beforeEach(() => {
  process.env.CANON_HOME = makeTree({});
});

describe("canon work", () => {
  test("a folder that exists is not the stage: with nothing selected the band names none", () => {
    const facts = band(repoWith());
    expect(facts.stage).toBeNull();
    expect(facts.stages.every((stage) => stage.state === "todo")).toBe(true);
  });

  test("a selected record shows, at the stage its kind starts at", () => {
    const repo = repoWith();
    selectWork(repo, config(repo), "PLAN-0001");
    const facts = band(repo);
    expect(facts.selected).toBe("PLAN-0001");
    expect(facts.stage).toBe("plan");
    expect(facts.problem).toMatchObject({ id: "PLAN-0001", title: "PLAN-0001 title", file: PLAN });
    expect(facts.root).toBe(repo);
  });

  test("a record starts at the stage named for its kind, even when that stage's done folder is another", () => {
    const yaml = "pipelines:\n  default:\n    - { id: plan, done: [.context/features] }\n    - { id: feature, done: [.context/bugs] }\n";
    const repo = makeTree({ ".context/context.yaml": yaml, [PLAN]: page("PLAN-0001"), ".context/features/0001-a.md": page("FEAT-0001") });
    selectWork(repo, config(repo), "PLAN-0001");
    expect(band(repo).stage).toBe("plan");
    selectWork(repo, config(repo), "FEAT-0001");
    expect(band(repo).stage).toBe("feature");
  });

  test("selecting a record that does not exist fails and changes nothing", () => {
    const repo = repoWith();
    expect(() => selectWork(repo, config(repo), "PLAN-0099")).toThrow("no record PLAN-0099");
    expect(readWork(repo)).toBeNull();
  });

  test("the band lists open work with titles, stages and files", () => {
    const repo = repoWith("stage: plan\n");
    expect(band(repo).work).toContainEqual({ id: "PROB-0001", title: "PROB-0001 title", stage: "plan", waiting: "plan", file: PROBLEM });
    expect(band(repo).work.map((row) => row.id)).toContain("PLAN-0001");
  });

  test("a closed selected record is no longer the work", () => {
    const closed = makeTree({ ".context/context.yaml": YAML, [PROBLEM]: page("PROB-0001").replace("status: open", "status: solved") });
    selectWork(closed, config(closed), "PROB-0001");
    expect(band(closed).selected).toBeNull();
  });

  test("editing a record's page selects it when nothing is selected", () => {
    const repo = repoWith();
    follow(repo, PLAN);
    expect(readWork(repo)).toBe("PLAN-0001");
  });

  test("editing a page does not replace the selection", () => {
    const repo = repoWith();
    selectWork(repo, config(repo), "PROB-0001");
    follow(repo, PLAN);
    expect(readWork(repo)).toBe("PROB-0001");
  });

  test("an edit with nothing selected moves no stage", () => {
    const repo = repoWith();
    follow(repo, "src/a.ts");
    expect(band(repo).stage).toBeNull();
  });

  test("an edit in a later stage's folder moves the selected record there", () => {
    const repo = repoWith(APPROVED_PLAN);
    selectWork(repo, config(repo), "PROB-0001");
    follow(repo, "src/a.ts");
    expect(band(repo).stage).toBe("code");
  });

  test("a name that only starts like a stage's folder is not in it", () => {
    const repo = repoWith(APPROVED_PLAN);
    selectWork(repo, config(repo), "PROB-0001");
    follow(repo, "src2/a.ts");
    expect(band(repo).stage).toBe("problem");
  });

  test("an edit never moves a record back", () => {
    const repo = repoWith(`stage: code\n${APPROVED_PLAN}`);
    selectWork(repo, config(repo), "PROB-0001");
    follow(repo, PLAN);
    expect(band(repo).stage).toBe("code");
  });

  test("working inside a gate is not waiting on you, and it does not count as approved", () => {
    const repo = repoWith(APPROVED_PLAN);
    selectWork(repo, config(repo), "PROB-0001");
    follow(repo, ".context/designs/x.html");
    const facts = band(repo);
    expect(facts.stage).toBe("design");
    expect(facts.waiting).toBeNull();
    expect(facts.stages.find((stage) => stage.id === "design")?.state).toBe("here");
  });

  test("leaving an unapproved gate holds the record there, waiting on you", () => {
    const repo = repoWith(APPROVED_PLAN);
    selectWork(repo, config(repo), "PROB-0001");
    follow(repo, ".context/designs/x.html");
    follow(repo, "src/a.ts");
    const facts = band(repo);
    expect(facts.stage).toBe("design");
    expect(facts.waiting).toEqual({ record: "PROB-0001", stage: "design" });
  });

  test("jumping over a required gate stops at it, but an optional gate can be passed", () => {
    const repo = repoWith();
    selectWork(repo, config(repo), "PROB-0001");
    follow(repo, "src/a.ts");
    expect(band(repo).waiting).toEqual({ record: "PROB-0001", stage: "plan" });
  });

  test("a person can set the stage, back or forward, but not past an unapproved gate", () => {
    const repo = repoWith(`stage: code\n${APPROVED_PLAN}`);
    selectWork(repo, config(repo), "PROB-0001");
    setStage(repo, config(repo), "PROB-0001", "plan");
    expect(band(repo).stage).toBe("plan");
    const blocked = repoWith();
    selectWork(blocked, config(blocked), "PROB-0001");
    setStage(blocked, config(blocked), "PROB-0001", "code");
    expect(band(blocked).waiting).toEqual({ record: "PROB-0001", stage: "plan" });
  });

  test("an unknown stage is refused", () => {
    const repo = repoWith();
    expect(() => setStage(repo, config(repo), "PROB-0001", "nope")).toThrow('no stage "nope"');
  });

  test("a stage move changes no approval", () => {
    const repo = repoWith();
    selectWork(repo, config(repo), "PROB-0001");
    follow(repo, "src/a.ts");
    expect(readFileSync(join(repo, PROBLEM), "utf8")).not.toContain("approvals");
  });

  test("a path outside the repo does nothing", () => {
    const repo = repoWith();
    selectWork(repo, config(repo), "PROB-0001");
    followEdit(repo, config(repo), "/elsewhere/src/a.ts");
    expect(band(repo).stage).toBe("problem");
  });
});
