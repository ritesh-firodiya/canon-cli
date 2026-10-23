#!/usr/bin/env bash
# Publish the CLI to npm with the token from the gitignored .env, so the token
# never appears in a command line, a shell history or ~/.npmrc.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "missing .env — copy .env.example and set NPM_TOKEN" >&2; exit 1; }
set -a; . ./.env; set +a
[ -n "${NPM_TOKEN:-}" ] || { echo "NPM_TOKEN is empty in .env" >&2; exit 1; }

npmrc="$(mktemp)"
trap 'rm -f "$npmrc"' EXIT
printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$npmrc"
npm publish --userconfig "$npmrc" "$@"
