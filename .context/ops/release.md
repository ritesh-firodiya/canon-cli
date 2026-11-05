# Release

Release by bumping the version in `package.json` and `.claude-plugin/plugin.json`, then pushing `main`. `release.yml` publishes to npm, then creates the tag and the GitHub release itself.

- Never push a tag by hand: the tag run races the main run and fails with npm E409, even when the main run published.
- npm can take a few minutes to list a new version after "being processed".
- `git add` a new file before running the tests, or `no-product-names` will not see it; it reads tracked files only.
- This repo is public. A `canon verdict --request` or `--reason` run here is written into an Idea, so it never names another product; say "a sibling product".
- After a scripted find-and-replace (IDs, links, names), read each changed file once: a later replace can miss text an earlier one already changed.
