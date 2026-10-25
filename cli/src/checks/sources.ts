import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import type { Check, Finding } from "./types.ts";
import { wikiPages } from "./wiki-frontmatter.ts";

// zeno has no connectors: a source page must say which MCP server, skill or CLI
// reads it, or the weigh gate cannot turn a claim into a fact.
const ACCESS = /^(mcp|skill|cli):\s*(\S+)/;
const HOW_TO_QUERY = /^## How to query\s*$/m;

function accessValue(body: string, id: string): string | null {
  const row = body.split("\n").find((line) => line.replace(/\s/g, "").startsWith(`|${id}.ACCESS|`));
  return row ? (row.split("|")[2]?.trim() ?? "") : null;
}

export const sources: Check = {
  id: "sources",
  module: "docs",
  description: "each SOURCE.* page says how to read it (mcp, skill or a cli in doctor.tools) and has a How to query section",
  run({ repo, config }) {
    const tools = new Set(config.doctor.tools.map((tool) => tool.tool));
    return wikiPages(repo).flatMap((file): Finding[] => {
      const { data, body } = parseFrontmatter(readFileSync(join(repo, file), "utf8"));
      const id = String(data?.id ?? "");
      if (data?.type !== "entity" || !id.startsWith("SOURCE.")) return [];

      const findings: Finding[] = [];
      const add = (message: string) => findings.push({ check: "sources", level: "error", file, message });
      if (!HOW_TO_QUERY.test(body)) add("no `## How to query` section");

      const access = accessValue(body, id);
      const match = access === null ? null : ACCESS.exec(access);
      if (access === null) add(`no ${id}.ACCESS row — say how to read it`);
      else if (!match) add(`${id}.ACCESS is "${access}" — write mcp: <server>, skill: <name> or cli: <command>`);
      else if (match[1] === "cli" && !tools.has(match[2])) add(`cli ${match[2]} is not in doctor.tools — zeno doctor cannot report it missing`);
      return findings;
    });
  },
};
