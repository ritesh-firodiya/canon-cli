import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { costOf, priceOf } from "../src/usage/prices.ts";
import { addLine, buildReport, formatReport, installedSkills, newTally, readTranscripts, type FileContext, type Tally } from "../src/usage/usage.ts";

const SINCE = new Date("2026-10-01T00:00:00Z");
const main: FileContext = { subagent: false, products: new Set(["myapp", "other"]), workspace: "/w", session: "s1" };
const at = (minute: number) => new Date(Date.UTC(2026, 9, 2, 10, minute)).toISOString();

const ask = (text: string, minute = 0) => JSON.stringify({ type: "user", timestamp: at(minute), message: { content: text } });
const reply = (id: string, minute: number, usage: object, blocks: object[] = [], model = "claude-opus-5-5") =>
  JSON.stringify({ type: "assistant", timestamp: at(minute), message: { id, model, usage, content: blocks } });
const tool = (name: string, input: object = {}) => ({ type: "tool_use", name, input });
const output = (tokens: number) => ({ input_tokens: 0, output_tokens: tokens });

function run(lines: string[], context = main, known = new Set<string>()): Tally {
  const tally = newTally(SINCE, known);
  for (const line of lines) addLine(tally, line, context);
  return tally;
}

describe("prices", () => {
  test("a model id with a date finds its price, and an unknown model has none", () => {
    expect(priceOf("claude-haiku-4-5-20251001", 0)?.input).toBe(1);
    expect(priceOf("claude-opus-5-5", 0)?.cacheRead).toBe(0.2);
    expect(priceOf("claude-new-9", 0)).toBeNull();
  });

  test("Haiku 5.5 costs more once a prompt passes 100,000 tokens", () => {
    expect(priceOf("claude-haiku-5-5", 100_000)?.input).toBe(0.1);
    expect(priceOf("claude-haiku-5-5", 100_001)?.input).toBe(0.5);
  });

  test("one-hour and five-minute cache writes have their own prices", () => {
    const cost = costOf({ input_tokens: 1_000_000, output_tokens: 1_000_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 2_000_000, cache_creation: { ephemeral_1h_input_tokens: 1_000_000, ephemeral_5m_input_tokens: 1_000_000 } }, "claude-opus-5-5");
    expect(cost).toEqual({ input: 4, output: 20, cacheRead: 0.2, cacheWrite: 13 });
  });

  test("a write with no split is priced as the longer one, what a plan's main session uses", () => {
    expect(costOf({ cache_creation_input_tokens: 1_000_000 }, "claude-opus-5-5")?.cacheWrite).toBe(8);
  });
});

