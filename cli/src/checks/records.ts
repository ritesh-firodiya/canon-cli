import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/files.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import type { Check, Finding } from "./types.ts";

const OUTCOMES = ["retained", "discarded", "retried"];
// A chore or a platform change ships with nothing a user reads; a feature that never shipped keeps its target release.
const NEVER_SHIPPED = ["shelved", "superseded"];
const STORE_COPY = /^## Store copy[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m;

const hasSection = (body: string, section: string) => new RegExp(`^## ${section}[ \\t]*$`, "m").test(body);
const missingSections = (body: string, sections: string[]) => sections.filter((section) => !hasSection(body, section)).map((section) => `missing section ## ${section}`);

/** Any record can run as an experiment: it says what it tests, and once it has an outcome, what happened. */
function experimentRules(folder: string, data: Record<string, unknown>, body: string): string[] {
  const outcome = data.outcome ? String(data.outcome) : null;
  return [
    ...(outcome && !OUTCOMES.includes(outcome) ? [`outcome ${outcome} is not one of ${OUTCOMES.join(", ")}`] : []),
    ...(data.experiment === true ? missingSections(body, ["Hypothesis", "Metric"]) : []),
    ...(outcome || (folder === "experiments" && data.status === "done") ? missingSections(body, ["Result"]) : []),
  ];
}

/** A shipped feature's release note. */
function storeCopyRule(folder: string, data: Record<string, unknown>, body: string): string[] {
  if (folder !== "features" || data.type !== "feature") return [];
  const released = /\d+\.\d+\.\d+/.test(String(data.release ?? "")) && !NEVER_SHIPPED.includes(String(data.status));
  const copy = STORE_COPY.exec(body.replace(/<!--[\s\S]*?-->/g, ""));
  return released && !(copy && /^>[ \t]*\S/m.test(copy[1])) ? [`ships in ${data.release} with no "> …" line under ## Store copy`] : [];
}

export const records: Check = {
  id: "records",
  module: "docs",
  description: "each record has its id, status, fields and sections for its kind, and links only to records that exist",
  run({ repo, config }) {
    const pages = config.records.flatMap((kind) =>
      listFiles(repo, `.context/${kind.folder}`, (name) => /^\d{4}-.+\.md$/.test(name)).map((file) => ({ kind, file, ...parseFrontmatter(readFileSync(join(repo, file), "utf8")) })),
    );
    const known = new Set(pages.map((page) => String(page.data?.id)));
    const recordId = new RegExp(`\\b(?:${config.records.map((kind) => kind.prefix).join("|")})-\\d{4}\\b`, "g");
    return pages.flatMap(({ kind, file, data, body }): Finding[] => {
      const finding = (message: string): Finding => ({ check: "records", level: "error", file, message });
      if (!data) return [finding("no frontmatter")];
      const expectedId = `${kind.prefix}-${file.match(/(\d{4})-[^/]+$/)?.[1]}`;
      const links = Object.entries(data).flatMap(([field, value]) => (field === "id" ? [] : (String(value ?? "").match(recordId) ?? [])));
      const messages = [
        ...(data.id ? (data.id === expectedId ? [] : [`id ${data.id} should be ${expectedId}`]) : ["missing id"]),
        ...(data.status ? (kind.statuses.includes(String(data.status)) ? [] : [`status ${data.status} is not one of ${kind.statuses.join(", ")}`]) : ["missing status"]),
        ...Object.entries(kind.fields).flatMap(([field, values]) => {
          if (!data[field]) return [`missing field ${field}`];
          return values && !values.includes(String(data[field])) ? [`${field} ${data[field]} is not one of ${values.join(", ")}`] : [];
        }),
        ...missingSections(body, kind.sections),
        ...experimentRules(kind.folder, data, body),
        ...storeCopyRule(kind.folder, data, body),
        ...links.filter((id) => !known.has(id)).map((id) => `links to ${id}, which does not exist`),
      ];
      return messages.map(finding);
    });
  },
};
