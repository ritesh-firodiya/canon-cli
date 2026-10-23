# zeno

Standards, searchable product knowledge and a decision gate for teams that
build with Claude Code. zeno keeps several products consistent as they evolve,
keeps what you decided findable, and makes Claude weigh a request against your
rules and history before it acts on it.

It has two halves that read the same config:

- **a Claude Code plugin** — skills, a decision gate, a session hook and a
  search server, so every session in every repo starts with the same rules;
- **the `zeno` CLI** — set up, check, sync and browse your repos.

## What it does

- **Weigh before acting.** For a non-trivial request Claude checks the
  constitution, your wiki and decision records, existing features and tasks,
  cost vs value, and the write-less ladder, then answers **DO IT**, **DO IT
  DIFFERENTLY** or **PUSH BACK** with citations. Push back stops work until you
  give a reason; overrides are logged and feed `zeno learn`.
- **Knowledge that is found, not remembered.** Every repo's `.context/wiki` and
  feature board is indexed with [QMD](https://github.com/tobi/qmd) (local hybrid
  search). Claude is told to search before answering.
- **Standards with one home.** zeno ships defaults (constitution, wiki schema,
  `.context` layout, agent contract). A team adds or replaces them from its own
  folder; a repo can override again. `zeno standards` shows what applies.
- **Hard rules are checks.** `zeno check` validates layout, wiki frontmatter,
  stale pages, prices with no canonical home, copied standards, and runs every
  checker your config declares.
- **Each repo's architecture is enforced.** With the `architecture` module, a
  repo keeps its own import rules in `.dependency-cruiser.cjs` files: one at the
  root, or one per workspace under `apps/` and `packages/` (each runs from its
  folder, since apps map `@/` to their own `src`). `zeno init` writes starters and
  `.dependency-cruiser.base.cjs`, the shared base they extend; that base is zeno's,
  and `zeno sync` keeps it current. Add `dependency-cruiser` as a devDependency.
  `zeno check` fails on a broken boundary or a cycle, the gate weighs requests
  against the rules, and `zeno ui` draws each repo's import graph.
- **Products evolve together.** Packs index vendor docs (`llms.txt`) for a stack;
  `zeno sync` refreshes them and moves each repo to the current zeno version.

## Install

```bash
# plugin (from GitHub)
claude plugin marketplace add ritesh-firodiya/zeno-ai
claude plugin install zeno@zeno

# CLI (Node 22+)
npm install -g @freetesh/zeno

# search
npm install -g @tobilu/qmd --allow-scripts=node-llama-cpp,tree-sitter-go,tree-sitter-python,tree-sitter-rust,tree-sitter-typescript,tree-sitter-javascript

# optional: write-less discipline for the efficiency step of the gate
claude plugin marketplace add DietrichGebert/ponytail && claude plugin install ponytail@ponytail
```

## Quickstart (5 minutes)

In any git repo, after the install above:

```bash
zeno doctor                 # node, git, qmd — fix anything marked ✗ first
zeno init                   # pick kind, modules and doc packs; writes .claude/zeno.yaml and .context/
zeno check                  # should print "<repo>  ok"
zeno sync                   # fetches the packs you picked and indexes the wiki for search
```

Then start Claude Code in the repo. The session hook loads the constitution,
and a non-trivial request is weighed before Claude acts on it — try
`/zeno:weigh add a dark mode toggle`. Write decisions to `.context/wiki/` as
you make them (`/zeno:decision`) and ask about them later with `/zeno:ask`.

Want import rules too? `zeno init --force --modules docs,knowledge,architecture`
(keep the modules you already had), `npm i -D dependency-cruiser`, then edit the
starter `.dependency-cruiser.cjs` to your layers. `evals/fixtures/streaks` is a
small product with a wiki and decision records, if you want to see the
`.context/` layout before touching your own repo.

