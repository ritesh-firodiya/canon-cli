import { describe, expect, test } from "vitest";
import { metricsDefinitions } from "../../src/checks/metrics-definitions.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

describe("metrics-definitions", () => {
  test("a repo with metrics/definitions.yml passes", () => {
    expect(metricsDefinitions.run(contextFor(makeTree({ ".context/metrics/definitions.yml": "retention: {}\n" })))).toEqual([]);
  });

  test("a missing definitions.yml is a warning, not an error", () => {
    const findings = metricsDefinitions.run(contextFor(makeTree({ "README.md": "" })));
    expect(findings).toEqual([expect.objectContaining({ level: "warn", file: ".context/metrics/definitions.yml" })]);
  });
});
