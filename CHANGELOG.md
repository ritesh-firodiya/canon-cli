# Changelog

## 3.1.1 — 2026-11-03

### Fixed

- The awake sun is one icon: green filled ☀ while this session keeps the Mac awake, white outlined ☼ when it does not.
- `caffeinate` exits with the Claude Code process that started it, so a crash or forced quit cannot leave the Mac awake.

## 3.1.0 — 2026-11-03

### Changed

- **A new band order.** Left: ☾ or ☀, session cost, project › stage, the task by its title. Right: WAITING ON YOU, reply size, model·effort in short form (`son·med`), checks (`✓ checks`, `! 3`, `✗ 2`), 7D, 5H, context left and the cache. Limits turn amber under 40% and red under 20%.
- The task shows in words, never by ID, and a click opens its page. The band no longer picks work or moves stages: `canon work` does both.
- A click on a short item says what it means in one line.

### Added

- **Keep the Mac awake.** A click on ☾ runs `caffeinate` while the session is open; ☀ shows it is on. macOS only.
- **Reply size S, M or L.** A click moves to the next size. It goes beside each typed prompt, so changing it keeps the cache.
- **Context left** (`ctx 62%`), from the session's own context figures.

## 3.0.1 — 2026-11-03

### Fixed

- An experiment started at an optional stage (`--from design`, `--from discovery`) runs that stage instead of asking whether it should, the same as `--with`.

## 3.0.0 — 2026-11-03

### Changed

- **A new default flow.** `intake → (problem | idea | discovery) → research → options → design → plan → feature → code → review → release → outcome`. `idea` as the weighed choices is now `options`, `result` is now `outcome`, and design comes before the plan. Rename these ids in your own `pipelines:`; there are no aliases.
- **Experiments begin at `started-at:`.** Their run and `canon check` start there, so they no longer write skip entries for earlier stages. `--to` must be a stage reachable from `--from`.
- A record's own stage (a problem's `problem`, an idea's `idea`) is done because its page exists. This replaces the special case for `problem`.
- `canon flow` counts a conversation at the pipeline's first stage, not at `idea`.

### Added

- **Forks with `after:`.** A stage lists the stages it may follow. With no `after:` it follows the stage above it, so a plain list is a straight line. In the default, problem, idea and discovery follow intake or each other, in any order, or not at all; each is optional with a `when:`. `canon pipeline` shows the forks. A stage named for a default inherits its wording but not its `after:`. A config whose `after:` names an unknown stage, the stage itself, or leaves a stage unreachable is refused.
- A problem opened by a trigger starts at the first stage (`intake`), so its signal is checked before anything uses it.
- Every stage is told to check that what it was given is true before using it, not only stages with `verify:`.

## 2.4.0 — 2026-11-03

### Added

- **`context.rootFolders` in `context.yaml`.** A repo can keep a tracked root `docs/` by naming it with a `{ folder, reason }`, the same shape as `context.folders`. It merges across layers by folder. The `docs/` error now points at it. Only `docs` is checked today.

## 2.3.0 — 2026-11-03

### Added

- **Any agent for `canon run`.** `agent:` in `context.yaml` is `claude` (the default) or a command with `args` (`{prompt}`, `{model}`), `modelArgs` and `smallModel`. A custom agent reports no dollars, so the spend cap is not enforced for it.
- **The band's Haiku comes from the live models list.** With `ANTHROPIC_API_KEY` set, the classifier uses the newest `claude-haiku-*`. Without it, it uses the `haiku` alias.

### Changed

- The band no longer starts with "canon". Good is green, warnings are yellow, danger is red: checks, tests, usage, cache, the chosen model and effort, and spend against the cap.

### Fixed

- Moving a stage by hand or by edit no longer fails `canon check`. Where you are working now is its own `at` field.
- A record starts at the stage named for its kind, so a selected plan shows its stage.
- Design sets read their pages every time, so deleted pages no longer show and new ones do.

## 2.2.0 — 2026-11-03

### Added

- **Choose your work from the band.** Click the record ID to list open work, select a record, or open its page. Click a stage to set it. `canon work <record>` does the same, with `--stage <id>` and `--clear`.
- **The stage follows your edits.** An edit in a later stage's folder moves the selected record there. An unapproved gate in the way holds it, waiting on you, and only `canon approve` passes a gate. Editing a record's page selects it if nothing is selected.
- `canon reject` works on any stage and reruns the later ones. Each stage's final message is saved on the record.

### Changed

- Research comes before ideas in the default pipeline.
- The optional-stage check judges the work instead of searching for its words.

### Fixed

