import { describe, expect, test } from "vitest";
import { tasks } from "../../src/checks/tasks.ts";
import { makeTree } from "../helpers/fixture.ts";
import { contextFor } from "../helpers/context.ts";

const TODAY = new Date("2026-10-23");
const at = (files: Record<string, string>) => contextFor(makeTree(files), { today: TODAY });

describe("tasks", () => {
  const blocked = (item: string) => ({ ".context/tasks.md": `# Tasks\n\n## Blocked\n${item}\n` });

  test("a blocked task with all three fields passes; a passed check date is a warning", () => {
    expect(tasks.run(at(blocked("- [ ] T005 Ship\n  blocked-by: Apple\n  unblock: wait\n  next-check: after T010")))).toEqual([]);
    const late = tasks.run(at(blocked("- [ ] T005 Ship\n  blocked-by: Apple\n  unblock: wait\n  next-check:2026-10-01")));
    expect(late).toEqual([expect.objectContaining({ level: "warn", message: expect.stringMatching(/T005 was to be checked/) })]);
  });

  test("a missing field, a missing id and a non-date are errors", () => {
    const findings = tasks.run(at(blocked("- [ ] T005 Ship\n  blocked-by: Apple\n  next-check: 2026-13-45\n- [ ] no id here")));
    expect(findings.map((f) => f.message)).toEqual([
      "T005 is blocked without unblock:",
      "T005 next-check: 2026-13-45 is not a date",
      "blocked item without a task id: - [ ] no id here",
    ]);
  });
});
