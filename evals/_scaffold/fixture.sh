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
command -v qmd >/dev/null || exit 0
qmd init >/dev/null
qmd collection add "$PWD/.context/wiki" --name wiki >/dev/null
qmd collection add "$PWD/.context/features" --name features >/dev/null
qmd embed >/dev/null 2>&1 || echo "scaffold: qmd embed failed; keyword search still works" >&2
