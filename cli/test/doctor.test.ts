import { describe, expect, test } from "vitest";
import { runDoctor, type Probe } from "../src/doctor.ts";

const probe = (outputs: Record<string, string | null>): Probe => (command) => outputs[command] ?? null;

describe("runDoctor", () => {
  test("reports each tool as ok with its version, or missing with an install hint", () => {
    const results = runDoctor(probe({ node: "v24.21.0", qmd: "qmd 2.8.3 (facd35e)", git: "git version 2.50.0" }));
    const qmd = results.find((r) => r.tool === "qmd");
    expect(qmd).toEqual(expect.objectContaining({ ok: true, version: "2.8.3" }));
    expect(results.map((r) => r.tool)).toEqual(["node", "git", "qmd"]);
  });

  test("tools declared in zeno.yaml are checked after the core ones", () => {
    const extra = [{ tool: "rtk", why: "short output", hint: "brew install rtk" }];
    const results = runDoctor(probe({ node: "v24.0.0" }), extra);
    const rtk = results.find((r) => r.tool === "rtk");
    expect(rtk).toEqual({ tool: "rtk", ok: false, why: "short output", hint: "brew install rtk" });
  });

  test("an outdated node is not ok", () => {
    const node = runDoctor(probe({ node: "v20.1.0" })).find((r) => r.tool === "node");
    expect(node).toEqual(expect.objectContaining({ ok: false, version: "20.1.0" }));
    expect(node?.hint).toMatch(/23\.6/);
  });
});
