#!/usr/bin/env bash
# Seeds an eval workspace with a fixture product and a local QMD index over its
# wiki and features, so cases run on known data. The harness runs this in the
# workspace with a sandboxed $HOME; the real model cache is reused when present
# so the sandbox does not download ~2 GB.
#   fixture.sh <fixture-name>
set -euo pipefail
fixture="$(cd "$(dirname "$0")/../fixtures/$1" && pwd)"
cp -R "$fixture/." .

real_home="$(eval echo "~$(id -un)")"
if [ -d "$real_home/.cache/qmd/models" ]; then
  mkdir -p "$HOME/.cache/qmd"
  [ -e "$HOME/.cache/qmd/models" ] || ln -s "$real_home/.cache/qmd/models" "$HOME/.cache/qmd/models"
fi
# The sandbox cannot read your home folder, where mise keeps node and canon, so
# `canon` (a mise shim) would fail. run.sh leaves a copy of node and this checkout
# next to the plugin; clone them into the sandbox's $HOME as its own mise node.
source="$(cd "$(dirname "$0")/../../.." && pwd)/canon"
if [ -x "$source/node" ]; then
  copy="$HOME/.canon"
  cp -cR "$source" "$copy" 2>/dev/null || cp -R "$source" "$copy"
  version="$("$copy/node" -p process.versions.node)"
  bin="$HOME/.local/share/mise/installs/node/$version/bin"
  mkdir -p "$bin" "$HOME/.config/mise"
  ln -sf "$copy/node" "$bin/node"
  printf '#!/bin/sh\nexec "%s" "%s/cli/src/index.ts" "$@"\n' "$copy/node" "$copy" > "$bin/canon"
  chmod +x "$bin/canon"
  printf '[tools]\nnode = "%s"\n' "$version" > "$HOME/.config/mise/config.toml"
  # The agent's shell inherits your PATH, whose canon copies the sandbox cannot read: put this one first.
  for rc in .zshenv .zshrc .bashrc .profile; do printf 'export PATH="%s:$PATH"\n' "$bin" >> "$HOME/$rc"; done
fi
command -v qmd >/dev/null || exit 0
qmd init >/dev/null
qmd collection add "$PWD/.context/wiki" --name wiki >/dev/null
qmd collection add "$PWD/.context/features" --name features >/dev/null
qmd embed >/dev/null 2>&1 || echo "scaffold: qmd embed failed; keyword search still works" >&2
