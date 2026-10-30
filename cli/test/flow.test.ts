import { homedir } from "node:os";
import { describe, expect, test } from "vitest";
import { day, RELEASE_TAG, versionOf } from "../src/flow/facts.ts";
import { belongs, COMMIT_CALL, productPath, readSession } from "../src/flow/sessions.ts";

const W = `${homedir()}/work/products`;
const line = (entry: object) => JSON.stringify({ timestamp: "2026-10-01T10:00:00Z", ...entry });

describe("canon flow", () => {
  test("a release is a version tag, and a commit call is any git … commit", () => {
    expect(RELEASE_TAG.test("v1.4.1") && RELEASE_TAG.test("mobile-v0.1.1")).toBe(true);
    expect(RELEASE_TAG.test("stash-bak-0")).toBe(false);
    expect(COMMIT_CALL.test('git -C myapp commit -m "x"') && COMMIT_CALL.test("git commit -q -F -")).toBe(true);
    expect(COMMIT_CALL.test("git status; echo commit")).toBe(false);
  });

  test("release.yml dates and versions read in every shape it writes them", () => {
    expect(day("2026-10-27").getUTCHours()).toBe(0);
    expect(day("2026-09-30T17:43:43+00:00").getUTCHours()).toBe(17);
    expect([versionOf("2.0.1 (15)"), versionOf({ version: "1.4.3" }), versionOf(null)]).toEqual(["2.0.1", "1.4.3", null]);
  });

  test("a product folder is found in full and from ~", () => {
    const found = [...`cd ${W}/myapp && git -C ~/work/products/shared status`.matchAll(productPath(W))].map((m) => m[1]);
    expect(found).toEqual(["myapp", "shared"]);
  });

  test("a conversation belongs to a product it worked in, or to any product when it worked in none", () => {
    const known = new Set(["myapp", "shared"]);
    expect(belongs(new Set(["myapp", "CLAUDE.md"]), new Set(["myapp"]), known)).toBe(true);
    expect(belongs(new Set(["CLAUDE.md"]), new Set(["myapp"]), known)).toBe(true);
    expect(belongs(new Set(["shared", "bin"]), new Set(["myapp"]), known)).toBe(false);
  });

  test("a session is its typed requests, commit calls, first web search and folders; tool output is not read", () => {
    const text = [
      line({ type: "user", cwd: `${W}/myapp`, message: { content: "add a stats screen" } }),
      line({ type: "user", message: { content: "<command-name>/clear</command-name>" } }),
      line({ timestamp: "2026-10-01T10:05:00Z", type: "assistant", message: { content: [{ type: "tool_use", name: "WebSearch", input: { query: "charts" } }] } }),
      line({ timestamp: "2026-10-01T10:09:00Z", type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "git commit -m x" } }] } }),
      line({ type: "user", message: { content: [{ type: "tool_result", content: `${W}/shared` }] } }),
      "not json",
    ].join("\n");
    const session = readSession(text, productPath(W));
    expect(session).toEqual({
      start: new Date("2026-10-01T10:00:00Z"),
      calls: [new Date("2026-10-01T10:09:00Z")],
      web: new Date("2026-10-01T10:05:00Z"),
      where: new Set(["myapp"]),
    });
    expect(readSession(line({ type: "user", message: { content: "<system-reminder>" } }), productPath(W))).toBeNull();
  });
});
