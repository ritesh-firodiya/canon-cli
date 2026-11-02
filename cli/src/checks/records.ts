import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { listFiles } from "../lib/files.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import { fieldProblem } from "../records/fields.ts";
import type { Check, Finding } from "./types.ts";

// A chore or a platform change ships with nothing a user reads; a feature that never shipped keeps its target release.
const NEVER_SHIPPED = ["shelved", "superseded"];
const STORE_COPY = /^## Store copy[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m;

const hasSection = (body: string, section: string) => new RegExp(`^## ${section}[ \\t]*$`, "m").test(body);

/** An experiment should say what it tests and what happened, but a missing section does not block a push. */
function experimentWarnings(folder: string, data: Record<string, unknown>, body: string): string[] {
  const wanted = [...(folder === "experiments" ? ["Hypothesis", "Metric"] : []), ...(data.outcome || (folder === "experiments" && data.status === "done") ? ["Result"] : [])];
  return wanted.filter((section) => !hasSection(body, section)).map((section) => `no ## ${section} section`);
}

/** A shipped feature's release note: store listings read it. */
function storeCopyRule(folder: string, data: Record<string, unknown>, body: string): string[] {
  if (folder !== "features" || data.type !== "feature") return [];
  const released = /\d+\.\d+\.\d+/.test(String(data.release ?? "")) && !NEVER_SHIPPED.includes(String(data.status));
  const copy = STORE_COPY.exec(body.replace(/<!--[\s\S]*?-->/g, ""));
  return released && !(copy && /^>[ \t]*\S/m.test(copy[1])) ? [`ships in ${data.release} with no "> …" line under ## Store copy`] : [];
}

export const records: Check = {
  id: "records",
  module: "docs",
  description: "each record has a unique id matching its file, its values fit the repo's rules, what the repo requires is there, and links name records that exist",
  run({ repo, config }) {
    const pages = config.records.flatMap((kind) =>
      listFiles(repo, `.context/${kind.folder}`, (name) => (kind.named ? name.endsWith(".md") && name !== "index.md" : /^\d{4}-.+\.md$/.test(name))).map((file) => ({ kind, file, ...parseFrontmatter(readFileSync(join(repo, file), "utf8")) })),
    );
    const idOf = (kind: (typeof pages)[number]["kind"], data: Record<string, unknown> | null) => String((kind.named ? data?.name : data?.id) ?? "");
    const ids = pages.map((page) => idOf(page.kind, page.data));
    const known = new Set(ids);
    const prefixes = config.records.map((kind) => kind.prefix).filter(Boolean);
    const recordId = new RegExp(`\\b(?:${prefixes.join("|") || "$^"})-\\d{4}\\b`, "g");
    return pages.flatMap(({ kind, file, data, body }): Finding[] => {
      const finding = (message: string, level: Finding["level"] = "error"): Finding => ({ check: "records", level, file, message });
      if (!data) return [finding("no frontmatter")];
      const idField = kind.named ? "name" : "id";
      const id = idOf(kind, data);
      const expected = kind.named ? basename(file, ".md") : `${kind.prefix}-${file.match(/(\d{4})-[^/]+$/)?.[1]}`;
      const links = Object.entries(data).flatMap(([field, value]) => (field === idField ? [] : (String(value ?? "").match(recordId) ?? [])));
      const experiment = data.experiment && !known.has(String(data.experiment)) ? [String(data.experiment)] : [];
      const errors = [
        ...(id ? (id === expected ? [] : [`${idField} ${id} should be ${expected}`]) : [`missing ${idField}`]),
        ...(id && ids.filter((other) => other === id).length > 1 ? [`${idField} ${id} is used by more than one record`] : []),
        ...Object.entries(data).flatMap(([field, value]) => {
          if (field === idField || value === null || value === undefined) return [];
          const problem = fieldProblem(config, kind, field, value);
          return problem ? [problem] : [];
        }),
        ...kind.required.flatMap((need) => {
          if (need.startsWith("## ")) return hasSection(body, need.slice(3)) ? [] : [`missing section ${need}`];
          return data[need] === undefined || data[need] === null || data[need] === "" ? [`missing field ${need}`] : [];
        }),
        ...storeCopyRule(kind.folder, data, body),
        ...[...links, ...experiment].filter((link) => !known.has(link)).map((link) => `links to ${link}, which does not exist`),
      ];
      return [...errors.map((message) => finding(message)), ...experimentWarnings(kind.folder, data, body).map((message) => finding(message, "warn"))];
    });
  },
};