For local development of zeno itself, link the repo as a skills-dir plugin so
edits apply on the next session: `ln -s "$PWD" ~/.claude/skills/zeno`.
Run the CLI from source (Node 23.6+ runs the TypeScript directly):
`pnpm install && ln -s "$PWD/cli/src/index.ts" ~/.local/bin/zeno`.
`pnpm test`, `pnpm typecheck` and `pnpm build` run from the repo root.

## CLI

```bash
zeno init             # write .claude/zeno.yaml and the missing .context files (asks kind, modules, packs)
zeno init -y --kind web --modules docs,code --packs nextjs   # same, no questions
zeno add              # list packs; `zeno add expo` adds one and indexes its docs (-g: whole estate)
zeno check            # this repo against the standards (exit 1 on any error)
zeno check --all -q   # every repo in the estate, only the ones with findings
zeno standards        # which standards apply here, and where each comes from
zeno sync             # refresh pack docs + search index, move the pinned zeno version, then check
zeno status           # version, kind, modules, config layers, check summary
zeno doctor           # node, git, qmd — plus any tools your config lists
zeno learn            # proposals from overridden verdicts; --approve/--reject <id>
zeno weigh "<ask>"    # the decision gate from the terminal (runs Claude, weighs only)
zeno ui               # every wiki (search, backlinks, graph) on :4610, design galleries on :4611
```

## Config

`.claude/zeno.yaml`, read in layers — **estate → repo → local**
(`zeno.local.yaml`, not committed). The estate is the nearest folder above a
repo whose `zeno.yaml` says `estate: true`, or `ZENO_ESTATE`.

```yaml
# <estate>/.claude/zeno.yaml — shared by every repo below it
estate: true
standards: [.zeno/standards]        # team rules; same name replaces a zeno default
commands:                           # your own checkers, run by `zeno check`
  - id: designs
    run: ./scripts/check-designs.sh
    if: .context/designs            # only where this path exists
doctor:
  tools:
    - { tool: pnpm, why: product scripts, hint: npm i -g pnpm }
```

```yaml
# <repo>/.claude/zeno.yaml — written by `zeno init`
zeno: 0.6.0
kind: expo-app                      # expo-app | web | content
modules: [docs, knowledge, metrics, code, listing]   # all optional; design is added when .context/designs exists
packs: [expo]
checks:
  stale-copies: { enabled: false, reason: "Cursor is still used here" }
weigh:
  weights: { C-05: 2 }
```

Scalars: the most specific layer wins. `packs` and `standards` add up across
layers; `commands` and `doctor.tools` merge by id. A check turned off must
carry a `reason:`, and `zeno check` lists every override.

## Standards

| zeno default | What it holds |
|---|---|
| `constitution.md` | Principles C-01–C-13 a request is weighed against. A team adds C-20+ in its own `constitution.md`. |
| `wiki-schema.md` | Wiki page types, frontmatter, required sections, lint rules |
| `context-layout.md` | The `.context/` ten-folder layout, `features/` and `tasks.md` |
| `agent-contract.md` | What every agent does before, during and after work |

## Packs

`packs/<name>/pack.yaml` names the vendor docs to index. Shipped: expo,
uniwind, react, nextjs, firebase, revenuecat. A pack is three lines of YAML; add
your own.

## Evals

`evals/` runs five requests against a fixture product (`evals/fixtures/streaks`)
with and without the plugin, each in a sandbox seeded with the fixture and a
local QMD index:

```bash
claude plugin eval . --scaffold --mocks off --allow-tools 'mcp__plugin_zeno_qmd__*' --runs 2
```

## Layout

```
.claude-plugin/   plugin manifest and marketplace
skills/           weigh, standards, ask, ingest, decision, wiki-lint
agents/           challenger — independent second opinion for large requests
hooks/            session start: constitution titles, qmd refresh
standards/        default standards
packs/            vendor doc packs
templates/        files init writes: dependency-cruiser base (synced) and starters
scripts/          log-verdict.mjs — append-only override log
cli/              the zeno CLI (TypeScript, vitest; built to cli/dist for npm)
evals/            plugin evals and the fixture product
```
