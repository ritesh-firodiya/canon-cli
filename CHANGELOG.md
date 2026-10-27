# Changelog

## 0.16.0 — 2026-10-27

### Changed

- Kinds say what a repo ships: `mobile` (was `expo-app`), `web`,
  `mobile-and-web`, `package` and `content`. `mobile-and-web` gets the packs and
  the Expo SDK pin of both. A public `package.json` with `bin`, `exports` or
  `main` is inferred as `package`. Rename `kind: expo-app` to `kind: mobile`.
- Packs list the new kinds.

### Added

- `kinds:` on a command in `commands:` — it runs only in repos of those kinds.

### Changed (layout)

- One file per check, named by its id; command wiring in `cli/src/commands/`,
  helpers in `cli/src/lib/`. `scripts/publish.sh` is gone: releases only go
  through the release workflow.

## 0.15.0 — 2026-10-27

The CLI and plugin move to their own public repo, `ritesh-firodiya/canon-cli`,
and ship on npm as `@freetesh/canon` (was `@freetesh/zeno`). The knowledge site
stays private and depends on this package.

### Added

- `canon pipeline [repo] [--json]`: the repo's stages in order — the estate's
  `pipeline:` unless the product declares its own — with the first `done` path
  that exists for each and whether its gate is approved. `--json` is for
  scripts that measure flow against a product's own stages.
- `@freetesh/canon/api`: `findEstate`, `findProducts`, `qmdQuery` and
  `qmdRefresh`, for tools built on canon.
- Constitution C-12: a change to visibility, licence, package name or repo
  layout is weighed first, with what each option loses.

### Removed

- `canon site sync` and `canon site serve` — they belong to the knowledge site.

## 0.14.0 — 2026-10-27

### Changed

- zeno is now canon: the CLI, the plugin, `.claude/canon.yaml`, `.canon/`,
  `CANON_ESTATE` and the `canon:` version pin. One wiki shape (concepts,
  entities, decisions overwritten in place, surfaces only where real,
  synthesis), and one check, one search server and one hook.

## 0.13.0 — 2026-10-27

### Changed

- A repo names only what it uses. `copies` is opt-in: the estate defines named
  `sets`, a product lists the ones it uses under `copies.use`; there is no
  skip list. The `.context/README.md` no longer lists absent folders, and
  `zeno init` writes no such section.

### Removed

- `checks: { <id>: { enabled: false, reason } }`. Whether a check applies is
  decided by the modules a repo turns on; nothing turns one off.

## 0.12.0 — 2026-10-27

### Added

