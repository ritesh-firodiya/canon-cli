# Changelog

## 0.20.1 — 2026-10-30

### Added

- **`space:` in canon.yaml** names the product a repo is part of. Repos naming
  the same space form one in Canon (a site and its CLI, a backend and its app);
  a repo without it is a space of its own.

## 0.20.0 — 2026-10-30

### Changed

- **The design shell is canon's.** It ships in `shell/`; a design set holds
  only `shell.js`, a loader pinned to a published canon, so its files still
  open from disk. `canon check` fails on a copied `_shell/` or a missing or
  hand-written `shell.js`, and warns when it pins another canon.
- **`canon ui` serves this repo's design set** on localhost with the running
  canon's shell. A set drawn for several sizes switches between them in the
  bar. The wiki site moved to `canon wiki`, without the old design galleries.
- `.claude-plugin` versions caught up with the package (they stopped at 0.18.2).

### Removed

- Links inside a component's definition are journey links no more (0.19.2):
  they drew a nav bar's links from every page, hidden by default.

## 0.19.2 — 2026-10-30

### Fixed

- The design check reads a definition's classes the way the browser builds
  them: each arm of `{test?a:b}` is its own class, and a class built from a
  `{prop}` is known by its prefix. It no longer reports a token missing for
  `bg-brand-{tone}`, or a styles.css class dead when a prop builds it.
- A page's links include the fixed hrefs of every component it draws (a nav
  bar), so the click-through check agrees with the shell.

## 0.19.1 — 2026-10-29

### Fixed

- The design check no longer reads an `email` size against the app: an email
  renders no route, so it gets no routes, app-flow or copy check.

## 0.19.0 — 2026-10-29

### Changed

- The `design-sets` standard is the Babul design set: pages built from
  components, one file per page with its states as blocks, a two-tier W3C
  palette, and a shell that reads pages, links, journeys and components from the
  HTML at runtime — it opens from disk, and no data file lists them. Still
  opt-in: a repo without the standard is never asked for designs.
- The design check reads a Babul set through the set's own `_shell/scan.mjs`,
  per size folder beside `babul.js`, and fails on any page, board or
  definition the crawl from the start page cannot reach.
- `wiki-schema`: a surface page no longer refers to `routes.js`.

## 0.18.2 — 2026-10-28

### Changed

- The `frontend` standard and the `weigh` skill defer to the `frontend-design`
  plugin when it is installed, the same way `weigh` defers to `ponytail`. The
  repo's own design-system rules still win on a conflict.
- `designs-first` only applies to a repo that imports the `design-sets`
  standard. A repo that designs outside the repo (Figma, a design team) no
  longer fails for having no `.context/designs/`.
- `context-layout` no longer asks `AGENTS.md` to point at `.context/tasks.md`
  when `.context/` is gitignored.
- `stale-copies` no longer warns about a Copilot, Cursor or Windsurf file that is
  a short pointer: at most 15 lines and mentions `AGENTS.md`.

## 0.18.1 — 2026-10-28

### Fixed

- `canon check` in a clone of one repo (CI) no longer fails every copy set when
  `copies.source` is not checked out beside it. It gives one warning instead;
  where the source exists, a wrong set name is still an error.

## 0.18.0 — 2026-10-27

### Removed

- The estate layer. Every repo carries its own rules in `.claude/canon.yaml`;
  canon never reads a `canon.yaml` above the repo, and `estate: true` is now an
  error. `canon add --global` is gone.

### Changed

- Copy sets live in the source repo's own `canon.yaml` (`copies.sets`); a
  product names the source (`copies.source: ../charades`) and the sets it uses.
- Commands that span products (`check --all`, `hooks --all`, `ui`, `learn`,
  `flow`) use the folder holding the repo you are in, or `CANON_WORKSPACE`
  (was `CANON_ESTATE`). The `canon learn` decisions log moves to
  `~/.claude/canon/decisions.jsonl`.
- A repo that draws its screens always gets the design checks, even when its
  `modules:` list leaves `design` out.

### Added

- `designs-first`, built in: a mobile or web repo keeps `.context/designs/`.
- `canon flow <product>` and `canon arch-set <spec>` (were `~/git/bin` scripts),
  and `formerly:` for a repo's older folder names.
- `canon doctor` checks python3, which the design checks need.
- Plugin eval cases over real product repos (`evals/_scaffold/product.sh`).

### Fixed

- `refs` no longer reads a copy set's `to:` path as a file of the source repo.

## 0.17.0 — 2026-10-27

### Added

- A standards library a repo imports by name: `standards: [design-sets,
  pipeline, expo, frontend, performance, secrets, store-listing]`. A library
  standard may add principles (`pipeline` adds C-16 and C-17). A folder of a
  repo's own rules is a path (`./rules`); a bare name is always a library name.
- The `designs` check (module `design`): canon runs its design-set checker
  (`scripts/check-designs.py`, needs python3) on every surface under
  `.context/designs/` that has a `routes.js`. Repos no longer carry a copy.

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
