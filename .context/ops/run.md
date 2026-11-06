# Run

How to run, test and release canon-cli. Needs Node, pnpm, git and qmd ([runtime](../wiki/decisions/runtime.md)).

## Run

- `pnpm install`, then `pnpm canon <command>` runs the CLI from source.
- `pnpm canon check` checks this repo the way it checks every product.

## Test

- `pnpm check` runs everything a release needs: `canon check`, `pnpm typecheck` and `pnpm test`.
- `pnpm test:band` tests the band plugin inside Claude Code.
- The model evals in `evals/` run weekly, not per release ([reviews-and-evals](../wiki/decisions/reviews-and-evals.md)).
- `git add` a new file before running the tests, or `no-product-names` will not see it; it reads tracked files only.

## Release

Bump the version in `package.json` and `.claude-plugin/plugin.json`, then push `main`. `release.yml` publishes to npm, then creates the tag and the GitHub release itself.

- Never push a tag by hand: the tag run races the main run and fails with npm E409, even when the main run published.
- npm can take a few minutes to list a new version after "being processed".

## Watch out

- This repo is public. A `canon verdict --request` or `--reason` run here is written into an Idea, so it never names another product; say "a sibling product".
- After a scripted find-and-replace (IDs, links, names), read each changed file once: a later replace can miss text an earlier one already changed.
