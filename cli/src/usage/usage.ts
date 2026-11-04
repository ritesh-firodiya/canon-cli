import { createReadStream, existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { createInterface } from "node:readline";
import { productPath } from "../flow/sessions.ts";
import { transcriptFiles } from "../lib/transcripts.ts";
import { costOf, priceOf, promptTokens, tokens, type KindCost, type Usage } from "./prices.ts";

const CACHE_HOUR_MS = 60 * 60 * 1000;
const COLD_MIN_WRITE = 50_000;
const PER_MILLION = 1_000_000;
const COMMAND = /<command-name>\/?([^<]+)<\/command-name>/;
const NO_KINDS: KindCost = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

export interface FileContext {
  subagent: boolean;
  products: Set<string>;
  workspace: string | null;
  session: string;
}

interface ToolUse {
  type?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface Entry {
  type?: string;
  timestamp?: string;
  cwd?: string;
  isMeta?: boolean;
  isCompactSummary?: boolean;
  message?: { id?: string; model?: string; usage?: Usage; content?: unknown };
}

interface OpenReply {
  id: string;
  at: Date;
  model: string;
  usage: Usage;
  tools: ToolUse[];
}

interface SessionState {
  context: FileContext;
  reply: OpenReply | null;
  skill: string | null;
  product: string | null;
  lastAt: Date | null;
  counted: boolean;
}

interface SkillTally {
  calls: number;
  lastUsed: string | null;
  kinds: KindCost;
  tools: Map<string, number>;
  products: Set<string>;
}

export interface Tally {
  since: Date;
  installed: Set<string>;
  sessions: Map<string, SessionState>;
  seen: Set<string>;
  skippedLines: number;
  kinds: KindCost;
  models: Map<string, number>;
  mainUsd: number;
  subagentUsd: number;
  products: Map<string, number>;
  tools: Map<string, { calls: number; costUsd: number }>;
  skills: Map<string, SkillTally>;
  firstContexts: number[];
  coldCount: number;
  coldExtraUsd: number;
  unpriced: Set<string>;
  sessionCount: number;
}

export const newTally = (since: Date, installed: Set<string>): Tally => ({
  since,
  installed,
  sessions: new Map(),
  seen: new Set(),
  skippedLines: 0,
  kinds: { ...NO_KINDS },
  models: new Map(),
  mainUsd: 0,
  subagentUsd: 0,
  products: new Map(),
  tools: new Map(),
  skills: new Map(),
  firstContexts: [],
  coldCount: 0,
  coldExtraUsd: 0,
  unpriced: new Set(),
  sessionCount: 0,
});

const sumKinds = (cost: KindCost): number => cost.input + cost.output + cost.cacheWrite + cost.cacheRead;
const addKinds = (into: KindCost, cost: KindCost): void => {
  into.input += cost.input;
  into.output += cost.output;
  into.cacheWrite += cost.cacheWrite;
  into.cacheRead += cost.cacheRead;
};
const addTo = (map: Map<string, number>, key: string, amount: number): void => void map.set(key, (map.get(key) ?? 0) + amount);

function skillOf(tally: Tally, name: string): SkillTally {
  const existing = tally.skills.get(name);
  if (existing) return existing;
  const created: SkillTally = { calls: 0, lastUsed: null, kinds: { ...NO_KINDS }, tools: new Map(), products: new Set() };
  tally.skills.set(name, created);
  return created;
}

function startSkill(tally: Tally, state: SessionState, name: string, at: Date): void {
  const skill = skillOf(tally, name);
  skill.calls += 1;
  skill.lastUsed = at.toISOString().slice(0, 10);
  state.skill = name;
}

// shortcut: a reply naming two products goes to the last one, split it if a report ever needs that.
function namedProduct(state: SessionState, text: string): void {
  const { workspace, products } = state.context;
  if (!workspace) return;
  for (const match of text.matchAll(productPath(workspace))) if (products.has(match[1])) state.product = match[1];
}

function chargeCold(tally: Tally, state: SessionState, reply: OpenReply): void {
  const written = tokens(reply.usage.cache_creation_input_tokens);
  const idle = state.lastAt !== null && reply.at.getTime() - state.lastAt.getTime() > CACHE_HOUR_MS;
  // The system prefix stays warm across sessions, so a cold reload still reads some: it writes more than it reads.
  if (state.context.subagent || !idle || written < COLD_MIN_WRITE || tokens(reply.usage.cache_read_input_tokens) >= written) return;
  const rate = priceOf(reply.model, promptTokens(reply.usage));
  if (!rate) return;
  tally.coldCount += 1;
  tally.coldExtraUsd += (written * (rate.write1h - rate.cacheRead)) / PER_MILLION;
}

function chargeTools(tally: Tally, state: SessionState, reply: OpenReply, usd: number): void {
  const share = reply.tools.length ? usd / reply.tools.length : 0;
  for (const tool of reply.tools) {
    const name = tool.name ?? "unknown";
    const entry = tally.tools.get(name) ?? { calls: 0, costUsd: 0 };
    tally.tools.set(name, { calls: entry.calls + 1, costUsd: entry.costUsd + share });
    if (state.skill) addTo(skillOf(tally, state.skill).tools, name, share);
  }
}

/** A reply spans several lines with the same id, so it is counted when the next thing arrives. */
function closeReply(tally: Tally, state: SessionState): void {
  const reply = state.reply;
  state.reply = null;
  if (!reply || tally.seen.has(reply.id)) return;
  tally.seen.add(reply.id);
  if (!state.counted && !state.context.subagent) {
    tally.sessionCount += 1;
    tally.firstContexts.push(promptTokens(reply.usage));
  }
  state.counted = true;
  for (const tool of reply.tools) namedProduct(state, [tool.input?.file_path, tool.input?.path, tool.input?.command].filter((value) => typeof value === "string").join(" "));
  chargeCold(tally, state, reply);
  state.lastAt = reply.at;

  const cost = costOf(reply.usage, reply.model);
  if (!cost && !reply.model.startsWith("<")) tally.unpriced.add(reply.model);
  const usd = cost ? sumKinds(cost) : 0;
  if (cost) {
    addKinds(tally.kinds, cost);
    addTo(tally.models, reply.model, usd);
    if (state.context.subagent) tally.subagentUsd += usd;
    else tally.mainUsd += usd;
    if (state.product) addTo(tally.products, state.product, usd);
    if (state.skill) {
      const skill = skillOf(tally, state.skill);
      addKinds(skill.kinds, cost);
      if (state.product) skill.products.add(state.product);
    }
  }
  chargeTools(tally, state, reply, usd);
  for (const tool of reply.tools) if (tool.name === "Skill" && typeof tool.input?.skill === "string") startSkill(tally, state, tool.input.skill, reply.at);
}

function typedText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as { type?: string; text?: string }[]).filter((block) => block?.type === "text").map((block) => block.text ?? "").join(" ");
}