- **The band no longer guesses the stage from folders.** A repo with `.context/marketing` showed Marketing whatever you were doing. With no selected, waiting or running record, the band now shows no stage.
- A gate you are still working in no longer shows WAITING ON YOU.
- The band uses the record's own pipeline, not always the default one.
- A code stage that changes no files and gives no reason now stops instead of passing.

### Removed

- `canon mcp`. Connectors can still use `via: mcp`.

## 2.1.2 — 2026-11-02

### Fixed

- **Design sets opened from `file:///` get the current shell.** A set's `shell.js` pointed at `@freetesh/canon@0`, which stopped at 0.30.0 when canon reached 1.0, so no shell fix since then reached them. It now names no version, and `canon check` fails on a pinned one. Change `@freetesh/canon@0` to `@freetesh/canon` in your set's `shell.js`.
- `canon update` changes only the `canon:` line of `context.yaml`, instead of reformatting the file.

## 2.1.1 — 2026-11-02

### Fixed

- **Design sets are quick to move through.** A click between pages no longer crawls the whole set again; only the Journey reads it fresh. A changed page shows after you open the Journey again.
- **A set's theme no longer comes from another product.** The light/dark choice is kept per product, and a set starts from the first theme in its `design.js`.
- Not fixed: a report that a link inside a page loads into a frame. It did not reproduce (`BUG-0005`).

## 2.1.0 — 2026-11-02

### Added

- **`canon enable --user` and `canon disable --user`:** turn a feature on or off across your machine, in every repo and any other folder, including a parent folder. It is kept in `~/.canon/features.json` and adds to what a repo names. New installs stay band-only.

## 2.0.1 — 2026-11-02

### Fixed

- `canon enable` and `canon disable` no longer reformat `context.yaml`. They now change only the `features:` lines. In 2.0.0 they could fold long lines and split one-line entries, though the values stayed the same.

## 2.0.0 — 2026-11-02

A new install turns on only the band. Everything else is off until you turn it on for a repo.

### Added

- **`canon enable` and `canon disable`:** turn `process`, `knowledge`, `routing` or `styles` on or off for a repo.

### Changed

- **BREAKING:** the `canon` plugin is now only the band. Skills, the search server, the session-start text and output styles moved to `canon-process`, `canon-knowledge` and `canon-styles`. To keep them, run `canon enable process` and `canon enable knowledge` in each repo, or install them for your user.
- **BREAKING:** skill names changed, such as `canon:weigh` to `canon-process:weigh`. The search tools are now `mcp__plugin_canon-knowledge_qmd__*`, and the output styles are `canon-styles:short` and `canon-styles:detail`.
- **BREAKING:** the band shows the product, stage, gates, runs, checks, tests and task cost only with `process` on.
- The `process` session-start text and the `weigh` and `standards` skills now need the CLI to read the standards.

## 1.0.1 — 2026-11-02

### Changed

- **Prompt routing is off by default.** Turn it on for a repo with `features: [routing]` in `.context/context.yaml`. Until then, no prompt is sent to Haiku, no model or effort changes, and no pick shows on the band.

## 1.0.0 — 2026-11-02

Canon picks the effort and model for each prompt, and the band follows your work.

### Added

- **Prompt routing:** the band sorts each typed prompt as small, medium or large with Haiku, through your own login. It sets effort per prompt, and the model at the start of a session; mid-session the model only moves up. Your choice on the band, or `/model`, always wins. Headless sessions and `canon run` agents are not routed.
- `canon usage` shows prompt routing counts and what deciding cost.

### Changed

- The band follows the product you edit or `cd` into, so a session in a parent folder or moving between products needs no link.

## 0.30.0 — 2026-11-02

See what your Claude sessions cost, and keep the state of the work above the prompt.

### Added

- **Band:** a Claude Code mod in the plugin shows the product, stage, what waits on you, live runs, checks, tests, task cost, usage left and the prompt cache. Clicking an item opens its detail. Nothing on it approves anything.
- **Extend:** a button on the band restarts the cache hour with one tiny message, and shows its estimated cost. It appears only when the cache is warm and no reply is running.
- **`canon usage`:** skills, tools, models and products at list prices, with `--skill`, `--unused`, `--json` and `--save`. It keeps counts only, never message text.
- **`canon band`:** the facts the band shows, as JSON.
- **Output styles:** `/output-style canon:short` and `canon:detail` set how long answers are.
- **`/canon:wildcard`:** 2 of every 10 ideas deliberately break the repo's patterns.

### Changed

- `canon run` marks itself live under `~/.canon/running/` while it works.

## 0.29.0 — 2026-11-02

The flow is a default each product changes, and what it decides stays enforced.

### Added

