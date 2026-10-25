#!/usr/bin/env node
// Appends one verdict, and what happened next, to .context/raw/zeno/verdicts.jsonl
// in the current repo. Append-only: raw/ is immutable, and `zeno learn` reads
// the history to show how often the gate stops work and to propose rule
// changes from overrides, so earlier lines must never be rewritten.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

const VERDICTS = ["do-it", "do-it-differently", "push-back"];
const OUTCOMES = ["proceeded", "stopped", "overridden", "dropped"];
const PRINCIPLE_ID = /^C-\d{2}$/;

const { values } = parseArgs({
  options: {
    verdict: { type: "string" },
    principles: { type: "string", default: "" },
    request: { type: "string" },
    reason: { type: "string", default: "" },
    outcome: { type: "string", default: "overridden" },
    // One per term the user agreed to, verbatim. Repeat the flag for each.
    term: { type: "string", multiple: true, default: [] },
    repo: { type: "string", default: process.cwd() },
  },
});

function fail(message) {
  console.error(`log-verdict: ${message}`);
  process.exit(1);
}

if (!VERDICTS.includes(values.verdict)) fail(`--verdict must be one of ${VERDICTS.join(", ")}`);
if (!values.request?.trim()) fail("--request is required");
if (!OUTCOMES.includes(values.outcome)) fail(`--outcome must be one of ${OUTCOMES.join(", ")}`);
if (values.outcome === "overridden" && !values.reason.trim()) fail("--reason is required: an override without a reason teaches nothing");

const principles = values.principles.split(",").map((id) => id.trim()).filter(Boolean);
const invalid = principles.filter((id) => !PRINCIPLE_ID.test(id));
if (invalid.length > 0) fail(`not principle IDs: ${invalid.join(", ")}`);

const terms = values.term.map((term) => term.trim()).filter(Boolean);

const entry = {
  at: new Date().toISOString(),
  verdict: values.verdict,
  principles,
  request: values.request.trim(),
  reason: values.reason.trim(),
  outcome: values.outcome,
  ...(terms.length > 0 && { terms }),
};

const dir = join(values.repo, ".context", "raw", "zeno");
mkdirSync(dir, { recursive: true });
appendFileSync(join(dir, "verdicts.jsonl"), `${JSON.stringify(entry)}\n`);
console.log(`logged to ${join(dir, "verdicts.jsonl")}`);