function readAsk(tally: Tally, state: SessionState, entry: Entry, at: Date): void {
  if (entry.isMeta || entry.isCompactSummary) return;
  const text = typedText(entry.message?.content).trimStart();
  if (!text) return;
  const command = COMMAND.exec(text)?.[1]?.trim();
  if (text.startsWith("<") && !command) return;
  closeReply(tally, state);
  state.skill = null;
  if (command && tally.installed.has(command)) startSkill(tally, state, command, at);
}

function readReply(tally: Tally, state: SessionState, entry: Entry, at: Date): void {
  const message = entry.message;
  if (!message?.id || !message.usage) return;
  if (state.reply?.id !== message.id) {
    closeReply(tally, state);
    state.reply = { id: message.id, at, model: message.model ?? "unknown", usage: message.usage, tools: [] };
  }
  // The last line holds the reply's final count.
  state.reply.usage = message.usage;
  const blocks = Array.isArray(message.content) ? (message.content as ToolUse[]) : [];
  state.reply.tools = [...state.reply.tools, ...blocks.filter((block) => block?.type === "tool_use")];
}

/** Adds one transcript line. Only counts and tool names are kept: never what a person or a tool wrote. */
export function addLine(tally: Tally, line: string, context: FileContext): void {
  if (!line.trim()) return;
  let entry: Entry;
  try {
    entry = JSON.parse(line) as Entry;
  } catch {
    tally.skippedLines += 1;
    return;
  }
  if (!entry?.timestamp) return;
  const at = new Date(entry.timestamp);
  if (Number.isNaN(at.getTime())) {
    tally.skippedLines += 1;
    return;
  }
  if (at < tally.since) return;
  const state = tally.sessions.get(context.session) ?? { context, reply: null, skill: null, product: null, lastAt: null, counted: false };
  tally.sessions.set(context.session, state);
  if (!state.product && entry.cwd) namedProduct(state, entry.cwd);
  if (entry.type === "user") readAsk(tally, state, entry, at);
  else if (entry.type === "assistant") readReply(tally, state, entry, at);
}

