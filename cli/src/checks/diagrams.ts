import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Check, Finding } from "./types.ts";

const FOLDER = ".context/architecture";
const FILE = `${FOLDER}/architecture.json`;
const OLD_FOLDER = ".context/wiki/concepts/architecture";
const BASES = ["measured", "stated", "code", "assumed", "unknown"];
const STALE_DAYS = 90;
const DAY_MS = 86_400_000;

interface Basis {
  basis?: string;
  source?: string;
}
interface Part {
  id: string;
  area?: string;
  cost?: Basis & { today?: string };
  ifDown?: Basis;
}
interface Architecture {
  verified?: string;
  summary?: string;
  areas?: { id: string }[];
  parts?: Part[];
  flows?: { name: string; path?: string[] }[];
}

function basisProblems(what: string, value: Basis | undefined): string[] {
  if (!value?.basis || !BASES.includes(value.basis)) return [`${what} has no valid basis`];
  if (value.basis !== "unknown" && !value.source) return [`${what} is "${value.basis}" but names no source`];
  return [];
}

function problems(architecture: Architecture): string[] {
  const areas = new Set((architecture.areas ?? []).map((area) => area.id));
  const parts = architecture.parts ?? [];
  const ids = new Set(parts.map((part) => part.id));
  return [
    ...(architecture.summary ? [] : ["no summary"]),
    ...parts.flatMap((part) => [
      ...(part.area && areas.has(part.area) ? [] : [`part "${part.id}" is in area "${part.area}", which does not exist`]),
      ...basisProblems(`part "${part.id}" cost`, part.cost),
      // A guess must not read as a fact: "unknown" with a figure in it is the failure this page exists to stop.
      ...(part.cost?.basis === "unknown" && /\d/.test(part.cost.today ?? "") ? [`part "${part.id}" cost is "unknown" but states a number: ${part.cost.today}`] : []),
      ...(part.ifDown ? basisProblems(`part "${part.id}" ifDown`, part.ifDown) : []),
    ]),
    ...(architecture.flows ?? []).flatMap((flow) =>
      (flow.path ?? []).filter((id) => !ids.has(id)).map((id) => `flow "${flow.name}" goes through "${id}", which is not a part`),
    ),
  ];
}

/** The repo's architecture for the shell's view, or null when there is none. The view says so if the file does not parse. */
export function architectureJson(repo: string): string {
  try {
    return readFileSync(join(repo, FILE), "utf8");
  } catch {
    return "null";
  }
}

const jsonIn = (repo: string, folder: string): string[] =>
  existsSync(join(repo, folder)) ? readdirSync(join(repo, folder)).filter((file) => file.endsWith(".json")).map((file) => `${folder}/${file}`) : [];

export const diagrams: Check = {
  id: "architecture-page",
  module: null,
  description: `${FILE} parses, every cost says where it came from, and its flows go through parts that exist`,
  run({ repo, today }) {
    const finding = (level: Finding["level"], file: string, message: string): Finding => ({ check: "architecture-page", level, file, message });
    const old = [...jsonIn(repo, OLD_FOLDER), ...jsonIn(repo, FOLDER).filter((file) => file !== FILE)].map((file) =>
      finding("warn", file, `old diagram: the architecture is one file now, ${FILE}`),
    );
    if (!existsSync(join(repo, FILE))) return old;

    let architecture: Architecture;
    try {
      architecture = JSON.parse(readFileSync(join(repo, FILE), "utf8"));
    } catch (error) {
      return [...old, finding("error", FILE, `not valid JSON: ${(error as Error).message}`)];
    }
    const age = architecture.verified ? (today.getTime() - new Date(architecture.verified).getTime()) / DAY_MS : Infinity;
    return [
      ...old,
      ...problems(architecture).map((message) => finding("error", FILE, message)),
      ...(age > STALE_DAYS ? [finding("warn", FILE, `not verified in ${STALE_DAYS} days — check the costs and update "verified"`)] : []),
    ];
  },
};
