#!/usr/bin/env bash
# Runs the weigh evals against this checkout's canon-process plugin and CLI.
#   evals/run.sh          quick: 1 run per case, no baseline arm, 8 at once (before a release)
#   evals/run.sh full     3 runs per case with the no-plugin baseline (weekly)
# The eval tool reads cases only from inside the plugin, so both are copied to a temp folder.
# Gated tools need this operator grant; the sandbox is the boundary. The weigher reads with shell commands (cat, find), so Bash is not narrowed to canon.
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp -R "$repo/plugins/canon-process" "$work/plugin"
# The wiki cases need canon-knowledge's ingest skill, so it rides along with the weigh plugin.
mkdir -p "$work/plugin/skills" && cp -R "$repo/plugins/canon-knowledge/skills/ingest" "$work/plugin/skills/"
cp -R "$repo/evals" "$work/plugin/evals"
rm -rf "$work/plugin/evals/results"
# The skills call `canon`: this checkout's, not the installed release. The sandbox cannot
# read your home folder, so a copy of node and this checkout go in; _scaffold/fixture.sh installs them there. APFS clones cost no disk.
mkdir -p "$work/canon"
cp -cR "$repo/." "$work/canon/" 2>/dev/null || cp -R "$repo/." "$work/canon/"
cp -c "$(node -p process.execPath)" "$work/canon/node" 2>/dev/null || cp "$(node -p process.execPath)" "$work/canon/node"
if [ "${1:-quick}" = full ]; then
  mode=(--max-cost-usd 8)
else
  mode=(--ablation none --runs 1 --concurrency 8 --max-cost-usd 3)
fi
cd "$work"
# An installed plugin's bin/ (this machine's own canon) is outside what the sandbox may read: keep it off PATH.
clean_path="$(printf %s "$PATH" | tr ':' '\n' | grep -v '/.claude/plugins/' | paste -sd: -)"
PATH="$clean_path" claude plugin eval ./plugin --eval-dir evals --trust-plugin --judge-model sonnet --scaffold ${KEEP:+--keep-temp} --allow-tools Write Edit Bash "${mode[@]}" ${CASE:+--case "$CASE"} --json "$repo/evals/results/latest.json"
