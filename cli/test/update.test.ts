import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { isOlder, updateCanon } from "../src/update/update.ts";
import { makeTree } from "./helpers/fixture.ts";

const installed = (version: string, extra: Record<string, string> = {}) =>
  makeTree({ "canon/.claude-plugin/plugin.json": JSON.stringify({ version }), ...extra });

function harness(latest: string, failing: string[] = []) {
  const calls: string[] = [];
  return {
    calls,
    run: (command: string, args: string[]) => {
      calls.push([command, ...args].join(" "));
      return failing.includes(command) ? { status: 1, output: `${command} broke\nmore` } : { status: 0, output: "" };
    },
    fetchText: async () => JSON.stringify({ version: latest }),
  };
}

describe("updateCanon", () => {
  test("an old npm install moves to the latest, then the plugin updates", async () => {
    const h = harness("0.21.0");
    const lines = await updateCanon({ canonRoot: join(installed("0.20.1"), "canon"), ...h });
    expect(h.calls).toEqual(["npm install -g @freetesh/canon@0.21.0", "claude plugin marketplace update canon", "claude plugin update canon@canon"]);
    expect(lines).toEqual(["cli: 0.20.1 → 0.21.0", "plugin: updated — restart Claude Code to load it"]);
  });

  test("a pnpm global install updates with pnpm", async () => {
    const h = harness("0.21.0");
    const root = makeTree({ "pnpm/global/canon/.claude-plugin/plugin.json": JSON.stringify({ version: "0.20.1" }) });
    await updateCanon({ canonRoot: join(root, "pnpm/global/canon"), ...h });
    expect(h.calls[0]).toBe("pnpm add -g @freetesh/canon@0.21.0");
  });

  test("the latest installs nothing, and a git checkout is left to git", async () => {
    const latest = harness("0.20.1");
    expect((await updateCanon({ canonRoot: join(installed("0.20.1"), "canon"), ...latest }))[0]).toBe("cli: 0.20.1 is the latest");
    const checkout = harness("0.21.0");
    const lines = await updateCanon({ canonRoot: join(installed("0.20.1", { "canon/.git/HEAD": "" }), "canon"), ...checkout });
    expect(lines[0]).toMatch(/checkout .* git pull there/);
    expect(checkout.calls.some((call) => call.startsWith("npm"))).toBe(false);
  });

  test("an install newer than npm's latest, as before a publish, is never moved back", async () => {
    const h = harness("0.20.1");
    expect((await updateCanon({ canonRoot: join(installed("0.21.0"), "canon"), ...h }))[0]).toBe("cli: 0.21.0 is the latest");
    expect(h.calls.some((call) => call.startsWith("npm"))).toBe(false);
    expect([isOlder("0.9.0", "0.10.0"), isOlder("1.0.0", "0.10.0"), isOlder("1.0.0", "1.0.0")]).toEqual([true, false, false]);
  });

  test("a failed install stops before the plugin; a failed plugin update is reported, not thrown", async () => {
    const npm = harness("0.21.0", ["npm"]);
    await expect(updateCanon({ canonRoot: join(installed("0.20.1"), "canon"), ...npm })).rejects.toThrow(/npm could not install/);
    expect(npm.calls).toHaveLength(1);
    const claude = harness("0.20.1", ["claude"]);
    expect((await updateCanon({ canonRoot: join(installed("0.20.1"), "canon"), ...claude }))[1]).toBe("plugin: not updated — claude broke");
  });
});