/** Reads every transcript touched in the period, line by line: one can be larger than a string may hold. */
export async function readTranscripts(tally: Tally, root: string, shared: Pick<FileContext, "products" | "workspace">): Promise<void> {
  // shortcut: not cached per file, since a resumed session repeats earlier messages and `seen` drops them across files; cache the tally whole if usage gets slow.
  for (const file of transcriptFiles(root, tally.since)) {
    const context: FileContext = { ...shared, subagent: file.includes(`${sep}subagents${sep}`), session: file };
    for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) addLine(tally, line, context);
    const state = tally.sessions.get(file);
    if (state) closeReply(tally, state);
  }
}

/** Skills on this machine: each installed plugin's as `plugin:skill`, and the user's own by name. */
export function installedSkills(claudeHome = join(homedir(), ".claude")): Set<string> {
  const skillsIn = (folder: string): string[] => (existsSync(folder) ? readdirSync(folder).filter((name) => existsSync(join(folder, name, "SKILL.md"))) : []);
  const own = skillsIn(join(claudeHome, "skills"));
  const manifest = join(claudeHome, "plugins", "installed_plugins.json");
  if (!existsSync(manifest)) return new Set(own);
  const { plugins } = JSON.parse(readFileSync(manifest, "utf8")) as { plugins?: Record<string, { installPath?: string }[]> };
  const fromPlugins = Object.entries(plugins ?? {}).flatMap(([key, installs]) => {
    const path = installs?.[0]?.installPath;
    return path ? skillsIn(join(path, "skills")).map((skill) => `${key.split("@")[0]}:${skill}`) : [];
  });
  return new Set([...own, ...fromPlugins]);
}

export interface SkillRow {
  name: string;
  calls: number;
  lastUsed: string | null;
  products: string[];
  costUsd: number;
  kinds: KindCost;
  tools: { name: string; costUsd: number }[];
}

export interface UsageReport {
  since: string;
  sessions: number;
  totalUsd: number;
  mainUsd: number;
  subagentUsd: number;
  kinds: KindCost;
  models: { name: string; costUsd: number }[];
  products: { name: string; costUsd: number }[];
  tools: { name: string; calls: number; costUsd: number }[];
  skills: SkillRow[];
  neverUsed: string[];
  firstContextMedian: number;
  coldReloads: { count: number; extraUsd: number };
  runs: { stage: string; runs: number; costUsd: number }[];
  routes: { small: number; medium: number; large: number; failed: number; decideUsd: number };
  unpricedModels: string[];
  skippedLines: number;
}

const usd = (value: number): number => Math.round(value * 10000) / 10000;
const rounded = (cost: KindCost): KindCost => ({ input: usd(cost.input), output: usd(cost.output), cacheWrite: usd(cost.cacheWrite), cacheRead: usd(cost.cacheRead) });
const byCost = <T extends { costUsd: number; name: string }>(rows: T[]): T[] => [...rows].sort((a, b) => b.costUsd - a.costUsd || a.name.localeCompare(b.name));
const rows = (map: Map<string, number>) => byCost([...map].map(([name, cost]) => ({ name, costUsd: usd(cost) })));

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function readRuns(file: string | undefined, since: Date): UsageReport["runs"] {
  if (!file || !existsSync(file)) return [];
  const stages = new Map<string, { runs: number; costUsd: number }>();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    try {
      const run = JSON.parse(line) as { at?: string; stage?: string; costUsd?: unknown };
      if (!run.stage || !run.at || new Date(run.at) < since) continue;
      const entry = stages.get(run.stage) ?? { runs: 0, costUsd: 0 };
      stages.set(run.stage, { runs: entry.runs + 1, costUsd: entry.costUsd + tokens(run.costUsd) });
    } catch {
      continue;
    }
  }
  return [...stages].map(([stage, entry]) => ({ stage, runs: entry.runs, costUsd: usd(entry.costUsd) })).sort((a, b) => b.costUsd - a.costUsd);
}

function readRoutes(file: string | undefined, since: Date): UsageReport["routes"] {
  const routes = { small: 0, medium: 0, large: 0, failed: 0, decideUsd: 0 };
  if (!file || !existsSync(file)) return routes;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    try {
      const entry = JSON.parse(line) as { at?: string; size?: unknown; decideUsd?: unknown };
      if (!entry.at || new Date(entry.at) < since) continue;
      if (entry.size === "small" || entry.size === "medium" || entry.size === "large") routes[entry.size] += 1;
      else routes.failed += 1;
      routes.decideUsd += tokens(entry.decideUsd);
    } catch {
      continue;
    }
  }
  return { ...routes, decideUsd: usd(routes.decideUsd) };
}

