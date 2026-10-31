import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { day, RELEASE_TAG, versionOf } from "../src/flow/facts.ts";
import { flow } from "../src/flow/flow.ts";
import { allSessions, belongs, COMMIT_CALL, productPath, readSession } from "../src/flow/sessions.ts";
import { makeTree } from "./helpers/fixture.ts";

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

  test("counts each conversation at every stage up to the furthest its commits reached, and the hours between", () => {
    const workspace = makeTree({});
    const repo = join(workspace, "myapp");
    const at = (iso: string) => ({ GIT_COMMITTER_DATE: iso, GIT_AUTHOR_DATE: iso });
    const git = (env: object, ...args: string[]) => execFileSync("git", ["-C", repo, ...args], { env: { ...process.env, ...env } });
    const commit = (iso: string, file: string, text = "x") => {
      mkdirSync(dirname(join(repo, file)), { recursive: true });
      writeFileSync(join(repo, file), text);
      git({}, "add", "-A");
      git(at(iso), "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", file);
    };
    mkdirSync(repo);
    git({}, "init", "-q");
    git({}, "remote", "add", "origin", "git@github.com:me/myapp.git");
    commit("2026-10-01T10:00:00Z", ".context/context.yaml", "pipeline:\n  - { id: idea, done: [x] }\n  - { id: plan, done: [x] }\n  - { id: code, done: [x] }\n  - { id: review, done: [x] }\n  - { id: live, done: [x] }\n");
    commit("2026-10-01T11:00:00Z", ".context/features/stats.md");
    commit("2026-10-01T13:00:00Z", "src/stats.ts");
    commit("2026-10-02T09:00:00Z", ".context/ops/release.yml", "surfaces:\n  ios: { live: '1.0.0' }\n");
    git(at("2026-10-02T09:00:00Z"), "tag", "v1.0.0");
    const head = git({}, "rev-parse", "HEAD").toString().trim();
    const github = (path: string) => (path.includes("/pulls?") ? [{ number: 1, merged_at: "2026-10-01T15:00:00Z", merge_commit_sha: head }] : path.includes("/commits") ? [] : []);

    const projects = makeTree({
      "p/one.jsonl": [
        line({ timestamp: "2026-10-01T10:30:00Z", type: "user", cwd: repo, message: { content: "plan stats" } }),
        line({ timestamp: "2026-10-01T11:00:30Z", type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "git commit -m plan" } }] } }),
        line({ timestamp: "2026-10-01T13:00:30Z", type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "git commit -m code" } }] } }),
      ].join("\n"),
      "p/two.jsonl": line({ timestamp: "2026-10-03T08:00:00Z", type: "user", cwd: repo, message: { content: "just asking" } }),
      "p/elsewhere.jsonl": line({ type: "user", cwd: join(workspace, "other"), message: { content: "not this one" } }),
    });
    mkdirSync(join(workspace, "other", ".git"), { recursive: true });

    const result = flow(workspace, "myapp", allSessions(workspace, projects), [], github);
    expect(result.since).toBe("2026-10-01");
    expect(result.stages).toEqual([{ id: "idea", count: 2 }, { id: "plan", count: 1 }, { id: "code", count: 1 }, { id: "review", count: 1 }, { id: "live", count: 1 }]);
    expect(result.medianHours).toEqual({ "idea→plan": 0.5, "plan→code": 2, "code→review": null, "review→live": null });
  });

  test("a live web surface counts everything deployed, not only what its tag holds", () => {
    const workspace = makeTree({});
    const repo = join(workspace, "site");
    const at = (iso: string) => ({ GIT_COMMITTER_DATE: iso, GIT_AUTHOR_DATE: iso });
    const git = (env: object, ...args: string[]) => execFileSync("git", ["-C", repo, ...args], { env: { ...process.env, ...env } });
    const commit = (iso: string, file: string, text = "x") => {
      mkdirSync(dirname(join(repo, file)), { recursive: true });
      writeFileSync(join(repo, file), text);
      git({}, "add", "-A");
      git(at(iso), "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", file);
    };
    mkdirSync(repo);
    git({}, "init", "-q");
    git({}, "remote", "add", "origin", "git@github.com:me/site.git");
    commit("2026-10-01T10:00:00Z", ".context/context.yaml", "pipeline:\n  - { id: idea, done: [x] }\n  - { id: code, done: [x] }\n  - { id: live, done: [x] }\n");
    git(at("2026-10-01T10:00:00Z"), "tag", "v0.1.0");
    commit("2026-10-02T10:00:00Z", "src/page.ts");
    const deployed = git({}, "rev-parse", "HEAD").toString().trim();
    commit("2026-10-03T10:00:00Z", ".context/ops/release.yml", `surfaces:\n  web: { live: { version: "0.1.0" }, deployed: { commit: ${deployed}, since: "2026-10-02" } }\n`);
    const projects = makeTree({
      "p/one.jsonl": [
        line({ timestamp: "2026-10-02T09:30:00Z", type: "user", cwd: repo, message: { content: "change the page" } }),
        line({ timestamp: "2026-10-02T10:00:30Z", type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "git commit -m page" } }] } }),
      ].join("\n"),
    });

    const result = flow(workspace, "site", allSessions(workspace, projects), [], () => []);

    expect(result.stages).toContainEqual({ id: "live", count: 1 });
  });

  test("a stage with no evidence rule is an error naming the ones there are", () => {
    const workspace = makeTree({ "myapp/.context/context.yaml": "pipeline:\n  - { id: idea, done: [x] }\n  - { id: vibes, done: [x] }\n" });
    execFileSync("git", ["-C", join(workspace, "myapp"), "init", "-q"]);
    expect(() => flow(workspace, "myapp", [], [], () => [])).toThrow(/no evidence rule for stage\(s\) vibes/);
  });
});