- **Fields:** `fields:` takes `text`, `date`, `date-range`, `number`, `link`, allowed values, or `remove`. `required:` names fields and `## ` sections. Only `id` is required by default.
- **`canon set`** and **`canon done`** change fields and mark work complete, checked against the repo's rules.
- **Named experiments:** `canon experiment start <name> --from <stage> [--to <stage>]`. Records made for one name it with `experiment:`.
- **Checks against real sources:** `verify:` on a stage reads connectors and live addresses first. Wrong stops the run, and a source that cannot be reached needs a person's `--unverified` reason. The result goes under `## Checked`.
- **Optional stages:** `canon run --with` and `--skip`. With no `when:`, an optional stage is skipped unless asked for.
- **Enforcement:** `canon status` lists what a repo has weakened and whether it has a hook and a CI job. `canon init` adds a CI job. `canon check` fails a stage passed with no record of being done or skipped, a `verify:` stage with no check, and duplicate ids.

### Changed

- **BREAKING:** the default flow is `problem, idea, research, plan, feature, design, code, review, release, result`. `research` and `code` are back; `development` and `poc` are gone.
- **BREAKING:** experiments are `experiments/<name>.md` with `name:`. `EXP-NNNN`, `kind: poc` and `experiment: true` are gone.
- **BREAKING:** `fields:` no longer means required. Use `required:`. `sections:` are suggestions.
- `canon init` creates `features/` again, and `features/` is required unless a repo removes it.

## 0.28.1 — 2026-11-02

### Fixed

- `canon run`: an agent can no longer close a record before the last stage, which skipped the gates still ahead of it.
- The last stage closes the work and everything made for it, so finished work leaves `canon queue`.
- The default stages give agents full `.context/` paths, so a discovery cannot land outside `wiki/synthesis/`.

## 0.28.0 — 2026-11-02

One way to do each thing. Run `canon sync` to index the new folders.

### Added

- **`canon new <kind> <title>`** starts a page from its template: problem, idea, experiment, plan, feature, bug, discovery, finding or decision. A repo's own kind gets a template from its config, or names its own with `template:`. Agents are told each kind's format.
- **Meanings:** `meanings:` and `closed:` under `records:` explain each value. `canon records` prints them, and agents are given them.
- **Priority:** `priorities:` is configurable, works on any record, and `canon queue` lists open work by it.
- **Approvals:** `approvers:` and `required:` on a stage, and `canon reject` to send one back with a reason.
- **Ownership:** `owner:` on a record, with a default in config. `canon queue --owner`.
- **Versions:** a run writes `rules:`, the commit of `context.yaml` the work started under.

- A stage naming a default id inherits what it does not set, so `- { id: plan, cap: 2 }` keeps canon's wording and gate.

### Changed

- **BREAKING:** one stage vocabulary. `canon flow` measures `idea, poc, plan, feature, design, development, review, release, store-review, deployed, live, result`; `research` and `code` are gone (`code` is `development`). Any other stage counts by its `done` paths.
- **BREAKING:** `canon problem add` is gone; use `canon new problem`.
- No record folder is required any more, and `canon init` no longer writes `features/index.md`.

### Removed

- The check for the old `.claude/canon.yaml`, and replacing hooks written by tools canon replaced.

## 0.27.0 — 2026-11-02

Canon now runs work, not only checks it. Everything here is a default a repo can change in config.

### Added

