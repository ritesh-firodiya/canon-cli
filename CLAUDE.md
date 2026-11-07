# canon-cli

- A change under `cli/src/` is not done until `pnpm bundle` has rebuilt `bin/canon` and the bundle is committed with it. The plugin runs `bin/canon`, and CI fails when it does not match the source. `pnpm check` runs the bundle check too.
