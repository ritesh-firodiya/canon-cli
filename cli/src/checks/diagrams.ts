import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Check, Finding } from "./types.ts";

const FOLDER = ".context/architecture";
const OLD_FOLDER = ".context/wiki/concepts/architecture";
const DRAWN_TYPE = "architecture";

interface Part {
  id: string;
  label?: string;
  pos?: number[];
  size?: number[];
}
interface Connection {
  id: string;
  from: string;
  to: string;
}
interface Diagram {
  diagram_type?: string;
  meta?: { title?: string };
  components?: Part[];
  connections?: Connection[];
}

const jsonFiles = (repo: string, folder: string): string[] =>
  existsSync(join(repo, folder))
    ? readdirSync(join(repo, folder)).filter((file) => file.endsWith(".json")).sort().map((file) => `${folder}/${file}`)
    : [];

const isPair = (value: unknown): boolean => Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number");

function problems(diagram: Diagram): string[] {
  const parts = diagram.components ?? [];
  const ids = new Set(parts.map((part) => part.id));
  return [
    ...(diagram.meta?.title ? [] : ["no meta.title"]),
    ...parts.filter((part) => !part.label || !isPair(part.pos) || !isPair(part.size)).map((part) => `part "${part.id}" needs a label, pos and size`),
    ...(diagram.connections ?? []).flatMap((connection) =>
      [connection.from, connection.to].filter((end) => !ids.has(end)).map((end) => `connection "${connection.id}" points at "${end}", which is not a part`),
    ),
  ];
}

/** The repo's diagrams for the shell's Architecture view: a broken file is left out, and `canon check` names it. */
export function diagramsJson(repo: string): string {
  const diagrams = jsonFiles(repo, FOLDER).flatMap((file) => {
    try {
      return [{ name: basename(file, ".json"), ...JSON.parse(readFileSync(join(repo, file), "utf8")) }];
    } catch {
      return [];
    }
  });
  return JSON.stringify(diagrams);
}

export const diagrams: Check = {
  id: "diagrams",
  module: null,
  description: `every diagram in ${FOLDER}/ parses, and its connections join parts that exist`,
  run({ repo }) {
    const finding = (level: Finding["level"], file: string, message: string): Finding => ({ check: "diagrams", level, file, message });
    const moved = jsonFiles(repo, OLD_FOLDER).map((file) => finding("warn", file, `diagrams live in ${FOLDER}/ now — move it, and delete its .html`));

    return [
      ...moved,
      ...jsonFiles(repo, FOLDER).flatMap((file) => {
        let diagram: Diagram;
        try {
          diagram = JSON.parse(readFileSync(join(repo, file), "utf8"));
        } catch (error) {
          return [finding("error", file, `not valid JSON: ${(error as Error).message}`)];
        }
        if (diagram.diagram_type !== DRAWN_TYPE) return [finding("warn", file, `the shell draws only "${DRAWN_TYPE}" diagrams, not "${diagram.diagram_type}"`)];
        return problems(diagram).map((message) => finding("error", file, message));
      }),
    ];
  },
};
