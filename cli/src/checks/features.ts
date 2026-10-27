import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { listFiles } from "../lib/files.ts";
import { parseFrontmatter } from "../lib/frontmatter.ts";
import type { Check, Finding } from "./types.ts";

const TYPES = ["feature", "experiment", "chore", "platform"];
const STATUSES = ["planned", "building", "shipped", "shelved", "superseded"];
// A chore or a platform change ships with nothing a user reads; a feature that never shipped keeps its target release.
const NEEDS_STORE_COPY = ["feature", "experiment"];
const NEVER_SHIPPED = ["shelved", "superseded"];
const STORE_COPY = /^## Store copy[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m;

export const features: Check = {
  id: "features",
  module: "docs",
  description: "each features/ page has id, type and status from their sets; a released feature has its Store copy blockquote (the What's New text)",
  run({ repo }) {
    const pages = listFiles(repo, ".context/features", (name) => /^\d{4}-.+\.md$/.test(name));
    return pages.flatMap((file): Finding[] => {
      const findings: Finding[] = [];
      const add = (message: string) => findings.push({ check: "features", level: "error", file, message });
      const { data, body } = parseFrontmatter(readFileSync(join(repo, file), "utf8"));
      if (!data) return [{ check: "features", level: "error", file, message: `no frontmatter (${basename(file)})` }];
      for (const field of ["id", "type", "status"]) if (!data[field]) add(`missing ${field}`);
      if (data.type && !TYPES.includes(String(data.type))) add(`type ${data.type} is not one of ${TYPES.join(", ")}`);
      if (data.status && !STATUSES.includes(String(data.status))) add(`status ${data.status} is not one of ${STATUSES.join(", ")}`);
      const released = /\d+\.\d+\.\d+/.test(String(data.release ?? "")) && !NEVER_SHIPPED.includes(String(data.status));
      const copy = STORE_COPY.exec(body.replace(/<!--[\s\S]*?-->/g, ""));
      if (released && NEEDS_STORE_COPY.includes(String(data.type)) && !(copy && /^>[ \t]*\S/m.test(copy[1]))) {
        add(`ships in ${data.release} with no "> …" line under ## Store copy`);
      }
      return findings;
    });
  },
};
