# standards/

canon's standards. `canon check --standards` lists the ones that apply to a repo.

## Defaults — apply to every repo

| File | What it holds |
|---|---|
| `constitution.md` | The rules a request is checked against, grouped as facts, value, control and words (C-01 to C-19 are canon's) |
| `wiki-schema.md` | Wiki page types, frontmatter, required sections, lint rules |
| `context-layout.md` | The `.context/` folder layout, where each kind of document lives, the repo root, records and `tasks.md` formats |
| `dev-methods.md` | The evidence spec-, test- and data-driven work leaves behind |
| `agent-contract.md` | What every agent does before, during and after work |

## Library — a repo opts in by name

A repo lists the ones it wants in `.context/context.yaml`:
`standards: [design-sets, pipeline, expo]`.

| Name | What it holds |
|---|---|
| `design-sets` | HTML design sets as Babul products: pages, components, tokens, the shell, the journey, checks |
| `pipeline` | How a new app's first version is built, in order, with hard gates; principles C-16 and C-17 |
| `expo` | Scaffolding an Expo app, its layout, the versioned-docs rule, release checks |
| `frontend` | `.tsx` code rules: one component per file, thin routes, helpers in `lib/` and `hooks/`, UniWind |
| `performance` | No redraw after a local edit, counted round trips, no blank navigation, a number before and after |
| `secrets` | Every secret backed up the moment it exists; key names only in `INVENTORY.md` |
| `store-listing` | `.context/listing/` as fastlane's tree, screenshots, release notes from `features/` |

A library standard may add principles in the constitution's `### C-NN Title`
format; they apply only to repos that opt in.
