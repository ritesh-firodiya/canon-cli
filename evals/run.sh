#!/usr/bin/env bash
# Runs the weigh evals against this checkout's canon-process plugin and CLI.
#   evals/run.sh          quick: 1 run per case, no baseline arm, 8 at once (before a release)
#   evals/run.sh full     3 runs per case with the no-plugin baseline (weekly)
# The eval tool reads cases only from inside the plugin, so both are copied to a temp folder.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp -R "$repo/plugins/canon-process" "$work/plugin"
cp -R "$repo/evals" "$work/plugin/evals"
rm -rf "$work/plugin/evals/results"
mkdir -p "$work/bin"
# The skills call `canon`: this checkout's, not the installed release.
printf '#!/bin/sh\nexec node "%s/cli/src/index.ts" "$@"\n' "$repo" > "$work/bin/canon"
chmod +x "$work/bin/canon"
if [ "${1:-quick}" = full ]; then
  mode=(--max-cost-usd 8)
else
  mode=(--ablation none --runs 1 --concurrency 8 --max-cost-usd 3)
fi
cd "$work"
PATH="$work/bin:$PATH" claude plugin eval ./plugin --eval-dir evals --trust-plugin --scaffold "${mode[@]}" ${CASE:+--case "$CASE"} --json "$repo/evals/results/latest.json"