describe("canon usage", () => {
  test("a reply on several lines counts its cost once and all of its tools", () => {
    const report = buildReport(run([ask("go"), reply("m1", 1, output(1_000_000), [tool("Bash")]), reply("m1", 1, output(1_000_000), [tool("Read")])]));
    expect(report.totalUsd).toBe(20);
    expect(report.tools).toEqual([{ name: "Bash", calls: 1, costUsd: 10 }, { name: "Read", calls: 1, costUsd: 10 }]);
  });

  test("a reply copied into a resumed session counts once", () => {
    const tally = run([reply("m1", 1, output(1_000_000))]);
    addLine(tally, reply("m1", 1, output(1_000_000)), { ...main, session: "s2" });
    expect(buildReport(tally).totalUsd).toBe(20);
  });

  test("a skill is charged from its call until the person's next message, split by tool and kind", () => {
    const report = buildReport(run([
      ask("start"),
      reply("m1", 1, output(1_000_000), [tool("Skill", { skill: "canon:weigh" })]),
      reply("m2", 2, output(1_000_000), [tool("Read")]),
      JSON.stringify({ type: "user", timestamp: at(3), message: { content: [{ type: "tool_result", content: "x" }] } }),
      reply("m3", 4, { cache_read_input_tokens: 1_000_000 }),
      ask("next", 5),
      reply("m4", 6, output(1_000_000)),
    ]));
    expect(report.skills).toHaveLength(1);
    expect(report.skills[0]).toMatchObject({ name: "canon:weigh", calls: 1, lastUsed: "2026-10-02", costUsd: 20.2 });
    expect(report.skills[0].tools).toEqual([{ name: "Read", costUsd: 20 }]);
    expect(report.skills[0].kinds).toMatchObject({ output: 20, cacheRead: 0.2 });
  });

  test("a typed slash command starts an installed skill, and a built-in one does not count", () => {
    const tally = newTally(SINCE, new Set(["ponytail:ponytail"]));
    addLine(tally, ask("<command-name>/ponytail:ponytail</command-name>"), main);
    addLine(tally, reply("m1", 1, output(1_000_000)), main);
    addLine(tally, ask("<command-name>/clear</command-name>", 2), main);
    addLine(tally, reply("m2", 3, output(1_000_000)), main);
    expect(buildReport(tally).skills.map((s) => [s.name, s.calls, s.costUsd])).toEqual([["ponytail:ponytail", 1, 20]]);
  });

  test("installed skills never called are listed, and a called one is not", () => {
    const tally = newTally(SINCE, new Set(["a:used", "a:idle"]));
    addLine(tally, reply("m1", 1, output(1), [tool("Skill", { skill: "a:used" })]), main);
    expect(buildReport(tally).neverUsed).toEqual(["a:idle"]);
  });

  test("a reply belongs to the known product its tools last named", () => {
    const context = { ...main, workspace: "/w" };
    const report = buildReport(run([
      ask("go"),
      reply("m1", 1, output(1_000_000), [tool("Read", { file_path: "/w/myapp/a.ts" })]),
      reply("m2", 2, output(1_000_000)),
      reply("m3", 3, output(1_000_000), [tool("Read", { file_path: "/w/notaproduct/a.ts" })]),
    ], context));
    expect(report.products).toEqual([{ name: "myapp", costUsd: 60 }]);
  });

  test("main and subagent costs are apart, and only a main session sets context at the first reply", () => {
    const tally = run([reply("m1", 1, { input_tokens: 10, cache_read_input_tokens: 1000, cache_creation_input_tokens: 500 })]);
    addLine(tally, reply("m2", 1, { input_tokens: 99_999 }), { ...main, subagent: true, session: "s3" });
    const report = buildReport(tally);
    expect(report.firstContextMedian).toBe(1510);
    expect(report.sessions).toBe(1);
    expect(report.subagentUsd).toBeGreaterThan(0);
    expect(report.mainUsd).toBeGreaterThan(0);
  });

  test("a large cache write after an hour idle is a cold reload, and a warm or small one is not", () => {
    const big = { cache_creation_input_tokens: 100_000, cache_read_input_tokens: 0 };
    const cold = buildReport(run([reply("m1", 0, output(1)), reply("m2", 59, big)]));
    expect(cold.coldReloads.count).toBe(0);
    const late = JSON.stringify({ type: "assistant", timestamp: new Date(Date.UTC(2026, 9, 2, 12, 0)).toISOString(), message: { id: "m2", model: "claude-opus-5-5", usage: big, content: [] } });
    const report = buildReport(run([reply("m1", 0, output(1)), late]));
    expect(report.coldReloads.count).toBe(1);
    // What was paid to write it, less what reading it warm would have cost.
    expect(report.coldReloads.extraUsd).toBeCloseTo(0.78);
    const small = JSON.stringify({ type: "assistant", timestamp: new Date(Date.UTC(2026, 9, 2, 12, 0)).toISOString(), message: { id: "m2", model: "claude-opus-5-5", usage: { cache_creation_input_tokens: 1000 }, content: [] } });
    expect(buildReport(run([reply("m1", 0, output(1)), small])).coldReloads.count).toBe(0);
  });

  test("a cold reload still reads the shared prefix, so most of the prompt being written is what marks it", () => {
    const late = (usage: object) => JSON.stringify({ type: "assistant", timestamp: new Date(Date.UTC(2026, 9, 2, 12, 0)).toISOString(), message: { id: "m2", model: "claude-opus-5-5", usage, content: [] } });
    const cold = buildReport(run([reply("m1", 0, output(1)), late({ cache_creation_input_tokens: 300_000, cache_read_input_tokens: 40_000 })]));
    expect(cold.coldReloads.count).toBe(1);
    const warm = buildReport(run([reply("m1", 0, output(1)), late({ cache_creation_input_tokens: 60_000, cache_read_input_tokens: 300_000 })]));
    expect(warm.coldReloads.count).toBe(0);
  });

  test("broken lines are counted, old entries are left out, and an unknown model is named and not priced", () => {
    const old = JSON.stringify({ type: "assistant", timestamp: "2026-09-01T00:00:00Z", message: { id: "old", model: "claude-opus-5-5", usage: output(1_000_000), content: [] } });
    const report = buildReport(run(["{broken", old, reply("m1", 1, output(1000), [], "claude-new-9")]));
    expect(report.skippedLines).toBe(1);
    expect(report.totalUsd).toBe(0);
    expect(report.unpricedModels).toEqual(["claude-new-9"]);
  });

  test("nothing a person or a tool wrote reaches the report", () => {
    const report = buildReport(run([ask("my secret plan"), reply("m1", 1, output(10), [tool("Bash", { command: "echo hunter2" }), { type: "text", text: "reply secret" }])]));
    const printed = JSON.stringify(report) + formatReport(report);
    for (const secret of ["secret", "hunter2"]) expect(printed).not.toContain(secret);
  });

  test("it reads main and subagent transcripts from disk, skips files older than the period, and adds run costs", async () => {
    const root = mkdtempSync(join(tmpdir(), "canon-usage-"));
    mkdirSync(join(root, "p", "s1", "subagents"), { recursive: true });
    writeFileSync(join(root, "p", "s1.jsonl"), `${reply("m1", 1, output(1_000_000))}\n`);
    writeFileSync(join(root, "p", "s1", "subagents", "agent-a.jsonl"), `${reply("m2", 1, output(1_000_000))}\n`);
    const old = join(root, "p", "old.jsonl");
    writeFileSync(old, `${reply("m3", 1, output(1_000_000))}\n`);
    utimesSync(old, new Date("2026-09-01"), new Date("2026-09-01"));
    const runs = join(root, "runs.jsonl");
    writeFileSync(runs, `${JSON.stringify({ at: at(1), stage: "code", costUsd: 2 })}\nbad\n${JSON.stringify({ at: "2026-09-01T00:00:00Z", stage: "code", costUsd: 9 })}\n`);
    const tally = newTally(SINCE, new Set());
    await readTranscripts(tally, join(root, "p"), { products: new Set(), workspace: null });
    const report = buildReport(tally, runs);
    expect([report.mainUsd, report.subagentUsd]).toEqual([20, 20]);
    expect(report.runs).toEqual([{ stage: "code", runs: 1, costUsd: 2 }]);
  });

  test("prompt routing picks are counted, with what deciding cost, and old or broken lines left out", () => {
    const file = join(mkdtempSync(join(tmpdir(), "canon-routes-")), "routes.jsonl");
    writeFileSync(file, `${JSON.stringify({ at: at(1), size: "small", decideUsd: 0.001 })}\n${JSON.stringify({ at: at(2), size: null, decideUsd: 0 })}\nbad\n${JSON.stringify({ at: "2026-09-01T00:00:00Z", size: "large", decideUsd: 9 })}\n`);
    const report = buildReport(newTally(SINCE, new Set()), undefined, file);
    expect(report.routes).toEqual({ small: 1, medium: 0, large: 0, failed: 1, decideUsd: 0.001 });
    expect(formatReport(report)).toContain("small 1");
  });

  test("installed skills come from plugins and the user's own folder, and a folder with no SKILL.md is not one", () => {
    const home = mkdtempSync(join(tmpdir(), "canon-home-"));
    mkdirSync(join(home, "cache", "skills", "weigh"), { recursive: true });
    writeFileSync(join(home, "cache", "skills", "weigh", "SKILL.md"), "x");
    mkdirSync(join(home, "plugins"));
    writeFileSync(join(home, "plugins", "installed_plugins.json"), JSON.stringify({ plugins: { "canon@canon": [{ installPath: join(home, "cache") }] } }));
    mkdirSync(join(home, "skills", "mine"), { recursive: true });
    writeFileSync(join(home, "skills", "mine", "SKILL.md"), "x");
    mkdirSync(join(home, "skills", "learned"));
    expect([...installedSkills(home)].sort()).toEqual(["canon:weigh", "mine"]);
    expect([...installedSkills(join(home, "missing"))]).toEqual([]);
  });
});
