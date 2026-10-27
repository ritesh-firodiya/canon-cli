import { basename } from "node:path";
import { loadConfig } from "../../src/config/load.ts";
import type { CheckContext } from "../../src/checks/types.ts";

export function contextFor(repo: string, overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    repo,
    name: basename(repo),
    config: loadConfig(repo, { estateRoot: repo }).config,
    canonRoot: repo,
    today: new Date("2026-10-23"),
    ...overrides,
  };
}
