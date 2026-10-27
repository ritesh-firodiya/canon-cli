<p align="center">
  <img src=".github/assets/icon.svg" width="96" height="96" alt="canon icon">
</p>

<h1 align="center">canon</h1>

<p align="center"><b>Facts, not assumptions.</b> Your rules and knowledge, kept in your repos. Enforced.</p>

canon keeps domain knowledge, decisions and AI rules in each repo's `.context/`,
enforces them, and makes them searchable. Claude searches them before it
answers, weighs each request against them before it acts, and checks every
claim in a request against facts. `canon check` fails when code or docs break a
rule. The AI guesses less, and you redo less work.

<p align="center">
  <img src=".github/assets/demo.svg" alt="canon weighs a request. Two of three claims have no facts and the request breaks a decided rule, so it pushes back and stops until the user brings facts, agrees to terms, or drops it.">
</p>

Two parts, free and MIT, that read the same config:

- **a Claude Code plugin** — skills, a decision gate, a session hook and a
  search server, so every session in every repo starts with the same rules;
- **the `canon` CLI** — set up, check, sync and search your repos.

A hosted knowledge site, with every repo's `.context/` in one place for a team,
is a separate paid product built on this CLI.

## What it does

- **Weigh before acting.** For a non-trivial request Claude checks the
  constitution, the wiki and decisions, features and tasks, cost against value,
  and the write-less ladder, then answers **DO IT**, **DO IT DIFFERENTLY** or
  **PUSH BACK** with citations. Every verdict is logged; `canon learn` turns
  repeated overrides into proposals.
- **No assumptions.** Each claim in a request ("users want this", "it is slow")
  is checked against the repo and its data sources and marked backed or not.
- **Your data sources, your tools.** A repo describes each tool that holds its
  data on a `SOURCE.*` wiki entity that names the MCP server, skill or CLI that
  reads it. The gate queries it read-only to back or reject a claim.
- **Knowledge that is found.** Every repo's wiki and feature board is indexed
  with [QMD](https://github.com/tobi/qmd); Claude searches before answering.
- **Context stays small.** A line belongs in `.context/` only if an agent would
  get something wrong without it. Decisions are one file per topic, overwritten
  when the choice changes; `tasks.md` holds open work only; history is git's.
- **Hard rules are checks.** `canon check` validates layout, wiki frontmatter,
  stale pages, placeholders, size caps, blocked tasks, feature pages, the store
  listing tree, dead `.context/` paths, prices with no canonical home, shared
  files, the import architecture, pipeline gates, and every checker your config
  declares. `canon hooks install` makes every push run it.
- **Standards with one home.** canon ships defaults; an estate adds or replaces
  them from its own folder; a repo can override again. `canon standards` shows
  what applies.
- **A repo names only what it uses.** Modules, packs and shared-file sets are
  opt-in; there is no skip list and no setting that turns a check off.

## Install

```bash
claude plugin marketplace add ritesh-firodiya/canon-cli
claude plugin install canon@canon
npm install -g @freetesh/canon
npm install -g @tobilu/qmd --allow-scripts=node-llama-cpp,tree-sitter-go,tree-sitter-python,tree-sitter-rust,tree-sitter-typescript,tree-sitter-javascript
```

Then in any repo: `canon doctor`, `canon init`, `canon check`, `canon sync`.
Try `/canon:weigh add a dark mode toggle` in a session; record choices with
`/canon:decision` and ask about them with `/canon:ask`. `/canon:ingest` with no
argument captures what a session taught.

## CLI

```bash
canon init             # write .claude/canon.yaml and the missing .context files
canon add              # list packs; `canon add expo` adds one and indexes its docs
canon check            # this repo against the standards (exit 1 on any error); --all for the estate
canon copies --sync    # repair drifted shared files from copies.source (never adds one)
canon hooks install    # a pre-push hook that runs `canon check` (--all: every product)
canon standards        # which standards apply here, and where each comes from
canon sync             # refresh pack docs and the search index, move the pinned version
canon status           # version, kind, modules, config layers, check summary
canon doctor           # node, git, qmd — plus any tools your config lists
canon learn            # proposals from overridden verdicts
canon approve <stage>  # a person records a pipeline gate approval
canon pipeline         # the stages this repo resolves to, and where each stands
canon weigh "<ask>"    # the decision gate from the terminal
canon ui               # every wiki and design gallery on localhost
canon search "<q>"     # search the knowledge index
canon mcp              # the search MCP server, for any MCP client
```

## Config

`.claude/canon.yaml`, read in layers — **estate → repo → local**
(`canon.local.yaml`, not committed). The estate is the nearest folder above a
repo whose `canon.yaml` says `estate: true`, or `CANON_ESTATE`.

```yaml
# <estate>/.claude/canon.yaml — shared by every repo below it
estate: true
standards: [.canon/standards]       # estate rules; same name replaces a canon default
commands:                           # your own checkers, run by `canon check`
  - { id: designs, run: ./scripts/check-designs.sh, if: .context/designs, module: design }
copies:                             # files products copy from one source repo, in named sets
  source: design-system
  sets:
    upload: [scripts/upload.mjs]
    shell-web:
      - { from: designs/mobile/index.html, to: designs/web/index.html, named: true }
```

```yaml
# <repo>/.claude/canon.yaml — written by `canon init`
canon: 0.14.0
kind: expo-app                      # expo-app | web | content
modules: [docs, knowledge, code, listing, refs]
packs: [expo]
name: Acme                          # how the product is written; `named` copies swap it in
copies:
  use: [upload, shell-web]          # the sets this repo uses; only these are held to the source
```

Scalars: the most specific layer wins. `packs`, `standards` and `copies.use`
add up across layers; `commands`, `doctor.tools`, `wiki.types` and
`context.folders` merge by name.

## Layout

```
.claude-plugin/   plugin manifest and marketplace
skills/           weigh, standards, ask, ingest, decision, wiki-lint
agents/           challenger — a second opinion for too-large requests
hooks/            session start: constitution titles, qmd refresh
standards/        default standards
packs/            vendor doc packs
templates/        files init writes (dependency-cruiser base and starters)
scripts/          log-verdict.mjs — the verdict log
evals/            plugin evals and the fixture product
cli/              the canon CLI (TypeScript, vitest); `@freetesh/canon/api` for tools built on it
```

Inside `cli/src/`:

```
index.ts          the program: registers every command
api.ts            what other tools import (`@freetesh/canon/api`)
commands/         one file per command — options and output only
checks/           one file per check, named by its id; index.ts lists them
config/           .claude/canon.yaml: schema, layered loading, estate discovery
lib/              shared helpers: files, frontmatter, env, qmd, system calls
<name>.ts         the logic the commands call: check (+ format for its output), init, packs (add), sync, …
```

Tests mirror it in `cli/test/`.

## Develop

`pnpm check` runs `canon check` on this repo, the typecheck and every test.
The version lives in `package.json` and `.claude-plugin/plugin.json`; bump both
with a CHANGELOG entry. A push to main with a new version publishes to npm.

MIT licence.
