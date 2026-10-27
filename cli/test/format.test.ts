import { describe, expect, test } from "vitest";
import { exitCode, formatReports } from "../src/format.ts";
import type { Report } from "../src/run.ts";

const report = (name: string, levels: Array<"error" | "warn">): Report => ({
  repo: `/x/${name}`,
  name,
  findings: levels.map((level, i) => ({ check: "c", level, message: `m${i}`, file: `f${i}` })),
  skipped: [],
});

describe("formatReports", () => {
  test("prints one header per product with counts, then its findings", () => {
    const text = formatReports([report("a", ["error", "warn"]), report("b", [])]);
    expect(text).toContain("a  1 error, 1 warning");
    expect(text).toContain("  ✗ c  f0  m0");
    expect(text).toContain("  ! c  f1  m1");
    expect(text).toContain("b  ok");
  });

  test("ends with a total line", () => {
    expect(formatReports([report("a", ["error"]), report("b", ["warn"])])).toMatch(/2 products · 1 error · 1 warning$/);
  });

  test("quiet mode hides products with no findings", () => {
    expect(formatReports([report("a", []), report("b", ["warn"])], { quiet: true })).not.toContain("a  ok");
  });
});

describe("exitCode", () => {
  test("is 1 when any error exists, else 0", () => {
    expect(exitCode([report("a", ["warn"])])).toBe(0);
    expect(exitCode([report("a", ["warn"]), report("b", ["error"])])).toBe(1);
  });
});
