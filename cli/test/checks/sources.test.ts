import { describe, expect, test } from "vitest";
import { sources } from "../../src/checks/sources.ts";
import { makeTree, wikiPage } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const PAGE = ".context/wiki/entities/source-sentry.md";
const HOW = "## How to query\nSearch issues by keyword.\n";
const source = (access: string | null, how = HOW, id = "SOURCE.SENTRY") =>
  wikiPage(
    { id, type: "entity", status: "canonical", "last-verified": "2026-10-01" },
    `## Summary\nCrashes.\n\n## Canonical values\n| Key | Value | Last changed |\n|---|---|---|\n| SOURCE.SENTRY.PROJECT | app | 2026-10-01 |\n${access === null ? "" : `| SOURCE.SENTRY.ACCESS | ${access} | 2026-10-01 |\n`}\n${how}`,
  );
const SENTRY_CLI = { ".claude/canon.yaml": "doctor:\n  tools:\n    - { tool: sentry-cli, why: reads Sentry, hint: brew install getsentry/tools/sentry-cli }\n" };

function run(files: Record<string, string>) {
  return sources.run(contextFor(makeTree(files)));
}

describe("sources", () => {
  test("an mcp, skill or declared cli source passes", () => {
    expect(run({ [PAGE]: source("mcp: sentry") })).toEqual([]);
    expect(run({ [PAGE]: source("skill: datadog") })).toEqual([]);
    expect(run({ ...SENTRY_CLI, [PAGE]: source("cli: sentry-cli") })).toEqual([]);
  });

  test("a dashboard a person reads by hand passes as manual", () => {
    expect(run({ [PAGE]: source("manual: RevenueCat dashboard, Charts") })).toEqual([]);
  });

  test("an entity that is not a source is ignored", () => {
    expect(run({ [PAGE]: source(null, "", "PRICE.PACK") })).toEqual([]);
  });

  test("a source with no ACCESS row is an error", () => {
    expect(run({ [PAGE]: source(null) })).toEqual([
      expect.objectContaining({ level: "error", file: PAGE, message: expect.stringContaining("SOURCE.SENTRY.ACCESS") }),
    ]);
  });

  test("an ACCESS value that names no way to read is an error", () => {
    expect(run({ [PAGE]: source("Sentry MCP server") })).toEqual([
      expect.objectContaining({ level: "error", message: expect.stringContaining("manual: <where>") }),
    ]);
  });

  test("a cli missing from doctor.tools is an error", () => {
    expect(run({ [PAGE]: source("cli: snowsql") })).toEqual([
      expect.objectContaining({ level: "error", message: expect.stringContaining("doctor.tools") }),
    ]);
  });

  test("a source with no How to query section is an error", () => {
    expect(run({ [PAGE]: source("mcp: sentry", "") })).toEqual([
      expect.objectContaining({ level: "error", message: expect.stringContaining("How to query") }),
    ]);
  });
});