- **`canon run <record>`** moves a record through its pipeline with Claude Code. It stops at each gate, at a person's stage and at a spend cap, resumes where it stopped, and shows agents what failed before. Optional stages ask a small yes-or-no first.
- **`canon problem add`** and **`canon trigger`**. A trigger reads a connector or a schedule, joins repeats to the open problem, and keeps only each event's address and count, never its text.
- **Named pipelines:** `pipelines:` holds `default` (canon's flow until changed) and any others. A trigger or a record picks one.
- **Rule layers:** `extends:` builds on organization, product and team files; the closest wins. `locked:` keeps a value from being changed below, and the `locks` check enforces it. A top-level `cap:` sets the spend per stage.
- **Record kinds:** `problems/`, `ideas/`, `experiments/`, `plans/` and `bugs/` beside `features/`. `records:` adds, changes or removes kinds. The `records` check replaces `features`.
- **Live experiments:** any record can set `experiment: true`, then `outcome: retained | discarded | retried` with a `## Result`.
- **Custom connectors:** `connectors:` names any tool, how it is reached and its key names, read-only.

### Changed

- **BREAKING:** `pipeline:` is now `pipelines: { default: [...] }`, and `space:` is now `product:`, with `team:` beside it.
- **BREAKING:** a verdict is now `## Verdict` on the record it judged, written by `canon verdict`, and `scripts/log-verdict.mjs` is gone. `canon learn` reads the records. A request with no record becomes an Idea.
- **BREAKING:** an approval is now `approvals:` on a record: `canon approve <stage> --record <id>`, in a terminal. The `pipeline` check is per record, and `gates.jsonl` is gone.
- **BREAKING:** experiments moved from `features/` (`type: experiment`) to `experiments/`, `EXP-NNNN`.
- `canon flow` counts custom stages by their `done` paths, instead of failing on them.

### Fixed

- `canon flow`: a live web surface counts every commit it has deployed, not only what its last tag holds.

## 0.26.0 — 2026-10-31

### Changed

- **BREAKING: the config moved.** `.claude/canon.yaml` is now `.context/context.yaml`,
  and `canon.local.yaml` is `.context/context.local.yaml`. A repo still holding the old
  file gets an error that says where to move it. `context-layout` allows both files at
  the `.context/` root.

## 0.25.1 — 2026-10-30

### Fixed

- The Architecture map has arrows, so a path shows which way it travels.

## 0.25.0 — 2026-10-30

### Changed

- **The Architecture view is one page about architecture and cost.** It draws
  `.context/architecture/architecture.json`: headline numbers, a map with a path per
  user action, cost with a basis for every figure, growth, what breaks, where data
  goes and what is not known. Replaces the 0.24.0 diagram tabs. Format and rules are
  in the new `architecture-page` standard.
- The `diagrams` check is now `architecture-page`. It fails a cost with no basis or
  source, and a figure marked unknown, and warns after 90 days without a check.

## 0.24.0 — 2026-10-30

### Added

- **Architecture in the shell's top bar.** `canon ui` draws each repo's
  `.context/architecture/*.json`, one tab per diagram. From disk the item is off,
  because a browser refuses `fetch` on `file://`.
- **`.context/architecture/` is an allowed folder**, the one home of a repo's
  diagrams. A new `diagrams` check fails bad JSON and connections to parts that do
  not exist, and warns on diagrams still in `wiki/concepts/architecture/`.

### Fixed

- A website design no longer loses its right side on a narrow window. A frame wider
  than the canvas keeps its width and shrinks whole.

## 0.23.2 — 2026-10-30

### Changed

- **`canon wiki` starts in about 20 seconds, not over a minute.** It no longer draws a
  social card image for every page, which a local site never uses, and no longer
  runs `canon check --all` for a report page. Run `canon check --all` for that report.

## 0.23.1 — 2026-10-30

### Fixed

- `canon check` no longer reads the links in a component's definition as links
  from its board, which failed sets whose nav or footer component links to pages.

## 0.23.0 — 2026-10-30

### Changed

- **A component is one HTML file.** Its definition moves from
  `components/<id>.js` into the `<head>` of its board, `components/<id>.html`,
  and a page reads it through a hidden frame. `canon check` no longer reads
  `components/*.js`, so a set must move its definitions when it takes this release.
- **A set opens from `file:///` again.** It holds one `shell.js`, canon's loader
  pointed at `@freetesh/canon@0` on unpkg. `canon ui` and sites that publish sets
  still put their own in its place. `canon check` now fails only on a copied
  `_shell/`.

## 0.22.0 — 2026-10-30

### Changed

- **A design set holds none of canon's shell — no `shell.js` either.** `canon ui`
  serves `shell.js` from canon, so a set no longer pins a canon version and
  nothing needs bumping after a release. A site that publishes sets writes
  each `shell.js` itself from canon's `shell/loader.js`. `canon check` fails on
  a leftover `shell.js`, as it does on a copied `_shell/`. A page opened
  straight from disk now has no shell: open sets with `canon ui`.
- **`babul.js` is now `design.js`.** A design set's product file is
  `.context/designs/design.js`; its contents are unchanged. `canon ui`, the
  shell and `canon check` read only `design.js`.

## 0.21.0 — 2026-10-30

### Added

- **`canon update`** moves the CLI (npm or pnpm global) and the Claude Code
  plugin to the latest release, then runs `canon sync` in the repo. A git
  checkout is left to `git pull`.
  It never moves an install back to an older release.

### Changed

- **`cli/src` is one folder per feature**: its logic beside a
  `<command>.command.ts` per command. `commands/` is gone.
- **canon names no product.** Test fixtures, comments and the demo use
  made-up names, and a test fails when a tracked file names a repo beside it.

### Removed

- python3. `canon flow` now runs in TypeScript and reads release.yml with the
  yaml package instead of Ruby; canon needs only Node, git and qmd.
- The Python design checker. `canon check` now runs the same checks in
  TypeScript, so checking a design set no longer needs python3. Sets still on
  routes.js are no longer checked; every set is a Babul set.
- `canon arch-set`. It wrote architecture screens into routes.js, which no
  design set has used since sets became Babul sets.
- The plugin evals that ran on real product repos, and their scaffold. The
  fixture-product evals stay.

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
  product names the source (`copies.source: ../source-app`) and the sets it uses.
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
