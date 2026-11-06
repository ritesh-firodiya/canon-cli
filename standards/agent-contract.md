# Agent contract

What every coding agent does in a canon repo: before, during and after work. A team
can replace this file with its own `agent-contract.md` in a configured standards
folder.

## Before starting

1. Read the repo's `CLAUDE.md` or `AGENTS.md`: its stack, its layout, its own rules.
   It points to `.context/`; without that pointer an agent never finds it.
2. Read `.context/README.md` and the pages it lists, in order: purpose, glossary,
   how to run it.
3. Read `.context/tasks.md`. The top item of `## Now` is the next action.
4. For a non-trivial request, run `weigh` first (`/canon-process:weigh`).

## While working

- **Facts before answers.** A claim in the request is not a fact. Check it, or say
  it is not checked (C-01).
- **Put things where they belong.** Product material goes in the `.context/` folder
  that owns it (`context.md`), written as `writing.md` says.
- **Nothing new at the root.** No `docs/` or `wireframes/` folder, no `TODO.md`,
  `STATUS.md` or `SETUP.md`. Where they go: `context.md`, "Repo root".
- **Never hand-edit generated files.** Change the source and generate again.
- **Names:** lowercase kebab-case unless the language says otherwise; the repo's
  current name, never an old one.
- **Plain words** in replies, short sentences (C-11).

## Comments

A comment says **why**, never how. It records what the code cannot show: a
constraint, a trade-off, a bug it prevents. If it repeats the next line, delete it.

```ts
// Good: the reason is invisible in the code.
// Prune only. Recomputing here would discard the user's per-pack choices
// on every launch, which is the bug this replaced.
state.selectedPackIds = prunePackIds(...);

// Bad: it narrates the code.
// Loop over the packs and filter out the locked ones
```

No divider comments, no changelog comments, no comment that repeats a function's
name.

## Before calling work done

1. Fix `CLAUDE.md` and every `.context/` page the change made wrong. Add a page only
   if an agent would get something wrong without it.
2. Run the repo's own lint, typecheck and tests.
3. Run `canon check`. It also runs every checker the repo lists under `commands:`.
4. Delete the finished task from `tasks.md`.
