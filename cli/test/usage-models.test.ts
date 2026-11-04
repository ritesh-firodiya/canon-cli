import { describe, expect, test } from "vitest";
import { latestModel } from "../src/setup/models/latest.ts";

const reply = (data: unknown, ok = true) => (async () => ({ ok, json: async () => data }) as Response) as typeof fetch;
const rows = { data: [{ id: "claude-haiku-4-5", created_at: "2025-10-01T00:00:00Z" }, { id: "claude-haiku-5-5", created_at: "2026-10-01T00:00:00Z" }, { id: "claude-opus-5-5", created_at: "2026-11-01T00:00:00Z" }] };

describe("latestModel", () => {
  test("returns the alias when there is no API key", async () => {
    expect(await latestModel("haiku", undefined, reply(rows))).toBe("haiku");
  });
  test("returns the newest id in the family", async () => {
    expect(await latestModel("haiku", "k", reply(rows))).toBe("claude-haiku-5-5");
  });
  test("returns the alias when the list fails or has no match", async () => {
    expect(await latestModel("sonnet", "k", reply(rows))).toBe("sonnet");
    expect(await latestModel("opus", "k", reply({}, false))).toBe("opus");
  });
});