- `copies:` in `zeno.yaml` and the `shared-files` check: files every product
  copies from one source repo stay identical (or identical but for the
  product's `name:`, or up to a marker line). A product lists what it does
  without under `copies.skip` with a reason. `zeno copies --sync` repairs a
  drifted copy.
- `refs` check: every `.context/` path a tracked file names exists; a
  `[[link]]` to no page is a note.
- `tasks` check (blocked items have an id, blocked-by, unblock, next-check),
  `features` check (id, type, status; a released feature has its Store copy)
  and `listing` check (fastlane's tree).
- `context-layout` also flags empty folders, root `TODO.md`/`STATUS.md`/
  `SETUP.md` and `docs/`, a live product without its go-to-market folders, and
  an `AGENTS.md` that does not point at `tasks.md`. A wiki `last-verified` in
  the future is an error.
- `zeno hooks install [--all]`: a pre-push hook that runs `zeno check`.

### Changed

- `architecture` ignores violations in gitignored files (a stale `dist/`).

## 0.11.0 — 2026-10-27

### Added

- `pipeline:` in `zeno.yaml`: ordered stages, each with `done` paths and an
  optional `gate`. The most specific layer replaces the whole list.
- `pipeline` check: fails when a stage starts before an earlier gate is
  approved, once per gate.
- `zeno approve <stage>`: a person records a gate approval, dated now, in
  `.context/raw/zeno/gates.jsonl`.
- `context-size` check (warnings): page 60 lines, decision 30, `README.md` 30,
  `tasks.md` 100; dated decision file names; `wiki/flows/`;
  `## Done` or `## Session Notes` in `tasks.md`.
- `wiki-frontmatter` warns on placeholder text (`TBD`, `none yet`).

### Changed

- The wiki keeps only what an agent would get wrong without: `last-verified` is
  the only required field, no section is required, and the schema is 70 lines
  instead of 299.
- No page per screen: a `surfaces/` page exists only for a screen with notes its
  HTML can't show. No `flow` type; a journey worth keeping is a concept.
- Decisions are one file per topic (`decisions/pricing.md`), overwritten when
  the choice changes, with a `Rejected:` line. No supersede chains.
- `tasks.md` holds open work only; a done task is deleted. `zeno init` writes
  the shorter template.
- `canonical-values` also checks prices in decisions.

## 0.10.0 — 2026-10-25

### Added

- Every verdict is logged, not just overrides. `log-verdict.mjs` takes
  `--verdict do-it` and `--outcome proceeded | stopped | overridden | dropped`;
  `--reason` is required only for an override.
- `zeno learn` opens with how often the gate let work through, stopped it, or
  was overridden.

### Changed

- `zeno learn` proposals count only overrides. A line with no `outcome` (all
  lines before 0.10.0) is read as an override, so old logs mean what they did.

## 0.9.1 — 2026-10-25

### Added

- `manual: <where>` access for a `SOURCE.*` page whose data lives in a
  dashboard with no API (RevenueCat, store consoles). The gate asks the user
  for the numbers instead of guessing.

### Fixed

- Terms the gate shows are always a numbered list, wherever they appear.

## 0.9.0 — 2026-10-25

### Added

- C-14 *Facts, not assumptions* and C-15 *Plain words* in the constitution. The
  weigh gate lists each claim in a request and marks it backed, partly backed
  or not backed. DO IT needs nothing assumed. Going on despite an assumption
  takes written, numbered terms the user agrees to; `log-verdict.mjs --term`
  logs each one.
- The gate reads a repo's `SOURCE.*` pages to check claims, under query rules in
  `wiki-schema.md`: read only, small queries, counts not people.
- `sources` check: a `SOURCE.*` page names how to read it in its `ACCESS` row
  (`mcp:`, `skill:` or `cli:`, and a `cli:` must be in `doctor.tools`) and has
  a `## How to query` section.
- Evals `source-backed` and `go-ahead-is-not-agreement` (nine cases in all).

## 0.8.0 — 2026-10-23

### Added

- `wiki.types` and `context.folders` in `zeno.yaml`: a team adds page types and
  `.context` folders, each with a `reason:`. An added type lists its required
  `sections:`, and `zeno check` fails a page that misses one. Built-in ones
  cannot be redefined.
- `metrics-definitions` check: warns when the `metrics` module is on and
  `.context/metrics/definitions.yml` is missing.
- `dev-methods.md` standard (spec-, test- and data-driven evidence), a table of
  where each kind of document lives, and `SOURCE.*` entity pages for data tools.
- Evals `added-wiki-type` and `evidence-first` (seven cases in all).

### Changed

- **Breaking:** the unused `specs` module is removed. A `zeno.yaml` that lists
  it fails to load.
- **Breaking:** `metrics` is no longer a default module; turn it on when you
  define metrics. Where it is on, a missing `definitions.yml` is a warning.
- The weigh gate costs fewer tokens: it no longer fires on every multi-file
  change, searches the current product's collections first, and calls the
  `challenger` only for too-large requests (or when asked), handing it what was
  already read.
- `/decision` copies the shape of a recent decision page instead of reading the
  whole wiki schema.

### Fixed

- `zeno check` and the `ingest`, `decision` and `wiki-lint` skills follow a
  team's own wiki schema and context layout instead of zeno's built-in lists.

## 0.7.0

zeno rebuilt as a Claude Code plugin plus a CLI. Everything below is new since
the original `zeno-ai` workflow CLI.

### Added

- **Plugin**: constitution and standards loaded at session start, the `weigh`
  decision gate with a `challenger` agent, and `ask`, `decision`, `ingest`,
  `standards`, `wiki-lint` skills. Knowledge search through QMD.
- **CLI** (`npm install -g @freetesh/zeno`, Node 22+): `init`, `add`, `check`,
  `standards`, `sync`, `status`, `doctor`, `learn`, `weigh`, `ui`.
- **Packs**: vendor docs (`llms.txt`) for expo, firebase, nextjs, react,
  revenuecat and uniwind, indexed for search.
- **Architecture module**: each repo keeps its import rules in
  `.dependency-cruiser.cjs` (one per workspace in a monorepo); `zeno check`
  enforces them, `weigh` cites them, `zeno ui` draws each repo's import graph.
  `init` writes starters and a shared base; `sync` keeps the base current.
- `init` asks for kind, modules and packs, and takes `--kind`, `--modules`,
  `--packs` for a no-questions setup.
- Plugin evals on a fixture product.

### Changed

- Every module is optional. Designs and docs are no longer required; an estate
  that wants designs first adds that as its own command.
- `zeno learn` decisions are stored with the estate, not inside the zeno install.

### Fixed

- `sync` indexes the wiki even when qmd was installed after `init`.
- A missing tool reports "not installed — run `zeno doctor`" instead of `ENOENT`.
- Architecture checks see npm imports (rules such as `no-non-package-json`
  were silently off), and warn when a TypeScript workspace had no `.ts` file
  read instead of passing.