export function buildReport(tally: Tally, runsFile?: string, routesFile?: string): UsageReport {
  for (const state of tally.sessions.values()) closeReply(tally, state);
  const skills: SkillRow[] = [...tally.skills].map(([name, skill]) => ({
    name,
    calls: skill.calls,
    lastUsed: skill.lastUsed,
    products: [...skill.products].sort(),
    costUsd: usd(sumKinds(skill.kinds)),
    kinds: rounded(skill.kinds),
    tools: rows(skill.tools).filter((tool) => tool.costUsd > 0),
  }));
  return {
    since: tally.since.toISOString().slice(0, 10),
    sessions: tally.sessionCount,
    totalUsd: usd(sumKinds(tally.kinds)),
    mainUsd: usd(tally.mainUsd),
    subagentUsd: usd(tally.subagentUsd),
    kinds: rounded(tally.kinds),
    models: rows(tally.models),
    products: rows(tally.products),
    tools: byCost([...tally.tools].map(([name, tool]) => ({ name, calls: tool.calls, costUsd: usd(tool.costUsd) }))),
    skills: byCost(skills),
    neverUsed: [...tally.installed].filter((name) => !tally.skills.has(name)).sort(),
    firstContextMedian: median(tally.firstContexts),
    coldReloads: { count: tally.coldCount, extraUsd: usd(tally.coldExtraUsd) },
    runs: readRuns(runsFile, tally.since),
    routes: readRoutes(routesFile, tally.since),
    unpricedModels: [...tally.unpriced].sort(),
    skippedLines: tally.skippedLines,
  };
}

const TOP_ROWS = 10;
const money = (value: number): string => `$${value.toFixed(2)}`;
const share = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%");

function kindsLine(kinds: KindCost): string {
  const total = sumKinds(kinds);
  return `cache read ${share(kinds.cacheRead, total)} · cache write ${share(kinds.cacheWrite, total)} · output ${share(kinds.output, total)} · input ${share(kinds.input, total)}`;
}

/** One skill in full: what is costly inside it. */
export function formatSkill(report: UsageReport, name: string): string {
  const skill = report.skills.find((row) => row.name === name);
  if (!skill) return `${name}: not used since ${report.since}`;
  return [
    `${skill.name}: ${skill.calls} calls · last ${skill.lastUsed ?? "unknown"} · ~${money(skill.costUsd)}`,
    `used in: ${skill.products.join(", ") || "no product"}`,
    kindsLine(skill.kinds),
    ...skill.tools.slice(0, TOP_ROWS).map((tool) => `  ${tool.name}  ${money(tool.costUsd)}`),
  ].join("\n");
}

const section = (title: string, lines: string[]): string[] => (lines.length ? [``, title, ...lines] : []);

export function formatReport(report: UsageReport): string {
  const total = report.totalUsd;
  const named = (list: { name: string; costUsd: number }[]) => list.slice(0, TOP_ROWS).map((row) => `  ${row.name}  ${money(row.costUsd)} (${share(row.costUsd, total)})`);
  return [
    `since ${report.since} · ${report.sessions} sessions · ~${money(total)} at list prices, not a bill`,
    kindsLine(report.kinds),
    `main ${share(report.mainUsd, total)} · subagents ${share(report.subagentUsd, total)}`,
    `context at first reply: ${report.firstContextMedian.toLocaleString("en-US")} tokens (median)`,
    `cold reloads: ${report.coldReloads.count}, ~${money(report.coldReloads.extraUsd)} extra`,
    ...section("models", named(report.models)),
    ...section("products", named(report.products)),
    ...section("tools (cost of the replies that called them)", report.tools.slice(0, TOP_ROWS).map((tool) => `  ${tool.name}  ${tool.calls} calls  ${money(tool.costUsd)}`)),
    ...section("skills (from the call to the next message)", report.skills.slice(0, TOP_ROWS).map((skill) => `  ${skill.name}  ${skill.calls} calls  last ${skill.lastUsed ?? "unknown"}  ${money(skill.costUsd)}`)),
    `installed but never used: ${report.neverUsed.length} (canon usage --unused)`,
    ...section("canon runs", report.runs.map((run) => `  ${run.stage}  ${run.runs} runs  ${money(run.costUsd)}`)),
    ...section("prompt routing", report.routes.small + report.routes.medium + report.routes.large + report.routes.failed ? [`  small ${report.routes.small} · medium ${report.routes.medium} · large ${report.routes.large} · could not decide ${report.routes.failed} · deciding cost ${money(report.routes.decideUsd)}`] : []),
    ...(report.unpricedModels.length ? [``, `no price for: ${report.unpricedModels.join(", ")}`] : []),
    ...(report.skippedLines ? [``, `could not read ${report.skippedLines} lines`] : []),
  ].join("\n");
}
