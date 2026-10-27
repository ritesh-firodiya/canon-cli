#!/usr/bin/env bash
# Seeds an eval workspace with a snapshot of the real product repos in CANON_WORKSPACE and a local QMD
# index over their wikis and feature boards, so a case is judged on real data.
# The harness runs this in the workspace with a sandboxed $HOME, so the real
# home comes from the account, not from $HOME.
#   product.sh <product>...
#   CANON_SCAFFOLD_LIGHT=1 product.sh ...   knowledge and package files only, no
#     source and no embeddings — for cases that span many products and would
#     otherwise outrun the scaffold time limit.
set -euo pipefail
real_home="$(eval echo "~$(id -un)")"
src_root="${CANON_WORKSPACE:-$real_home/git/products}"   # the folder holding the product repos
light="${CANON_SCAFFOLD_LIGHT:-}"
code_includes=(--include 'scripts/**' --include 'src/**' --include 'apps/*/src/**')
[ -n "$light" ] && code_includes=()

for product in "$@"; do
  src="$src_root/$product"
  [ -d "$src" ] || { echo "scaffold: no product at $src" >&2; exit 1; }
  mkdir -p "$product"
  rsync -a --prune-empty-dirs \
    --exclude node_modules --exclude .git --exclude 'ios/' --exclude 'android/' \
    --exclude '.context/listing/' --exclude '.context/marketing/' \
    --exclude '*.png' --exclude '*.jpg' --exclude '*.webp' --exclude '*.mp4' \
    --include '*/' \
    --include 'AGENTS.md' --include 'CLAUDE.md' --include 'package.json' --include 'app.config.ts' --include 'app.json' \
    --include 'firebase.json' --include 'eas.json' --include '.claude/canon.yaml' \
    --include '.context/**' --include 'apps/*/package.json' ${code_includes[@]+"${code_includes[@]}"} \
    --exclude '*' \
    "$src/" "$product/"
done

# A project-local index (./.qmd) is what qmd uses when started in this folder.
# Reuse the real model cache instead of downloading ~2 GB into the sandbox.
mkdir -p "$HOME/.cache/qmd"
[ -e "$HOME/.cache/qmd/models" ] || ln -s "$real_home/.cache/qmd/models" "$HOME/.cache/qmd/models"
qmd init >/dev/null
for product in "$@"; do
  for kind in wiki features; do
    dir="$PWD/$product/.context/$kind"
    [ -d "$dir" ] && qmd collection add "$dir" --name "$product-$kind" >/dev/null
  done
done
[ -n "$light" ] || qmd embed >/dev/null 2>&1 || echo "scaffold: qmd embed failed; keyword search still works" >&2
